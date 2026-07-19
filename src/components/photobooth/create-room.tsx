'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'
import type { FilterId, StripLayout } from '@/lib/types'
import { FILTERS } from '@/lib/types'

const VIBES: { id: string; emoji: string; name: string; desc: string; filter: FilterId; layout: StripLayout }[] = [
  { id: 'classic',  emoji: '🎞️', name: 'Classic',      desc: 'Timeless film strip feel',       filter: 'vintage',      layout: 'classic'  },
  { id: 'couple',   emoji: '💕', name: 'Couple',       desc: 'Soft & romantic side-by-side',   filter: 'polaroid',     layout: 'couple'   },
  { id: 'aesthetic',emoji: '🌸', name: 'Aesthetic',    desc: 'Dreamy pastel mood',             filter: 'dream',        layout: 'magazine' },
  { id: 'cinema',   emoji: '🎬', name: 'Cinematic',    desc: 'Warm movie-scene tones',         filter: 'warm-cinema',  layout: 'magazine' },
  { id: 'retro',    emoji: '📼', name: 'Retro',        desc: 'Y2K camcorder energy',           filter: 'retro',        layout: 'memory'   },
  { id: 'neon',     emoji: '💜', name: 'Neon',         desc: 'Cyber glow & vivid colours',     filter: 'cyber-neon',   layout: 'classic'  },
  { id: 'bw',       emoji: '🖤', name: 'B&W',          desc: 'Clean black & white',            filter: 'bw',           layout: 'classic'  },
  { id: 'raw',      emoji: '✨', name: 'Natural',      desc: 'No filter, just you',            filter: 'none',         layout: 'classic'  },
]

const SHOT_COUNTS = [2, 3, 4, 6]

export default function CreateRoomView() {
  const {
    username, setUserId,
    setView, setRoomCode, setIsCreator, setSessionId,
    setSelectedFilter, setStripLayout,
    setRoomState, setParticipants,
  } = useAppStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedVibe, setSelectedVibe] = useState(VIBES[0])
  const [shotCount, setShotCount] = useState(4)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = () => {
    if (!username.trim()) return
    setIsCreating(true)

    // Apply the vibe's filter & layout to store
    setSelectedFilter(selectedVibe.filter)
    setStripLayout(selectedVibe.layout)

    const socket = getSocket()

    const onCreated = (roomData: any) => {
      setRoomCode(roomData.code)
      setRoomState(roomData)
      setParticipants(roomData.participants || [])
      setIsCreator(true)
      setIsCreating(false)
      sessionStorage.setItem(`snap_joined_${roomData.code}`, '1')
      setView('lobby')
      clearTimeout(deadline)
      socket.off('room-created', onCreated)
      socket.off('error', onErr)

      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          theme: selectedVibe.id,
          filter: selectedVibe.filter,
          code: roomData.code,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setUserId(d.user.id); setSessionId(d.session.id) } })
        .catch(() => {})
    }

    const onErr = (err: any) => {
      toast.error(err.message || 'Could not connect')
      setIsCreating(false)
      clearTimeout(deadline)
      socket.off('room-created', onCreated)
      socket.off('error', onErr)
    }

    const deadline = setTimeout(() => onErr({ message: 'Server unreachable — try again' }), 10000)
    socket.on('room-created', onCreated)
    socket.on('error', onErr)

    const emit = () => socket.emit('create-room', {
      username: username.trim(),
      theme: selectedVibe.id,
      filter: selectedVibe.filter,
      totalPhotos: shotCount,
    })
    socket.connected ? emit() : (socket.once('connect', emit), socket.connect())
  }

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[-15%] right-[-5%] w-[450px] h-[450px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[350px] h-[350px] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center px-5 h-14 border-b border-white/6">
        <button
          onClick={() => step === 2 ? setStep(1) : setView('landing')}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors mr-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 2 ? 'Back' : 'Home'}
        </button>
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
          {[1, 2].map(s => (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${
                s === step ? 'w-5 h-1.5 bg-primary' : s < step ? 'w-1.5 h-1.5 bg-primary/50' : 'w-1.5 h-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-6 relative z-10">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Pick a vibe ────────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">Pick a vibe</h2>
                  <p className="text-sm text-white/35">Sets the filter and layout for your strip</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-6">
                  {VIBES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVibe(v)}
                      className={`relative p-4 rounded-2xl border text-left transition-all ${
                        selectedVibe.id === v.id
                          ? 'bg-primary/12 border-primary/40 shadow-lg shadow-primary/10'
                          : 'bg-white/4 border-white/8 hover:bg-white/7 hover:border-white/15'
                      }`}
                    >
                      {selectedVibe.id === v.id && (
                        <motion.div
                          layoutId="vibe-check"
                          className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                        >
                          <Check className="w-2.5 h-2.5 text-white" />
                        </motion.div>
                      )}
                      <span className="text-2xl block mb-1.5">{v.emoji}</span>
                      <span className="text-sm font-semibold block">{v.name}</span>
                      <span className="text-[11px] text-white/35 leading-tight block mt-0.5">{v.desc}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── Step 2: Shots + confirm ───────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">How many shots?</h2>
                  <p className="text-sm text-white/35">Each shot = one synchronized capture</p>
                </div>

                {/* Shot count picker */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {SHOT_COUNTS.map(n => (
                    <button
                      key={n}
                      onClick={() => setShotCount(n)}
                      className={`py-4 rounded-2xl border text-center transition-all ${
                        shotCount === n
                          ? 'bg-primary/12 border-primary/40 text-white'
                          : 'bg-white/4 border-white/8 text-white/50 hover:text-white/80 hover:bg-white/7'
                      }`}
                    >
                      <span className="text-2xl font-bold block">{n}</span>
                      <span className="text-[10px] text-white/30 mt-0.5 block">
                        {n === 2 ? 'quick' : n === 6 ? 'full' : ''}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Summary card */}
                <div className="bg-white/4 border border-white/8 rounded-2xl p-4 mb-5">
                  <p className="text-[11px] font-semibold tracking-widest uppercase text-white/30 mb-3">Your session</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/50">Vibe</span>
                      <span className="text-sm font-semibold">{selectedVibe.emoji} {selectedVibe.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/50">Filter</span>
                      <span className="text-sm font-semibold">{FILTERS.find(f => f.id === selectedVibe.filter)?.name ?? 'None'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/50">Shots</span>
                      <span className="text-sm font-semibold">{shotCount} photos</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all disabled:opacity-60"
                >
                  {isCreating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Create room
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}