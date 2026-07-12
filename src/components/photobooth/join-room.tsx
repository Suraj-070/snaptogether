'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { ArrowLeft, LogIn, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'

export default function JoinRoomView() {
  const { username, userId, setUserId, setView, setRoomCode, setIsCreator, setSessionId, setRoomState, setParticipants } = useAppStore()
  const [code, setCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleJoin = () => {
    if (!code.trim() || !username.trim()) return
    if (code.trim().length !== 6) {
      toast.error('Room code must be 6 characters')
      return
    }

    setIsJoining(true)
    const roomCodeUp = code.trim().toUpperCase()

    const socket = getSocket()

    const onRoomJoined = (roomData: any) => {
      setIsCreator(false)
      setRoomCode(roomData.code || roomCodeUp)
      setRoomState(roomData)
      setParticipants(roomData.participants || [])
      setIsJoining(false)
      setView('lobby')
      socket.off('room-joined', onRoomJoined)
      socket.off('error', onSocketError)

      // Register the user in the DB in the background — never blocks joining.
      fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCodeUp, username: username.trim() }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data) {
            setUserId(data.user.id)
            setSessionId(data.session.id)
          }
        })
        .catch(() => { /* non-fatal */ })
    }

    const onSocketError = (err: any) => {
      toast.error(err.message || 'Failed to join room')
      setIsJoining(false)
      socket.off('room-joined', onRoomJoined)
      socket.off('error', onSocketError)
    }

    socket.on('room-joined', onRoomJoined)
    socket.on('error', onSocketError)

    const emitJoin = () => socket.emit('join-room', { code: roomCodeUp, username: username.trim() })

    if (socket.connected) {
      emitJoin()
    } else {
      socket.once('connect', emitJoin)
      socket.connect()
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => setView('landing')} className="mr-3">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <span className="font-semibold">Join Room</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="glass rounded-3xl p-8 sm:p-12 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join a Photobooth</h2>
            <p className="text-muted-foreground text-sm">
              Enter the 6-character room code shared by the host
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="text-center text-2xl font-mono tracking-[0.3em] h-16 max-w-[240px] rounded-2xl"
                maxLength={6}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
                autoFocus
              />
            </div>

            <Button
              size="lg"
              onClick={handleJoin}
              disabled={isJoining || code.trim().length !== 6}
              className="w-full rounded-2xl py-6 text-base font-medium"
            >
              {isJoining ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Join Room
                </>
              )}
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have a code?{' '}
              <button
                onClick={() => setView('create')}
                className="text-primary font-medium hover:underline"
              >
                Create a room instead
              </button>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}