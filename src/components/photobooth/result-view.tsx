'use client'

import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Share2, RotateCcw, Sparkles,
  Camera, Copy, Check, Home, GalleryHorizontalEnd,
  Save, Pen, Eraser, Trash2, Search, Loader2,
  Minus, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '@/lib/socket'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Stroke {
  points: { x: number; y: number }[]
  color: string
  size: number
  userId: string
}
interface Sticker {
  id: string
  emoji: string
  x: number   // 0..1 fraction of canvas width
  y: number   // 0..1 fraction of canvas height
  scale: number
}

// ─── Sticker palette ─────────────────────────────────────────────────────────
// Giphy sticker API — uses your existing key from Groove Together
// Replace with your own key from developers.giphy.com (free)
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_KEY || 'bS0cRf1KVChzdHqPyCXFfpZmgSvooUWB'
const GIPHY_LIMIT = 20

// Quick-access suggestion tags shown before user searches
const STICKER_SUGGESTIONS = ['love', 'cute', 'funny', 'party', 'flowers', 'cats', 'fire', 'vibes']

interface GiphySticker {
  id: string
  url: string       // original GIF URL
  preview: string   // small preview URL
  width: number
  height: number
}
const DRAW_COLORS = ['#ffffff','#000000','#ff3b5c','#ff9500','#ffcc02','#34c759','#30b0c7','#007aff','#af52de','#ff2d55']
const DRAW_SIZES = [2, 4, 8, 14, 22]

