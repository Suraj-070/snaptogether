import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Returns the single shared Socket.IO connection for the current session.
 * Creating it once and reusing it (instead of opening a new connection in
 * every view) is what keeps the creator's socket.id — and therefore the
 * room they own on the server — stable as they navigate from
 * Create Room -> Studio, or Join Room -> Studio.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3004', {
      path: '/',
      transports: ['websocket', 'polling'],
      autoConnect: false,
    })
  }
  return socket
}

/** Tears down the shared connection, e.g. when leaving a room/session. */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
  }
  socket = null
}
