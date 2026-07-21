'use client'

import { useAppStore } from '@/lib/store'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ArrowRight, LogIn, GalleryHorizontalEnd, User } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import ThemeToggle from '@/components/theme-toggle'
import { toast } from 'sonner'

const STEPS = [
  { emoji: '✍️', label: 'Enter your name' },
  { emoji: '🔗', label: 'Create or join' },
  { emoji: '📸', label: 'Shoot together' },
  { emoji: '🎞️', label: 'Download strip' },
]

// ─── Socket helpers — outside component so React Compiler never analyses them ─

type RoomCallbacks = {
  setRoomCode: (c: string) => void
  setRoomState: (s: any) => void
  setParticipants: (p: any[]) => void
  setIsCreator: (b: boolean) => void
  setIsWorking: (b: boolean) => void
  setView: (v: any) => void
  setUserId: (id: string) => void
  setSessionId: (id: string | null) => void
}

function socketCreate(uname: string, cb: RoomCallbacks) {
  const socket = getSocket()
  const onCreated = (roomData: any) => {
    cb.setRoomCode(roomData.code)
    cb.setRoomState(roomData)
    cb.setParticipants(roomData.participants || [])
    cb.setIsCreator(true)
    cb.setIsWorking(false)
    sessionStorage.setItem(`snap_joined_${roomData.code}`, '1')
    cb.setView('lobby')
    clearTimeout(t)
    socket.off('room-created', onCreated)
    socket.off('error', onErr)
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, theme: 'classic', filter: 'none', code: roomData.code }),
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { cb.setUserId(d.user.id); cb.setSessionId(d.session.id) } })
      .catch(() => {})
  }
  const onErr = (err: any) => {
    toast.error(err.message || 'Could not connect — check your internet')
    cb.setIsWorking(false)
    clearTimeout(t)
    socket.off('room-created', onCreated)
    socket.off('error', onErr)
  }
  const t = setTimeout(() => onErr({ message: 'Server unreachable. Is the socket service running?' }), 10000)
  socket.on('room-created', onCreated)
  socket.on('error', onErr)
  const emit = () => socket.emit('create-room', { username: uname, theme: 'classic', filter: 'none', totalPhotos: 6 })
  if (socket.connected) { emit() } else { socket.once('connect', emit); socket.connect() }
}

