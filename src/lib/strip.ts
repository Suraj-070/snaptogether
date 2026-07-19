import type { CapturedPhoto } from '@/lib/types'

export interface StripOptions {
  layout?: 'classic' | 'magazine' | 'couple' | 'memory'
  showHeader?: boolean
  showCaption?: boolean
  caption?: string
  // canonical=true means left person is always creator, right is partner.
  // Both users pass their own isCreator so the server-side composition is
  // identical on both screens.
  isCreator?: boolean
}

const PAD = 24
const GAP = 10
const PHOTO_W = 400
const CORNER = 8

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  cw: number,
  label: string,
  subLabel: string,
  textColor: string,
  subColor: string,
) {
  ctx.fillStyle = textColor
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, cw / 2, 35)
  ctx.fillStyle = subColor
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(subLabel, cw / 2, 55)
}

// ─── Classic: vertical strip ──────────────────────────────────────────────────
async function renderClassic(
  photos: CapturedPhoto[],
  opts: StripOptions,
): Promise<string | null> {
  const { showHeader = true, showCaption = false, caption = '' } = opts
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const imgs = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const heights = imgs.map(img => Math.round(PHOTO_W * (img.naturalHeight / img.naturalWidth)))
  const headerH = showHeader ? 72 : PAD
  const footerH = showCaption && caption ? 72 : (showHeader ? 40 : PAD)
  canvas.width = PHOTO_W + PAD * 2
  canvas.height = headerH + heights.reduce((a, b) => a + b + GAP, 0) + footerH

  ctx.fillStyle = '#faf9f7'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#e5e2de'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

  if (showHeader) {
    drawHeader(ctx, canvas.width, 'SnapTogether',
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      '#333', '#999')
  }

  let y = headerH
  imgs.forEach((img, i) => {
    const h = heights[i]
    ctx.save()
    roundRect(ctx, PAD, y, PHOTO_W, h, CORNER)
    ctx.clip()
    ctx.drawImage(img, PAD, y, PHOTO_W, h)
    ctx.restore()
    y += h + GAP
  })

  if (showCaption && caption) {
    ctx.fillStyle = '#555'
    ctx.font = 'italic 13px Georgia, serif'
    ctx.textAlign = 'center'
    const maxW = canvas.width - PAD * 2
    const words = caption.split(' ')
    let line = ''
    let lineY = canvas.height - 52
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, canvas.width / 2, lineY)
        line = word; lineY += 18
      } else line = test
    }
    if (line) ctx.fillText(line, canvas.width / 2, lineY)
  }
  if (showHeader) {
    ctx.fillStyle = '#bbb'
    ctx.font = '9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${photos.length} memories captured together`, canvas.width / 2, canvas.height - 14)
  }
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Magazine: big hero left, 2 smaller right ─────────────────────────────────
async function renderMagazine(
  photos: CapturedPhoto[],
  opts: StripOptions,
): Promise<string | null> {
  if (photos.length < 2) return renderClassic(photos, opts)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const W = 900
  const HEADER = 72
  const FOOTER = 40
  // hero takes left half; right column gets up to 3 photos stacked
  const heroW = Math.round(W * 0.55) - PAD * 2 - GAP / 2
  const colW = W - PAD * 2 - GAP - heroW
  const heroH = Math.round(heroW * 1.25)
  const rightPhotos = photos.slice(1, 4)
  const rightH = Math.round((heroH - GAP * (rightPhotos.length - 1)) / rightPhotos.length)
  const totalH = HEADER + heroH + FOOTER
  canvas.width = W; canvas.height = totalH

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, totalH)

  // header bar
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, W, HEADER)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SnapTogether', PAD, 38)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText(
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    PAD, 56,
  )

  const imgs = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const heroX = PAD; const heroY = HEADER + GAP

  ctx.save()
  roundRect(ctx, heroX, heroY, heroW, heroH, CORNER)
  ctx.clip()
  ctx.drawImage(imgs[0], heroX, heroY, heroW, heroH)
  ctx.restore()

  const rightX = heroX + heroW + GAP
  rightPhotos.forEach((_, i) => {
    const ry = heroY + i * (rightH + GAP)
    ctx.save()
    roundRect(ctx, rightX, ry, colW, rightH, CORNER)
    ctx.clip()
    ctx.drawImage(imgs[i + 1], rightX, ry, colW, rightH)
    ctx.restore()
  })

  ctx.fillStyle = '#bbb'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('snaptogether.app', W - PAD, totalH - 14)
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Couple: 2-column, matching pairs ─────────────────────────────────────────
// canonical: creator always left col, partner always right col
// each row = same-shot pair side by side
async function renderCouple(
  photos: CapturedPhoto[],
  opts: StripOptions,
): Promise<string | null> {
  if (photos.length < 1) return null
  const { isCreator = true } = opts
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const HEADER = 72; const FOOTER = 44
  const colW = Math.round(PHOTO_W * 0.9)
  const W = colW * 2 + GAP * 3 + PAD

  // Load + compute row heights
  const imgs = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const rowH = Math.round(colW * (imgs[0].naturalHeight / imgs[0].naturalWidth))
  const rows = Math.ceil(photos.length / 2)
  const H = HEADER + rows * rowH + (rows - 1) * GAP + FOOTER

  canvas.width = W; canvas.height = H

  // Pastel pink background
  ctx.fillStyle = '#fff5f7'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#ffd6dd'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1, 1, W - 2, H - 2)

  // Header
  ctx.fillStyle = '#d63a5a'
  ctx.font = 'bold 17px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('SnapTogether 💕', W / 2, 36)
  ctx.fillStyle = '#e8889a'
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText(
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    W / 2, 55,
  )

  // Column labels
  const leftLabel = isCreator ? 'Me' : 'Partner'
  const rightLabel = isCreator ? 'Partner' : 'Me'
  ctx.font = 'bold 10px system-ui, sans-serif'
  ctx.fillStyle = '#cc3355'
  ctx.textAlign = 'center'
  ctx.fillText(leftLabel.toUpperCase(), PAD / 2 + colW / 2, 68)
  ctx.fillText(rightLabel.toUpperCase(), PAD / 2 + colW + GAP + colW / 2, 68)

  // Photos in pairs
  for (let row = 0; row < rows; row++) {
    const y = HEADER + row * (rowH + GAP)
    const leftIdx = row * 2
    const rightIdx = row * 2 + 1

    if (imgs[leftIdx]) {
      ctx.save()
      roundRect(ctx, PAD / 2, y, colW, rowH, CORNER)
      ctx.clip()
      ctx.drawImage(imgs[leftIdx], PAD / 2, y, colW, rowH)
      ctx.restore()
    }
    if (imgs[rightIdx]) {
      ctx.save()
      roundRect(ctx, PAD / 2 + colW + GAP, y, colW, rowH, CORNER)
      ctx.clip()
      ctx.drawImage(imgs[rightIdx], PAD / 2 + colW + GAP, y, colW, rowH)
      ctx.restore()
    }

    // Divider heart between cols
    ctx.font = '13px serif'
    ctx.textAlign = 'center'
    ctx.fillText('♥', PAD / 2 + colW + GAP / 2, y + rowH / 2 + 5)
  }

  ctx.fillStyle = '#e8889a'
  ctx.font = 'italic 10px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('captured together, wherever you are', W / 2, H - 14)
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Memory Card: polaroid feel, date + caption ───────────────────────────────
async function renderMemory(
  photos: CapturedPhoto[],
  opts: StripOptions,
): Promise<string | null> {
  const { caption = '' } = opts
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const W = PHOTO_W + PAD * 3
  const imgs = await Promise.all(photos.slice(0, 3).map(p => loadImage(p.dataUrl)))
  const photoH = Math.round(PHOTO_W * (imgs[0].naturalHeight / imgs[0].naturalWidth))
  const HEADER = 60; const CARD_PAD = PAD
  const captionH = 90
  const H = HEADER + CARD_PAD + photoH + captionH + CARD_PAD

  canvas.width = W; canvas.height = H

  // Warm cream
  ctx.fillStyle = '#f8f5ee'
  ctx.fillRect(0, 0, W, H)

  // Top strip tape effect
  ctx.fillStyle = 'rgba(255,220,100,0.35)'
  const tapeW = 60; const tapeH = 18
  ctx.save()
  ctx.translate(W / 2, HEADER / 3)
  ctx.rotate(-0.03)
  ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH)
  ctx.restore()

  // "SnapTogether" stamp top
  ctx.fillStyle = '#7c6a52'
  ctx.font = 'bold 13px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('SnapTogether', W / 2, HEADER / 2 + 4)
  ctx.fillStyle = '#b0967a'
  ctx.font = '10px Georgia, serif'
  ctx.fillText('a memory', W / 2, HEADER / 2 + 18)

  // Main photo (only first)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 4
  roundRect(ctx, CARD_PAD, HEADER + CARD_PAD, PHOTO_W, photoH, 4)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, CARD_PAD + 6, HEADER + CARD_PAD + 6, PHOTO_W - 12, photoH - 12, 2)
  ctx.clip()
  ctx.drawImage(imgs[0], CARD_PAD + 6, HEADER + CARD_PAD + 6, PHOTO_W - 12, photoH - 12)
  ctx.restore()

  // Caption area
  const capY = HEADER + CARD_PAD + photoH + 16
  ctx.fillStyle = '#5a4a38'
  ctx.font = 'italic 14px Georgia, serif'
  ctx.textAlign = 'center'
  const displayCaption = caption || '✨ a moment to remember'
  const maxW = W - PAD * 3
  const words = displayCaption.split(' ')
  let line = ''; let lineY = capY
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, W / 2, lineY); line = word; lineY += 20
    } else line = test
  }
  if (line) ctx.fillText(line, W / 2, lineY)

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  ctx.fillStyle = '#b0967a'
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillText(dateStr, W / 2, H - 16)

  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Public entry point ───────────────────────────────────────────────────────
export async function renderStrip(
  photos: CapturedPhoto[],
  options: StripOptions = {},
): Promise<string | null> {
  if (photos.length === 0) return null
  const layout = options.layout ?? 'classic'
  switch (layout) {
    case 'magazine': return renderMagazine(photos, options)
    case 'couple':   return renderCouple(photos, options)
    case 'memory':   return renderMemory(photos, options)
    default:         return renderClassic(photos, options)
  }
}