'use client'

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

// Fetch ICE servers from our Next.js API route, which calls Cloudflare TURN
// to generate short-lived credentials. Falls back to STUN-only if not configured.
async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn', { cache: 'force-cache' })
    const data = await res.json()
    return data.iceServers as RTCIceServer[]
  } catch {
    // Network error — fall back to Google STUN
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }
}

export function useWebRTC(opts: {
  socket: Socket | null
  localStream: MediaStream | null
  /** should this side create the offer (use isCreator) */
  isInitiator: boolean
  /** number of participants in the room — connection starts at 2+ */
  participantCount: number
}) {
  const { socket, localStream, isInitiator, participantCount } = opts
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connected, setConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const peerIdRef = useRef<string | null>(null)
  const iceServersRef = useRef<RTCIceServer[] | null>(null)

  // Pre-fetch ICE servers as soon as the hook mounts so they're ready
  // when the peer connection is needed (avoids a waterfall delay)
  useEffect(() => {
    getIceServers().then(servers => { iceServersRef.current = servers })
  }, [])

  useEffect(() => {
    if (!socket || !localStream) return
    if (participantCount < 2) return
    if (typeof RTCPeerConnection === 'undefined') return

    let closed = false

    const newPc = async () => {
      pcRef.current?.close()

      // Use cached ICE servers, or fetch now if not ready yet
      const iceServers = iceServersRef.current ?? await getIceServers()
      iceServersRef.current = iceServers

      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      localStream.getTracks().forEach(t => pc.addTrack(t, localStream))

      pc.ontrack = (e) => {
        if (!closed) setRemoteStream(e.streams[0])
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc-ice', { candidate: e.candidate, to: peerIdRef.current || undefined })
        }
      }
      pc.onconnectionstatechange = () => {
        if (closed) return
        setConnected(pc.connectionState === 'connected')
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setRemoteStream(null)
        }
      }
      return pc
    }

    const makeOffer = async () => {
      const pc = await newPc()
      if (!pc) return
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webrtc-offer', { sdp: offer })
      } catch { /* retry happens on next participant event */ }
    }

    const onOffer = async (data: { sdp: RTCSessionDescriptionInit; from: string }) => {
      peerIdRef.current = data.from
      const pc = await newPc()
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('webrtc-answer', { sdp: answer, to: data.from })
      } catch { /* ignore glare; initiator re-offers */ }
    }

    const onAnswer = async (data: { sdp: RTCSessionDescriptionInit; from: string }) => {
      peerIdRef.current = data.from
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp))
      } catch { /* stale answer */ }
    }

    const onIce = async (data: { candidate: RTCIceCandidateInit; from: string }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch { /* candidate for a torn-down pc */ }
    }

    const onPeerReady = (data: { from: string }) => {
      peerIdRef.current = data.from
      if (isInitiator) {
        makeOffer()
      } else {
        socket.emit('webrtc-ready')
      }
    }

    socket.on('webrtc-offer', onOffer)
    socket.on('webrtc-answer', onAnswer)
    socket.on('webrtc-ice', onIce)
    socket.on('webrtc-ready', onPeerReady)

    socket.emit('webrtc-ready')

    return () => {
      closed = true
      socket.off('webrtc-offer', onOffer)
      socket.off('webrtc-answer', onAnswer)
      socket.off('webrtc-ice', onIce)
      socket.off('webrtc-ready', onPeerReady)
      pcRef.current?.close()
      pcRef.current = null
    }
  }, [socket, localStream, isInitiator, participantCount])

  return { remoteStream, connected }
}