function socketJoin(raw: string, uname: string, cb: RoomCallbacks) {
  const socket = getSocket()
  const onJoined = (roomData: any) => {
    const finalCode = roomData.code || raw
    cb.setIsCreator(false)
    cb.setRoomCode(finalCode)
    cb.setRoomState(roomData)
    cb.setParticipants(roomData.participants || [])
    cb.setIsWorking(false)
    sessionStorage.setItem(`snap_joined_${finalCode}`, '1')
    cb.setView('lobby')
    clearTimeout(t)
    socket.off('room-joined', onJoined)
    socket.off('error', onErr)
    fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: raw, username: uname }),
    }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { cb.setUserId(d.user.id); cb.setSessionId(d.session.id) } })
      .catch(() => {})
  }
  const onErr = (err: any) => {
    toast.error(err.message || 'Room not found — check the code and try again')
    cb.setIsWorking(false)
    clearTimeout(t)
    socket.off('room-joined', onJoined)
    socket.off('error', onErr)
  }
  const t = setTimeout(() => onErr({ message: 'Server unreachable' }), 10000)
  socket.on('room-joined', onJoined)
  socket.on('error', onErr)
  const emit = () => socket.emit('join-room', { code: raw, username: uname })
  if (socket.connected) { emit() } else { socket.once('connect', emit); socket.connect() }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingView() {
  const {
    setView, setUsername, username, setUserId,
    setRoomCode, setIsCreator, setRoomState,
    setParticipants, setSessionId,
  } = useAppStore()
  const { data: session } = useSession()

  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [focused, setFocused] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const joinInputRef = useRef<HTMLInputElement>(null)
  // Pending deep-link code — set once on mount, consumed when mode=join
  const pendingRef = useRef<string | null>(null)

  // Stable callbacks object — initialised once, updated in an effect so we
  // never mutate a ref during render (which React 19 strict mode forbids)
  const cbRef = useRef<RoomCallbacks>({
    setRoomCode, setRoomState, setParticipants, setIsCreator,
    setIsWorking, setView, setUserId, setSessionId,
  })
  useEffect(() => {
    cbRef.current.setRoomCode = setRoomCode
    cbRef.current.setRoomState = setRoomState
    cbRef.current.setParticipants = setParticipants
    cbRef.current.setIsCreator = setIsCreator
    cbRef.current.setIsWorking = setIsWorking
    cbRef.current.setView = setView
    cbRef.current.setUserId = setUserId
    cbRef.current.setSessionId = setSessionId
  }) // no dep array — runs after every render, keeps ref current

  // Auto-fill username from NextAuth session
  useEffect(() => {
    if (session?.user?.username && !username) {
      setUsername(session.user.username)
      if (session.user.id) setUserId(session.user.id)
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link: read sessionStorage once on mount, don't call setState here
  useEffect(() => {
    const pending = sessionStorage.getItem('snap_pending_join')
    if (pending) {
      sessionStorage.removeItem('snap_pending_join')
      pendingRef.current = pending
      setMode('join') // only setState allowed: switches tab
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const canProceed = username.trim().length >= 1

  function handleCreate() {
    const uname = username.trim()
    if (!uname) { nameRef.current?.focus(); return }
    setIsWorking(true)
    socketCreate(uname, cbRef.current)
  }

  function handleJoin(overrideCode?: string) {
    const uname = username.trim()
    const raw = (overrideCode ?? joinCode).trim().toUpperCase()
    if (!uname) { nameRef.current?.focus(); return }
    if (raw.length !== 6) { toast.error('Enter the full 6-character room code'); return }
    setIsWorking(true)
    socketJoin(raw, uname, cbRef.current)
  }

  // Once mode flips to join AND there's a pending deep-link code, fill + submit
  // This runs after render so setJoinCode here is fine (not in effect body)
  useEffect(() => {
    if (mode !== 'join' || !pendingRef.current) return
    const code = pendingRef.current
    pendingRef.current = null
    setJoinCode(code)
    if (username.trim()) {
      const t = setTimeout(() => handleJoin(code), 150)
      return () => clearTimeout(t)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-16 w-[480px] h-[480px] rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute -bottom-24 -right-16 w-[380px] h-[380px] rounded-full bg-violet-500/6 blur-[120px]" />
        <div className="absolute top-1/2 left-1/3 w-[280px] h-[280px] rounded-full bg-rose-500/4 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-5 h-14 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">SnapTogether</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('gallery')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground/80 hover:bg-foreground/[0.06] transition-all text-xs flex items-center gap-1.5"
          >
            <GalleryHorizontalEnd className="w-4 h-4" />
            <span className="hidden sm:inline">Gallery</span>
          </button>
          <ThemeToggle />
          <button
            onClick={() => session ? signOut() : setView('auth')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground/80 hover:bg-foreground/[0.06] transition-all text-xs flex items-center gap-1.5"
          >
            {session?.user?.image
              ? <img src={session.user.image} className="w-5 h-5 rounded-full" alt="" />
              : session ? <User className="w-4 h-4" /> : <LogIn className="w-4 h-4" />
            }
            <span className="hidden sm:inline">{session ? session.user.username : 'Sign in'}</span>
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-[360px]">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center mb-6"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-[24px] bg-primary/10 animate-pulse-ring" />
              <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-primary/25 to-violet-500/15 border border-border flex items-center justify-center shadow-xl shadow-primary/10">
                <Camera className="w-7 h-7 text-primary" />
              </div>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="text-center mb-7"
          >
            <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight mb-2">
              Capture moments<br />
              <span className="gradient-text">together, anywhere</span>
            </h1>
            <p className="text-sm text-muted-foreground">Real-time photo booth for two</p>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14 }}
            className="glass-strong rounded-3xl p-5 mb-4 shadow-2xl shadow-foreground/10"
          >
            {/* Name */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">
                Your name
              </label>
              <input
                ref={nameRef}
                type="text"
                placeholder="e.g. Alex"
                value={username}
                onChange={e => setUsername(e.target.value.slice(0, 20))}
                onKeyDown={e => { if (e.key === 'Enter') mode === 'create' ? handleCreate() : handleJoin() }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                maxLength={20}
                autoComplete="nickname"
                className={`w-full rounded-xl px-4 py-3 text-base font-semibold bg-foreground/[0.06] border outline-none transition-all placeholder:text-foreground/30 ${
                  focused
                    ? 'border-primary/50 bg-foreground/[0.08] shadow-[0_0_0_3px_oklch(0.65_0.22_350/0.12)]'
                    : 'border-border hover:border-border/60'
                }`}
              />
            </div>

            {/* Tab toggle */}
            <div className="flex bg-foreground/[0.05] rounded-2xl p-1 mb-4 gap-1">
              {(['create', 'join'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    if (m === 'join') setTimeout(() => joinInputRef.current?.focus(), 50)
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all relative overflow-hidden ${
                    mode === m ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/65'
                  }`}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-foreground/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">
                    {m === 'create' ? '✦ New room' : '→ Join room'}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {mode === 'create' ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    onClick={handleCreate}
                    disabled={isWorking || !canProceed}
                    className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isWorking ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        Create a room
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-foreground/30 mt-2">
                    You'll get a 6-letter code to share
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">
                      Room code
                    </label>
                    <div className="relative h-14">
                      {/* Visual letter boxes */}
                      <div className="absolute inset-0 flex gap-1.5 pointer-events-none" aria-hidden>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-full rounded-xl border flex items-center justify-center text-lg font-bold font-mono transition-all duration-150 ${
                              i < joinCode.length
                                ? 'bg-primary/15 border-primary/50 text-foreground'
                                : i === joinCode.length
                                ? 'bg-foreground/[0.08] border-primary/30 text-foreground/30'
                                : 'bg-foreground/[0.04] border-border text-foreground/20'
                            }`}
                          >
                            {joinCode[i] ?? '·'}
                          </div>
                        ))}
                      </div>
                      {/* Real input overlaying boxes */}
                      <input
                        ref={joinInputRef}
                        type="text"
                        inputMode="text"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                        onKeyDown={e => { if (e.key === 'Enter') handleJoin() }}
                        maxLength={6}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-text caret-transparent"
                        aria-label="Room code"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoin()}
                    disabled={isWorking || joinCode.length !== 6 || !canProceed}
                    className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-35"
                  >
                    {isWorking ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Join room <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-4 gap-2"
          >
            {STEPS.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-xl bg-foreground/[0.05] border border-border flex items-center justify-center text-base">
                  {s.emoji}
                </div>
                <span className="text-[9px] leading-tight text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  )
}