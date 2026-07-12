'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import LandingView from '@/components/photobooth/landing'
import CreateRoomView from '@/components/photobooth/create-room'
import JoinRoomView from '@/components/photobooth/join-room'
import LobbyView from '@/components/photobooth/lobby'
import StudioView from '@/components/photobooth/studio'
import ResultView from '@/components/photobooth/result-view'
import GalleryView from '@/components/photobooth/gallery'
import ProfileView from '@/components/photobooth/profile'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function Home() {
  const view = useAppStore((s) => s.view)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {view === 'landing' && <LandingView />}
        {view === 'create' && <CreateRoomView />}
        {view === 'join' && <JoinRoomView />}
        {view === 'lobby' && <LobbyView />}
        {view === 'studio' && <StudioView />}
        {view === 'result' && <ResultView />}
        {view === 'gallery' && <GalleryView />}
        {view === 'profile' && <ProfileView />}
      </motion.div>
    </AnimatePresence>
  )
}