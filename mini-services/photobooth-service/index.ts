import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
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

  socket.on('create-room', (data: { username: string; theme?: string; filter?: string; code?: string }) => {
    let code = data.code ? data.code.toUpperCase().trim() : generateRoomCode()
    while (rooms.has(code)) {
      if (data.code) {
        // requested code is taken (rare) — fall back to a fresh one
        code = generateRoomCode()
      } else {
        code = generateRoomCode()
      }
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
      totalPhotos: 4,
      currentPhoto: 0,
    }

    rooms.set(code, room)
    socket.join(code)
    socket.data.roomCode = code

    socket.emit('room-created', { code, ...getRoomInfo(room) })
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

    socket.emit('room-joined', { code: upperCode, ...getRoomInfo(room) })
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

  socket.on('start-session', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return
    if (socket.id !== room.creatorId) return

    const allReady = Array.from(room.participants.values()).every(p => p.isReady)
    if (!allReady && room.participants.size > 1) return

    room.status = 'countdown'
    room.currentPhoto = 1
    io.to(code).emit('session-started', { room: getRoomInfo(room) })
  })

  socket.on('start-countdown', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    room.status = 'countdown'
    io.to(code).emit('countdown-start', { count: 3, photo: room.currentPhoto, total: room.totalPhotos })
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

  socket.on('retake-requested', (data: { order: number }) => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    room.photos = room.photos.filter(p => p.order !== data.order || p.userId !== socket.id)
    io.to(code).emit('retake-notify', { order: data.order, userId: socket.id })
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
})

const PORT = 3004
httpServer.listen(PORT, () => {
  console.log(`Photobooth WebSocket service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})