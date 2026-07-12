'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, ArrowLeft, Heart, Download, Search,
  Calendar, ImageIcon, Star, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface MemoryItem {
  id: string
  stripData: string | null
  caption: string | null
  isFavorite: boolean
  createdAt: string
  session: {
    roomCode: string
    theme: string
    filter: string
    status: string
    createdAt: string
    completedAt: string | null
    creator: { username: string; avatar?: string }
    photos: { id: string; order: number }[]
  }
}

export default function GalleryView() {
  const { userId, setView } = useAppStore()
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')

  const loadMemories = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userId) params.set('userId', userId)
      const res = await fetch(`/api/memories?${params}`)
      const data = await res.json()
      setMemories(data.memories || [])
    } catch {
      toast.error('Failed to load memories')
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMemories()
  }, [userId])

  const toggleFavorite = async (memory: MemoryItem) => {
    try {
      const res = await fetch('/api/memories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memory.id, isFavorite: !memory.isFavorite }),
      })
      const data = await res.json()
      setMemories(prev => prev.map(m => m.id === memory.id ? { ...m, isFavorite: data.isFavorite } : m))
    } catch {
      toast.error('Failed to update')
    }
  }

  const filteredMemories = memories
    .filter(m => filter === 'all' || m.isFavorite)
    .filter(m =>
      !searchQuery ||
      m.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.session.roomCode.toLowerCase().includes(searchQuery.toLowerCase())
    )

  // Group by month
  const grouped = filteredMemories.reduce<Record<string, MemoryItem[]>>((acc, m) => {
    const date = new Date(m.createdAt)
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const handleDownload = (dataUrl: string, code: string) => {
    const link = document.createElement('a')
    link.download = `snaptogther-${code}.jpg`
    link.href = dataUrl
    link.click()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView('landing')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>
            <span className="font-semibold">Memory Gallery</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView('create')} className="text-primary">
            <Camera className="w-4 h-4 mr-1.5" />
            New
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Search & Filter */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="pl-9 rounded-xl glass"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="rounded-xl"
            >
              All
            </Button>
            <Button
              variant={filter === 'favorites' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('favorites')}
              className="rounded-xl"
            >
              <Star className="w-3.5 h-3.5 mr-1" />
              Favorites
            </Button>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full"
            />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No memories yet</h3>
            <p className="text-sm text-muted-foreground/70 mb-6">
              {searchQuery ? 'Try a different search' : 'Create your first photobooth session to start capturing memories'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setView('create')} className="rounded-2xl">
                <Camera className="w-4 h-4 mr-2" />
                Create a Room
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                {/* Month Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {month}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground/60">{items.length} memories</span>
                </div>

                {/* Memory Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {items.map((memory, i) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass rounded-2xl overflow-hidden group hover:shadow-lg transition-shadow duration-300"
                    >
                      {memory.stripData ? (
                        <div className="aspect-[4/3] relative overflow-hidden">
                          <img
                            src={memory.stripData}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleFavorite(memory)}
                              className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
                            >
                              <Heart className={`w-4 h-4 ${memory.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(memory.stripData!, memory.session.roomCode)}
                              className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                          {memory.isFavorite && (
                            <div className="absolute top-3 right-3">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400 drop-shadow" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-medium text-primary">{memory.session.roomCode}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(memory.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {memory.caption || 'A captured moment'}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground/60">
                          <Camera className="w-3 h-3" />
                          <span>{memory.session.photos?.length || 0} photos</span>
                          <span>·</span>
                          <span>with {memory.session.creator?.username || 'friend'}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}