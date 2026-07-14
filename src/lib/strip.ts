import type { CapturedPhoto } from '@/lib/types'

export interface StripOptions {
  showHeader?: boolean   // show SnapTogether + date (default: true)
  showCaption?: boolean  // show caption at bottom (default: false)
  caption?: string       // caption text if showCaption is true
}

export async function renderStrip(
  photos: CapturedPhoto[],
  options: StripOptions = {},
): Promise<string | null> {
  if (photos.length === 0) return null

  const {
    showHeader = true,
    showCaption = false,
    caption = '',
  } = options

  const stripCanvas = document.createElement('canvas')
  const ctx = stripCanvas.getContext('2d')
  if (!ctx) return null

  const padding = 24
  const gap = 12
  const photoW = 400
  const headerH = showHeader ? 80 : 16
  const footerH = showCaption && caption ? 70 : (showHeader ? 40 : 16)

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })

  const loadedImages = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const heights = loadedImages.map(img => Math.round(photoW * (img.naturalHeight / img.naturalWidth)))

  stripCanvas.width = photoW + padding * 2
  stripCanvas.height = headerH + heights.reduce((a, b) => a + b + gap, 0) + footerH

  // Background
  ctx.fillStyle = '#faf9f7'
  ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height)

  // Border
  ctx.strokeStyle = '#e5e2de'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, stripCanvas.width - 2, stripCanvas.height - 2)

  // Header — SnapTogether + date (optional)
  if (showHeader) {
    ctx.fillStyle = '#333'
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SnapTogether', stripCanvas.width / 2, 35)

    ctx.fillStyle = '#999'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      stripCanvas.width / 2,
      58,
    )
  }

  // Photos
  let y = headerH
  photos.forEach((_photo, i) => {
    const img = loadedImages[i]
    const photoH = heights[i]
    const r = 8
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(padding + r, y)
    ctx.lineTo(padding + photoW - r, y)
    ctx.quadraticCurveTo(padding + photoW, y, padding + photoW, y + r)
    ctx.lineTo(padding + photoW, y + photoH - r)
    ctx.quadraticCurveTo(padding + photoW, y + photoH, padding + photoW - r, y + photoH)
    ctx.lineTo(padding + r, y + photoH)
    ctx.quadraticCurveTo(padding, y + photoH, padding, y + photoH - r)
    ctx.lineTo(padding, y + r)
    ctx.quadraticCurveTo(padding, y, padding + r, y)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, padding, y, photoW, photoH)
    ctx.restore()
    y += photoH + gap
  })

  // Footer — caption (optional) or minimal memory count
  const footerY = stripCanvas.height - (showCaption && caption ? 44 : 22)

  if (showCaption && caption) {
    // Caption text — wrap if needed
    ctx.fillStyle = '#555'
    ctx.font = 'italic 13px Georgia, serif'
    ctx.textAlign = 'center'
    const maxWidth = stripCanvas.width - padding * 2
    const words = caption.split(' ')
    let line = ''
    let lineY = stripCanvas.height - 54
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, stripCanvas.width / 2, lineY)
        line = word
        lineY += 18
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, stripCanvas.width / 2, lineY)
  }

  if (showHeader) {
    ctx.fillStyle = '#ccc'
    ctx.font = '9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${photos.length} memories captured together`, stripCanvas.width / 2, stripCanvas.height - 12)
  }

  return stripCanvas.toDataURL('image/jpeg', 0.9)
}