'use client'

import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'

// Eagerly load the critical path screens
import LandingView from '@/components/photobooth/landing'
import LobbyView from '@/components/photobooth/lobby'

// Lazy-load the heavier screens to keep initial bundle small
const CreateRoomView  = lazy(() => import('@/components/photobooth/create-room'))
const JoinRoomView    = lazy(() => import('@/components/photobooth/join-room'))
const StudioView      = lazy(() => import('@/components/photobooth/studio'))
const StripBuilderView = lazy(() => import('@/components/photobooth/strip-builder'))
const ResultView      = lazy(() => import('@/components/photobooth/result-view'))
const GalleryView     = lazy(() => import('@/components/photobooth/gallery'))
const ProfileView     = lazy(() => import('@/components/photobooth/profile'))

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    </div>
  )
}

// Direction-aware transitions: forward = slide left, back = slide right
const FORWARD_VIEWS = ['create', 'join', 'lobby', 'studio', 'stripBuilder', 'result']
const viewDepth: Record<string, number> = {
  landing: 0, create: 1, join: 1, lobby: 2, studio: 3, stripBuilder: 4, result: 5, gallery: 1, profile: 1,
}

export default function Home() {
  const view = useAppStore(s => s.view)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<PageSkeleton />}>
          {view === 'landing'      && <LandingView />}
          {view === 'create'       && <CreateRoomView />}
          {view === 'join'         && <JoinRoomView />}
          {view === 'lobby'        && <LobbyView />}
          {view === 'studio'       && <StudioView />}
          {view === 'stripBuilder' && <StripBuilderView />}
          {view === 'result'       && <ResultView />}
          {view === 'gallery'      && <GalleryView />}
          {view === 'profile'      && <ProfileView />}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}