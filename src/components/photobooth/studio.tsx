'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, ArrowLeft, Sparkles,
  FlipHorizontal2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Socket } from 'socket.io-client'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { useWebRTC } from '@/lib/use-webrtc'
import type { FilterId, CapturedPhoto } from '@/lib/types'
import { FILTERS, getFilterCss } from '@/lib/types'

const REACTION_EMOJIS = ['❤️', '😂', '😍', '🥰', '🎉', '✨', '🔥', '👏', '💕', '🤩']

type StudioPhase = 'setup' | 'countdown' | 'capture' | 'review'

export default function StudioView() {
  const {
    username, userId, roomCode, isCreator,
    selectedFilter, setSelectedFilter,
    totalPhotos, capturedPhotos, addPhoto,
    setView, setRoomState, setParticipants,
    reactions, addReaction,
  } = useAppStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [heartBursts, setHeartBursts] = useState<number[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Server-clock offset: serverTime ≈ Date.now() + serverOffset.current
  const serverOffset = useRef(0)

  const [phase, setPhase] = useState<StudioPhase>('setup')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentCapture, setCurrentCapture] = useState(1)
  const [flashActive, setFlashActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [mirrored, setMirrored] = useState(true)

  const participants = useAppStore(s => s.participants)
  const roomState = useAppStore(s => s.roomState)

  // Connect to WebSocket
  useEffect(() => {
    if (!roomCode || !username) return

    const socket: Socket = getSocket()

    const joinOrCreate = () => {
      // Studio should NEVER re-create or re-join a room.
      // create-room.tsx and join-room.tsx already handled that and set the sentinel.
      // Studio only needs to rejoin on reconnect (socket dropped mid-session).
      const sentinelKey = `snap_joined_${roomCode}`
      const alreadyJoined = sessionStorage.getItem(sentinelKey) === '1'

      if (alreadyJoined) {
        // Already in the room — just re-announce so server knows our socket ID
        socket.emit('rejoin-room', { code: roomCode, username })
        return
      }

      // Fallback: sentinel missing (e.g. hard refresh in studio).
      // Re-join/create as last resort only.
      console.warn('[Studio] sentinel missing for', roomCode, '— falling back to join/create')
      if (isCreator) {
        socket.emit('create-room', { username, theme: 'classic', filter: selectedFilter, code: roomCode })
      } else {
        socket.emit('join-room', { code: roomCode, username })
      }
      sessionStorage.setItem(sentinelKey, '1')
    }

    // Measure server clock offset (5 pings, keep lowest-RTT sample)
    const syncClock = () => {
      let best = { rtt: Infinity, offset: 0 }
      let done = 0
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now()
        socket.emit('time-sync', t0, (serverTime: number) => {
          const rtt = Date.now() - t0
          if (rtt < best.rtt) best = { rtt, offset: serverTime + rtt / 2 - Date.now() }
          if (++done === 5) serverOffset.current = best.offset
        })
      }
    }

    if (socket.connected) {
      setSocketStatus('connected')
      joinOrCreate()
      syncClock()
    } else {
      socket.once('connect', joinOrCreate)
      socket.on('connect', () => { setSocketStatus('connected'); syncClock() })
      socket.on('connect_error', () => setSocketStatus('error'))
      socket.on('disconnect', () => setSocketStatus('connecting'))
      socket.connect()
    }

    socket.on('room-created', (data: any) => {
      setRoomState({ ...data, code: data.code || roomCode })
      setParticipants(data.participants || [])
    })

    socket.on('room-joined', (data: any) => {
      setRoomState({ ...data, code: data.code || roomCode })
      setParticipants(data.participants || [])
    })

    socket.on('participant-joined', (data: any) => {
      setParticipants(data.room?.participants || [])
      setRoomState(data.room)
      toast.info(`${data.participant?.username} joined the room`)
    })

    socket.on('participant-left', (data: any) => {
      setParticipants(data.room?.participants || [])
      setRoomState(data.room)
      if (data.participant?.username) {
        toast.info(`${data.participant.username} left`)
      }
    })

    socket.on('participant-updated', (data: any) => {
      setParticipants(data.room?.participants || [])
      setRoomState(data.room)
    })

    socket.on('settings-updated', (data: any) => {
      setRoomState(data.room)
      // Sync filter to partner — partner's filter change arrives here
      if (data.room?.filter && data.room.filter !== 'none') {
        setSelectedFilter(data.room.filter as FilterId)
      } else if (data.room?.filter === 'none') {
        setSelectedFilter('none')
      }
    })

    // BUG-02: server room expired (restart) — clear sentinel and rejoin fresh
    socket.on('room-expired', (data: { code: string }) => {
      sessionStorage.removeItem(`snap_joined_${data.code}`)
      if (isCreator) {
        socket.emit('create-room', { username, theme: 'classic', filter: selectedFilter, code: data.code })
      } else {
        socket.emit('join-room', { code: data.code, username })
      }
      sessionStorage.setItem(`snap_joined_${data.code}`, '1')
    })

    socket.on('session-started', (data: any) => {
      setRoomState(data.room)
    })

    socket.on('countdown-start', (data: any) => {
      setCurrentCapture(data.photo)
      startCountdownSequence(data.count ?? 5)
    })

    socket.on('capture-now', (data: any) => {
      // Fire at the same server instant on every device
      const fireAt = (data.captureAt ?? Date.now()) - serverOffset.current
      const delay = Math.max(0, fireAt - Date.now())
      setTimeout(() => capturePhotoRef.current(data.photo), delay)
    })

    socket.on('session-review', (data: any) => {
      setRoomState(data.room)
      setPhase('review')
    })

    socket.on('photo-received', (data: any) => {
      setRoomState(data.room)
    })

    socket.on('session-complete', (data: any) => {
      setRoomState(data.room)
      setPhase('review')
    })

    socket.on('strip-open', () => {
      setView('stripBuilder')
    })

    socket.on('reaction-received', (data: any) => {
      addReaction({
        userId: data.userId,
        username: data.username,
        emoji: data.emoji,
        timestamp: data.timestamp,
      })
    })

    socket.on('error', (err: any) => {
      toast.error(err.message || 'Connection error')
    })

    socketRef.current = socket

    return () => {
      socket.off('room-created')
      socket.off('room-joined')
      socket.off('participant-joined')
      socket.off('participant-left')
      socket.off('participant-updated')
      socket.off('settings-updated')
      socket.off('session-started')
      socket.off('strip-open')
      socket.off('capture-now')
      socket.off('session-review')
      socket.off('countdown-start')
      socket.off('photo-received')
      socket.off('session-complete')
      socket.off('reaction-received')
      socket.off('connect', syncClock)
      socket.off('error')
    }
  }, []) // run ONCE on mount — roomCode/username read from Zustand inside

  // Camera setup
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  useEffect(() => {
    let mounted = true

    function friendlyCameraError(err: any): string {
      switch (err?.name) {
        case 'NotReadableError':
        case 'TrackStartError':
          return 'Camera is being used by another app or browser tab. Close it there, then tap Retry.'
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          return 'Camera permission was blocked. Allow camera access in your browser settings, then tap Retry.'
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          return 'No camera found on this device.'
        case 'OverconstrainedError':
          return 'Camera does not support the requested resolution.'
        default:
          return err?.message || 'Could not access the camera.'
      }
    }

    async function startCamera() {
      setCameraError(null)
      setCameraReady(false)
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          window.isSecureContext
            ? 'This browser does not support camera access.'
            : 'Camera needs a secure (HTTPS) connection. Open the app via HTTPS or localhost.'
        )
        return
      }
      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } catch (firstErr: any) {
          if (firstErr?.name === 'OverconstrainedError' || firstErr?.name === 'NotReadableError') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          } else {
            throw firstErr
          }
        }
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        setLocalStream(stream)
        // Don't attach srcObject here — videoRef.current may be null if
        // the video element hasn't rendered yet. The useEffect below handles it.
      } catch (err: any) {
        if (mounted) setCameraError(friendlyCameraError(err))
      }
    }

    startCamera()
    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setLocalStream(null)
    }
  }, [cameraAttempt])

  // --- Live partner video (WebRTC) ---
  // BUG FIX: always use getSocket() — socketRef.current is null on first render
  // because it's set inside a useEffect. getSocket() returns the same singleton.
  const { remoteStream, connected: peerConnected } = useWebRTC({
    socket: roomCode ? getSocket() : null,
    localStream,
    isInitiator: isCreator,
    participantCount: participants.length,
  })

  // Attach local stream to video element whenever stream or element becomes available
  useEffect(() => {
    const video = videoRef.current
    if (!video || !localStream) return
    if (video.srcObject === localStream) return // already attached
    video.srcObject = localStream
    video.onloadedmetadata = () => setCameraReady(true)
    // Some browsers need explicit play() after srcObject assignment
    video.play().catch(() => {/* autoplay policy — user gesture required */})
  }, [localStream, cameraReady]) // cameraReady dep re-runs if video re-mounts

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  const partnerName = participants.find(p => p.username !== username)?.username || 'partner'

  const capturePhoto = useCallback((order: number) => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const remote = remoteVideoRef.current
    const hasRemote = !!(remote && remoteStream && remote.videoWidth > 0)

    // Bake the selected CSS filter into canvas pixels so it appears in the
    // saved photo, not just the live preview. ctx.filter mirrors CSS filter.
    const filterCssValue = getFilterCss(selectedFilter) || 'none'

    if (hasRemote) {
      const h = Math.min(video.videoHeight, remote!.videoHeight) || 720
      const wL = Math.round(h * (video.videoWidth / video.videoHeight))
      const wR = Math.round(h * (remote!.videoWidth / remote!.videoHeight))
      canvas.width = wL + wR
      canvas.height = h

      ctx.filter = filterCssValue
      ctx.save()
      if (mirrored) {
        ctx.translate(wL, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, wL, h)
      } else {
        ctx.drawImage(video, 0, 0, wL, h)
      }
      ctx.restore()
      ctx.drawImage(remote!, wL, 0, wR, h)
      ctx.filter = 'none'

      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillRect(wL - 1, 0, 2, h)
    } else {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      ctx.filter = filterCssValue
      if (mirrored) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0)
      ctx.filter = 'none'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    const photo: CapturedPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dataUrl,
      filter: selectedFilter,
      order,
      timestamp: Date.now(),
      userId: userId || 'local',
    }

    addPhoto(photo)
    setCurrentCapture(order)

    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 600)

    if (navigator.vibrate) navigator.vibrate(50)
  }, [selectedFilter, userId, mirrored, addPhoto, remoteStream])

  const capturePhotoRef = useRef(capturePhoto)
  useEffect(() => { capturePhotoRef.current = capturePhoto }, [capturePhoto])

  const startCountdownSequence = useCallback((secs = 5) => {
    setPhase('countdown')
    let count = secs
    setCountdown(count)

    const interval = setInterval(() => {
      count--
      if (count > 0) {
        setCountdown(count)
      } else {
        clearInterval(interval)
        setCountdown(null)
        setPhase('capture')
      }
    }, 1000)
  }, [])

  const handleStartSession = () => {
    socketRef.current?.emit('start-session')
  }

  const handleToggleReady = () => {
    setIsReady(prev => !prev)
    socketRef.current?.emit('toggle-ready')
  }

  const handleSendReaction = (emoji: string) => {
    addReaction({ userId: userId || 'local', username: username, emoji, timestamp: Date.now() })
    socketRef.current?.emit('send-reaction', { emoji })
  }

  const handleRetake = (order: number) => {
    toast.info(`Retake photo ${order} — feature coming soon!`)
  }

  const filterCss = getFilterCss(selectedFilter)
  const floatingReactions = reactions.slice(-5)

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14">
          <Button variant="ghost" size="sm" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); socketRef.current?.emit('leave-room'); disconnectSocket(); setView('landing') }} className="text-white/80 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Leave
          </Button>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-lg bg-white/10 text-white/90 text-sm font-mono tracking-wider">
              {roomCode}
            </div>
            <div className="flex -space-x-2">
              {participants.slice(0, 4).map((p) => (
                <div key={p.id} className="w-7 h-7 rounded-full bg-primary/30 border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                  {p.username.charAt(0).toUpperCase()}
                </div>
              ))}
              {participants.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-[10px] text-white/70">
                  +{participants.length - 4}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Camera Area */}
      <div className="flex-1 flex items-center justify-center pt-14 pb-24 relative">
        <div className={`relative w-full mx-auto px-4 ${participants.length > 1 ? 'max-w-4xl' : 'max-w-2xl'}`}>
          <div className={`relative rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl ring-1 ring-white/10 ${
            participants.length > 1 ? 'aspect-[16/9] sm:aspect-[2/1]' : 'aspect-[4/3]'
          }`}>
            <div className="flex h-full">
              {/* You */}
              <div className={`relative h-full ${participants.length > 1 ? 'w-1/2' : 'w-full'}`}>
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 p-6 text-center">
                    <Camera className="w-10 h-10 mb-3 opacity-50" />
                    <p className="text-xs sm:text-sm max-w-xs mb-4">{cameraError}</p>
                    <Button
                      variant="outline"
                      onClick={() => setCameraAttempt(a => a + 1)}
                      className="rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Retry Camera
                    </Button>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
                    style={{ filter: filterCss || undefined }}
                  />
                )}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md text-white text-[11px] font-semibold whitespace-nowrap">
                  {username || 'You'}
                </div>
              </div>

              {/* Partner half */}
              {participants.length > 1 && (
                <div
                  className="relative h-full w-1/2 border-l border-white/15 bg-neutral-950"
                  onDoubleClick={() => {
                    setHeartBursts(prev => [...prev, Date.now()])
                    handleSendReaction('❤️')
                  }}
                >
                  {remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ filter: filterCss || undefined }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <p className="text-sm text-white/60 text-center">
                        waiting for {partnerName}&apos;s camera
                        <motion.span
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        >...</motion.span>
                      </p>
                    </div>
                  )}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold whitespace-nowrap max-w-[85%] truncate">
                    {partnerName}
                  </div>
                  {remoteStream && (
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-md">
                      <span className={`w-1.5 h-1.5 rounded-full ${peerConnected ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                      <span className="text-[9px] font-semibold tracking-wider text-white/80">LIVE</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Heart bursts (double-tap partner) */}
            <AnimatePresence>
              {heartBursts.map((t) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 1, scale: 0.4 }}
                  animate={{ opacity: 0, scale: 2.2, y: -50 }}
                  transition={{ duration: 1 }}
                  onAnimationComplete={() => setHeartBursts(prev => prev.filter(x => x !== t))}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 text-7xl"
                >
                  ❤️
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Flash Overlay */}
            <AnimatePresence>
              {flashActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white animate-camera-flash pointer-events-none z-30"
                />
              )}
            </AnimatePresence>

            {/* Countdown Overlay */}
            <AnimatePresence>
              {countdown !== null && countdown > 0 && (
                <motion.div
                  key={countdown}
                  initial={{ opacity: 0, scale: 2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 z-30"
                >
                  <div className="animate-countdown text-9xl font-bold text-white drop-shadow-2xl">
                    {countdown}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Photo Progress */}
            {(phase === 'capture' || phase === 'countdown') && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-2">
                  <span className="text-white text-sm font-medium">{currentCapture} / {totalPhotos}</span>
                  <div className="flex gap-1.5 items-center">
                    {Array.from({ length: totalPhotos }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all duration-300 ${
                          i + 1 < currentCapture ? 'w-2 h-2 bg-green-400' :
                          i + 1 === currentCapture ? 'w-3 h-3 bg-white scale-110' :
                          'w-2 h-2 bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Captured filmstrip — below frame, never overlapping */}
          {capturedPhotos.length > 0 && phase !== 'review' && (
            <div className="mt-2 px-1">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {[...capturedPhotos].sort((a, b) => a.order - b.order).map((p, i) => (
                  <div
                    key={p.id}
                    className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-green-400/60 shadow-lg"
                  >
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold text-white bg-black/50 rounded px-0.5 leading-none py-0.5">{i + 1}</span>
                  </div>
                ))}
                {/* Empty slots */}
                {Array.from({ length: Math.max(0, totalPhotos - capturedPhotos.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/20 bg-white/5" />
                ))}
              </div>
            </div>
          )}

          {/* Filter row — thumbnail + name, always below frame */}
          {phase === 'setup' && !cameraError && (
            <div className="relative mt-3 z-20 px-1 sm:px-3">
              <div className="flex gap-3 overflow-x-auto no-scrollbar justify-start sm:justify-center items-end py-2">
                {FILTERS.map((f) => {
                  const active = selectedFilter === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => { setSelectedFilter(f.id as FilterId); socketRef.current?.emit('update-filter', { filter: f.id }) }}
                      className="shrink-0 flex flex-col items-center gap-1.5"
                    >
                      {/* Thumbnail — live video frame with filter baked via CSS */}
                      <span className={`relative block w-14 h-14 rounded-xl overflow-hidden transition-all duration-200 ${
                        active
                          ? 'ring-2 ring-white scale-110 shadow-xl'
                          : 'ring-1 ring-white/20 opacity-70 hover:opacity-100 hover:scale-105'
                      }`}>
                        {cameraReady ? (
                          <video
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover pointer-events-none ${mirrored ? 'scale-x-[-1]' : ''}`}
                            style={{ filter: f.css || undefined }}
                            ref={(el) => {
                              if (el && localStream) {
                                if (el.srcObject !== localStream) {
                                  el.srcObject = localStream
                                  el.play().catch(() => {})
                                }
                              }
                            }}
                          />
                        ) : (
                          <span
                            className="block w-full h-full bg-gradient-to-br from-neutral-600 to-neutral-800"
                            style={{ filter: f.css || undefined }}
                          />
                        )}
                        {active && (
                          <span className="absolute inset-0 ring-2 ring-inset ring-white/40 rounded-xl pointer-events-none" />
                        )}
                      </span>
                      {/* Name — always visible */}
                      <span className={`text-[9px] font-medium drop-shadow whitespace-nowrap ${
                        active ? 'text-white' : 'text-white/60'
                      }`}>
                        {f.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ready status */}
          {phase === 'setup' && participants.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.isReady ? 'bg-green-400' : 'bg-white/30'}`} />
                  <span className="text-[11px] text-white/85 max-w-[90px] truncate">{p.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Reactions */}
        <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
          {floatingReactions.map((r, i) => (
            <motion.div
              key={`${r.timestamp}-${i}`}
              initial={{ opacity: 1, x: 20, scale: 0.5 }}
              animate={{ opacity: 0, x: 40, y: -60, scale: 1.2 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="text-2xl"
            >
              {r.emoji}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Reaction Bar */}
        {phase !== 'review' && (
          <div className="flex justify-center mb-2">
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 flex gap-1"
              >
                {REACTION_EMOJIS.slice(0, 5).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <div className="bg-black/70 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <AnimatePresence mode="wait">
              {/* Setup Phase Controls */}
              {phase === 'setup' && (
                <motion.div
                  key="setup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-3"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMirrored(!mirrored)}
                    className={`rounded-xl shrink-0 ${mirrored ? 'bg-white/20 text-white' : 'text-white/70'}`}
                  >
                    <FlipHorizontal2 className="w-5 h-5" />
                  </Button>

                  <Button
                    size="lg"
                    onClick={handleStartSession}
                    disabled={!cameraReady}
                    className="flex-1 rounded-2xl py-6 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Start Session
                  </Button>
                </motion.div>
              )}

              {/* Capture Phase Controls */}
              {phase === 'capture' && (
                <motion.div
                  key="capture"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-center gap-4"
                >
                  <div className="flex items-center gap-3 text-white/80 text-sm font-medium py-3">
                    <motion.span
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="w-3 h-3 rounded-full bg-red-500"
                    />
                    Capturing {currentCapture} of {roomState?.totalPhotos ?? 6}...
                  </div>
                </motion.div>
              )}

              {/* Review Phase Controls */}
              {phase === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-3"
                >
                  {capturedPhotos.length > 0 && (
                    <div className="flex gap-2 justify-center mb-2">
                      {[...capturedPhotos].sort((a, b) => a.order - b.order).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleRetake(p.order)}
                          className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/30 hover:border-white/60 transition-colors"
                        >
                          <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { setPhase('setup'); setCurrentCapture(1); }}
                      className="flex-1 rounded-2xl py-5 text-white border-white/20 hover:bg-white/10"
                    >
                      Retake All
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => { socketRef.current?.emit('strip-open'); setView('stripBuilder') }}
                      className="flex-[2] rounded-2xl py-5 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Make Your Strip
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}