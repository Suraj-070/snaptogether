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
  const photoH = 300
  const headerH = 80
  const footerH = 60

  stripCanvas.width = photoW + padding * 2
  stripCanvas.height = headerH + (photoH + gap) * photos.length + footerH

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

  // Load every photo first — drawing a data URL into an <img> is async.
  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })

  const loadedImages = await Promise.all(photos.map((p) => loadImage(p.dataUrl)))

  // Photos — crop-to-fill so faces don't get squished.
  photos.forEach((_photo, i) => {
    const img = loadedImages[i]
    const y = headerH + i * (photoH + gap)

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

    const srcRatio = img.naturalWidth / img.naturalHeight
    const dstRatio = photoW / photoH
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
    if (srcRatio > dstRatio) {
      sw = img.naturalHeight * dstRatio
      sx = (img.naturalWidth - sw) / 2
    } else {
      sh = img.naturalWidth / dstRatio
      sy = (img.naturalHeight - sh) / 2
    }

    ctx.drawImage(img, sx, sy, sw, sh, padding, y, photoW, photoH)
    ctx.restore()

    // Photo number
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(padding + photoW - 36, y + 8, 28, 22)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, padding + photoW - 22, y + 24)
  })

  // Footer
  const footerY = stripCanvas.height - 40
  ctx.fillStyle = '#bbb'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${photos.length} memories captured together`, stripCanvas.width / 2, footerY)

  return stripCanvas.toDataURL('image/jpeg', 0.9)
}
