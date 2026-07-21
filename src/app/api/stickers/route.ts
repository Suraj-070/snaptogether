import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const dir = path.join(process.cwd(), 'public', 'stickers')

    // Create folder if it doesn't exist yet
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      return NextResponse.json({ stickers: [] })
    }

    const files = fs.readdirSync(dir)
      .filter(f => /\.(webp|png|gif|jpg|jpeg)$/i.test(f))
      .sort() // alphabetical order
      .map((filename, i) => ({
        id: `sticker-${i + 1}`,
        src: `/stickers/${filename}`,
        label: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), // "etekai-01" → "etekai 01"
        category: 'All',
      }))

    return NextResponse.json({ stickers: files })
  } catch (err) {
    console.error('[stickers api]', err)
    return NextResponse.json({ stickers: [] })
  }
}