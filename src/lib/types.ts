export type FilterId =
  | 'none'
  | 'vintage'
  | 'polaroid'
  | 'retro'
  | 'bw'
  | 'warm-cinema'
  | 'cool-aesthetic'
  | 'dream'
  | 'cyber-neon'
  | 'anime'
  | 'golden-hour'
  | 'rainy-window'
  | 'scrapbook'
  | 'ai-memory'

export type ThemeId = 'classic' | 'modern' | 'couple' | 'memory'
export type StripLayout = 'classic' | 'magazine' | 'couple' | 'memory'
export type AppView =
  | 'landing'
  | 'create'
  | 'join'
  | 'studio'
  | 'result'
  | 'gallery'
  | 'profile'

export interface FilterDef {
  id: FilterId
  name: string
  category: 'classic' | 'modern' | 'unique'
  icon: string
  css: string
}

export const FILTERS: FilterDef[] = [
  {
    id: 'none',
    name: 'Original',
    category: 'classic',
    icon: '✨',
    css: '',
  },
  {
    id: 'vintage',
    name: 'Vintage Film',
    category: 'classic',
    icon: '📷',
    css: 'sepia(0.4) contrast(1.1) brightness(0.9) saturate(1.2)',
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    category: 'classic',
    icon: '📷',
    css: 'sepia(0.2) contrast(1.05) brightness(1.1) saturate(0.9)',
  },
  {
    id: 'retro',
    name: 'Retro Camera',
    category: 'classic',
    icon: '📼',
    css: 'hue-rotate(-15deg) saturate(1.4) contrast(1.15) brightness(0.95)',
  },
  {
    id: 'bw',
    name: 'Black & White',
    category: 'classic',
    icon: '🖤',
    css: 'grayscale(1) contrast(1.1)',
  },
  {
    id: 'warm-cinema',
    name: 'Warm Cinematic',
    category: 'classic',
    icon: '🎬',
    css: 'sepia(0.15) saturate(1.3) brightness(1.05) contrast(1.08)',
  },
  {
    id: 'cool-aesthetic',
    name: 'Cool Aesthetic',
    category: 'classic',
    icon: '❄️',
    css: 'saturate(0.8) brightness(1.05) hue-rotate(10deg) contrast(1.05)',
  },
  {
    id: 'dream',
    name: 'Dream Mode',
    category: 'modern',
    icon: '💭',
    css: 'brightness(1.12) contrast(0.9) saturate(1.3) blur(0.3px)',
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    category: 'modern',
    icon: '💜',
    css: 'saturate(2) contrast(1.2) brightness(1.1) hue-rotate(300deg)',
  },
  {
    id: 'anime',
    name: 'Anime Memories',
    category: 'modern',
    icon: '🌸',
    css: 'saturate(1.6) contrast(1.15) brightness(1.08)',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    category: 'modern',
    icon: '🌅',
    css: 'sepia(0.25) saturate(1.5) brightness(1.1) contrast(1.05) hue-rotate(-10deg)',
  },
  {
    id: 'rainy-window',
    name: 'Rainy Window',
    category: 'unique',
    icon: '🌧️',
    css: 'saturate(0.7) contrast(1.15) brightness(0.88) hue-rotate(5deg)',
  },
  {
    id: 'scrapbook',
    name: 'Scrapbook',
    category: 'unique',
    icon: '📕',
    css: 'sepia(0.1) saturate(1.1) contrast(1.05) brightness(1.05)',
  },
]

export function getFilterCss(id: FilterId): string {
  return FILTERS.find(f => f.id === id)?.css || ''
}

export interface CapturedPhoto {
  id: string
  dataUrl: string
  filter: FilterId
  order: number
  timestamp: number
  userId: string
}

export interface Participant {
  id: string
  username: string
  avatar?: string
  isReady: boolean
  joinedAt: number
}

export interface RoomState {
  code: string
  creatorId: string
  creatorName: string
  theme: string
  filter: string
  status: string
  participants: Participant[]
  photoCount: number
  totalPhotos: number
  currentPhoto: number
}