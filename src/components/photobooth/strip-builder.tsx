'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { renderStrip } from '@/lib/strip'
import type { CapturedPhoto } from '@/lib/types'

/**
 * "MAKE YOUR STRIP" — after the session, pick which shots go into the
 * strip and in what order. Pool on the left, strip slots on the right.
 */
export default function StripBuilderView() {
  const {
    capturedPhotos, totalPhotos,
    setFinalStripData, setAiCaption, setView,
  } = useAppStore()

  const slotCount = Math.min(totalPhotos, Math.max(capturedPhotos.length, 1))
  const [slots, setSlots] = useState<(CapturedPhoto | null)[]>(
    () => Array(slotCount).fill(null)
  )
  const [isBuilding, setIsBuilding] = useState(false)

  const usedIds = new Set(slots.filter(Boolean).map(p => p!.id))
  const pool = capturedPhotos.filter(p => !usedIds.has(p.id))
  const filledCount = slots.filter(Boolean).length

  const addToStrip = (photo: CapturedPhoto) => {
    const idx = slots.findIndex(s => s === null)
    if (idx === -1) {
      toast('Strip is full — remove one first')
      return
    }
    setSlots(prev => prev.map((s, i) => (i === idx ? photo : s)))
  }

  const removeFromSlot = (idx: number) => {
    setSlots(prev => prev.map((s, i) => (i === idx ? null : s)))
  }

  const handleCreate = async () => {
    const chosen = slots.filter(Boolean) as CapturedPhoto[]
    if (chosen.length === 0) return
    setIsBuilding(true)

    const stripData = await renderStrip(chosen)
    if (!stripData) {
      toast.error('Could not build the strip')
      setIsBuilding(false)
      return
    }
    setFinalStripData(stripData)
    setView('result')

    // AI caption in the background
    fetch('/api/ai/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'caption', context: `${chosen.length} photos in a photobooth session` }),
    })
      .then(r => r.json())
      .then(d => setAiCaption(d.caption))
      .catch(() => setAiCaption('A moment worth remembering ✨'))
  }

  const autoFill = () => {
    const ordered = [...capturedPhotos].sort((a, b) => a.order - b.order)
    setSlots(prev => prev.map((s, i) => s ?? ordered.filter(p => !usedIds.has(p.id))[i - filledCount] ?? ordered[i] ?? null))
    // simple: just take first N in order
    setSlots(ordered.slice(0, slotCount))
  }

  return (
    <div className="min-h-screen bg-[#f6f5f3] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f6f5f3]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('studio')} className="text-neutral-600">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <h1 className="text-sm font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            Make Your Strip
          </h1>
          <Button variant="ghost" size="sm" onClick={autoFill} className="text-neutral-500 text-xs">
            Auto-fill
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-32 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(260px,320px)] gap-6">
          {/* Photo pool */}
          <div>
            <p className="text-xs text-neutral-400 mb-3">
              Tap a photo to add it to the strip · {pool.length} available
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
              <AnimatePresence>
                {pool.sort((a, b) => a.order - b.order).map((p) => (
                  <motion.button
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToStrip(p)}
                    className="relative aspect-[4/3] rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5 hover:ring-2 hover:ring-primary/50 transition-shadow"
                  >
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  </motion.button>
                ))}
              </AnimatePresence>
              {pool.length === 0 && (
                <p className="col-span-full text-sm text-neutral-400 py-8 text-center">
                  All photos placed ✓
                </p>
              )}
            </div>
          </div>

          {/* Strip preview */}
          <div className="mx-auto w-full max-w-[320px]">
            <div className="strip-frame bg-[#efe9df] rounded-lg p-3 shadow-md ring-1 ring-black/5">
              <div className="space-y-2.5">
                {slots.map((slot, i) => (
                  <motion.div key={i} layout className="relative">
                    {slot ? (
                      <button
                        onClick={() => removeFromSlot(i)}
                        className="group relative block w-full aspect-[4/3] rounded-sm overflow-hidden"
                      >
                        <img src={slot.dataUrl} alt="" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <X className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </button>
                    ) : (
                      <div className="w-full aspect-[4/3] rounded-sm bg-[#e6ddcf] flex items-center justify-center">
                        <Plus className="w-5 h-5 text-neutral-400" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-[10px] tracking-widest text-neutral-400 mt-3 uppercase">
                SnapTogether
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Create button */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#f6f5f3] via-[#f6f5f3]/95 to-transparent pt-8 pb-5 px-4">
        <div className="max-w-md mx-auto">
          <Button
            size="lg"
            disabled={filledCount === 0 || isBuilding}
            onClick={handleCreate}
            className="w-full rounded-2xl py-6 text-base font-medium"
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
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
