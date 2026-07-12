import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const session = await db.photoSession.findUnique({
      where: { roomCode: code.toUpperCase().trim() },
      include: {
        creator: true,
        photos: { orderBy: { order: 'asc' } },
        memories: { include: { user: true } },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Get room error:', error)
    return NextResponse.json({ error: 'Failed to get room' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await req.json()
    const { status, theme, filter, customMessage, stripLayout } = body

    const session = await db.photoSession.update({
      where: { roomCode: code.toUpperCase().trim() },
      data: {
        ...(status && { status }),
        ...(theme && { theme }),
        ...(filter && { filter }),
        ...(customMessage !== undefined && { customMessage }),
        ...(stripLayout && { stripLayout }),
        ...(status === 'completed' && { completedAt: new Date() }),
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Update room error:', error)
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 })
  }
}