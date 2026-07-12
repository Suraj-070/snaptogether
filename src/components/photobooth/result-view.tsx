'use client'

import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  Download, Heart, Share2, RotateCcw, Sparkles,
  Camera, Copy, Check, Home, GalleryHorizontalEnd,
  MessageCircle, Star, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

export default function ResultView() {
  const {
    finalStripData, aiCaption, roomCode, username, userId, sessionId,
    capturedPhotos, setView, resetSession,
    setAiCaption, setFinalStripData,
  } = useAppStore()

  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false)
  const [copied, setCopied] = useState(false)
  const [customMessage, setCustomMessage] = useState('')

  const handleDownload = () => {
    if (!finalStripData) return
    const link = document.createElement('a')
    link.download = `snaptogther-${roomCode}-${Date.now()}.jpg`
    link.href = finalStripData
    link.click()
    toast.success('Photo strip downloaded!')
  }

  const handleShare = async () => {
    if (navigator.share && finalStripData) {
      try {
        const res = await fetch(finalStripData)
        const blob = await res.blob()
        const file = new File([blob], 'snaptogther-strip.jpg', { type: 'image/jpeg' })
        await navigator.share({ title: 'SnapTogether Memory', files: [file] })
      } catch {
        // Fallback to clipboard
        navigator.clipboard.writeText(`Join my SnapTogether memory! Room: ${roomCode}`)
        toast.success('Link copied to clipboard!')
      }
    } else {
      navigator.clipboard.writeText(`Check out my SnapTogether memory! Room: ${roomCode}`)
      toast.success('Link copied to clipboard!')
    }
  }

  const handleSaveMemory = async () => {
    if (!sessionId || !userId || isSaving) return
    setIsSaving(true)

    try {
      // Save each photo
      for (const photo of capturedPhotos) {
        await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            uploaderId: userId,
            imageData: photo.dataUrl,
            filter: photo.filter,
            order: photo.order,
          }),
        })
      }

      // Save memory
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          stripData: finalStripData,
          caption: customMessage || aiCaption,
          isFavorite: false,
        }),
      })

      // Update room status
      await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      setIsSaved(true)
      toast.success('Memory saved to your gallery!')
    } catch {
      toast.error('Failed to save memory')
    }
    setIsSaving(false)
  }

  const handleNewCaption = async () => {
    setIsGeneratingCaption(true)
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'caption',
          context: `${capturedPhotos.length} photos captured in a shared photobooth session. People connecting across distance.`,
        }),
      })
      const data = await res.json()
      setAiCaption(data.caption)
    } catch {
      toast.error('Failed to generate caption')
    }
    setIsGeneratingCaption(false)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="glass sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span className="font-semibold">Your Memory</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView('gallery')} className="text-muted-foreground">
              <GalleryHorizontalEnd className="w-4 h-4 mr-1" />
              Gallery
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Title */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="text-5xl mb-4"
            >
              ✨
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">
              Beautiful!
            </h1>
            <p className="text-muted-foreground">
              Your photo strip is ready. Save it, share it, treasure it.
            </p>
          </div>

          {/* Photo Strip */}
          {finalStripData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <div className="strip-frame rounded-2xl p-3 sm:p-5 shadow-xl max-w-sm w-full">
                <img
                  src={finalStripData}
                  alt="Photo strip"
                  className="w-full rounded-xl"
                />
              </div>
            </motion.div>
          )}

          {/* AI Caption */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center space-y-3"
          >
            <div className="glass rounded-2xl p-5 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">AI Caption</span>
              </div>
              <p className="text-lg font-medium mb-4">{aiCaption || 'A moment worth remembering ✨'}</p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewCaption}
                  disabled={isGeneratingCaption}
                  className="rounded-xl"
                >
                  {isGeneratingCaption ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                    />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  )}
                  New Caption
                </Button>
              </div>
            </div>

            {/* Custom message */}
            <div className="max-w-md mx-auto">
              <input
                type="text"
                placeholder="Add your own message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full glass rounded-xl px-4 py-3 text-sm outline-none bg-transparent text-center placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20"
                maxLength={100}
              />
            </div>
          </motion.div>

          {/* Room Code */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground mb-2">Room Code</p>
            <div className="inline-flex items-center gap-2 glass rounded-xl px-4 py-2">
              <span className="font-mono text-lg font-bold tracking-wider">{roomCode}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyCode}
                className="h-8 w-8 rounded-lg"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <Button
              size="lg"
              onClick={handleSaveMemory}
              disabled={isSaving || isSaved}
              className={`flex-1 rounded-2xl py-5 ${isSaved ? 'bg-green-500 hover:bg-green-500' : ''}`}
            >
              {isSaving ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : isSaved ? (
                <><Check className="w-5 h-5 mr-2" /> Saved!</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> Save to Gallery</>
              )}
            </Button>
            <Button variant="outline" size="lg" onClick={handleDownload} className="flex-1 rounded-2xl py-5">
              <Download className="w-5 h-5 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="lg" onClick={handleShare} className="flex-1 rounded-2xl py-5">
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
          </motion.div>

          {/* New Session */}
          <div className="text-center pt-4 pb-8">
            <Button
              variant="ghost"
              onClick={resetSession}
              className="text-muted-foreground hover:text-foreground"
            >
              <Home className="w-4 h-4 mr-2" />
              Start New Session
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}