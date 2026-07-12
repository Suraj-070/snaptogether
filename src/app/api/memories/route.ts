import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, userId, stripData, caption, isFavorite } = body

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const memory = await db.memory.create({
      data: {
        sessionId,
        userId,
        stripData: stripData || null,
        caption: caption || null,
        isFavorite: isFavorite || false,
      },
    })

    // Mark session as completed
    await db.photoSession.update({
      where: { id: sessionId },
      data: { status: 'completed', completedAt: new Date() },
    })

    return NextResponse.json({ memory })
  } catch (error) {
    console.error('Save memory error:', error)
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const sessionId = searchParams.get('sessionId')

    const memories = await db.memory.findMany({
      where: {
        ...(userId && { userId }),
        ...(sessionId && { sessionId }),
      },
      include: {
        session: { include: { creator: true, photos: true } },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ memories })
  } catch (error) {
    console.error('Get memories error:', error)
    return NextResponse.json({ error: 'Failed to get memories' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, isFavorite, caption } = body

    if (!id) {
      return NextResponse.json({ error: 'Memory ID required' }, { status: 400 })
    }

    const memory = await db.memory.update({
      where: { id },
      data: {
        ...(isFavorite !== undefined && { isFavorite }),
        ...(caption !== undefined && { caption }),
      },
    })

    return NextResponse.json({ memory })
  } catch (error) {
    console.error('Update memory error:', error)
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 })
  }
}