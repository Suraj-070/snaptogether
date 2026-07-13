import type { CapturedPhoto } from '@/lib/types'

/**
 * Renders the final photo strip from an ordered list of chosen photos.
 * Extracted from the studio so the strip-builder can generate strips from
 * any user-picked selection/order.
 */
export async function renderStrip(photos: CapturedPhoto[]): Promise<string | null> {
  if (photos.length === 0) return null

  const stripCanvas = document.createElement('canvas')
  const ctx = stripCanvas.getContext('2d')
  if (!ctx) return null

  const padding = 24
  const gap = 12
  const photoW = 400
  const headerH = 80
  const footerH = 60

  // Load first — slot heights follow each photo's own aspect ratio so
  // nothing gets cropped or zoomed.
  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  const loadedImages = await Promise.all(photos.map((p) => loadImage(p.dataUrl)))
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

  // Header
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

  // Draw full frames — rounded corners, no cropping.
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

  // Footer
  const footerY = stripCanvas.height - 40
  ctx.fillStyle = '#bbb'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${photos.length} memories captured together`, stripCanvas.width / 2, footerY)

  return stripCanvas.toDataURL('image/jpeg', 0.9)
}