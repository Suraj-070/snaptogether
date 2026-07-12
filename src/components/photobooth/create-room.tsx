'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'
import type { FilterId, StripLayout } from '@/lib/types'
import { FILTERS } from '@/lib/types'

const THEMES = [
  { id: 'classic', name: 'Classic', icon: '📷', desc: 'Traditional photobooth style', frame: 'bg-neutral-900', accent: 'from-rose-300 to-amber-200' },
  { id: 'modern', name: 'Modern', icon: '✨', desc: 'Clean magazine look', frame: 'bg-white border border-neutral-200', accent: 'from-sky-300 to-indigo-200' },
  { id: 'couple', name: 'Couple', icon: '💕', desc: 'Two-person matching layout', frame: 'bg-rose-50 border border-rose-200', accent: 'from-pink-300 to-rose-200' },
  { id: 'memory', name: 'Memory', icon: '📝', desc: 'With date, message & stickers', frame: 'bg-amber-50 border border-amber-200', accent: 'from-amber-300 to-orange-200' },
] as const

/** Mini photo-strip mockup for theme previews */
function ThemeStripPreview({ frame, accent }: { frame: string; accent: string }) {
  return (
    <div className={`w-10 rounded-md p-1 flex flex-col gap-1 shadow-sm ${frame}`}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`h-5 rounded-[3px] bg-gradient-to-br ${accent}`} style={{ opacity: 0.9 - i * 0.12 }} />
      ))}
      <div className="h-1.5" />
    </div>
  )
}

/** Colorful sample the CSS filter gets applied to */
function FilterSwatch({ css }: { css: string }) {
  return (
    <div
      className="w-14 h-14 rounded-lg overflow-hidden shrink-0"
      style={{ filter: css || undefined }}
    >
      <div className="w-full h-full bg-gradient-to-br from-sky-400 via-rose-400 to-amber-300 relative">
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-emerald-500/70 to-transparent" />
        <div className="absolute top-1.5 right-2 w-3 h-3 rounded-full bg-yellow-200" />
      </div>
    </div>
  )
}

/** Mini layout mockups */
function LayoutPreview({ id }: { id: StripLayout }) {
  const cell = 'rounded-[2px] bg-primary/25'
  if (id === 'classic') return (
    <div className="w-8 mx-auto flex flex-col gap-0.5 p-1 rounded bg-muted">
      {[0,1,2,3].map(i => <div key={i} className={`h-3 ${cell}`} />)}
    </div>
  )
  if (id === 'magazine') return (
    <div className="w-14 mx-auto grid grid-cols-2 gap-0.5 p-1 rounded bg-muted">
      <div className={`h-7 row-span-2 ${cell}`} />
      <div className={`h-3.5 ${cell}`} />
      <div className={`h-3 ${cell}`} />
      <div className={`h-3 col-span-2 ${cell}`} />
    </div>
  )
  if (id === 'couple') return (
    <div className="w-14 mx-auto grid grid-cols-2 gap-0.5 p-1 rounded bg-muted">
      {[0,1,2,3].map(i => <div key={i} className={`h-4 ${cell}`} />)}
    </div>
  )
  return (
    <div className="w-12 mx-auto flex flex-col gap-0.5 p-1 rounded bg-muted">
      <div className={`h-6 ${cell}`} />
      <div className="h-1.5 rounded-[2px] bg-primary/15" />
      <div className="h-1 w-2/3 rounded-[2px] bg-primary/15" />
    </div>
  )
}

const LAYOUTS = [
  { id: 'classic' as StripLayout, name: 'Classic 4-Strip', icon: '⋮' },
  { id: 'magazine' as StripLayout, name: 'Magazine', icon: '◧' },
  { id: 'couple' as StripLayout, name: 'Couple Split', icon: '__,__' },
  { id: 'memory' as StripLayout, name: 'Memory Card', icon: '🔳' },
]

