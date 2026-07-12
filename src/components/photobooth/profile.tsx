'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Camera, Heart, ImageIcon, Star, Trophy,
  Calendar, Sparkles,
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
      <header className="glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => setView('landing')} className="mr-3">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <span className="font-semibold">Profile</span>
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
              <span className="text-3xl font-bold gradient-text">
                {username ? username.charAt(0).toUpperCase() : '?'}
              </span>
            </motion.div>
            <h2 className="text-2xl font-bold mb-1">{username || 'Guest'}</h2>
            <p className="text-muted-foreground text-sm">Memory Collector</p>
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