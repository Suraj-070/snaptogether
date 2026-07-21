/**
 * stickers.ts — dynamic sticker library
 *
 * Drop any .webp / .png / .gif into /public/stickers/
 * The API at /api/stickers auto-scans the folder.
 * No config needed — new files appear automatically.
 */

export interface StickerDef {
  id: string
  src: string
  label: string
  category: string
}

export const STICKER_CATEGORIES = ['All'] as const
export type StickerCategory = typeof STICKER_CATEGORIES[number]

// Hook — fetches sticker list from server, re-usable anywhere
import { useState, useEffect } from 'react'

export function useStickers() {
  const [stickers, setStickers] = useState<StickerDef[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/stickers')
      .then(r => r.json())
      .then(d => setStickers(d.stickers ?? []))
      .catch(() => setStickers([]))
      .finally(() => setLoading(false))
  }, [])

  return { stickers, loading }
}