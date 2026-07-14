import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface Participant {
  id: string
  username: string
  avatar?: string
  isReady: boolean
  joinedAt: number
}

interface Room {
  code: string
  creatorId: string
  creatorName: string
  theme: string
  filter: string
  participants: Map<string, Participant>
  status: 'waiting' | 'ready' | 'countdown' | 'capturing' | 'review'
  photos: { userId: string; data: string; order: number }[]
  totalPhotos: number
  currentPhoto: number
}

const rooms = new Map<string, Room>()

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function getRoomInfo(room: Room) {
  return {
    code: room.code,
    creatorId: room.creatorId,
    creatorName: room.creatorName,
    theme: room.theme,
    filter: room.filter,
    status: room.status,
    participants: Array.from(room.participants.values()),
    photoCount: room.photos.length,
    totalPhotos: room.totalPhotos,
    currentPhoto: room.currentPhoto,
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`)

  socket.on('create-room', (data: { username: string; theme?: string; filter?: string; code?: string; totalPhotos?: number }) => {
    let code = data.code ? data.code.toUpperCase().trim() : generateRoomCode()
    while (rooms.has(code)) {
      code = generateRoomCode()
    }

    const participant: Participant = {
      id: socket.id,
      username: data.username || 'User',
      isReady: false,
      joinedAt: Date.now(),
    }

    const room: Room = {
      code,
      creatorId: socket.id,
      creatorName: data.username || 'User',
      theme: data.theme || 'classic',
      filter: data.filter || 'none',
      participants: new Map([[socket.id, participant]]),
      status: 'waiting',
      photos: [],
      totalPhotos: data.totalPhotos && data.totalPhotos >= 2 && data.totalPhotos <= 6 ? data.totalPhotos : 4,
      currentPhoto: 0,
    }

    rooms.set(code, room)
    socket.join(code)
    socket.data.roomCode = code

    socket.emit('room-created', getRoomInfo(room))
    console.log(`Room ${code} created by ${data.username}`)
  })

  socket.on('join-room', (data: { code: string; username: string }) => {
    const { code, username } = data
    const upperCode = code.toUpperCase().trim()
    const room = rooms.get(upperCode)

    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    if (room.participants.size >= 6) {
      socket.emit('error', { message: 'Room is full' })
      return
    }

    const participant: Participant = {
      id: socket.id,
      username: username || 'User',
      isReady: false,
      joinedAt: Date.now(),
    }

    room.participants.set(socket.id, participant)
    socket.join(upperCode)
    socket.data.roomCode = upperCode

    socket.emit('room-joined', getRoomInfo(room))
    socket.to(upperCode).emit('participant-joined', { participant, room: getRoomInfo(room) })
    console.log(`${username} joined room ${upperCode}`)
  })

  socket.on('toggle-ready', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    const participant = room.participants.get(socket.id)
    if (participant) {
      participant.isReady = !participant.isReady
      io.to(code).emit('participant-updated', { room: getRoomInfo(room) })
    }
  })

  socket.on('update-settings', (data: { theme?: string; filter?: string; totalPhotos?: number }) => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    if (socket.id !== room.creatorId) return

    if (data.theme) room.theme = data.theme
    if (data.filter) room.filter = data.filter
    if (data.totalPhotos) room.totalPhotos = data.totalPhotos

    io.to(code).emit('settings-updated', { room: getRoomInfo(room) })
  })

  socket.on('enter-studio', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return
    const allReady = Array.from(room.participants.values()).every(p => p.isReady)
    if (!allReady && room.participants.size > 1) {
      socket.emit('error', { message: 'Everyone must be ready first' })
      return
    }
    io.to(code).emit('studio-entered', { room: getRoomInfo(room) })
  })

  // Clock sync — client pings, server acks with server time so client can
  // measure its offset and schedule captures at the exact same instant.
  socket.on('time-sync', (_clientTime: number, cb: (serverTime: number) => void) => {
    if (typeof cb === 'function') cb(Date.now())
  })

  const SHOT_COUNT = 6
  const COUNTDOWN_SECS = 5
  const CAPTURE_LEAD_MS = 600 // future timestamp window to absorb network jitter
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  // Server drives the whole shoot: both screens stay perfectly in sync.
  // captureAt is an absolute server timestamp that every client converts
  // via their measured clock offset → fires at the same real-world instant.
  socket.on('start-session', async () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return
    // BUG-03: only the creator can trigger the shoot sequence
    if (socket.id !== room.creatorId) {
      socket.emit('error', { message: 'Only the room creator can start the session' })
      return
    }
    if ((room as any).sequenceRunning) return

    ;(room as any).sequenceRunning = true
    room.totalPhotos = SHOT_COUNT
    room.photos = []
    io.to(code).emit('session-started', { room: getRoomInfo(room) })

    for (let shot = 1; shot <= SHOT_COUNT; shot++) {
      if (!rooms.has(code)) break
      room.status = 'countdown'
      room.currentPhoto = shot
      io.to(code).emit('countdown-start', {
        count: COUNTDOWN_SECS, photo: shot, total: SHOT_COUNT,
      })
      await sleep(COUNTDOWN_SECS * 1000 + 300)
      if (!rooms.has(code)) break
      room.status = 'capturing'
      // captureAt: both clients fire at this exact server-clock instant
      io.to(code).emit('capture-now', {
        photo: shot,
        total: SHOT_COUNT,
        captureAt: Date.now() + CAPTURE_LEAD_MS,
      })
      await sleep(CAPTURE_LEAD_MS + 2200)
    }

    if (rooms.has(code)) {
      room.status = 'review'
      io.to(code).emit('session-review', { room: getRoomInfo(room) })
    }
    ;(room as any).sequenceRunning = false
  })

  socket.on('photo-captured', (data: { imageData: string; order: number }) => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    room.photos.push({
      userId: socket.id,
      data: data.imageData,
      order: data.order,
    })

    room.status = 'capturing'
    room.currentPhoto = data.order

    io.to(code).emit('photo-received', {
      userId: socket.id,
      order: data.order,
      current: room.photos.length,
      total: room.totalPhotos,
      room: getRoomInfo(room),
    })

    if (room.photos.length >= room.totalPhotos * room.participants.size) {
      room.status = 'review'
      io.to(code).emit('session-complete', { room: getRoomInfo(room) })
    }
  })

  socket.on('send-reaction', (data: { emoji: string }) => {
    const code = socket.data.roomCode
    if (!code) return
    const participant = rooms.get(code)?.participants.get(socket.id)
    if (!participant) return

    io.to(code).emit('reaction-received', {
      userId: socket.id,
      username: participant.username,
      emoji: data.emoji,
      timestamp: Date.now(),
    })
  })

  // --- WebRTC signaling ---
  socket.on('webrtc-ready', () => {
    const code = socket.data.roomCode
    if (!code) return
    socket.to(code).emit('webrtc-ready', { from: socket.id })
  })

  socket.on('webrtc-offer', (data: { sdp: any; to?: string }) => {
    const code = socket.data.roomCode
    if (!code) return
    if (data.to) io.to(data.to).emit('webrtc-offer', { sdp: data.sdp, from: socket.id })
    else socket.to(code).emit('webrtc-offer', { sdp: data.sdp, from: socket.id })
  })

  socket.on('webrtc-answer', (data: { sdp: any; to: string }) => {
    if (!socket.data.roomCode) return
    io.to(data.to).emit('webrtc-answer', { sdp: data.sdp, from: socket.id })
  })

  socket.on('webrtc-ice', (data: { candidate: any; to?: string }) => {
    const code = socket.data.roomCode
    if (!code) return
    if (data.to) io.to(data.to).emit('webrtc-ice', { candidate: data.candidate, from: socket.id })
    else socket.to(code).emit('webrtc-ice', { candidate: data.candidate, from: socket.id })
  })

  // Collaborative strip building
  socket.on('strip-open', () => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-open')
  })
  socket.on('strip-slot-update', (data: { slots: (number | null)[] }) => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-slot-update', data)
  })

  socket.on('leave-room', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    const participant = room.participants.get(socket.id)
    room.participants.delete(socket.id)
    socket.leave(code)
    socket.data.roomCode = undefined

    if (room.participants.size === 0) {
      rooms.delete(code)
      console.log(`Room ${code} deleted (empty)`)
    } else {
      io.to(code).emit('participant-left', {
        participant: { id: socket.id, username: participant?.username },
        room: getRoomInfo(room),
      })
    }
  })

  socket.on('disconnect', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    const participant = room.participants.get(socket.id)
    room.participants.delete(socket.id)

    if (room.participants.size === 0) {
      rooms.delete(code)
      console.log(`Room ${code} deleted (empty)`)
    } else {
      io.to(code).emit('participant-left', {
        participant: { id: socket.id, username: participant?.username },
        room: getRoomInfo(room),
      })
    }
    console.log(`Disconnected: ${socket.id}`)
  })

  // --- Collaborative strip editor (drawing + stickers) ---
  socket.on('strip-draw-start', (data: { x: number; y: number; color: string; size: number; userId: string }) => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-draw-start', data)
  })
  socket.on('strip-draw-move', (data: { x: number; y: number; userId: string }) => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-draw-move', data)
  })
  socket.on('strip-draw-end', (data: { userId: string }) => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-draw-end', data)
  })
  socket.on('strip-sticker-add', (data: { id: string; emoji: string; x: number; y: number; scale: number }) => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-sticker-add', data)
  })
  socket.on('strip-sticker-move', (data: { id: string; x: number; y: number }) => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-sticker-move', data)
  })
  socket.on('strip-clear-drawing', () => {
    const code = socket.data.roomCode
    if (code) socket.to(code).emit('strip-clear-drawing')
  })
})

const PORT = Number(process.env.PORT) || 3004
httpServer.listen(PORT, () => {
  console.log(`Photobooth WebSocket service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})