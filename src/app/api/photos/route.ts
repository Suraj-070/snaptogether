import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadDataUrl } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, uploaderId, imageData, filter, order } = body

    if (!sessionId || !uploaderId || !imageData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // imageData arrives as a base64 data URL from the canvas capture.
    // Upload it to Supabase Storage and store the resulting URL instead
    // of the raw base64 (keeps the DB small and fast).
    const imageUrl = await uploadDataUrl(imageData, 'photos')

    const photo = await db.photo.create({
      data: {
        sessionId,
        uploaderId,
        imageData: imageUrl,
        filter: filter || 'none',
        order: order || 0,
      },
    })

    return NextResponse.json({ photo })
  } catch (error) {
    console.error('Save photo error:', error)
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const photos = await db.photo.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('Get photos error:', error)
    return NextResponse.json({ error: 'Failed to get photos' }, { status: 500 })
  }
}