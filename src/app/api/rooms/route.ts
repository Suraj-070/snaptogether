import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, theme = 'classic', filter = 'none' } = body

    if (!username || username.trim().length === 0) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Generate unique room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]

    // Ensure uniqueness
    let existing = await db.photoSession.findUnique({ where: { roomCode: code } })
    while (existing) {
      code = ''
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
      existing = await db.photoSession.findUnique({ where: { roomCode: code } })
    }

    // Create or find user
    let user = await db.user.findUnique({ where: { username: username.trim() } })
    if (!user) {
      user = await db.user.create({
        data: { username: username.trim(), email: `${uuidv4()}@guest.photobooth` },
      })
    }

    const session = await db.photoSession.create({
      data: {
        roomCode: code,
        creatorId: user.id,
        theme,
        filter,
        status: 'waiting',
      },
      include: { creator: true },
    })

    return NextResponse.json({ session, user })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const sessions = await db.photoSession.findMany({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        creator: true,
        memories: true,
        _count: { select: { photos: true } },
      },
    })
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('List rooms error:', error)
    return NextResponse.json({ error: 'Failed to list rooms' }, { status: 500 })
  }
}