'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { ArrowLeft, LogIn, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function JoinRoomView() {
  const { username, userId, setUserId, setView, setRoomCode, setIsCreator, setSessionId, setRoomState, setParticipants } = useAppStore()
  const [code, setCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleJoin = async () => {
    if (!code.trim() || !username.trim()) return
    if (code.trim().length !== 6) {
      toast.error('Room code must be 6 characters')
      return
    }

    setIsJoining(true)

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          username: username.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Room not found')
        setIsJoining(false)
        return
      }

      setUserId(data.user.id)
      setSessionId(data.session.id)
      setIsCreator(false)
      setRoomCode(data.session.roomCode)
      setRoomState({
        code: data.session.roomCode,
        creatorId: data.session.creatorId,
        creatorName: data.session.creator?.username || 'Host',
        theme: data.session.theme,
        filter: data.session.filter,
        status: data.session.status,
        participants: [],
        photoCount: 0,
        totalPhotos: 4,
        currentPhoto: 0,
      })

      // Reuse the single shared socket connection.
      const { getSocket } = await import('@/lib/socket')
      const socket = getSocket()

      const onRoomJoined = (roomData: any) => {
        setRoomState(roomData)
        setParticipants(roomData.participants || [])
        setIsJoining(false)
        setView('lobby')
        socket.off('room-joined', onRoomJoined)
        socket.off('error', onSocketError)
      }
      const onSocketError = (err: any) => {
        toast.error(err.message || 'Failed to join room')
        setIsJoining(false)
        socket.off('room-joined', onRoomJoined)
        socket.off('error', onSocketError)
      }

      socket.on('room-joined', onRoomJoined)
      socket.on('error', onSocketError)

      const emitJoinRoom = () => {
        socket.emit('join-room', {
          code: code.trim().toUpperCase(),
          username: username.trim(),
        })
      }

      if (socket.connected) {
        emitJoinRoom()
      } else {
        socket.once('connect', emitJoinRoom)
        socket.connect()
      }
    } catch {
      toast.error('Failed to join room')
      setIsJoining(false)
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