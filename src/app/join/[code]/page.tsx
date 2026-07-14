'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'

// UX-04: Deep link handler — /join/ABC123
// When someone opens this URL, pre-fill the room code and
// navigate straight to the join flow. If no username is set,
// go to landing first (it will return here after name entry).
export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const { username, setRoomCode, setIsCreator, setView } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (!code) return
    const roomCode = code.toUpperCase()
    setRoomCode(roomCode)
    setIsCreator(false)

    if (username.trim()) {
      // Already have a name — go straight to join view
      setView('join')
      router.replace('/')
    } else {
      // No name yet — go to landing, join view will auto-trigger after name entry
      // Store intended join code in sessionStorage so landing can pick it up
      sessionStorage.setItem('snap_pending_join', roomCode)
      router.replace('/')
    }
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-white/50">Joining room {code?.toUpperCase()}...</p>
      </div>
    </div>
  )
}