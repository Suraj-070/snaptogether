'use client'

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * Two-person live video for the studio.
 *
 * The socket server relays offers/answers/ICE; video itself flows
 * peer-to-peer. The room creator initiates the offer whenever a partner
 * is present, so it works regardless of who opens the studio first.
 */
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

  useEffect(() => {
    if (!socket || !localStream) return
    if (participantCount < 2) return
    if (typeof RTCPeerConnection === 'undefined') return

    let closed = false

    const newPc = () => {
      pcRef.current?.close()
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
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
      const pc = newPc()
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webrtc-offer', { sdp: offer })
      } catch { /* retry happens on next participant event */ }
    }

    const onOffer = async (data: { sdp: any; from: string }) => {
      peerIdRef.current = data.from
      const pc = newPc()
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('webrtc-answer', { sdp: answer, to: data.from })
      } catch { /* ignore glare; initiator re-offers */ }
    }

    const onAnswer = async (data: { sdp: any; from: string }) => {
      peerIdRef.current = data.from
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp))
      } catch { /* stale answer */ }
    }

    const onIce = async (data: { candidate: any; from: string }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch { /* candidate for a torn-down pc */ }
    }

    // Ready-handshake: a lone timed offer gets lost if the partner's camera
    // isn't up yet. Instead, both sides announce readiness; the initiator
    // (re)offers every time it hears the peer is ready.
    const onPeerReady = (data: { from: string }) => {
      peerIdRef.current = data.from
      if (isInitiator) {
        makeOffer()
      } else {
        // reply so an initiator that mounted late still learns we're here
        socket.emit('webrtc-ready')
      }
    }

    socket.on('webrtc-offer', onOffer)
    socket.on('webrtc-answer', onAnswer)
    socket.on('webrtc-ice', onIce)
    socket.on('webrtc-ready', onPeerReady)

    // Announce our own readiness (stream is guaranteed non-null here).
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
