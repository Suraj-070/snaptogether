'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'

export default function JoinRoomView() {
  const {
    username, setUserId, setView,
    setRoomCode, setIsCreator, setSessionId,
    setRoomState, setParticipants,
    roomCode: prefilledCode,
  } = useAppStore()

  const [code, setCode] = useState(prefilledCode || '')
  const [isJoining, setIsJoining] = useState(false)
  const joinInputRef = useRef<HTMLInputElement>(null)

  // Defined before useEffect so it's in scope
  const handleJoin = (overrideCode?: string) => {
    const raw = (overrideCode ?? code).trim().toUpperCase()
    if (!username.trim()) { toast.error('Enter your name first'); setView('landing'); return }
    if (raw.length !== 6) { toast.error('Enter the full 6-character code'); return }
    setIsJoining(true)
    const socket = getSocket()

    const onJoined = (roomData: any) => {
      const finalCode = roomData.code || raw
      setIsCreator(false)
      setRoomCode(finalCode)
      setRoomState(roomData)
      setParticipants(roomData.participants || [])
      setIsJoining(false)
      sessionStorage.setItem(`snap_joined_${finalCode}`, '1')
      setView('lobby')
      clearTimeout(deadline)
      socket.off('room-joined', onJoined)
      socket.off('error', onErr)
      fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: raw, username: username.trim() }),
      }).then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setUserId(d.user.id); setSessionId(d.session.id) } })
        .catch(() => {})
    }

    const onErr = (err: any) => {
      toast.error(err.message || 'Room not found')
      setIsJoining(false)
      clearTimeout(deadline)
      socket.off('room-joined', onJoined)
      socket.off('error', onErr)
    }

    const deadline = setTimeout(() => onErr({ message: 'Server unreachable — try again' }), 10000)
    socket.on('room-joined', onJoined)
    socket.on('error', onErr)
    const emit = () => socket.emit('join-room', { code: raw, username: username.trim() })
    if (socket.connected) { emit() } else { socket.once('connect', emit); socket.connect() }
  }

  // Auto-join if arriving via deep link with name already set
  useEffect(() => {
    if (prefilledCode && username.trim()) {
      handleJoin(prefilledCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-5">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-16 w-[450px] h-[450px] rounded-full bg-primary/8 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        <button
          onClick={() => setView('landing')}
          className="flex items-center gap-1.5 text-white/35 hover:text-white/65 text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h2 className="text-2xl font-bold mb-1">Join a room</h2>
        <p className="text-sm text-white/35 mb-7">Enter the 6-character code your host shared</p>

        {/* Letter-box code input */}
        <div className="mb-6">
          <div className="relative h-14">
            {/* Visual boxes */}
            <div className="absolute inset-0 flex gap-1.5 pointer-events-none" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-xl border flex items-center justify-center text-xl font-bold font-mono transition-all duration-150 ${
                    i < code.length
                      ? 'bg-primary/15 border-primary/50 text-white'
                      : i === code.length
                      ? 'bg-white/8 border-primary/25 text-white/15'
                      : 'bg-white/4 border-white/8 text-white/12'
                  }`}
                >
                  {code[i] ?? '·'}
                </div>
              ))}
            </div>
            {/* Real input fully overlaying the boxes */}
            <input
              ref={joinInputRef}
              type="text"
              inputMode="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              className="absolute inset-0 w-full h-full opacity-0 cursor-text caret-transparent"
              aria-label="Room code"
            />
          </div>
        </div>

        <button
          onClick={() => handleJoin()}
          disabled={isJoining || code.length !== 6}
          className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-35"
        >
          {isJoining ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Join room <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        <p className="text-center text-xs text-white/22 mt-5">
          No code?{' '}
          <button onClick={() => setView('create')} className="text-primary/65 hover:text-primary transition-colors">
            Create your own room
          </button>
        </p>
      </motion.div>
    </div>
  )
}