'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, ArrowLeft, Sparkles, Send, Check, Settings2,
  ChevronLeft, ChevronRight, Download, Heart, Loader2,
  ThumbsUp, PartyPopper, Star, Zap, X, Info, FlipHorizontal2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Socket } from 'socket.io-client'
import { getSocket, disconnectSocket } from '@/lib/socket'
import type { FilterId, CapturedPhoto, Participant, RoomState } from '@/lib/types'
import { FILTERS, getFilterCss } from '@/lib/types'
import type { StripLayout } from '@/lib/types'

const REACTION_EMOJIS = ['❤️', '😂', '😍', '🥰', '🎉', '✨', '🔥', '👏', '💕', '🤩']

type StudioPhase = 'setup' | 'countdown' | 'capture' | 'review'

export default function StudioView() {
  const {
    username, userId, roomCode, isCreator,
    selectedFilter, setSelectedFilter,
    totalPhotos, capturedPhotos, addPhoto,
    setView, setRoomState, setParticipants,
    setFinalStripData, setAiCaption,
    stripLayout, reactions, addReaction,
  } = useAppStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const [phase, setPhase] = useState<StudioPhase>('setup')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentCapture, setCurrentCapture] = useState(1)
  const [flashActive, setFlashActive] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [allReady, setAllReady] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [mirrored, setMirrored] = useState(true)

  const participants = useAppStore(s => s.participants)
  const roomState = useAppStore(s => s.roomState)

  // Connect to WebSocket
  useEffect(() => {
    if (!roomCode || !username) return

    const socket: Socket = getSocket()

    const joinOrCreate = () => {
      // If this socket already has an active room (it was created/joined
      // in the Create Room / Join Room screen right before navigating
      // here), don't create or join again — that would spin up a second,
      // disconnected room on the server and orphan the one everyone
      // already has the code for.
      if (roomState?.code === roomCode) return

      if (isCreator) {
        socket.emit('create-room', { username, theme: 'classic', filter: selectedFilter, code: roomCode })
      } else {
        socket.emit('join-room', { code: roomCode, username })
      }
    }

    if (socket.connected) {
      joinOrCreate()
    } else {
      socket.once('connect', joinOrCreate)
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
    })

    socket.on('session-started', (data: any) => {
      setRoomState(data.room)
      startCountdownSequence()
    })

    socket.on('countdown-start', (data: any) => {
      startCountdownSequence()
    })

    socket.on('photo-received', (data: any) => {
      setRoomState(data.room)
    })

    socket.on('session-complete', (data: any) => {
      setRoomState(data.room)
      setPhase('review')
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
      socket.off('countdown-start')
      socket.off('photo-received')
      socket.off('session-complete')
      socket.off('reaction-received')
      socket.off('error')
    }
  }, [roomCode])

  // Camera setup
  const [cameraAttempt, setCameraAttempt] = useState(0)
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
      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } catch (firstErr: any) {
          // Fallback: minimal constraints (helps on devices that reject ideal res)
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true)
          }
        }
      } catch (err: any) {
        if (mounted) setCameraError(friendlyCameraError(err))
      }
    }

    startCamera()
    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [cameraAttempt])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    if (mirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Apply filter via CSS on canvas
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    const photo: CapturedPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dataUrl,
      filter: selectedFilter,
      order: currentCapture,
      timestamp: Date.now(),
      userId: userId || 'local',
    }

    addPhoto(photo)
    socketRef.current?.emit('photo-captured', {
      imageData: dataUrl,
      order: currentCapture,
    })

    // Flash effect
    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 600)

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50)

    // Next photo or complete
    if (currentCapture < totalPhotos) {
      setTimeout(() => {
        setCurrentCapture(prev => prev + 1)
      }, 1500)
    } else {
      setTimeout(() => {
        setPhase('review')
      }, 1500)
    }
  }, [currentCapture, totalPhotos, selectedFilter, userId, mirrored, addPhoto])

  const startCountdownSequence = useCallback(() => {
    setPhase('countdown')
    let count = 3
    setCountdown(count)

    const interval = setInterval(() => {
      count--
      if (count > 0) {
        setCountdown(count)
      } else {
        clearInterval(interval)
        setCountdown(null)
        setPhase('capture')
        // Capture after a brief moment
        setTimeout(() => capturePhoto(), 200)
      }
    }, 1000)
  }, [capturePhoto])

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

  const handleGenerateStrip = async () => {
    const photos = capturedPhotos.sort((a, b) => a.order - b.order)
    if (photos.length === 0) return

    const stripCanvas = document.createElement('canvas')
    const ctx = stripCanvas.getContext('2d')
    if (!ctx) return

    const padding = 24
    const gap = 12
    const photoW = 400
    const photoH = 300
    const headerH = 80
    const footerH = 60

    stripCanvas.width = photoW + padding * 2
    stripCanvas.height = headerH + (photoH + gap) * photos.length + footerH

    // Background
    ctx.fillStyle = '#faf9f7'
    ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height)

    // Border
    ctx.strokeStyle = '#e5e2de'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, stripCanvas.width - 2, stripCanvas.height - 2)

    // Header
    ctx.fillStyle = '#333'
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SnapTogether', stripCanvas.width / 2, 35)

    ctx.fillStyle = '#999'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), stripCanvas.width / 2, 58)

    // Load every photo first — drawing a data URL into an <img> is async,
    // so we must wait for each to actually decode before drawImage runs.
    // Skipping this wait is why only whichever photo happened to already
    // be cached (usually just the last one) ever showed up in the strip.
    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })

    const loadedImages = await Promise.all(photos.map((p) => loadImage(p.dataUrl)))

    // Photos — crop-to-fill (like CSS object-fit: cover) instead of
    // stretching, so faces don't get squished into the fixed frame size.
    photos.forEach((photo, i) => {
      const img = loadedImages[i]
      const y = headerH + i * (photoH + gap)

      // Rounded rect clip
      const r = 8
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(padding + r, y)
      ctx.lineTo(padding + photoW - r, y)
      ctx.quadraticCurveTo(padding + photoW, y, padding + photoW, y + r)
      ctx.lineTo(padding + photoW, y + photoH - r)
      ctx.quadraticCurveTo(padding + photoW, y + photoH, padding + photoW - r, y + photoH)
      ctx.lineTo(padding + r, y + photoH)
      ctx.quadraticCurveTo(padding, y + photoH, padding, y + photoH - r)
      ctx.lineTo(padding, y + r)
      ctx.quadraticCurveTo(padding, y, padding + r, y)
      ctx.closePath()
      ctx.clip()

      // Compute a source crop rect that fills the destination box while
      // preserving the image's own aspect ratio.
      const srcRatio = img.naturalWidth / img.naturalHeight
      const dstRatio = photoW / photoH
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
      if (srcRatio > dstRatio) {
        // source is wider than destination — crop the sides
        sw = img.naturalHeight * dstRatio
        sx = (img.naturalWidth - sw) / 2
      } else {
        // source is taller than destination — crop top/bottom
        sh = img.naturalWidth / dstRatio
        sy = (img.naturalHeight - sh) / 2
      }

      ctx.drawImage(img, sx, sy, sw, sh, padding, y, photoW, photoH)
      ctx.restore()

      // Photo number
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(padding + photoW - 36, y + 8, 28, 22)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${i + 1}`, padding + photoW - 22, y + 24)
    })

    // Footer
    const footerY = stripCanvas.height - 40
    ctx.fillStyle = '#bbb'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${photos.length} memories captured together`, stripCanvas.width / 2, footerY)

    const stripData = stripCanvas.toDataURL('image/jpeg', 0.9)
    setFinalStripData(stripData)

    // Get AI caption
    try {
      const captionRes = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', context: `${photos.length} photos in a photobooth session` }),
      })
      const captionData = await captionRes.json()
      setAiCaption(captionData.caption)
    } catch {
      setAiCaption('A moment worth remembering ✨')
    }

    setView('result')
  }

  const handleRetake = (order: number) => {
    // In review, allow individual retake
    toast.info(`Retake photo ${order} — feature coming soon!`)
  }

  const filterCss = getFilterCss(selectedFilter)

  // Floating reactions
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
        {/* Camera Preview */}
        <div className="relative w-full max-w-2xl mx-auto px-4">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-gray-900 shadow-2xl">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 p-8 text-center">
                <Camera className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm max-w-xs mb-5">{cameraError}</p>
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

            {/* Flash Overlay */}
            <AnimatePresence>
              {flashActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white animate-camera-flash pointer-events-none"
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
                  className="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <div className="animate-countdown text-9xl font-bold text-white drop-shadow-2xl">
                    {countdown}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Photo Progress */}
            {(phase === 'capture' || phase === 'countdown') && (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 text-sm text-white font-medium">
                  Photo {currentCapture} / {totalPhotos}
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: totalPhotos }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        i + 1 < currentCapture ? 'bg-green-400' :
                        i + 1 === currentCapture ? 'bg-white scale-125' :
                        'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Captured Thumbnails */}
            {capturedPhotos.length > 0 && phase !== 'review' && (
              <div className="absolute bottom-4 left-4 flex gap-2">
                {capturedPhotos.sort((a, b) => a.order - b.order).map((p) => (
                  <div key={p.id} className="w-14 h-14 rounded-lg overflow-hidden border-2 border-white/40 shadow-lg">
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Ready indicator */}
            {phase === 'setup' && participants.length > 1 && (
              <div className="absolute top-4 left-4 right-4">
                <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white/80">Participants</span>
                    <span className="text-xs text-white/60">{participants.filter(p => p.isReady).length}/{participants.length} ready</span>
                  </div>
                  <div className="space-y-1.5">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-white/80 flex-1">{p.username}</span>
                        {p.isReady ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-white/30" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
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
                  {/* Filter Toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className={`rounded-xl shrink-0 ${showFilterPanel ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </Button>

                  {/* Mirror Toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMirrored(!mirrored)}
                    className={`rounded-xl shrink-0 ${mirrored ? 'bg-white/20 text-white' : 'text-white/70'}`}
                  >
                    <FlipHorizontal2 className="w-5 h-5" />
                  </Button>

                  {/* Ready / Start Button */}
                  {isCreator ? (
                    <Button
                      size="lg"
                      onClick={handleStartSession}
                      disabled={!cameraReady || (participants.length > 1 && !allReady)}
                      className="flex-1 rounded-2xl py-6 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Start Session
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleToggleReady}
                      className={`flex-1 rounded-2xl py-6 text-base font-medium ${
                        isReady
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      {isReady ? (
                        <>
                          <Check className="w-5 h-5 mr-2" />
                          Ready!
                        </>
                      ) : (
                        "I'm Ready"
                      )}
                    </Button>
                  )}
                </motion.div>
              )}

              {/* Capture Phase Controls */}
              {(phase === 'capture') && (
                <motion.div
                  key="capture"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-center gap-4"
                >
                  <Button
                    size="lg"
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white text-black hover:bg-white/90 shadow-lg shadow-white/20 p-0"
                  >
                    <Camera className="w-7 h-7" />
                  </Button>
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
                      {capturedPhotos.sort((a, b) => a.order - b.order).map((p) => (
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
                      onClick={handleGenerateStrip}
                      className="flex-[2] rounded-2xl py-5 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Photo Strip
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-black/70 backdrop-blur-xl border-t border-white/10 p-4"
            >
              <div className="max-w-2xl mx-auto">
                <h4 className="text-white/70 text-xs font-medium mb-3 uppercase tracking-wider">Filters</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => { setSelectedFilter(filter.id as FilterId); socketRef.current?.emit('update-settings', { filter: filter.id }) }}
                      className={`shrink-0 w-20 rounded-xl overflow-hidden transition-all duration-200 ${
                        selectedFilter === filter.id ? 'ring-2 ring-primary scale-105' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div
                        className="aspect-square relative"
                        style={{ filter: filter.css || undefined }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-rose-400 to-amber-300" />
                        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-emerald-600/70 to-transparent" />
                        <div className="absolute top-2 right-2.5 w-4 h-4 rounded-full bg-yellow-100" />
                      </div>
                      <div className="py-1.5 px-1 text-center">
                        <span className="text-[10px] text-white/80 font-medium">{filter.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}