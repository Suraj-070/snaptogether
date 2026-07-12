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

interface AppState {
  // Navigation
  view: AppView
  setView: (view: AppView) => void

  // User
  username: string
  userId: string
  setUsername: (name: string) => void
  setUserId: (id: string) => void

  // Room
  roomCode: string
  roomState: RoomState | null
  isCreator: boolean
  setRoomCode: (code: string) => void
  setRoomState: (state: RoomState | null) => void
  setIsCreator: (is: boolean) => void

  // Participants
  participants: Participant[]
  setParticipants: (p: Participant[]) => void

  // Settings
  selectedFilter: FilterId
  stripLayout: StripLayout
  totalPhotos: number
  setSelectedFilter: (f: FilterId) => void
  setStripLayout: (l: StripLayout) => void
  setTotalPhotos: (n: number) => void

  // Photos
  capturedPhotos: CapturedPhoto[]
  addPhoto: (photo: CapturedPhoto) => void
  removePhoto: (order: number) => void
  clearPhotos: () => void

  // Session
  sessionId: string | null
  setSessionId: (id: string | null) => void

  // Result
  finalStripData: string | null
  aiCaption: string | null
  setFinalStripData: (data: string | null) => void
  setAiCaption: (caption: string | null) => void

  // Reactions
  reactions: { userId: string; username: string; emoji: string; timestamp: number }[]
  addReaction: (r: { userId: string; username: string; emoji: string; timestamp: number }) => void

  // Reset
  resetSession: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  view: 'landing',
  setView: (view) => set({ view }),

  // User
  username: '',
  userId: '',
  setUsername: (username) => set({ username }),
  setUserId: (userId) => set({ userId }),

  // Room
  roomCode: '',
  roomState: null,
  isCreator: false,
  setRoomCode: (roomCode) => set({ roomCode }),
  setRoomState: (roomState) => set({ roomState }),
  setIsCreator: (isCreator) => set({ isCreator }),

  // Participants
  participants: [],
  setParticipants: (participants) => set({ participants }),

  // Settings
  selectedFilter: 'none',
  stripLayout: 'classic',
  totalPhotos: 4,
  setSelectedFilter: (selectedFilter) => set({ selectedFilter }),
  setStripLayout: (stripLayout) => set({ stripLayout }),
  setTotalPhotos: (totalPhotos) => set({ totalPhotos }),

  // Photos
  capturedPhotos: [],
  addPhoto: (photo) =>
    set((s) => ({
      capturedPhotos: [...s.capturedPhotos.filter((p) => p.order !== photo.order), photo],
    })),
  removePhoto: (order) =>
    set((s) => ({
      capturedPhotos: s.capturedPhotos.filter((p) => p.order !== order),
    })),
  clearPhotos: () => set({ capturedPhotos: [] }),

  // Session
  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),

  // Result
  finalStripData: null,
  aiCaption: null,
  setFinalStripData: (finalStripData) => set({ finalStripData }),
  setAiCaption: (aiCaption) => set({ aiCaption }),

  // Reactions
  reactions: [],
  addReaction: (r) =>
    set((s) => ({ reactions: [...s.reactions.slice(-19), r] })),

  // Reset
  resetSession: () =>
    set(() => {
      disconnectSocket()
      return {
        view: 'landing',
        roomCode: '',
        roomState: null,
        isCreator: false,
        participants: [],
        capturedPhotos: [],
        sessionId: null,
        finalStripData: null,
        aiCaption: null,
        reactions: [],
        selectedFilter: 'none',
        stripLayout: 'classic',
        totalPhotos: 4,
      }
    }),
}))