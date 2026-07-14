import { NextResponse } from 'next/server'

// Cloudflare TURN credentials API
// Docs: https://developers.cloudflare.com/calls/turn/
// Called by the client before creating an RTCPeerConnection.
// Returns short-lived ICE server config (TTL: 24h).
//
// Required env vars (Vercel only — NOT NEXT_PUBLIC, keep them server-side):
//   CLOUDFLARE_TURN_TOKEN_ID   — the "Token ID" from CF dashboard
//   CLOUDFLARE_TURN_API_TOKEN  — the API token with Calls:Edit permission

export async function GET() {
  const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN

  // Not configured — return public STUN only (same-network sessions still work)
  if (!tokenId || !apiToken) {
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    })
  }

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }), // 24 hours
        next: { revalidate: 82800 },           // cache response for 23h
      }
    )

    if (!res.ok) {
      throw new Error(`CF TURN API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()

    // data.iceServers matches RTCIceServer[] exactly — pass through directly
    return NextResponse.json(
      { iceServers: data.iceServers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=82800, stale-while-revalidate=3600',
        },
      }
    )
  } catch (err) {
    console.error('[TURN] Cloudflare credential fetch failed:', err)
    // Graceful fallback — STUN only
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    })
  }
}