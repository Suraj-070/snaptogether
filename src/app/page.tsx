'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { loadSession, idbGet } from '@/lib/persist'
import type { CapturedPhoto } from '@/lib/types'
import LandingView from '@/components/photobooth/landing'
import CreateRoomView from '@/components/photobooth/create-room'
import JoinRoomView from '@/components/photobooth/join-room'
import LobbyView from '@/components/photobooth/lobby'
import StripBuilderView from '@/components/photobooth/strip-builder'
import StudioView from '@/components/photobooth/studio'
import ResultView from '@/components/photobooth/result-view'
import GalleryView from '@/components/photobooth/gallery'
import ProfileView from '@/components/photobooth/profile'
import AuthView from '@/components/photobooth/auth-view'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

export default function Home() {
  const view           = useAppStore(s => s.view)
  const setView        = useAppStore(s => s.setView)
  const setUsername    = useAppStore(s => s.setUsername)
  const setUserId      = useAppStore(s => s.setUserId)
  const setRoomCode    = useAppStore(s => s.setRoomCode)
  const setIsCreator   = useAppStore(s => s.setIsCreator)
  const setSessionId   = useAppStore(s => s.setSessionId)
  const setStripLayout = useAppStore(s => s.setStripLayout)
  const setFinalStripData = useAppStore(s => s.setFinalStripData)
  const setChosenPhotos   = useAppStore(s => s.setChosenPhotos)
  const setAiCaption      = useAppStore(s => s.setAiCaption)

  // Tracks whether we've finished restore — prevents flash of landing
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    async function restore() {
      // 1. Session snapshot (view, roomCode, username, etc.)
      const session = loadSession()
      if (session) {
        if (session.username)  setUsername(session.username)
        if (session.userId)    setUserId(session.userId)
        if (session.roomCode)  setRoomCode(session.roomCode)
        if (session.sessionId) setSessionId(session.sessionId)
        setIsCreator(session.isCreator ?? false)
      }

      // 2. Captured photos from IndexedDB
      const photos = await idbGet<CapturedPhoto[]>('capturedPhotos')
      if (photos?.length) {
        // Restore into store without triggering IDB write loop
        useAppStore.setState({ capturedPhotos: photos })
      }

      // 3. Final strip data + chosen photos (result view)
      const stripData   = await idbGet<string>('finalStripData')
      const chosen      = await idbGet<CapturedPhoto[]>('chosenPhotos')
      const resultMeta  = (() => { try { const r = localStorage.getItem('snap_result'); return r ? JSON.parse(r) : null } catch { return null } })()

      if (stripData)          useAppStore.setState({ finalStripData: stripData })
      if (chosen?.length)     useAppStore.setState({ chosenPhotos: chosen })
      if (resultMeta?.aiCaption) setAiCaption(resultMeta.aiCaption)

      // 4. Navigate to restored view AFTER all data is in store
      //    Only restore mid-session views — studio requires camera so drop back to lobby
      if (session?.view) {
        const safeView = session.view === 'studio' ? 'lobby' : session.view
        // Only restore if there's meaningful data to go back to
        const hasRoom = !!session.roomCode
        const hasPhotos = !!(photos?.length)
        const hasStrip  = !!stripData

        if (safeView === 'result'       && hasStrip)  setView('result' as any)
        else if (safeView === 'stripBuilder' && hasPhotos) setView('stripBuilder' as any)
        else if (safeView === 'lobby'   && hasRoom)   setView('lobby' as any)
        // studio → lobby if we have a room (camera needs to restart anyway)
        else if (safeView === 'lobby'   && hasRoom)   setView('lobby' as any)
      }

      setRestored(true)
    }

    restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render until restore is done — avoids flash of wrong screen
  if (!restored) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {view === 'landing'      && <LandingView />}
        {view === 'create'       && <CreateRoomView />}
        {view === 'join'         && <JoinRoomView />}
        {view === 'lobby'        && <LobbyView />}
        {view === 'stripBuilder' && <StripBuilderView />}
        {view === 'studio'       && <StudioView />}
        {view === 'result'       && <ResultView />}
        {view === 'gallery'      && <GalleryView />}
        {view === 'profile'      && <ProfileView />}
        {view === 'auth'         && <AuthView />}
      </motion.div>
    </AnimatePresence>
  )
}