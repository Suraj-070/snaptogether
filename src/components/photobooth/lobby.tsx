'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Copy, Check, Users, Play, LogOut, Crown, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'
import type { Participant } from '@/lib/types'

export default function LobbyView() {
  const {
    username, isCreator, roomCode,
    participants, setParticipants,
    setView, setRoomState,
  } = useAppStore()

  const [copied, setCopied] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    const syncRoom = (data: any) => {
      if (data.room) {
        setRoomState(data.room)
        setParticipants(data.room.participants || [])
      }
    }

    const onJoined = (data: any) => {
      syncRoom(data)
      if (data.participant?.username) {
        toast.success(`${data.participant.username} joined!`)
      }
    }
    const onLeft = (data: any) => {
      syncRoom(data)
      if (data.username) toast(`${data.username} left`)
    }
    const onEntered = (data: any) => {
      syncRoom(data)
      setView('studio')
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

  const copyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    toast.success('Room code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareCode = async () => {
    if (!roomCode) return
    // UX-04: share a deep link so partner can tap and join instantly
    const joinUrl = `${window.location.origin}/join/${roomCode}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SnapTogether',
          text: `Join my photobooth! Tap the link or use code ${roomCode}`,
          url: joinUrl,
        })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(joinUrl)
      toast.success('Join link copied!')
    }
  }

  const toggleReady = () => {
    setIsReady(!isReady)
    getSocket().emit('toggle-ready')
  }

  const startSession = () => {
    getSocket().emit('enter-studio')
  }

  const leaveRoom = () => {
    getSocket().emit('leave-room')
    setRoomState(null)
    setParticipants([])
    useAppStore.getState().setRoomCode('')
    setView('landing')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-3xl p-6 sm:p-10 max-w-md w-full"
      >
        {/* Room code */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-1">
            {isCreator ? 'Room Created!' : 'You\'re In!'}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Share this code so friends can join
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="text-3xl sm:text-4xl font-bold tracking-[0.3em] font-mono select-all">
              {roomCode}
            </div>
            <Button variant="outline" size="icon" onClick={copyCode} className="rounded-xl">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={shareCode} className="rounded-xl">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Participants */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Users className="w-4 h-4 text-primary" />
            In the room ({participants.length})
          </div>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {participants.map((p: Participant, i: number) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="flex items-center gap-3 glass rounded-xl px-3 py-2.5"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center font-semibold text-primary text-sm">
                    {p.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium truncate">
                    {p.username}
                    {p.username === username && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  {i === 0 && <Crown className="w-4 h-4 text-amber-500" />}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.isReady
                      ? 'bg-green-500/15 text-green-600'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {p.isReady ? 'Ready' : 'Waiting'}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {participants.length < 2 && (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-dashed border-muted-foreground/30">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </motion.div>
                </div>
                <span className="text-sm text-muted-foreground">Waiting for friends...</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant={isReady ? 'secondary' : 'outline'}
            onClick={toggleReady}
            className="w-full rounded-2xl py-5"
          >
            {isReady ? <Check className="w-4 h-4 mr-2 text-green-500" /> : null}
            {isReady ? "I'm Ready" : 'Mark as Ready'}
          </Button>

          {isCreator ? (
            <Button onClick={startSession} className="w-full rounded-2xl py-6 text-base font-medium">
              <Play className="w-5 h-5 mr-2" />
              Enter Studio
              {participants.length < 2 && (
                <span className="ml-2 text-xs opacity-70">(solo)</span>
              )}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                Waiting for host to start...
              </motion.span>
            </div>
          )}

          <Button variant="ghost" onClick={leaveRoom} className="w-full text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Leave Room
          </Button>
        </div>
      </motion.div>
    </div>
  )
}