'use client'

import { useAppStore } from '@/lib/store'
import { useSession, signOut } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Camera, Sparkles, Heart, Users, ArrowRight, GalleryHorizontalEnd, Star, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LandingView() {
  const { setView, setUsername, username, setUserId, setRoomCode, setIsCreator } = useAppStore()
  const { data: session } = useSession()

  // Auto-fill username from session
  if (session?.user?.username && !username) {
    setUsername(session.user.username)
    setUserId(session.user.id)
  }

  const handleGetStarted = () => {
    if (!username.trim()) return
    // UX-04: if arriving from a deep link, auto-join that room
    const pendingJoin = sessionStorage.getItem('snap_pending_join')
    if (pendingJoin) {
      sessionStorage.removeItem('snap_pending_join')
      setRoomCode(pendingJoin)
      setIsCreator(false)
      setView('join')
      return
    }
    setView('create')
  }

  const handleJoinDirect = () => {
    if (!username.trim()) return
    setView('join')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold tracking-tight">SnapTogether</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setView('gallery')} className="hidden sm:flex">
                <GalleryHorizontalEnd className="w-4 h-4 mr-1.5" />
                Gallery
              </Button>
              {session ? (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{session.user.username}</span>
                  {session.user.image
                    ? <img src={session.user.image} className="w-8 h-8 rounded-full" alt="" />
                    : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">{session.user.username?.[0]?.toUpperCase()}</div>
                  }
                  <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-xs text-muted-foreground">Sign out</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setView('profile')} className="hidden sm:flex">
                  <Star className="w-4 h-4 mr-1.5" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <main className="flex-1 flex flex-col">
        <section className="hero-gradient flex-1 flex items-center justify-center px-4 py-12 md:py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Name Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8"
            >
              <div className="glass rounded-2xl p-3 max-w-sm mx-auto">
                <input
                  type="text"
                  placeholder="Enter your name to start..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGetStarted() }}
                  className="w-full bg-transparent text-center text-base outline-none placeholder:text-muted-foreground/60 px-4 py-2"
                  maxLength={20}
                />
              </div>
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-primary" />
                Premium Digital Photobooth Experience
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
            >
              Capture moments
              <br />
              <span className="gradient-text">together, anywhere.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Create a private photobooth room, invite your loved ones,
              and capture beautiful synchronized photo strips with creative filters.
              Your memories, forever preserved.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="lg"
                onClick={handleGetStarted}
                disabled={!username.trim()}
                className="rounded-2xl px-8 py-6 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 h-auto"
              >
                <Camera className="w-5 h-5 mr-2" />
                Create a Room
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleJoinDirect}
                disabled={!username.trim()}
                className="rounded-2xl px-8 py-6 text-base font-medium h-auto"
              >
                Join a Room
              </Button>
            </motion.div>

            {/* Floating decorative elements */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-32 left-8 sm:left-16 text-3xl opacity-30 pointer-events-none select-none"
            >
              📸
            </motion.div>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute top-48 right-8 sm:right-20 text-2xl opacity-25 pointer-events-none select-none"
            >
              ✨
            </motion.div>
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute bottom-40 left-12 sm:left-24 text-3xl opacity-20 pointer-events-none select-none"
            >
              💕
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                More than a <span className="gradient-text">photobooth</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                A digital memory archive that brings people together through beautiful, shared moments.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Camera, title: 'Private Rooms', desc: 'Create a room, share a code, and start capturing together in seconds.' },
                { icon: Sparkles, title: 'Creative Filters', desc: 'From vintage film to cyber neon — 12+ unique filters with real-time preview.' },
                { icon: Heart, title: 'Photo Strips', desc: 'Generate beautiful photo strips in classic, magazine, and memory layouts.' },
                { icon: Users, title: 'Group Sessions', desc: 'Support for 2 to 6 people. Everyone captures together, synchronized.' },
                { icon: Zap, title: 'AI Enhancement', desc: 'Auto lighting, smart crop, and AI-generated captions for your memories.' },
                { icon: GalleryHorizontalEnd, title: 'Memory Gallery', desc: 'A timeline of your shared moments. Search, favorite, and download anytime.' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Bottom */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-3xl p-10 sm:p-14"
            >
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Ready to create memories?
              </h2>
              <p className="text-muted-foreground mb-8">
                Distance doesn&apos;t have to mean disconnection. Start your first photobooth session now.
              </p>
              <Button
                size="lg"
                onClick={handleGetStarted}
                disabled={!username.trim()}
                className="rounded-2xl px-8 py-6 text-base font-medium"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Camera className="w-4 h-4" />
            <span>SnapTogether</span>
            <span>·</span>
            <span>Capture moments together</span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            A premium digital memory experience
          </p>
        </div>
      </footer>
    </div>
  )
}