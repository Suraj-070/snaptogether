import { create } from 'zustand'
import type {
  AppView,
  FilterId,
  StripLayout,
  CapturedPhoto,
  Participant,
  RoomState,
} from './types'
import { disconnectSocket } from './socket'
import {
  lsGet, lsSet, lsDel,
  idbSet, idbDel, idbClear,
  saveSession, clearSession,
} from './persist'

type Theme = 'dark' | 'light'

interface AppState {
  view: AppView
  setView: (view: AppView) => void

  username: string
  userId: string
  setUsername: (name: string) => void
  setUserId: (id: string) => void

  roomCode: string
  roomState: RoomState | null
  isCreator: boolean
  setRoomCode: (code: string) => void
  setRoomState: (state: RoomState | null) => void
  setIsCreator: (is: boolean) => void

  participants: Participant[]
  setParticipants: (p: Participant[]) => void

  selectedFilter: FilterId
  stripLayout: StripLayout
  totalPhotos: number
  setSelectedFilter: (f: FilterId) => void
  setStripLayout: (l: StripLayout) => void
  setTotalPhotos: (n: number) => void

  capturedPhotos: CapturedPhoto[]
  addPhoto: (photo: CapturedPhoto) => void
  removePhoto: (order: number) => void
  clearPhotos: () => void

  sessionId: string | null
  setSessionId: (id: string | null) => void

  finalStripData: string | null
  chosenPhotos: CapturedPhoto[]
  aiCaption: string | null
  setFinalStripData: (data: string | null) => void
  setChosenPhotos: (photos: CapturedPhoto[]) => void
  setAiCaption: (caption: string | null) => void

  reactions: { userId: string; username: string; emoji: string; timestamp: number }[]
  addReaction: (r: { userId: string; username: string; emoji: string; timestamp: number }) => void

  theme: Theme
  setTheme: (t: Theme) => void

  resetSession: () => void
}

// ── Read initial values from storage (sync where possible) ────────────────────

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('snap_theme') as Theme) ?? 'dark'
}

function getInitialUsername(): string {
  if (typeof window === 'undefined') return ''
  return lsGet<string>('snap_username') ?? ''
}

function getInitialPrefs(): { stripLayout: StripLayout } {
  if (typeof window === 'undefined') return { stripLayout: 'classic' }
  return lsGet<{ stripLayout: StripLayout }>('snap_prefs') ?? { stripLayout: 'classic' }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const prefs = getInitialPrefs()

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  view: 'landing',
  setView: (view) => {
    set({ view })
    // snapshot session on every nav change
    const s = get()
    saveSession({
      view,
      roomCode:  s.roomCode,
      isCreator: s.isCreator,
      username:  s.username,
      userId:    s.userId,
      sessionId: s.sessionId,
    })
  },

  // User
  username: getInitialUsername(),
  userId: '',
  setUsername: (username) => {
    lsSet('snap_username', username)
    set({ username })
  },
  setUserId: (userId) => set({ userId }),

  // Room
  roomCode: '',
  roomState: null,
  isCreator: false,
  setRoomCode: (roomCode) => {
    set({ roomCode })
    const s = get()
    saveSession({ view: s.view, roomCode, isCreator: s.isCreator, username: s.username, userId: s.userId, sessionId: s.sessionId })
  },
  setRoomState: (roomState) => set({ roomState }),
  setIsCreator: (isCreator) => {
    set({ isCreator })
    const s = get()
    saveSession({ view: s.view, roomCode: s.roomCode, isCreator, username: s.username, userId: s.userId, sessionId: s.sessionId })
  },

  // Participants
  participants: [],
  setParticipants: (participants) => set({ participants }),

  // Settings
  selectedFilter: 'none',
  stripLayout: prefs.stripLayout,
  totalPhotos: 6,
  setSelectedFilter: (selectedFilter) => set({ selectedFilter }),
  setStripLayout: (stripLayout) => {
    lsSet('snap_prefs', { ...lsGet('snap_prefs'), stripLayout })
    set({ stripLayout })
  },
  setTotalPhotos: (totalPhotos) => set({ totalPhotos }),

  // Photos — written to IndexedDB asynchronously
  capturedPhotos: [],
  addPhoto: (photo) => {
    set((s) => {
      const capturedPhotos = [...s.capturedPhotos.filter((p) => p.order !== photo.order), photo]
      idbSet('capturedPhotos', capturedPhotos)
      return { capturedPhotos }
    })
  },
  removePhoto: (order) => {
    set((s) => {
      const capturedPhotos = s.capturedPhotos.filter((p) => p.order !== order)
      idbSet('capturedPhotos', capturedPhotos)
      return { capturedPhotos }
    })
  },
  clearPhotos: () => {
    idbDel('capturedPhotos')
    set({ capturedPhotos: [] })
  },

  // Session
  sessionId: null,
  setSessionId: (sessionId) => {
    set({ sessionId })
    const s = get()
    saveSession({ view: s.view, roomCode: s.roomCode, isCreator: s.isCreator, username: s.username, userId: s.userId, sessionId })
  },

  // Result — finalStripData to IDB (large), caption to localStorage
  finalStripData: null,
  chosenPhotos: [],
  aiCaption: null,
  setFinalStripData: (finalStripData) => {
    if (finalStripData) {
      idbSet('finalStripData', finalStripData)
    } else {
      idbDel('finalStripData')
    }
    set({ finalStripData })
  },
  setChosenPhotos: (chosenPhotos) => {
    idbSet('chosenPhotos', chosenPhotos)
    set({ chosenPhotos })
  },
  setAiCaption: (aiCaption) => {
    lsSet('snap_result', { aiCaption })
    set({ aiCaption })
  },

  // Reactions
  reactions: [],
  addReaction: (r) =>
    set((s) => ({ reactions: [...s.reactions.slice(-19), r] })),

  // Theme
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('snap_theme', theme)
    document.documentElement.classList.toggle('light', theme === 'light')
    set({ theme })
  },

  // Reset — clears everything
  resetSession: () => {
    disconnectSocket()
    clearSession()
    idbClear()
    lsDel('snap_result')
    set({
      view: 'landing',
      roomCode: '',
      roomState: null,
      isCreator: false,
      participants: [],
      capturedPhotos: [],
      sessionId: null,
      finalStripData: null,
      chosenPhotos: [],
      aiCaption: null,
      reactions: [],
      selectedFilter: 'none',
      stripLayout: 'classic',
      totalPhotos: 6,
    })
  },
}))