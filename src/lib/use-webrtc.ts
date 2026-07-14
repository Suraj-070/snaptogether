'use client'

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

// Fetch ICE servers from our Next.js API route, which calls Cloudflare TURN
// to generate short-lived credentials. Falls back to STUN-only if not configured.
async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn', { cache: 'no-store' }) // no-store: always fresh credentials
    const data = await res.json()
    // Cloudflare returns a single object {urls,username,credential}, not an array
    const raw = data.iceServers
    const servers = (Array.isArray(raw) ? raw : [raw]) as RTCIceServer[]
    console.log('[WebRTC] ICE servers loaded:', JSON.stringify(servers))
    return servers
  } catch (err) {
    console.error('[WebRTC] Failed to fetch ICE servers:', err)
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }
}

export function useWebRTC(opts: {
  socket: Socket | null
  localStream: MediaStream | null
  isInitiator: boolean
  participantCount: number
}) {
  const { socket, localStream, isInitiator, participantCount } = opts
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connected, setConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const peerIdRef = useRef<string | null>(null)
  const iceServersRef = useRef<RTCIceServer[] | null>(null)
  // Keep latest values in refs so async callbacks always see current state
  const isInitiatorRef = useRef(isInitiator)
  const socketRef = useRef(socket)
  useEffect(() => { isInitiatorRef.current = isInitiator }, [isInitiator])
  useEffect(() => { socketRef.current = socket }, [socket])

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
      const iceServers = iceServersRef.current ?? await getIceServers()
      iceServersRef.current = iceServers

      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      localStream.getTracks().forEach(t => pc.addTrack(t, localStream))

      pc.ontrack = (e) => {
        if (!closed && e.streams[0]) {
          setRemoteStream(e.streams[0])
          setConnected(true)
        }
      }
      pc.onicecandidate = (e) => {
        if (e.candidate && socketRef.current) {
          socketRef.current.emit('webrtc-ice', {
            candidate: e.candidate,
            to: peerIdRef.current || undefined,
          })
        }
      }
      pc.onconnectionstatechange = () => {
        if (closed) return
        console.log('[WebRTC] connectionState:', pc.connectionState)
        setConnected(pc.connectionState === 'connected')
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setRemoteStream(null)
          setConnected(false)
          if (isInitiatorRef.current && !closed) {
            setTimeout(() => { if (!closed) makeOffer() }, 2000)
          }
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState)
      }

      pc.onicegatheringstatechange = () => {
        console.log('[WebRTC] iceGatheringState:', pc.iceGatheringState)
      }

      pc.onsignalingstatechange = () => {
        console.log('[WebRTC] signalingState:', pc.signalingState)
      }
      return pc
    }

    const makeOffer = async () => {
      console.log('[WebRTC] makeOffer — isInitiator:', isInitiatorRef.current)
      const pc = await newPc()
      if (!pc || closed) return
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        await pc.setLocalDescription(offer)
        socket.emit('webrtc-offer', { sdp: offer })
        console.log('[WebRTC] offer sent')
      } catch (e) {
        console.error('[WebRTC] createOffer failed:', e)
      }
    }

    const onOffer = async (data: { sdp: RTCSessionDescriptionInit; from: string }) => {
      // Ignore offers if we are the initiator — we sent the offer, not receive one
      if (isInitiatorRef.current) {
        console.log('[WebRTC] ignoring offer — we are initiator')
        return
      }
      console.log('[WebRTC] received offer from:', data.from)
      peerIdRef.current = data.from
      const pc = await newPc()
      if (!pc || closed) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        // No 'to' field — server broadcasts to room
        socket.emit('webrtc-answer', { sdp: answer })
        console.log('[WebRTC] answer sent')
      } catch (e) {
        console.warn('[WebRTC] answer failed', e)
      }
    }

    const onAnswer = async (data: { sdp: RTCSessionDescriptionInit; from: string }) => {
      // Ignore answers if we are NOT the initiator
      if (!isInitiatorRef.current) {
        console.log('[WebRTC] ignoring answer — we are not initiator')
        return
      }
      console.log('[WebRTC] received answer from:', data.from)
      peerIdRef.current = data.from
      if (!pcRef.current) return
      try {
        if (pcRef.current.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp))
          console.log('[WebRTC] remote description set from answer')
        } else {
          console.warn('[WebRTC] unexpected signalingState for answer:', pcRef.current.signalingState)
        }
      } catch (e) {
        console.warn('[WebRTC] setRemoteDescription failed', e)
      }
    }

    const onIce = async (data: { candidate: RTCIceCandidateInit; from: string }) => {
      if (!pcRef.current || !data.candidate) return
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch { /* candidate for torn-down pc */ }
    }

    const onPeerReady = (data: { from: string }) => {
      console.log('[WebRTC] peer-ready received from:', data.from, '— isInitiator:', isInitiatorRef.current)
      peerIdRef.current = data.from
      if (isInitiatorRef.current) {
        makeOffer()
      } else {
        socket.emit('webrtc-ready')
      }
    }

    console.log('[WebRTC] hook setup — isInitiator:', isInitiator, 'participantCount:', participantCount)

    // FIX: register ALL listeners BEFORE emitting webrtc-ready
    // Old code emitted first → partner's reply could arrive before listeners attached
    socket.on('webrtc-offer', onOffer)
    socket.on('webrtc-answer', onAnswer)
    socket.on('webrtc-ice', onIce)
    socket.on('webrtc-ready', onPeerReady)

    // Small delay ensures listeners are fully registered before announcing
    const readyTimer = setTimeout(() => {
      if (!closed) socket.emit('webrtc-ready')
    }, 100)

    return () => {
      closed = true
      clearTimeout(readyTimer)
      socket.off('webrtc-offer', onOffer)
      socket.off('webrtc-answer', onAnswer)
      socket.off('webrtc-ice', onIce)
      socket.off('webrtc-ready', onPeerReady)
      pcRef.current?.close()
      pcRef.current = null
    }
  }, [socket, localStream, participantCount])

  return { remoteStream, connected }
}