export default function ResultView() {
  const {
    finalStripData, aiCaption, roomCode, username, userId, sessionId,
    capturedPhotos, setView, resetSession, setAiCaption, setFinalStripData,
  } = useAppStore()

  // ── editor state ──
  const [tool, setTool] = useState<'draw' | 'erase' | 'sticker'>('sticker')
  const [color, setColor] = useState('#ff3b5c')
  const [brushSize, setBrushSize] = useState(1) // index into DRAW_SIZES
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [stickerQuery, setStickerQuery] = useState('')
  const [stickerResults, setStickerResults] = useState<GiphySticker[]>([])
  const [stickerLoading, setStickerLoading] = useState(false)
  const [stickerSearched, setStickerSearched] = useState(false)
  // Cache of loaded Image objects for canvas drawing (keyed by sticker id)
  const stickerImageCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const [draggingSticker, setDraggingSticker] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // ── other ui ──
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── refs ──
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stripImgRef = useRef<HTMLImageElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([])
  const remoteStrokesRef = useRef<Map<string, { x: number; y: number }[]>>(new Map())
  const animFrameRef = useRef<number>(0)

  const socket = getSocket()

  // ── load strip image once ──
  useEffect(() => {
    if (!finalStripData) return
    const img = new Image()
    img.onload = () => { stripImgRef.current = img; redraw() }
    img.src = finalStripData
  }, [finalStripData])

  // Keep latest strokes/stickers in refs so redraw always uses current values
  // even when called from handleDownload (which can't close over state reliably)
  const strokesRef = useRef<Stroke[]>([])
  const stickersRef = useRef<Sticker[]>([])
  useEffect(() => { strokesRef.current = strokes }, [strokes])
  useEffect(() => { stickersRef.current = stickers }, [stickers])

  // ── redraw everything ──
  // Uses refs (not state) so it's always current even in async contexts like download
  const redraw = useCallback((
    overrideStrokes?: Stroke[],
    overrideStickers?: Sticker[],
  ) => {
    const canvas = drawCanvasRef.current
    const img = stripImgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const activeStrokes = overrideStrokes ?? strokesRef.current
    const activeStickers = overrideStickers ?? stickersRef.current

    // canvas logical size = strip image size (HD)
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight

    // draw strip base
    ctx.drawImage(img, 0, 0)

    // draw committed strokes
    activeStrokes.forEach(s => paintStroke(ctx, s.points, s.color, s.size, canvas.width))

    // draw remote in-progress strokes
    remoteStrokesRef.current.forEach((pts, uid) => {
      if (pts.length < 2) return
      const hue = [...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
      paintStroke(ctx, pts, `hsl(${hue},80%,55%)`, DRAW_SIZES[2], canvas.width)
    })

    // Draw stickers: if emoji field is a URL (Giphy), use drawImage; else fillText
    activeStickers.forEach(s => {
      const px = s.x * canvas.width
      const py = s.y * canvas.height
      const isUrl = s.emoji.startsWith('http') || s.emoji.startsWith('blob')
      if (isUrl) {
        const img = stickerImageCache.current.get(s.id)
          || [...stickerImageCache.current.values()].find(i => i.src === s.emoji)
        if (img && img.complete) {
          const baseSize = 120 * s.scale * (canvas.width / 448)
          const aspect = img.naturalHeight / img.naturalWidth
          const w = baseSize
          const h = baseSize * aspect
          ctx.drawImage(img, px - w / 2, py - h / 2, w, h)
        }
      } else {
        // Legacy emoji fallback
        const size = 60 * s.scale * (canvas.width / 448)
        ctx.font = `${size}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.emoji, px, py)
      }
    })
  }, [])  // stable — reads from refs, no state deps needed

  // Redraw whenever strokes or stickers change
  useEffect(() => { redraw(strokes, stickers) }, [strokes, stickers, redraw])

  function paintStroke(
    ctx: CanvasRenderingContext2D,
    pts: { x: number; y: number }[],
    col: string,
    sizeIdx: number,
    cw: number,
  ) {
    if (pts.length < 2) return
    const scale = cw / 448
    ctx.save()
    ctx.strokeStyle = col
    ctx.lineWidth = DRAW_SIZES[sizeIdx] * scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = col === 'erase' ? 'destination-out' : 'source-over'
    ctx.beginPath()
    ctx.moveTo(pts[0].x * cw, pts[0].y * (ctx.canvas.height))
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * cw, pts[i].y * ctx.canvas.height)
    }
    ctx.stroke()
    ctx.restore()
  }

  // ── canvas pointer helpers ──
  function canvasFraction(e: React.PointerEvent): { x: number; y: number } {
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === 'sticker') return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const pt = canvasFraction(e)
    currentStrokeRef.current = [pt]
    socket.emit('strip-draw-start', {
      x: pt.x, y: pt.y,
      color: tool === 'erase' ? 'erase' : color,
      size: brushSize,
      userId: userId || 'me',
    })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDrawingRef.current) return
    const pt = canvasFraction(e)
    currentStrokeRef.current.push(pt)
    socket.emit('strip-draw-move', { x: pt.x, y: pt.y, userId: userId || 'me' })

    // optimistic local draw (light preview on display canvas)
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pts = currentStrokeRef.current
    if (pts.length < 2) return
    const last = pts[pts.length - 2]
    const cur = pts[pts.length - 1]
    ctx.save()
    ctx.strokeStyle = tool === 'erase' ? 'rgba(0,0,0,1)' : color
    ctx.lineWidth = DRAW_SIZES[brushSize] * (canvas.width / 448)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over'
    ctx.beginPath()
    ctx.moveTo(last.x * canvas.width, last.y * canvas.height)
    ctx.lineTo(cur.x * canvas.width, cur.y * canvas.height)
    ctx.stroke()
    ctx.restore()
  }

  function onPointerUp() {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const pts = [...currentStrokeRef.current]
    currentStrokeRef.current = []
    setStrokes(prev => [...prev, {
      points: pts,
      color: tool === 'erase' ? 'erase' : color,
      size: brushSize,
      userId: userId || 'me',
    }])
    socket.emit('strip-draw-end', { userId: userId || 'me' })
  }

  // ── Giphy sticker search ──
  const searchGiphy = async (q: string) => {
    if (!q.trim()) return
    setStickerLoading(true)
    setStickerSearched(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${GIPHY_LIMIT}&rating=g`
      )
      const data = await res.json()
      const results: GiphySticker[] = (data.data || []).map((item: any) => ({
        id: item.id,
        // Use downsized_medium for display (smaller), original for canvas
        url: item.images.original.url,
        preview: item.images.fixed_width_small.url,
        width: Number(item.images.original.width),
        height: Number(item.images.original.height),
      }))
      setStickerResults(results)
    } catch {
      setStickerResults([])
    }
    setStickerLoading(false)
  }

  // Preload sticker image into cache so canvas can draw it synchronously
  const loadStickerImage = (sticker: GiphySticker): Promise<HTMLImageElement> => {
    if (stickerImageCache.current.has(sticker.id)) {
      return Promise.resolve(stickerImageCache.current.get(sticker.id)!)
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { stickerImageCache.current.set(sticker.id, img); resolve(img) }
      img.onerror = reject
      img.src = sticker.url
    })
  }

  // ── sticker placement ──
  async function placeSticker(giphy: GiphySticker) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    // Pre-load image so redraw can use it immediately
    await loadStickerImage(giphy)
    const s: Sticker = {
      id,
      emoji: giphy.url,      // reuse emoji field to store the URL
      x: 0.5, y: 0.5, scale: 1,
    }
    setStickers(prev => [...prev, s])
    // Send sticker ID + url to partner so they can fetch the same image
    socket.emit('strip-sticker-add', { ...s, giphyId: giphy.id, giphyUrl: giphy.url })
  }

  // sticker drag (mouse/touch on sticker layer)
  function onStickerPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingSticker(id)
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const s = stickers.find(s => s.id === id)!
    setDragOffset({
      x: e.clientX / rect.width - s.x,
      y: e.clientY / rect.height - s.y,
    })
  }
  function onStickerPointerMove(e: React.PointerEvent, id: string) {
    if (draggingSticker !== id) return
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, e.clientX / rect.width - dragOffset.x))
    const ny = Math.max(0, Math.min(1, e.clientY / rect.height - dragOffset.y))
    setStickers(prev => prev.map(s => s.id === id ? { ...s, x: nx, y: ny } : s))
    socket.emit('strip-sticker-move', { id, x: nx, y: ny })
  }
  function onStickerPointerUp() {
    setDraggingSticker(null)
  }

  // ── socket listeners ──
  useEffect(() => {
    const onDrawStart = (d: any) => {
      remoteStrokesRef.current.set(d.userId, [{ x: d.x, y: d.y }])
    }
    const onDrawMove = (d: any) => {
      const pts = remoteStrokesRef.current.get(d.userId) || []
      pts.push({ x: d.x, y: d.y })
      remoteStrokesRef.current.set(d.userId, pts)
      // lightweight redraw just the incremental segment
      const canvas = drawCanvasRef.current
      if (!canvas || pts.length < 2) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const hue = [...d.userId].reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
      const last = pts[pts.length - 2], cur = pts[pts.length - 1]
      ctx.save()
      ctx.strokeStyle = `hsl(${hue},80%,55%)`
      ctx.lineWidth = DRAW_SIZES[2] * (canvas.width / 448)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(last.x * canvas.width, last.y * canvas.height)
      ctx.lineTo(cur.x * canvas.width, cur.y * canvas.height)
      ctx.stroke()
      ctx.restore()
    }
    const onDrawEnd = (d: any) => {
      const pts = remoteStrokesRef.current.get(d.userId) || []
      remoteStrokesRef.current.delete(d.userId)
      // commit remote stroke (hue-based colour, fixed size)
      const hue = [...d.userId].reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
      setStrokes(prev => [...prev, {
        points: pts,
        color: `hsl(${hue},80%,55%)`,
        size: 2,
        userId: d.userId,
      }])
    }
    const onStickerAdd = async (data: Sticker & { giphyId?: string; giphyUrl?: string }) => {
      // If partner placed a Giphy sticker, pre-load the image so canvas can draw it
      if (data.giphyUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => stickerImageCache.current.set(data.id, img)
        img.src = data.giphyUrl
      }
      setStickers(prev => [...prev, data])
    }
    const onStickerMove = (d: { id: string; x: number; y: number }) => {
      setStickers(prev => prev.map(s => s.id === d.id ? { ...s, x: d.x, y: d.y } : s))
    }
    const onClearDrawing = () => { setStrokes([]); redraw() }

    socket.on('strip-draw-start', onDrawStart)
    socket.on('strip-draw-move', onDrawMove)
    socket.on('strip-draw-end', onDrawEnd)
    socket.on('strip-sticker-add', onStickerAdd)
    socket.on('strip-sticker-move', onStickerMove)
    socket.on('strip-clear-drawing', onClearDrawing)
    return () => {
      socket.off('strip-draw-start', onDrawStart)
      socket.off('strip-draw-move', onDrawMove)
      socket.off('strip-draw-end', onDrawEnd)
      socket.off('strip-sticker-add', onStickerAdd)
      socket.off('strip-sticker-move', onStickerMove)
      socket.off('strip-clear-drawing', onClearDrawing)
    }
  }, [socket, redraw])

  // ── HD download ──
  const handleDownload = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    // Pass current stickers/strokes explicitly so the download canvas
    // always reflects the latest state (BUG-10 fix)
    redraw(strokesRef.current, stickersRef.current)
    // Use setTimeout instead of rAF — rAF fires before the canvas
    // context finishes flushing on some mobile browsers
    setTimeout(() => {
      const link = document.createElement('a')
      link.download = `snaptogether-${roomCode}-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
      toast.success('HD strip saved! 🎉')
    }, 100)
  }

  const handleShare = async () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(), 'image/png', 1.0)
      )
      const file = new File([blob], 'snaptogether-strip.png', { type: 'image/png' })
      if (navigator.share) {
        await navigator.share({ title: 'SnapTogether Memory', files: [file] })
      } else {
        throw new Error('no share')
      }
    } catch {
      navigator.clipboard.writeText(`Check out my SnapTogether memory! Room: ${roomCode}`)
      toast.success('Link copied!')
    }
  }

  const handleSaveMemory = async () => {
    if (!sessionId || !userId || isSaving) return
    setIsSaving(true)
    try {
      const canvas = drawCanvasRef.current
      const stripData = canvas ? canvas.toDataURL('image/jpeg', 0.92) : finalStripData
      for (const photo of capturedPhotos) {
        await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, uploaderId: userId, imageData: photo.dataUrl, filter: photo.filter, order: photo.order }),
        })
      }
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId, stripData, caption: aiCaption, isFavorite: false }),
      })
      await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      setIsSaved(true)
      toast.success('Memory saved!')
    } catch {
      toast.error('Failed to save memory')
    }
    setIsSaving(false)
  }

  const handleNewCaption = async () => {
    setIsGeneratingCaption(true)
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', context: `${capturedPhotos.length} photos in a shared photobooth session.` }),
      })
      const data = await res.json()
      setAiCaption(data.caption)
    } catch { toast.error('Failed to generate caption') }
    setIsGeneratingCaption(false)
  }

  const handleClearDrawing = () => {
    setStrokes([])
    socket.emit('strip-clear-drawing')
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e12] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Decorate Your Strip</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView('gallery')} className="text-white/60 hover:text-white">
            <GalleryHorizontalEnd className="w-4 h-4 mr-1" />
            Gallery
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-3 py-4 flex flex-col lg:flex-row gap-4">

        {/* ── Left: canvas editor ── */}
        <div className="flex-1 flex flex-col gap-3">

          {/* Tool bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tool switcher */}
            <div className="flex rounded-xl overflow-hidden border border-white/10">
              {([
                { id: 'sticker', icon: <span className="text-base">🎭</span>, label: 'Sticker' },
                { id: 'draw',    icon: <Pen className="w-4 h-4" />,          label: 'Draw' },
                { id: 'erase',   icon: <Eraser className="w-4 h-4" />,       label: 'Erase' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    tool === t.id ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Draw options */}
            {(tool === 'draw') && (
              <>
                <div className="flex gap-1">
                  {DRAW_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2 py-1">
                  <button onClick={() => setBrushSize(s => Math.max(0, s - 1))} className="text-white/60 hover:text-white p-0.5"><Minus className="w-3 h-3" /></button>
                  <span className="text-xs text-white/70 w-4 text-center">{DRAW_SIZES[brushSize]}</span>
                  <button onClick={() => setBrushSize(s => Math.min(DRAW_SIZES.length - 1, s + 1))} className="text-white/60 hover:text-white p-0.5"><Plus className="w-3 h-3" /></button>
                </div>
              </>
            )}

            <button
              onClick={handleClearDrawing}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {/* Canvas + sticker overlay */}
          <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden shadow-2xl bg-black select-none"
            style={{ cursor: tool === 'draw' || tool === 'erase' ? 'crosshair' : 'default' }}
          >
            <canvas
              ref={drawCanvasRef}
              className="w-full h-auto block"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />

            {/* Sticker overlay — positioned absolutely over canvas */}
            {stickers.map(s => {
              const isUrl = s.emoji.startsWith('http') || s.emoji.startsWith('blob')
              return (
                <div
                  key={s.id}
                  className="absolute select-none"
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    transform: `translate(-50%, -50%) scale(${s.scale})`,
                    touchAction: 'none',
                    cursor: draggingSticker === s.id ? 'grabbing' : 'grab',
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
                    zIndex: 10,
                  }}
                  onPointerDown={e => onStickerPointerDown(e, s.id)}
                  onPointerMove={e => onStickerPointerMove(e, s.id)}
                  onPointerUp={onStickerPointerUp}
                >
                  {isUrl ? (
                    <img
                      src={s.emoji}
                      alt="sticker"
                      className="w-16 h-16 object-contain pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{s.emoji}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Giphy Sticker picker */}
          <AnimatePresence>
            {tool === 'sticker' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="bg-white/5 rounded-2xl p-3 border border-white/10"
              >
                {/* Search bar */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                    <input
                      type="text"
                      value={stickerQuery}
                      onChange={e => setStickerQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchGiphy(stickerQuery)}
                      placeholder="Search stickers..."
                      className="w-full bg-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:bg-white/15 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => searchGiphy(stickerQuery)}
                    disabled={stickerLoading || !stickerQuery.trim()}
                    className="px-3 py-2 bg-primary rounded-xl text-xs font-medium disabled:opacity-40 transition-opacity"
                  >
                    {stickerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Go'}
                  </button>
                </div>

                {/* Suggestion tags — shown before first search */}
                {!stickerSearched && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {STICKER_SUGGESTIONS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => { setStickerQuery(tag); searchGiphy(tag) }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[10px] text-white/60 hover:text-white transition-colors capitalize"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Results grid */}
                {stickerLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                  </div>
                )}

                {!stickerLoading && stickerSearched && stickerResults.length === 0 && (
                  <p className="text-center text-white/30 text-xs py-4">No stickers found. Try another search.</p>
                )}

                {!stickerLoading && stickerResults.length > 0 && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
                      {stickerResults.map(sticker => (
                        <button
                          key={sticker.id}
                          onClick={() => placeSticker(sticker)}
                          className="relative aspect-square rounded-lg overflow-hidden bg-white/5 hover:bg-white/10 hover:scale-105 transition-all active:scale-95"
                        >
                          <img
                            src={sticker.preview}
                            alt=""
                            className="w-full h-full object-contain p-1"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-white/20 text-center mt-2">Powered by GIPHY</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: actions panel ── */}
        <div className="lg:w-64 flex flex-col gap-4">

          {/* AI Caption */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-white/60">AI CAPTION</span>
            </div>
            <p className="text-sm font-medium leading-snug mb-3">{aiCaption || 'A moment worth remembering ✨'}</p>
            <Button variant="outline" size="sm" onClick={handleNewCaption} disabled={isGeneratingCaption} className="w-full rounded-xl border-white/15 text-white/70 hover:text-white">
              {isGeneratingCaption ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full" />
              ) : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
              New Caption
            </Button>
          </div>

          {/* Room code */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
            <p className="text-[10px] text-white/40 mb-1 tracking-widest">ROOM</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-lg font-bold tracking-widest">{roomCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="p-1 rounded-lg hover:bg-white/10">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={handleDownload} className="w-full rounded-2xl py-5 bg-primary hover:bg-primary/90">
              <Download className="w-5 h-5 mr-2" />
              Download HD
            </Button>
            <Button variant="outline" size="lg" onClick={handleShare} className="w-full rounded-2xl py-5 border-white/15 text-white hover:bg-white/10">
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
            <Button
              variant="outline" size="lg"
              onClick={handleSaveMemory}
              disabled={isSaving || isSaved}
              className={`w-full rounded-2xl py-5 border-white/15 text-white hover:bg-white/10 ${isSaved ? 'border-green-500/40 text-green-400' : ''}`}
            >
              {isSaving ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : isSaved ? (
                <><Check className="w-5 h-5 mr-2" />Saved!</>
              ) : (
                <><Save className="w-5 h-5 mr-2" />Save to Gallery</>
              )}
            </Button>
          </div>

          {/* New session */}
          <button onClick={resetSession} className="text-sm text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5 py-2">
            <Home className="w-4 h-4" /> Start New Session
          </button>
        </div>
      </main>
    </div>
  )
}