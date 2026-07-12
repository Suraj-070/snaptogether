'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ArrowLeft, Copy, Check, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { io, Socket } from 'socket.io-client'
import type { FilterId, StripLayout } from '@/lib/types'
import { FILTERS } from '@/lib/types'

const THEMES = [
  { id: 'classic', name: 'Classic', icon: '📷', desc: 'Traditional photobooth style' },
  { id: 'modern', name: 'Modern', icon: '✨', desc: 'Clean magazine look' },
  { id: 'couple', name: 'Couple', icon: '💕', desc: 'Two-person matching layout' },
  { id: 'memory', name: 'Memory', icon: '📝', desc: 'With date, message & stickers' },
] as const

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
  const [copied, setCopied] = useState(false)
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

      // Connect to WebSocket and create room
      const socket: Socket = io('/?XTransformPort=3004', {
        transports: ['websocket', 'polling'],
        forceNew: true,
      })

      socket.on('connect', () => {
        socket.emit('create-room', {
          username: username.trim(),
          theme: selectedTheme,
          filter: selectedFilter,
        })
      })

      socket.on('room-created', (roomData: any) => {
        setRoomCode(roomData.code)
        setRoomState(roomData)
        setParticipants(roomData.participants || [])
        setIsCreating(false)
        setView('studio')
      })

      socket.on('error', (err: any) => {
        toast.error(err.message || 'Connection error')
        setIsCreating(false)
      })
    } catch {
      toast.error('Failed to create room')
      setIsCreating(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success('Room code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // If room already created, show waiting room
  const roomCode = useAppStore(s => s.roomCode)
  if (roomCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 sm:p-12 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Room Created!</h2>
          <p className="text-muted-foreground mb-8">Share this code with your friends to join</p>

          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="text-3xl sm:text-4xl font-bold tracking-[0.3em] font-mono">
              {roomCode}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyCode(roomCode)}
              className="rounded-xl"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
            <Users className="w-4 h-4" />
            <span>Waiting for others to join...</span>
          </div>

          <Button onClick={() => setView('studio')} className="w-full rounded-2xl py-6">
            Continue to Studio
            <Sparkles className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    )
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
                  <span className="text-2xl mb-2 block">{theme.icon}</span>
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
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedFilter === filter.id
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'glass hover:shadow-md'
                  }`}
                >
                  <span className="mr-1.5">{filter.icon}</span>
                  {filter.name}
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
                  <span className="text-lg block mb-1 font-mono">{layout.icon}</span>
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