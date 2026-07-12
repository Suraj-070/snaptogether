import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, username } = body

    if (!code || !username) {
      return NextResponse.json({ error: 'Room code and username are required' }, { status: 400 })
    }

    const session = await db.photoSession.findUnique({
      where: { roomCode: code.toUpperCase().trim() },
      include: { creator: true, photos: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Create or find user
    let user = await db.user.findUnique({ where: { username: username.trim() } })
    if (!user) {
      user = await db.user.create({
        data: { username: username.trim(), email: `${uuidv4()}@guest.photobooth` },
      })
    }

    return NextResponse.json({ session, user })
  } catch (error) {
    console.error('Join room error:', error)
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
  }
}