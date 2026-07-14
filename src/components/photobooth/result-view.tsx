'use client'

import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Share2, RotateCcw, Sparkles,
  Camera, Copy, Check, Home, GalleryHorizontalEnd,
  Save, Pen, Eraser, Trash2, Search, Loader2, X,
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
  x: number
  y: number
  scale: number
}
interface GiphySticker {
  id: string
  url: string
  preview: string
  width: number
  height: number
}

// ─── Constants ───────────────────────────────────────────────────────────────
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_KEY || 'bS0cRf1KVChzdHqPyCXFfpZmgSvooUWB'
const STICKER_SUGGESTIONS = ['love', 'cute', 'funny', 'party', 'flowers', 'cats', 'fire', 'vibes']
const DRAW_COLORS = ['#ffffff','#000000','#ff3b5c','#ff9500','#ffcc02','#34c759','#30b0c7','#007aff','#af52de','#ff2d55']
const DRAW_SIZES = [3, 6, 12, 20, 32] // actual pixel sizes at 448px base

export default function ResultView() {
  const {
    finalStripData, aiCaption, roomCode, username, userId, sessionId,
    capturedPhotos, setView, resetSession, setAiCaption,
  } = useAppStore()

  const [tool, setTool] = useState<'sticker' | 'draw' | 'erase'>('sticker')
  const [color, setColor] = useState('#ff3b5c')
  const [brushSize, setBrushSize] = useState(1)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)

  // Giphy
  const [stickerQuery, setStickerQuery] = useState('')
  const [stickerResults, setStickerResults] = useState<GiphySticker[]>([])
  const [stickerLoading, setStickerLoading] = useState(false)
  const [stickerSearched, setStickerSearched] = useState(false)
  const stickerImageCache = useRef<Map<string, HTMLImageElement>>(new Map())

  // Drag
  const [draggingSticker, setDraggingSticker] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Actions
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false)
  const [copied, setCopied] = useState(false)

  // Refs
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stripImgRef = useRef<HTMLImageElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([])
  const remoteStrokesRef = useRef<Map<string, { x: number; y: number }[]>>(new Map())
  const strokesRef = useRef<Stroke[]>([])
  const stickersRef = useRef<Sticker[]>([])

  const socket = getSocket()

  useEffect(() => { strokesRef.current = strokes }, [strokes])
  useEffect(() => { stickersRef.current = stickers }, [stickers])

  // paintStroke defined before redraw so redraw can call it
  const paintStroke = (
    ctx: CanvasRenderingContext2D,
    pts: { x: number; y: number }[],
    col: string,
    sizeIdx: number,
    cw: number,
    ch: number,
  ) => {
    if (pts.length < 2) return
    const scale = cw / 448
    ctx.save()
    if (col === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = col
    }
    ctx.lineWidth = DRAW_SIZES[sizeIdx] * scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0].x * cw, pts[0].y * ch)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * cw, pts[i].y * ch)
    }
    ctx.stroke()
    ctx.restore()
  }

  // ── Redraw canvas ──
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

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)

    activeStrokes.forEach(s => paintStroke(ctx, s.points, s.color, s.size, canvas.width, canvas.height))

    remoteStrokesRef.current.forEach((pts, uid) => {
      if (pts.length < 2) return
      const hue = [...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
      paintStroke(ctx, pts, `hsl(${hue},80%,55%)`, 2, canvas.width, canvas.height)
    })

    activeStickers.forEach(s => {
      const px = s.x * canvas.width
      const py = s.y * canvas.height
      const isUrl = s.emoji.startsWith('http') || s.emoji.startsWith('blob')
      if (isUrl) {
        const cachedImg = stickerImageCache.current.get(s.id)
          || [...stickerImageCache.current.values()].find(i => i.src === s.emoji)
        if (cachedImg && cachedImg.complete) {
          const baseSize = 130 * s.scale * (canvas.width / 448)
          const aspect = cachedImg.naturalHeight / cachedImg.naturalWidth
          ctx.drawImage(cachedImg, px - baseSize / 2, py - (baseSize * aspect) / 2, baseSize, baseSize * aspect)
        }
      } else {
        const size = 64 * s.scale * (canvas.width / 448)
        ctx.font = `${size}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.emoji, px, py)
      }
    })
  }, [])

  useEffect(() => { redraw(strokes, stickers) }, [strokes, stickers, redraw])

  // ── Load strip image (after redraw is defined) ──
  useEffect(() => {
    if (!finalStripData) return
    const img = new Image()
    img.onload = () => { stripImgRef.current = img; redraw() }
    img.src = finalStripData
  }, [finalStripData, redraw])


  // ── Pointer helpers ──
  function canvasFraction(e: React.PointerEvent) {
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === 'sticker') { setSelectedSticker(null); return }
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

    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pts = currentStrokeRef.current
    if (pts.length < 2) return
    const last = pts[pts.length - 2]
    const cur = pts[pts.length - 1]
    ctx.save()
    // FIX: eraser must use destination-out, not just a color
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.lineWidth = DRAW_SIZES[brushSize] * (canvas.width / 448)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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
    if (pts.length > 1) {
      setStrokes(prev => [...prev, {
        points: pts,
        color: tool === 'erase' ? 'erase' : color,
        size: brushSize,
        userId: userId || 'me',
      }])
    }
    socket.emit('strip-draw-end', { userId: userId || 'me' })
  }

  // ── Giphy ──
  const searchGiphy = async (q: string) => {
    if (!q.trim()) return
    setStickerLoading(true)
    setStickerSearched(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
      )
      const data = await res.json()
      setStickerResults((data.data || []).map((item: any) => ({
        id: item.id,
        url: item.images.original.url,
        preview: item.images.fixed_width_small.url,
        width: Number(item.images.original.width),
        height: Number(item.images.original.height),
      })))
    } catch { setStickerResults([]) }
    setStickerLoading(false)
  }

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

  async function placeSticker(giphy: GiphySticker) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    await loadStickerImage(giphy)
    const s: Sticker = { id, emoji: giphy.url, x: 0.5, y: 0.5, scale: 1 }
    setStickers(prev => [...prev, s])
    socket.emit('strip-sticker-add', { ...s, giphyId: giphy.id, giphyUrl: giphy.url })
  }

  function removeSticker(id: string) {
    setStickers(prev => prev.filter(s => s.id !== id))
    setSelectedSticker(null)
    socket.emit('strip-sticker-remove', { id })
  }

  // ── Sticker drag ──
  function onStickerPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedSticker(id)
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
  function onStickerPointerUp() { setDraggingSticker(null) }

  // ── Socket listeners ──
  useEffect(() => {
    const onDrawStart = (d: any) => {
      remoteStrokesRef.current.set(d.userId, [{ x: d.x, y: d.y }])
    }
    const onDrawMove = (d: any) => {
      const pts = remoteStrokesRef.current.get(d.userId) || []
      pts.push({ x: d.x, y: d.y })
      remoteStrokesRef.current.set(d.userId, pts)
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
      const hue = [...d.userId].reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360
      setStrokes(prev => [...prev, { points: pts, color: `hsl(${hue},80%,55%)`, size: 2, userId: d.userId }])
    }
    const onStickerAdd = async (data: Sticker & { giphyUrl?: string }) => {
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
    const onStickerRemove = (d: { id: string }) => {
      setStickers(prev => prev.filter(s => s.id !== d.id))
    }
    const onClearDrawing = () => { setStrokes([]) }

    socket.on('strip-draw-start', onDrawStart)
    socket.on('strip-draw-move', onDrawMove)
    socket.on('strip-draw-end', onDrawEnd)
    socket.on('strip-sticker-add', onStickerAdd)
    socket.on('strip-sticker-move', onStickerMove)
    socket.on('strip-sticker-remove', onStickerRemove)
    socket.on('strip-clear-drawing', onClearDrawing)
    return () => {
      socket.off('strip-draw-start', onDrawStart)
      socket.off('strip-draw-move', onDrawMove)
      socket.off('strip-draw-end', onDrawEnd)
      socket.off('strip-sticker-add', onStickerAdd)
      socket.off('strip-sticker-move', onStickerMove)
      socket.off('strip-sticker-remove', onStickerRemove)
      socket.off('strip-clear-drawing', onClearDrawing)
    }
  }, [socket])

  // ── Download ──
  const handleDownload = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    redraw(strokesRef.current, stickersRef.current)
    setTimeout(() => {
      const link = document.createElement('a')
      link.download = `snaptogether-${roomCode}-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
      toast.success('HD strip saved! 🎉')
    }, 120)
  }

  const handleShare = async () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(), 'image/png', 1.0)
      )
      await navigator.share({ title: 'SnapTogether Memory', files: [new File([blob], 'snaptogether.png', { type: 'image/png' })] })
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/join/${roomCode}`)
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
      setIsSaved(true)
      toast.success('Memory saved!')
    } catch { toast.error('Failed to save memory') }
    setIsSaving(false)
  }

  const handleNewCaption = async () => {
    setIsGeneratingCaption(true)
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', context: `${capturedPhotos.length} photos` }),
      })
      const data = await res.json()
      setAiCaption(data.caption)
    } catch { toast.error('Failed') }
    setIsGeneratingCaption(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e12] text-white">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/70 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 h-13 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Decorate Your Strip</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDownload} className="text-white/60 hover:text-white text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> Save HD
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('gallery')} className="text-white/60 hover:text-white">
              <GalleryHorizontalEnd className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 py-4 flex flex-col lg:flex-row gap-4">

        {/* ── LEFT: Sticker panel (on desktop) / top (on mobile) ── */}
        <div className="lg:w-72 flex flex-col gap-3 order-2 lg:order-1">

          {/* Giphy search — ALWAYS visible at top */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold text-white/50 tracking-wider uppercase">Stickers</span>
                <span className="text-[9px] text-white/25">Powered by GIPHY</span>
              </div>

              {/* Search bar */}
              <div className="flex gap-2">
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
                  className="px-3 py-2 bg-primary rounded-xl text-xs font-medium disabled:opacity-40 shrink-0"
                >
                  {stickerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Go'}
                </button>
              </div>

              {/* Suggestion tags */}
              {!stickerSearched && (
                <div className="flex flex-wrap gap-1.5 mt-2">
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
            </div>

            {/* Results */}
            {stickerLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-white/40" />
              </div>
            )}
            {!stickerLoading && stickerSearched && stickerResults.length === 0 && (
              <p className="text-center text-white/30 text-xs py-6">No stickers found.</p>
            )}
            {!stickerLoading && stickerResults.length > 0 && (
              <div className="grid grid-cols-4 gap-1 p-2 max-h-64 lg:max-h-96 overflow-y-auto">
                {stickerResults.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => placeSticker(sticker)}
                    className="aspect-square rounded-lg overflow-hidden bg-white/5 hover:bg-white/15 hover:scale-105 transition-all active:scale-95 p-1"
                  >
                    <img src={sticker.preview} alt="" className="w-full h-full object-contain" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Placed stickers list — with remove button */}
          {stickers.length > 0 && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-3">
              <p className="text-[10px] text-white/40 font-semibold tracking-wider uppercase mb-2">Placed stickers</p>
              <div className="flex flex-wrap gap-2">
                {stickers.map((s, i) => {
                  const isUrl = s.emoji.startsWith('http')
                  return (
                    <div key={s.id} className="relative group">
                      <button
                        onClick={() => setSelectedSticker(s.id === selectedSticker ? null : s.id)}
                        className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${selectedSticker === s.id ? 'border-primary' : 'border-white/10'}`}
                      >
                        {isUrl ? (
                          <img src={s.emoji} alt="" className="w-full h-full object-contain bg-white/5" />
                        ) : (
                          <span className="text-xl flex items-center justify-center h-full">{s.emoji}</span>
                        )}
                      </button>
                      {/* Remove button */}
                      <button
                        onClick={() => removeSticker(s.id)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Draw tools */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-3 flex flex-col gap-3">
            {/* Tool switcher */}
            <div className="grid grid-cols-3 gap-1 bg-white/5 rounded-xl p-1">
              {([
                { id: 'sticker' as const, icon: '🎭', label: 'Sticker' },
                { id: 'draw' as const, icon: <Pen className="w-3.5 h-3.5" />, label: 'Draw' },
                { id: 'erase' as const, icon: <Eraser className="w-3.5 h-3.5" />, label: 'Erase' },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                    tool === t.id ? 'bg-primary text-white shadow' : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Color picker — shown for draw */}
            {tool === 'draw' && (
              <div>
                <p className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">Color</p>
                <div className="grid grid-cols-5 gap-2">
                  {DRAW_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="relative w-full aspect-square rounded-lg border-2 transition-all hover:scale-110"
                      style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }}
                    >
                      {color === c && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brush size — visual dots */}
            {(tool === 'draw' || tool === 'erase') && (
              <div>
                <p className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">
                  {tool === 'erase' ? 'Eraser size' : 'Brush size'}
                </p>
                <div className="flex items-center justify-between px-1">
                  {DRAW_SIZES.map((size, i) => (
                    <button
                      key={i}
                      onClick={() => setBrushSize(i)}
                      className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                        brushSize === i ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-white/10'
                      }`}
                    >
                      <div
                        className="rounded-full"
                        style={{
                          width: Math.min(6 + i * 5, 28),
                          height: Math.min(6 + i * 5, 28),
                          backgroundColor: tool === 'erase' ? '#ffffff40' : (brushSize === i ? color : '#ffffff50'),
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear drawings */}
            <button
              onClick={() => { setStrokes([]); socket.emit('strip-clear-drawing') }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-red-500/15 text-white/40 hover:text-red-400 text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all drawings
            </button>
          </div>
        </div>

        {/* ── CENTER: Strip canvas ── */}
        <div className="flex-1 flex flex-col items-center gap-4 order-1 lg:order-2">
          {/* Strip frame — constrained height so all 4 photos visible */}
          <div
            ref={containerRef}
            className="relative w-full max-w-sm lg:max-w-xs xl:max-w-sm select-none mx-auto"
            style={{ cursor: tool === 'draw' || tool === 'erase' ? 'crosshair' : 'default' }}
          >
            {/* Outer frame */}
            <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black">
              <canvas
                ref={drawCanvasRef}
                className="w-full h-auto block"
                style={{ touchAction: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
            </div>

            {/* Sticker overlay */}
            {stickers.map(s => {
              const isUrl = s.emoji.startsWith('http') || s.emoji.startsWith('blob')
              const isSelected = selectedSticker === s.id
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
                    zIndex: 10,
                  }}
                  onPointerDown={e => onStickerPointerDown(e, s.id)}
                  onPointerMove={e => onStickerPointerMove(e, s.id)}
                  onPointerUp={onStickerPointerUp}
                >
                  {isUrl ? (
                    <img src={s.emoji} alt="sticker" className="w-14 h-14 object-contain pointer-events-none drop-shadow-lg" draggable={false} />
                  ) : (
                    <span className="text-4xl drop-shadow-lg" style={{ lineHeight: 1 }}>{s.emoji}</span>
                  )}
                  {/* Remove button on selected sticker */}
                  {isSelected && (
                    <button
                      onPointerDown={e => { e.stopPropagation(); removeSticker(s.id) }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-20"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action buttons below strip */}
          <div className="w-full max-w-sm lg:max-w-xs xl:max-w-sm flex flex-col gap-2">
            <Button size="lg" onClick={handleDownload} className="w-full rounded-2xl bg-primary hover:bg-primary/90">
              <Download className="w-4 h-4 mr-2" /> Download HD
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleShare} className="rounded-xl border-white/15 text-white hover:bg-white/10">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveMemory}
                disabled={isSaving || isSaved}
                className={`rounded-xl border-white/15 text-white hover:bg-white/10 ${isSaved ? 'border-green-500/40 text-green-400' : ''}`}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isSaved ? <><Check className="w-4 h-4 mr-1" />Saved</>
                  : <><Save className="w-4 h-4 mr-2" />Gallery</>}
              </Button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Caption + room info ── */}
        <div className="lg:w-56 flex flex-col gap-3 order-3">
          {/* AI Caption */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-white/50 tracking-wider uppercase">Caption</span>
            </div>
            <p className="text-sm leading-snug mb-3 text-white/90">{aiCaption || 'A moment worth remembering ✨'}</p>
            <button
              onClick={handleNewCaption}
              disabled={isGeneratingCaption}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              {isGeneratingCaption
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RotateCcw className="w-3 h-3" />}
              New caption
            </button>
          </div>

          {/* Room code */}
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
            <p className="text-[9px] text-white/30 mb-1 tracking-widest uppercase">Room</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-base font-bold tracking-widest">{roomCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="p-1 rounded-lg hover:bg-white/10">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/40" />}
              </button>
            </div>
          </div>

          {/* New session */}
          <button onClick={resetSession} className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center justify-center gap-1.5 py-2">
            <Home className="w-3.5 h-3.5" /> New session
          </button>
        </div>

      </main>
    </div>
  )
}