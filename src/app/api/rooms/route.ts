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

    const genCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let c = ''
      for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
      return c
    }

    // 1 round-trip: find-or-create user
    const user = await db.user.upsert({
      where: { username: username.trim() },
      update: {},
      create: { username: username.trim(), email: `${uuidv4()}@guest.photobooth` },
    })

    // 1 round-trip: create session; retry only on the (astronomically rare)
    // code collision instead of pre-checking with extra queries.
    let session = null
    for (let attempt = 0; attempt < 3 && !session; attempt++) {
      try {
        session = await db.photoSession.create({
          data: {
            roomCode: genCode(),
            creatorId: user.id,
            theme,
            filter,
            status: 'waiting',
          },
          include: { creator: true },
        })
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e // unique violation -> retry
      }
    }
    if (!session) {
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

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