export default function CreateRoomView() {
  const {
    username, userId, setUserId,
    setView, setRoomCode, setIsCreator, setSessionId,
    selectedFilter, setSelectedFilter,
    stripLayout, setStripLayout,
    totalPhotos, setTotalPhotos,
    setRoomState, setParticipants,
  } = useAppStore()

  const [isCreating, setIsCreating] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState('classic')

  const handleCreate = async () => {
    if (!username.trim()) return
    setIsCreating(true)

    try {
      // Create room via API
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          theme: selectedTheme,
          filter: selectedFilter,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create room')
        setIsCreating(false)
        return
      }

      setUserId(data.user.id)
      setSessionId(data.session.id)
      setIsCreator(true)

      // Reuse the single shared socket connection and register the room
      // under the SAME code the database already generated, so the code
      // shown to the creator always matches the code partners can join.
      const socket = getSocket()

      const onRoomCreated = (roomData: any) => {
        setRoomCode(roomData.code)
        setRoomState(roomData)
        setParticipants(roomData.participants || [])
        setIsCreating(false)
        setView('lobby')
        socket.off('room-created', onRoomCreated)
        socket.off('error', onSocketError)
      }
      const onSocketError = (err: any) => {
        toast.error(err.message || 'Connection error')
        setIsCreating(false)
        socket.off('room-created', onRoomCreated)
        socket.off('error', onSocketError)
      }

      socket.on('room-created', onRoomCreated)
      socket.on('error', onSocketError)

      const emitCreateRoom = () => {
        socket.emit('create-room', {
          username: username.trim(),
          theme: selectedTheme,
          filter: selectedFilter,
          totalPhotos,
          code: data.session.roomCode,
        })
      }

      if (socket.connected) {
        emitCreateRoom()
      } else {
        socket.once('connect', emitCreateRoom)
        socket.connect()
      }
    } catch {
      toast.error('Failed to create room')
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => setView('landing')} className="mr-3">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <span className="font-semibold">Create Room</span>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Theme Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Choose Theme
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`glass rounded-2xl p-4 text-left transition-all duration-200 ${
                    selectedTheme === theme.id
                      ? 'ring-2 ring-primary shadow-lg shadow-primary/10'
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <ThemeStripPreview frame={theme.frame} accent={theme.accent} />
                    <span className="text-xl">{theme.icon}</span>
                  </div>
                  <span className="text-sm font-medium block">{theme.name}</span>
                  <span className="text-xs text-muted-foreground">{theme.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Default Filter
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id as FilterId)}
                  className={`shrink-0 p-2 rounded-xl transition-all duration-200 flex flex-col items-center gap-1.5 ${
                    selectedFilter === filter.id
                      ? 'ring-2 ring-primary bg-primary/5 shadow-md'
                      : 'glass hover:shadow-md'
                  }`}
                >
                  <FilterSwatch css={filter.css} />
                  <span className="text-xs font-medium whitespace-nowrap">{filter.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Strip Layout */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Strip Layout</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setStripLayout(layout.id)}
                  className={`glass rounded-2xl p-4 text-center transition-all duration-200 ${
                    stripLayout === layout.id
                      ? 'ring-2 ring-primary shadow-lg shadow-primary/10'
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="mb-2 h-10 flex items-center justify-center">
                    <LayoutPreview id={layout.id} />
                  </div>
                  <span className="text-sm font-medium">{layout.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Count */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Photos per session: <span className="text-primary">{totalPhotos}</span>
            </h3>
            <div className="flex gap-3">
              {[2, 3, 4, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setTotalPhotos(n)}
                  className={`w-14 h-14 rounded-xl text-lg font-bold transition-all duration-200 ${
                    totalPhotos === n
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'glass hover:shadow-md'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <div className="pt-4 pb-8">
            <Button
              size="lg"
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full rounded-2xl py-6 text-base font-medium"
            >
              {isCreating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Camera className="w-5 h-5 mr-2" />
                  Create Photobooth Room
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}