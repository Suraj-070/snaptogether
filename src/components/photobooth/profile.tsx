'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Camera, Heart, ImageIcon, Star, Trophy,
  Calendar, Sparkles, LogIn, LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ProfileStats {
  totalSessions: number
  totalPhotos: number
  totalFavorites: number
  memories: any[]
}

export default function ProfileView() {
  const { username, userId, setView } = useAppStore()
  const { data: session } = useSession()
  const [stats, setStats] = useState<ProfileStats>({
    totalSessions: 0,
    totalPhotos: 0,
    totalFavorites: 0,
    memories: [],
  })
  const [loading, setLoading] = useState(true)

  const loadStats = async () => {
    if (!userId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/memories?userId=${userId}`)
      const data = await res.json()
      const memories = data.memories || []
      setStats({
        totalSessions: memories.length,
        totalPhotos: memories.reduce((acc: number, m: any) => acc + (m.session?.photos?.length || 0), 0),
        totalFavorites: memories.filter((m: any) => m.isFavorite).length,
        memories,
      })
    } catch {
      // silently fail
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats()
  }, [userId])

  // Achievement system
  const achievements = [
    { id: 'first', name: 'First Memory', desc: 'Created your first photo strip', icon: '📸', unlocked: stats.totalSessions >= 1 },
    { id: 'five', name: 'Memory Keeper', desc: 'Saved 5 memories', icon: '💎', unlocked: stats.totalSessions >= 5 },
    { id: 'ten', name: 'Memory Master', desc: 'Saved 10 memories', icon: '🏆', unlocked: stats.totalSessions >= 10 },
    { id: 'photos20', name: 'Shutterbug', desc: 'Captured 20 photos', icon: '🎬', unlocked: stats.totalPhotos >= 20 },
    { id: 'photos50', name: 'Photographer Pro', desc: 'Captured 50 photos', icon: '🎥', unlocked: stats.totalPhotos >= 50 },
    { id: 'fav5', name: 'Heart Collector', desc: 'Favorited 5 memories', icon: '💝', unlocked: stats.totalFavorites >= 5 },
  ]

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('landing')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <span className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">Profile</span>
          {!session ? (
            <Button variant="ghost" size="sm" onClick={() => setView('auth')} className="text-primary text-xs font-semibold">
              <LogIn className="w-3.5 h-3.5 mr-1" />
              Sign in
            </Button>
          ) : (
            <div className="w-20" />
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Profile Card */}
          <div className="glass rounded-3xl p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 ring-4 ring-primary/10"
            >
              {session?.user?.image ? (
                <img src={session.user.image} className="w-full h-full rounded-full object-cover" alt="" />
              ) : (
                <span className="text-3xl font-bold gradient-text">
                  {username ? username.charAt(0).toUpperCase() : '?'}
                </span>
              )}
            </motion.div>
            <h2 className="text-2xl font-bold mb-1">{username || 'Guest'}</h2>
            <p className="text-muted-foreground text-sm">{session ? 'Memory Collector' : 'Browsing as guest'}</p>

            {/* Guest sign-in prompt */}
            {!session && (
              <div className="mt-4 p-3 rounded-2xl bg-primary/8 border border-primary/15">
                <p className="text-xs text-muted-foreground mb-2">Sign in to save memories across devices</p>
                <button
                  onClick={() => setView('auth')}
                  className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in or create account
                </button>
              </div>
            )}

            {/* Sign out button for logged-in users */}
            {session && (
              <button
                onClick={() => signOut()}
                className="mt-4 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl bg-foreground/5 text-muted-foreground text-xs font-medium hover:bg-foreground/10 hover:text-foreground transition-colors border border-border"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Sessions', value: stats.totalSessions, icon: Camera },
              { label: 'Photos', value: stats.totalPhotos, icon: ImageIcon },
              { label: 'Favorites', value: stats.totalFavorites, icon: Heart },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass rounded-2xl p-5 text-center"
              >
                <div className="mx-auto mb-2 w-5 h-5 flex items-center justify-center text-primary/70"><stat.icon className="w-5 h-5" /></div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Achievements */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Achievements
              </h3>
              <span className="text-sm text-muted-foreground">{unlockedCount}/{achievements.length}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.map((achievement, i) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className={`rounded-2xl p-4 text-center transition-all duration-300 ${
                    achievement.unlocked
                      ? 'glass shadow-md'
                      : 'bg-muted/30 opacity-50'
                  }`}
                >
                  <div className={`text-3xl mb-2 ${achievement.unlocked ? '' : 'grayscale'}`}>
                    {achievement.icon}
                  </div>
                  <div className="text-sm font-medium mb-0.5">{achievement.name}</div>
                  <div className="text-xs text-muted-foreground">{achievement.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 pb-8">
            <Button onClick={() => setView('create')} className="flex-1 rounded-2xl py-5">
              <Camera className="w-4 h-4 mr-2" />
              New Session
            </Button>
            <Button variant="outline" onClick={() => setView('gallery')} className="flex-1 rounded-2xl py-5">
              <Star className="w-4 h-4 mr-2" />
              View Gallery
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}