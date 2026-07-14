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

    // ARCH-04: NEXT_PUBLIC_SOCKET_URL must be set in Vercel production env vars.
    // If missing in production the fallback becomes https://vercel.app:3004 which
    // doesn't exist. Throw early so the error is obvious instead of a silent hang.
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || fallback
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'production' &&
      !process.env.NEXT_PUBLIC_SOCKET_URL
    ) {
      console.error(
        '[SnapTogether] NEXT_PUBLIC_SOCKET_URL is not set. ' +
        'Add it to your Vercel environment variables pointing to your Render socket server. ' +
        'e.g. NEXT_PUBLIC_SOCKET_URL=https://your-app.onrender.com'
      )
    }

    socket = io(socketUrl, {
      path: '/',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      timeout: 8000,           // give up a connection attempt after 8s
      reconnectionAttempts: 3, // don't retry forever in the background
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