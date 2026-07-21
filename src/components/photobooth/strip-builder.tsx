'use client'
import ThemeToggle from '@/components/theme-toggle'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, Reorder } from 'framer-motion'
import { Plus, Sparkles, ArrowLeft, X, GripVertical, LayoutGrid, Frame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { renderStrip } from '@/lib/strip'
import { getSocket } from '@/lib/socket'
import type { CapturedPhoto, StripLayout } from '@/lib/types'

// ── Layout config ──────────────────────────────────────────────────────────────
const LAYOUTS: { id: StripLayout; name: string; desc: string; icon: string; slots: number }[] = [
  { id: 'classic',  name: 'Classic',  desc: 'Vertical film strip',  icon: '🎞️', slots: 4 },
  { id: 'magazine', name: 'Magazine', desc: 'Big hero + side shots', icon: '📰', slots: 4 },
  { id: 'couple',   name: 'Couple',   desc: 'Side-by-side pairs',   icon: '💕', slots: 4 },
  { id: 'memory',   name: 'Memory',   desc: 'Polaroid card style',  icon: '📷', slots: 1 },
]
const LAYOUT_SLOTS: Record<string, number> = Object.fromEntries(LAYOUTS.map(l => [l.id, l.slots]))

// ── Frame config ───────────────────────────────────────────────────────────────
export type FrameId =
  | 'none'
  | 'gallery-portfolio'
  | 'cinema-reel'
  | 'vinyl-album'
  | 'cinematic-storyboard'
  | 'parallel-lines'
  | 'postcard-from-afar'
  | 'sweetheart-candy'
  | 'love-letter'
  | 'vintage-valentine'
  | 'lovers-polaroid'

interface FrameDef {
  id: FrameId
  name: string
  desc: string
  emoji: string
  tag: string
  bg: string
  accent: string
  minPhotos: number
}

const FRAMES: FrameDef[] = [
  { id: 'none',               name: 'No Frame',          desc: 'Clean output',          emoji: '✦',  tag: 'PLAIN',     bg: '#f0eee9', accent: '#9a9090', minPhotos: 1 },
  // 2×2 (2 photos)
  { id: 'postcard-from-afar', name: 'Postcard',          desc: 'Vintage postcard',      emoji: '📮', tag: 'ROMANTIC',  bg: '#FFFEF9', accent: '#8a7060', minPhotos: 2 },
  { id: 'lovers-polaroid',    name: "Lovers' Polaroid",  desc: 'Tilted photo prints',   emoji: '📸', tag: 'ROMANTIC',  bg: '#FAF7F2', accent: '#a08878', minPhotos: 2 },
  // 2×3 (3 photos)
  { id: 'love-letter',        name: 'Love Letter',       desc: 'Ruled paper strip',     emoji: '💌', tag: 'ROMANTIC',  bg: '#FFFCF8', accent: '#c07080', minPhotos: 3 },
  // 2×4 (4 photos — 2 cols × 2 rows)
  { id: 'gallery-portfolio',  name: 'Gallery Portfolio', desc: '2×2 cream mat',         emoji: '🖼️', tag: 'CLASSIC',   bg: '#FDFBF9', accent: '#8a7f74', minPhotos: 4 },
  { id: 'vinyl-album',        name: 'Vinyl Album',       desc: '2×2 square grid',       emoji: '💿', tag: 'MINIMAL',   bg: '#FAFAFA', accent: '#1a1a1a', minPhotos: 4 },
  { id: 'sweetheart-candy',   name: 'Sweetheart',        desc: 'Pastel pink rounds',    emoji: '💖', tag: 'CUTE',      bg: '#FFF0F5', accent: '#e89ab4', minPhotos: 4 },
  { id: 'vintage-valentine',  name: 'Valentine',         desc: 'Scallop lace border',   emoji: '🎀', tag: 'CUTE',      bg: '#F9F1F2', accent: '#c06070', minPhotos: 4 },
  { id: 'parallel-lines',     name: 'Parallel Lines',    desc: 'Long distance split',   emoji: '🌍', tag: 'DISTANCE',  bg: '#FCFAF7', accent: '#6b5f54', minPhotos: 4 },
  // 2×6 (4–6 photos — vertical strip)
  { id: 'cinema-reel',        name: 'Cinema Reel',       desc: 'Film strip + holes',    emoji: '🎞️', tag: 'RETRO',     bg: '#1A1A1A', accent: '#888',    minPhotos: 4 },
  { id: 'cinematic-storyboard', name: 'Storyboard',      desc: '2×3 scene matrix',      emoji: '🎬', tag: 'CINEMA',    bg: '#111',    accent: '#555',    minPhotos: 6 },
]

// Group frames by photo count for the picker UI
const FRAME_GROUPS: { label: string; grid: string; photoCount: number; ids: FrameId[] }[] = [
  {
    label: '2×2 · 2 photos',
    grid: 'Side by side',
    photoCount: 2,
    ids: ['postcard-from-afar', 'lovers-polaroid'],
  },
  {
    label: '2×3 · 3 photos',
    grid: 'Portrait strip',
    photoCount: 3,
    ids: ['love-letter'],
  },
  {
    label: '2×4 · 4 photos',
    grid: '2 cols × 2 rows',
    photoCount: 4,
    ids: ['gallery-portfolio', 'vinyl-album', 'sweetheart-candy', 'vintage-valentine', 'parallel-lines'],
  },
  {
    label: '2×6 · 4–6 photos',
    grid: 'Vertical strip',
    photoCount: 4,
    ids: ['cinema-reel', 'cinematic-storyboard'],
  },
]

// ── Frame thumbnail SVG previews ──────────────────────────────────────────────
function FrameThumbnail({ frame, active }: { frame: FrameDef; active: boolean }) {
  const isDark = frame.bg === '#1A1A1A' || frame.bg === '#111'
  const textColor = isDark ? '#666' : frame.accent

  const renderPreview = () => {
    switch (frame.id) {
      case 'none':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <rect x="6" y="6" width="48" height="32" rx="2" fill="#e0dbd5" />
            <rect x="6" y="44" width="48" height="30" rx="2" fill="#e0dbd5" />
          </svg>
        )
      case 'gallery-portfolio':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <rect x="5" y="6" width="23" height="16" rx="1" fill="#d4cec8" />
            <rect x="32" y="6" width="23" height="16" rx="1" fill="#d4cec8" />
            <rect x="5" y="26" width="23" height="16" rx="1" fill="#d4cec8" />
            <rect x="32" y="26" width="23" height="16" rx="1" fill="#d4cec8" />
            <rect x="10" y="52" width="40" height="2" rx="1" fill={textColor} opacity="0.3" />
            <rect x="18" y="58" width="24" height="1.5" rx="1" fill={textColor} opacity="0.2" />
          </svg>
        )
      case 'cinema-reel':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            {[8,18,28,38,48,58,68].map((y,i) => i < 7 && (
              <rect key={i} x="3" y={y} width="5" height="4" rx="1" fill="#444" />
            ))}
            {[8,18,28,38,48,58,68].map((y,i) => i < 7 && (
              <rect key={i} x="52" y={y} width="5" height="4" rx="1" fill="#444" />
            ))}
            <rect x="12" y="6" width="36" height="16" fill="#2a2a2a" />
            <rect x="12" y="25" width="36" height="16" fill="#2a2a2a" />
            <rect x="12" y="44" width="36" height="16" fill="#2a2a2a" />
            <rect x="12" y="63" width="36" height="10" fill="#2a2a2a" />
          </svg>
        )
      case 'vinyl-album':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <rect x="4" y="4" width="24" height="24" fill="#e8e8e8" />
            <rect x="32" y="4" width="24" height="24" fill="#e8e8e8" />
            <rect x="4" y="32" width="24" height="24" fill="#e8e8e8" />
            <rect x="32" y="32" width="24" height="24" fill="#e8e8e8" />
            <rect x="4" y="62" width="52" height="1.5" fill="#1a1a1a" />
            <rect x="4" y="68" width="24" height="2" rx="1" fill={textColor} opacity="0.4" />
            <rect x="36" y="68" width="20" height="2" rx="1" fill={textColor} opacity="0.2" />
          </svg>
        )
      case 'cinematic-storyboard':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <rect x="1" y="1" width="28" height="16" fill="#222" />
            <rect x="31" y="1" width="28" height="16" fill="#222" />
            <rect x="1" y="19" width="28" height="16" fill="#222" />
            <rect x="31" y="19" width="28" height="16" fill="#222" />
            <rect x="1" y="37" width="28" height="16" fill="#222" />
            <rect x="31" y="37" width="28" height="16" fill="#222" />
            <rect x="3" y="32" width="14" height="2" rx="1" fill="#444" />
            <rect x="33" y="32" width="14" height="2" rx="1" fill="#444" />
          </svg>
        )
      case 'parallel-lines':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <rect x="4" y="10" width="24" height="18" rx="1" fill="#d4cec8" />
            <rect x="4" y="32" width="24" height="18" rx="1" fill="#d4cec8" />
            <rect x="32" y="10" width="24" height="18" rx="1" fill="#d4cec8" />
            <rect x="32" y="32" width="24" height="18" rx="1" fill="#d4cec8" />
            <line x1="4" y1="66" x2="56" y2="66" stroke="#d4cdc6" strokeWidth="0.8" />
            <circle cx="30" cy="66" r="3" fill="#e8897a" />
            <rect x="4" y="72" width="10" height="2" rx="1" fill={textColor} opacity="0.4" />
            <rect x="46" y="72" width="10" height="2" rx="1" fill={textColor} opacity="0.4" />
          </svg>
        )
      case 'postcard-from-afar':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} stroke="#e0d8ce" strokeWidth="1" />
            <rect x="3" y="3" width="26" height="42" fill="#e8e4dc" />
            <rect x="31" y="3" width="26" height="42" fill="#e8e4dc" />
            <line x1="30" y1="3" x2="30" y2="45" stroke="#ccc5b8" strokeWidth="1" strokeDasharray="2,2" />
            <rect x="38" y="50" width="16" height="18" fill="#fff5f5" stroke="#d4a0a0" strokeWidth="0.8" />
            <rect x="5" y="54" width="24" height="2" rx="1" fill={textColor} opacity="0.25" />
            <rect x="5" y="60" width="16" height="1.5" rx="1" fill={textColor} opacity="0.15" />
          </svg>
        )
      case 'sweetheart-candy':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <rect x="4" y="6" width="24" height="24" rx="6" fill="#f8d0de" />
            <rect x="32" y="6" width="24" height="24" rx="6" fill="#f8d0de" />
            <rect x="4" y="34" width="24" height="24" rx="6" fill="#f8d0de" />
            <rect x="32" y="34" width="24" height="24" rx="6" fill="#f8d0de" />
            <text x="30" y="74" textAnchor="middle" fontSize="6" fill="#e89ab4" fontStyle="italic" fontFamily="Georgia,serif">✨ together ✨</text>
          </svg>
        )
      case 'love-letter':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            {[14,21,28,35,42,49,56,63,70].map((y,i) => i < 9 && (
              <line key={i} x1="0" y1={y} x2="60" y2={y} stroke="#e8d8d0" strokeWidth="0.6" />
            ))}
            <line x1="14" y1="0" x2="14" y2="80" stroke="#f0b0b0" strokeWidth="0.5" opacity="0.5" />
            <rect x="18" y="5" width="38" height="16" rx="1" fill="#d8d0c4" />
            <rect x="18" y="24" width="38" height="16" rx="1" fill="#d8d0c4" />
            <rect x="18" y="43" width="38" height="16" rx="1" fill="#d8d0c4" />
            <text x="20" y="72" fontSize="7" fill="#c07080" fontFamily="cursive">xoxo, always</text>
          </svg>
        )
      case 'vintage-valentine':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} stroke="#e8c0c8" strokeWidth="1" />
            <path d={Array.from({length:12},(_,i)=>`M${i*5},4 Q${i*5+2.5},10 ${i*5+5},4`).join(' ')} fill="none" stroke="#d4657a" strokeWidth="0.8" opacity="0.5" />
            <rect x="5" y="14" width="23" height="18" rx="2" fill="#f0d0d8" stroke="#fff" strokeWidth="1.5" />
            <rect x="32" y="14" width="23" height="18" rx="2" fill="#f0d0d8" stroke="#fff" strokeWidth="1.5" />
            <rect x="5" y="36" width="23" height="18" rx="2" fill="#f0d0d8" stroke="#fff" strokeWidth="1.5" />
            <rect x="32" y="36" width="23" height="18" rx="2" fill="#f0d0d8" stroke="#fff" strokeWidth="1.5" />
            <path d={Array.from({length:12},(_,i)=>`M${i*5},60 Q${i*5+2.5},66 ${i*5+5},60`).join(' ')} fill="none" stroke="#d4657a" strokeWidth="0.8" opacity="0.5" />
            <text x="30" y="75" textAnchor="middle" fontSize="5" fill="#c06070" fontFamily="monospace" letterSpacing="1">✦ WITH LOVE ✦</text>
          </svg>
        )
      case 'lovers-polaroid':
        return (
          <svg viewBox="0 0 60 80" className="w-full h-full">
            <rect width="60" height="80" fill={frame.bg} />
            <g transform="rotate(-4, 18, 35)">
              <rect x="4" y="14" width="26" height="36" fill="white" filter="url(#ps)" />
              <rect x="6" y="16" width="22" height="22" fill="#d8d0c8" />
              <text x="17" y="47" textAnchor="middle" fontSize="5" fill="#8a7060" fontFamily="cursive">you</text>
            </g>
            <g transform="rotate(3, 42, 35)">
              <rect x="30" y="14" width="26" height="36" fill="white" />
              <rect x="32" y="16" width="22" height="22" fill="#d8d0c8" />
              <text x="43" y="47" textAnchor="middle" fontSize="5" fill="#8a7060" fontFamily="cursive">me</text>
            </g>
            <text x="30" y="74" textAnchor="middle" fontSize="7" fill="#a08878" fontFamily="cursive">You &amp; Me.</text>
          </svg>
        )
      default:
        return <svg viewBox="0 0 60 80" className="w-full h-full"><rect width="60" height="80" fill={frame.bg} /></svg>
    }
  }

  return (
    <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
      active ? 'border-primary shadow-md shadow-primary/20 scale-105' : 'border-transparent'
    }`}>
      {renderPreview()}
    </div>
  )
}



// ── Quick stickers (emoji fallback in strip preview) ──────────────────────────
const QUICK_STICKERS = [
  '❤️','💕','✨','🎉','😍','🥰','😂','🔥','💫','🌸',
  '🦋','🌈','⭐','🎊','💖','🥳','😘','💯','🙌','👑',
  '🌺','🍓','🫶','💝','🎀','🧸','🪄','🌙','☁️','🦄',
]

// ── Frame tag colours ─────────────────────────────────────────────────────────
const TAG_COLOURS: Record<string, string> = {
  PLAIN:    'bg-neutral-100 text-neutral-500',
  CLASSIC:  'bg-amber-50 text-amber-700',
  RETRO:    'bg-neutral-800 text-neutral-300',
  MINIMAL:  'bg-neutral-100 text-neutral-700',
  CINEMA:   'bg-neutral-800 text-neutral-400',
  DISTANCE: 'bg-rose-50 text-rose-700',
  ROMANTIC: 'bg-rose-50 text-rose-600',
  CUTE:     'bg-pink-50 text-pink-600',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StripBuilderView() {
  const capturedPhotos    = useAppStore(s => s.capturedPhotos)
  const stripLayout       = useAppStore(s => s.stripLayout)
  const setStripLayout    = useAppStore(s => s.setStripLayout)
  const setFinalStripData = useAppStore(s => s.setFinalStripData)
  const setChosenPhotos   = useAppStore(s => s.setChosenPhotos)
  const setAiCaption      = useAppStore(s => s.setAiCaption)
  const setView           = useAppStore(s => s.setView)
  const isCreator         = useAppStore(s => s.isCreator)

  const slotCount = LAYOUT_SLOTS[stripLayout] ?? 4
  const [isBuilding, setIsBuilding] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState<FrameId>('none')
  const [activeTab, setActiveTab] = useState<'layout' | 'frame'>('layout')

  const [rawSlots, setRawSlots] = useState<(CapturedPhoto | null)[]>(
    () => Array(slotCount).fill(null)
  )

  const slots = useMemo<(CapturedPhoto | null)[]>(() => {
    if (rawSlots.length === slotCount) return rawSlots
    const next: (CapturedPhoto | null)[] = Array(slotCount).fill(null)
    rawSlots.forEach((s, i) => { if (i < slotCount) next[i] = s })
    return next
  }, [rawSlots, slotCount])

  const [overlayStickers, setOverlayStickers] = useState<
    { id: string; emoji: string; x: number; y: number; scale: number }[]
  >([])
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const stripPreviewRef = useRef<HTMLDivElement>(null)

  const applyingRemote = useRef(false)
  const didMount = useRef(false)

  useEffect(() => {
    const socket = getSocket()
    const onRemoteSlots = (data: { slots: (number | null)[] }) => {
      applyingRemote.current = true
      setRawSlots(() => {
        const len = Math.max(slotCount, data.slots.length)
        return Array.from({ length: len }, (_, i) => {
          const o = data.slots[i]
          return o == null ? null : capturedPhotos.find(p => p.order === o) ?? null
        })
      })
      setTimeout(() => { applyingRemote.current = false }, 0)
    }
    socket.on('strip-slot-update', onRemoteSlots)
    return () => { socket.off('strip-slot-update', onRemoteSlots) }
  }, [capturedPhotos, slotCount])

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    if (applyingRemote.current) return
    getSocket().emit('strip-slot-update', { slots: slots.map(s => s?.order ?? null) })
  }, [slots])

  const usedIds = new Set(slots.filter(Boolean).map(p => p!.id))
  const pool = capturedPhotos.filter(p => !usedIds.has(p.id))
  const filledCount = slots.filter(Boolean).length

  const addToStrip = (photo: CapturedPhoto) => {
    const idx = slots.findIndex(s => s === null)
    if (idx === -1) { toast('Strip is full — remove a photo first'); return }
    setRawSlots(prev => {
      const base = prev.length === slotCount ? [...prev] : Array(slotCount).fill(null).map((_, i) => prev[i] ?? null)
      base[idx] = photo
      return base
    })
  }

  const removeFromSlot = (idx: number) => {
    setRawSlots(prev => prev.map((s, i) => (i === idx ? null : s)))
  }

  const autoFill = () => {
    const ordered = [...capturedPhotos].sort((a, b) => a.order - b.order)
    setRawSlots(ordered.slice(0, slotCount))
  }

  const onStickerPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    const preview = stripPreviewRef.current
    if (!preview) return
    const rect = preview.getBoundingClientRect()
    const sticker = overlayStickers.find(s => s.id === id)!
    setDraggingStickerId(id)
    setDragOffset({
      x: e.clientX - rect.left - sticker.x * rect.width,
      y: e.clientY - rect.top - sticker.y * rect.height,
    })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [overlayStickers])

  const onStickerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingStickerId) return
    const preview = stripPreviewRef.current
    if (!preview) return
    const rect = preview.getBoundingClientRect()
    const nx = (e.clientX - rect.left - dragOffset.x) / rect.width
    const ny = (e.clientY - rect.top - dragOffset.y) / rect.height
    setOverlayStickers(prev => prev.map(s =>
      s.id === draggingStickerId
        ? { ...s, x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) }
        : s
    ))
  }, [draggingStickerId, dragOffset])

  const onStickerPointerUp = useCallback(() => { setDraggingStickerId(null) }, [])

  // src can be a webp path '/stickers/x.webp' or emoji string
  const addSticker = (src: string) => {
    setOverlayStickers(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      emoji: src,
      x: 0.3 + Math.random() * 0.4,
      y: 0.2 + Math.random() * 0.6,
      scale: 1,
    }])
  }

  const removeSticker = (id: string) => {
    setOverlayStickers(prev => prev.filter(s => s.id !== id))
  }

  const handleCreate = async () => {
    const chosen = slots.filter(Boolean) as CapturedPhoto[]
    if (chosen.length === 0) return
    setIsBuilding(true)

    const stripData = await renderStrip(chosen, {
      layout: stripLayout,
      isCreator,
      frameId: selectedFrame,
    })
    if (!stripData) {
      toast.error('Could not build the strip')
      setIsBuilding(false)
      return
    }

    let finalData = stripData
    if (overlayStickers.length > 0) {
      const canvas = document.createElement('canvas')
      const img = new Image()
      await new Promise<void>(res => { img.onload = () => res(); img.src = stripData })
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      for (const s of overlayStickers) {
        const px = s.x * canvas.width
        const py = s.y * canvas.height
        const size = Math.round(64 * s.scale * (canvas.width / 448))
        const isWebp = s.emoji.startsWith('/')
        if (isWebp) {
          // Load and draw webp sticker image
          await new Promise<void>(res => {
            const si = new Image()
            si.onload = () => {
              ctx.drawImage(si, px - size / 2, py - size / 2, size, size)
              res()
            }
            si.onerror = () => res()
            si.src = s.emoji
          })
        } else {
          ctx.font = `${size}px serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(s.emoji, px, py)
        }
      }
      finalData = canvas.toDataURL('image/jpeg', 0.92)
    }

    setChosenPhotos(chosen)
    setFinalStripData(finalData)
    setView('result')

    fetch('/api/ai/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'caption', context: `${chosen.length} photos, ${stripLayout} layout, ${selectedFrame} frame` }),
    })
      .then(r => r.json())
      .then(d => setAiCaption(d.caption))
      .catch(() => setAiCaption('A moment worth remembering ✨'))
  }

  const currentFrame = FRAMES.find(f => f.id === selectedFrame)!

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('studio')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <h1 className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Build Your Strip
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={autoFill} className="text-muted-foreground text-xs hover:text-foreground">
              Auto-fill
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-36 pt-4 space-y-5">

        {/* Tab switcher: Layout / Frame */}
        <div className="flex bg-muted/60 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('layout')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'layout'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Layout
          </button>
          <button
            onClick={() => setActiveTab('frame')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'frame'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Frame className="w-4 h-4" />
            Frame
            {selectedFrame !== 'none' && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
        </div>

        {/* Layout tab */}
        {activeTab === 'layout' && (
          <div className="grid grid-cols-4 gap-2">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                onClick={() => setStripLayout(l.id)}
                className={`rounded-xl p-3 text-center transition-all border ${
                  stripLayout === l.id
                    ? 'bg-card border-primary/40 shadow-sm ring-2 ring-primary/20'
                    : 'bg-card/60 border-transparent hover:border-border hover:bg-card'
                }`}
              >
                <span className="text-2xl block mb-1">{l.icon}</span>
                <span className="text-[11px] font-semibold text-foreground block">{l.name}</span>
                <span className="text-[9px] text-muted-foreground leading-tight block mt-0.5">{l.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Frame tab */}
        {activeTab === 'frame' && (
          <div className="space-y-5">
            {/* No frame option */}
            <div className="flex items-center gap-3">
              {(() => {
                const f = FRAMES.find(fr => fr.id === 'none')!
                return (
                  <button
                    onClick={() => setSelectedFrame('none')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      selectedFrame === 'none'
                        ? 'bg-card border-primary/40 ring-2 ring-primary/20 text-foreground'
                        : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:bg-card'
                    }`}
                  >
                    <span className="text-base">✦</span>
                    No Frame
                  </button>
                )
              })()}
              {selectedFrame !== 'none' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 rounded-xl border border-primary/20">
                  <span className="text-base">{currentFrame.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{currentFrame.name}</p>
                    <p className="text-[10px] text-muted-foreground">{currentFrame.desc}</p>
                  </div>
                  <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${TAG_COLOURS[currentFrame.tag]}`}>
                    {currentFrame.tag}
                  </span>
                </div>
              )}
            </div>

            {/* Grouped frame sections */}
            {FRAME_GROUPS.map(group => (
              <div key={group.label}>
                {/* Group header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    {group.label}
                  </p>
                  <span className="text-[9px] text-muted-foreground/50 font-mono">— {group.grid}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Frame thumbnails row */}
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {group.ids.map(id => {
                    const f = FRAMES.find(fr => fr.id === id)!
                    const locked = filledCount > 0 && filledCount < f.minPhotos
                    return (
                      <button
                        key={f.id}
                        onClick={() => !locked && setSelectedFrame(f.id)}
                        disabled={locked}
                        className={`flex flex-col items-center gap-1.5 group relative ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <FrameThumbnail frame={f} active={selectedFrame === f.id} />
                        <span className={`text-[9px] font-medium text-center leading-tight transition-colors ${
                          selectedFrame === f.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                        }`}>
                          {f.name}
                        </span>
                        {locked && (
                          <span className="absolute top-1 right-1 text-[8px] bg-black/50 text-white px-1 rounded">
                            {f.minPhotos}+
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Photos + preview */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(220px,280px)] gap-5">
          {/* Left: pool + stickers */}
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                Photos · {pool.length} available
              </p>
              <div className="grid grid-cols-2 gap-2 content-start">
                {[...pool].sort((a, b) => a.order - b.order).map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToStrip(p)}
                    className="relative rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5 hover:ring-2 hover:ring-primary/40 transition-all group active:scale-95"
                  >
                    <img src={p.dataUrl} alt="" className="w-full h-auto block" loading="eager" decoding="sync" />
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold text-white bg-black/50 rounded px-1 py-0.5">
                      #{p.order}
                    </span>
                  </button>
                ))}
                {pool.length === 0 && (
                  <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
                    All photos placed ✓
                  </p>
                )}
              </div>
            </div>

            {/* Quick sticker preview (emoji) — full custom stickers available after strip is created */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                Stickers · tap to add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_STICKERS.map(e => (
                  <button
                    key={e}
                    onClick={() => addSticker(e)}
                    className="w-10 h-10 rounded-xl bg-card hover:bg-card shadow-sm hover:shadow-md border border-border hover:scale-110 active:scale-95 transition-all text-xl flex items-center justify-center"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5">
                ✦ Custom stickers available after creating your strip
              </p>
            </div>
          </div>

          {/* Right: strip preview */}
          <div className="mx-auto w-full max-w-[280px]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 text-center">
              Preview · drag stickers
            </p>

            <div
              ref={stripPreviewRef}
              className="relative bg-muted rounded-xl p-3 shadow-md ring-1 ring-black/8 dark:ring-white/8 select-none"
              onPointerMove={onStickerPointerMove}
              onPointerUp={onStickerPointerUp}
            >
              {/* Frame badge */}
              {selectedFrame !== 'none' && (
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Frame:</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${TAG_COLOURS[currentFrame.tag]}`}>
                    {currentFrame.name}
                  </span>
                </div>
              )}

              <Reorder.Group
                axis="y"
                values={rawSlots}
                onReorder={setRawSlots}
                className="space-y-2"
              >
                {slots.map((slot, i) => (
                  <Reorder.Item
                    key={slot ? slot.id : `empty-${i}`}
                    value={slot}
                    dragListener={!!slot}
                    className="relative"
                  >
                    {slot ? (
                      <div className="group relative rounded-sm overflow-hidden">
                        <img src={slot.dataUrl} alt="" className="w-full h-auto block" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <button
                          onClick={() => removeFromSlot(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                        <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab">
                          <GripVertical className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-[3/2] rounded-sm bg-secondary flex items-center justify-center border-2 border-dashed border-border">
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              {overlayStickers.map(s => {
                const isWebp = s.emoji.startsWith('/')
                const size = Math.round(48 * s.scale)
                return (
                  <div
                    key={s.id}
                    className="absolute cursor-grab active:cursor-grabbing select-none"
                    style={{
                      left: `${s.x * 100}%`,
                      top: `${s.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      width: size,
                      height: size,
                      fontSize: `${28 * s.scale}px`,
                      zIndex: 20,
                      touchAction: 'none',
                    }}
                    onPointerDown={e => onStickerPointerDown(e, s.id)}
                  >
                    {isWebp ? (
                      <img
                        src={s.emoji}
                        alt=""
                        className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
                        draggable={false}
                      />
                    ) : (
                      <span className="drop-shadow-md">{s.emoji}</span>
                    )}
                    <button
                      className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center leading-none shadow"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => removeSticker(s.id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}

              <p className="text-center text-[9px] tracking-widest text-muted-foreground mt-2.5 uppercase">
                SnapTogether · {LAYOUTS.find(l => l.id === stripLayout)?.name}
                {selectedFrame !== 'none' && ` · ${currentFrame.emoji}`}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Create button */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-5 px-4">
        <div className="max-w-md mx-auto">
          <Button
            size="lg"
            disabled={filledCount === 0 || isBuilding}
            onClick={handleCreate}
            className="w-full rounded-2xl py-6 text-base font-medium shadow-lg shadow-primary/20"
          >
            {isBuilding ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
              />
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Create Strip ({filledCount}/{slots.length})
                {selectedFrame !== 'none' && <span className="ml-2 opacity-70 text-sm">{currentFrame.emoji}</span>}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}