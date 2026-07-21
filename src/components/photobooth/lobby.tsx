'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Play, LogOut, Crown, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'
import ThemeToggle from '@/components/theme-toggle'
import type { Participant } from '@/lib/types'

const AVATAR_GRADIENTS = [
  'from-rose-500 to-primary',
  'from-violet-500 to-indigo-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-sky-500 to-blue-400',
  'from-fuchsia-500 to-purple-400',
]

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]} flex items-center justify-center font-bold text-white text-sm shadow-lg flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function LobbyView() {
  const {
    username, isCreator, roomCode,
    participants, setParticipants,
    setView, setRoomState,
  } = useAppStore()

  const [copied, setCopied] = useState(false)
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    const syncRoom = (data: any) => {
      if (data.room) {
        setRoomState(data.room)
        setParticipants(data.room.participants || [])
      }
    }

    // BUG FIX: server emits data.participant.username not data.username
    const onJoined = (data: any) => {
      syncRoom(data)
      if (data.participant?.username) toast.success(`${data.participant.username} joined! 🎉`)
    }
    const onLeft = (data: any) => {
      syncRoom(data)
      if (data.participant?.username) toast(`${data.participant.username} left`)
    }
    const onEntered = (data: any) => {
      syncRoom(data)
      setEntering(true)
      setTimeout(() => setView('studio'), 700)
    }

    socket.on('participant-joined', onJoined)
    socket.on('participant-left', onLeft)
    socket.on('participant-updated', syncRoom)
    socket.on('settings-updated', syncRoom)
    socket.on('studio-entered', onEntered)

    return () => {
      socket.off('participant-joined', onJoined)
      socket.off('participant-left', onLeft)
      socket.off('participant-updated', syncRoom)
      socket.off('settings-updated', syncRoom)
      socket.off('studio-entered', onEntered)
    }
  }, [setParticipants, setRoomState, setView])

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomCode).catch(() => {})
    setCopied(true)
    toast.success('Code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareLink = async () => {
    const url = `${window.location.origin}/join/${roomCode}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SnapTogether', text: `Join my photobooth! Code: ${roomCode}`, url })
      } catch {}
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      toast.success('Link copied!')
    }
  }

  const toggleReady = () => getSocket().emit('toggle-ready')
  const startSession = () => getSocket().emit('enter-studio')
  const leaveRoom = () => {
    getSocket().emit('leave-room')
    setRoomState(null)
    setParticipants([])
    useAppStore.getState().setRoomCode('')
    setView('landing')
  }

  // Use server-authoritative ready state from participants array
  const me = participants.find(p => p.username === username)
  const iAmReady = me?.isReady ?? false
  const partnerJoined = participants.length >= 2
  // allReady = everyone in room has toggled ready (uses server state, not local)
  const allReady = participants.length > 0 && participants.every(p => p.isReady)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="fixed top-3 right-4 z-50"><ThemeToggle /></div>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-16 w-[500px] h-[500px] rounded-full bg-primary/7 blur-[140px]" />
        <div className="absolute -bottom-24 -right-8 w-[380px] h-[380px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      {/* Entering overlay */}
      <AnimatePresence>
        {entering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-5"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
              className="text-6xl"
            >
              📸
            </motion.div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Opening studio…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Room code card */}
        <div className="glass-strong rounded-3xl p-6 mb-3 shadow-2xl shadow-foreground/10">
          {/* Code display */}
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-3">
              {isCreator ? 'Share this code' : 'Room'}
            </p>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {roomCode.split('').map((ch, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="w-10 h-11 rounded-xl bg-foreground/[0.07] border border-border flex items-center justify-center text-lg font-bold font-mono"
                >
                  {ch}
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-foreground/[0.06] hover:bg-foreground/10 border border-border text-xs font-semibold text-foreground/70 hover:text-foreground/90 transition-all active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={shareLink}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-foreground/[0.06] hover:bg-foreground/10 border border-border text-xs font-semibold text-foreground/70 hover:text-foreground/90 transition-all active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share link
              </button>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2 mb-5">
            <AnimatePresence initial={false}>
              {participants.map((p: Participant, i: number) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -14, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto', marginBottom: 0 }}
                  exit={{ opacity: 0, x: 14, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex items-center gap-3 bg-foreground/[0.04] rounded-2xl px-3.5 py-2.5"
                >
                  <div className="relative">
                    <Avatar name={p.username} index={i} />
                    <motion.div
                      animate={p.isReady ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background transition-colors duration-300 ${
                        p.isReady ? 'bg-green-400' : 'bg-foreground/15'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold truncate max-w-[120px]">{p.username}</span>
                      {p.username === username && <span className="text-[10px] text-muted-foreground">you</span>}
                      {i === 0 && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${p.isReady ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {p.isReady ? '✓ Ready' : 'Not ready yet'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Waiting slot */}
            {!partnerJoined && (
              <motion.div
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center gap-3 border border-dashed border-border rounded-2xl px-3.5 py-2.5"
              >
                <div className="w-11 h-11 rounded-full bg-foreground/[0.04] border border-dashed border-border flex items-center justify-center text-foreground/30 text-xs">
                  ?
                </div>
                <span className="text-sm text-muted-foreground">Waiting for your partner…</span>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            {/* Ready toggle — uses server state */}
            <button
              onClick={toggleReady}
              className={`w-full py-3 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                iAmReady
                  ? 'bg-green-500/12 border-green-500/25 text-green-400 hover:bg-green-500/18'
                  : 'bg-foreground/[0.05] border-border text-foreground/60 hover:text-foreground/80 hover:bg-foreground/[0.08]'
              }`}
            >
              {iAmReady ? '✓ Ready!' : 'Tap when ready'}
            </button>

            {isCreator ? (
              <motion.button
                onClick={startSession}
                whileTap={{ scale: 0.97 }}
                className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  allReady
                    ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90'
                    : 'bg-foreground/[0.07] text-muted-foreground border border-border'
                }`}
              >
                <Play className="w-4 h-4" />
                {allReady
                  ? "Everyone's ready — Start!"
                  : participants.length < 2
                  ? 'Start solo'
                  : 'Waiting for everyone…'
                }
              </motion.button>
            ) : (
              <div className="py-3 text-center">
                <motion.p
                  animate={{ opacity: [0.25, 0.6, 0.25] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                  className="text-xs text-muted-foreground"
                >
                  Waiting for the host to start…
                </motion.p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={leaveRoom}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave room
        </button>
      </motion.div>
    </div>
  )
}