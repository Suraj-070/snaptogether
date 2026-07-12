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
    // Derive the socket URL at runtime so phones on the same network hit
    // the dev machine (e.g. http://192.168.1.5:3004) instead of the
    // phone's own localhost. NEXT_PUBLIC_SOCKET_URL still wins when set
    // (production / tunnels).
    const fallback =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3004`
        : 'http://localhost:3004'

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || fallback, {
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
