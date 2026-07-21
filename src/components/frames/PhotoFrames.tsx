import type { CapturedPhoto } from '@/lib/types'

export interface StripOptions {
  layout?: 'classic' | 'magazine' | 'couple' | 'memory'
  showHeader?: boolean
  showCaption?: boolean
  caption?: string
  isCreator?: boolean
  frameId?: string
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

// ─── Frame overlay renderer ──────────────────────────────────────────────────
async function applyFrame(stripDataUrl: string, frameId: string): Promise<string> {
  if (!frameId || frameId === 'none') return stripDataUrl

  const img = await loadImage(stripDataUrl)
  const W = img.naturalWidth
  const H = img.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const BORDER = Math.round(W * 0.04)

  switch (frameId) {
    case 'cinema-reel': {
      const HOLE_W = Math.round(W * 0.06)
      const HOLE_H = Math.round(HOLE_W * 0.65)
      const HOLE_GAP = Math.round(HOLE_H * 1.6)
      canvas.width = W + HOLE_W * 2 + 8
      canvas.height = H + BORDER * 2
      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // draw strip
      ctx.drawImage(img, HOLE_W + 4, BORDER, W, H)
      // sprocket holes
      const holesCount = Math.floor(H / HOLE_GAP)
      const startY = BORDER + Math.round((H - holesCount * HOLE_GAP) / 2)
      for (let i = 0; i < holesCount; i++) {
        const hy = startY + i * HOLE_GAP
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.beginPath(); ctx.roundRect(4, hy, HOLE_W, HOLE_H, 3); ctx.fill()
        ctx.beginPath(); ctx.roundRect(canvas.width - HOLE_W - 4, hy, HOLE_W, HOLE_H, 3); ctx.fill()
      }
      break
    }
    case 'gallery-portfolio': {
      canvas.width = W + BORDER * 2
      canvas.height = H + BORDER * 3
      ctx.fillStyle = '#FDFBF9'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.shadowColor = 'rgba(0,0,0,0.06)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2
      ctx.drawImage(img, BORDER, BORDER, W, H)
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = '#8a7f74'
      ctx.font = `${Math.round(W * 0.025)}px Georgia, serif`
      ctx.textAlign = 'center'
      ctx.fillText('SnapTogether', canvas.width / 2, H + BORDER * 2.2)
      break
    }
    case 'vinyl-album': {
      const TAG_H = Math.round(W * 0.08)
      canvas.width = W + BORDER * 2
      canvas.height = H + BORDER * 2 + TAG_H
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
      ctx.drawImage(img, BORDER, BORDER, W, H)
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(BORDER, H + BORDER + 4, W, 2)
      ctx.fillStyle = '#1a1a1a'
      ctx.font = `bold ${Math.round(W * 0.022)}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText('[ SESSION_07 ]', BORDER + 4, H + BORDER + TAG_H - 4)
      ctx.fillStyle = '#888'
      ctx.textAlign = 'right'
      ctx.fillText('// ST.APP', BORDER + W - 4, H + BORDER + TAG_H - 4)
      break
    }
    case 'sweetheart-candy': {
      canvas.width = W + BORDER * 2
      canvas.height = H + BORDER * 2 + Math.round(W * 0.06)
      ctx.fillStyle = '#FFF0F5'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, BORDER, BORDER, W, H)
      ctx.fillStyle = '#e89ab4'
      ctx.font = `italic ${Math.round(W * 0.028)}px Georgia, serif`
      ctx.textAlign = 'center'
      ctx.fillText('✨ together ✨', canvas.width / 2, H + BORDER * 2 + Math.round(W * 0.04))
      break
    }
    case 'vintage-valentine': {
      const SCALLOP_H = Math.round(W * 0.03)
      canvas.width = W + BORDER * 2
      canvas.height = H + BORDER * 2 + SCALLOP_H * 2 + Math.round(W * 0.05)
      ctx.fillStyle = '#F9F1F2'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e8c0c8'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
      // scallop top
      ctx.beginPath()
      const scW = 12
      for (let x = 0; x < canvas.width; x += scW) {
        ctx.moveTo(x, SCALLOP_H)
        ctx.quadraticCurveTo(x + scW / 2, 0, x + scW, SCALLOP_H)
      }
      ctx.strokeStyle = '#d4657a'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.drawImage(img, BORDER, BORDER + SCALLOP_H, W, H)
      // scallop bottom
      ctx.beginPath()
      for (let x = 0; x < canvas.width; x += scW) {
        ctx.moveTo(x, H + BORDER + SCALLOP_H + 2)
        ctx.quadraticCurveTo(x + scW / 2, H + BORDER + SCALLOP_H * 2 + 2, x + scW, H + BORDER + SCALLOP_H + 2)
      }
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#c06070'
      ctx.font = `bold ${Math.round(W * 0.022)}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText('✦ WITH LOVE · SNAPTOGETHER ✦', canvas.width / 2, canvas.height - 8)
      break
    }
    case 'love-letter': {
      const NOTE_H = Math.round(W * 0.12)
      canvas.width = W + BORDER * 2
      canvas.height = H + BORDER * 2 + NOTE_H
      ctx.fillStyle = '#FFFCF8'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // ruled lines
      const lineGap = Math.round(W * 0.048)
      ctx.strokeStyle = '#e8d8d0'
      ctx.lineWidth = 0.8
      for (let y = lineGap; y < canvas.height; y += lineGap) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
      }
      // margin line
      ctx.strokeStyle = '#f0b0b0'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.4
      ctx.beginPath(); ctx.moveTo(BORDER * 2, 0); ctx.lineTo(BORDER * 2, canvas.height); ctx.stroke()
      ctx.globalAlpha = 1
      ctx.drawImage(img, BORDER, BORDER, W, H)
      ctx.fillStyle = '#c07080'
      ctx.font = `italic ${Math.round(W * 0.05)}px cursive`
      ctx.textAlign = 'left'
      ctx.fillText('xoxo, always', BORDER + 4, H + BORDER + NOTE_H * 0.6)
      break
    }
    case 'parallel-lines': {
      const FOOTER_H = Math.round(W * 0.08)
      canvas.width = W + BORDER * 2
      canvas.height = H + BORDER * 2 + FOOTER_H
      ctx.fillStyle = '#FCFAF7'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, BORDER, BORDER, W, H)
      const cy = H + BORDER + FOOTER_H / 2
      ctx.strokeStyle = '#d4cdc6'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(BORDER, cy); ctx.lineTo(canvas.width - BORDER, cy); ctx.stroke()
      ctx.fillStyle = '#e8897a'
      ctx.beginPath(); ctx.arc(canvas.width / 2, cy, 6, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(232,137,122,0.3)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(canvas.width / 2, cy, 10, 0, Math.PI * 2); ctx.stroke()
      const fs = Math.round(W * 0.028)
      ctx.fillStyle = '#6b5f54'
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText('SYD', BORDER, cy + 4)
      ctx.textAlign = 'right'
      ctx.fillText('NYC', canvas.width - BORDER, cy + 4)
      break
    }
    case 'lovers-polaroid': {
      canvas.width = W + BORDER * 4
      canvas.height = H + BORDER * 4 + Math.round(W * 0.08)
      ctx.fillStyle = '#FAF7F2'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // polaroid A — tilted left
      ctx.save()
      ctx.translate(canvas.width * 0.3, canvas.height * 0.45)
      ctx.rotate(-0.06)
      const pw = Math.round(W * 0.45)
      const ph = Math.round(pw * 1.15)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.18)'
      ctx.shadowBlur = 16
      ctx.shadowOffsetY = 6
      ctx.fillRect(-pw / 2 - 8, -ph / 2 - 8, pw + 16, ph + 40)
      ctx.shadowColor = 'transparent'
      ctx.drawImage(img, 0, 0, Math.round(img.naturalWidth / 2), img.naturalHeight, -pw / 2, -ph / 2, pw, ph)
      ctx.fillStyle = '#8a7060'
      ctx.font = `italic ${Math.round(pw * 0.1)}px cursive`
      ctx.textAlign = 'center'
      ctx.fillText('you', 0, ph / 2 + 22)
      ctx.restore()
      // polaroid B — tilted right
      ctx.save()
      ctx.translate(canvas.width * 0.7, canvas.height * 0.45)
      ctx.rotate(0.05)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.18)'
      ctx.shadowBlur = 16
      ctx.shadowOffsetY = 6
      ctx.fillRect(-pw / 2 - 8, -ph / 2 - 8, pw + 16, ph + 40)
      ctx.shadowColor = 'transparent'
      ctx.drawImage(img, Math.round(img.naturalWidth / 2), 0, Math.round(img.naturalWidth / 2), img.naturalHeight, -pw / 2, -ph / 2, pw, ph)
      ctx.fillStyle = '#8a7060'
      ctx.font = `italic ${Math.round(pw * 0.1)}px cursive`
      ctx.textAlign = 'center'
      ctx.fillText('me', 0, ph / 2 + 22)
      ctx.restore()
      ctx.fillStyle = '#a08878'
      ctx.font = `italic ${Math.round(W * 0.045)}px cursive`
      ctx.textAlign = 'center'
      ctx.fillText('You & Me.', canvas.width / 2, canvas.height - BORDER)
      break
    }
    default: {
      // Simple thin border for other frames
      canvas.width = W + BORDER
      canvas.height = H + BORDER
      ctx.fillStyle = '#FDFBF9'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, BORDER / 2, BORDER / 2, W, H)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Frame overlay (──────────────────────────────────────────────────────────────────────────────────
async function applyFrame(dataUrl: string, frameId: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const W = img.naturalWidth, H = img.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const B = Math.round(W * 0.04)

  switch (frameId) {
    case 'cinema-reel': {
      const hw = Math.round(W * 0.06), hh = Math.round(hw * 0.65), hg = Math.round(hh * 1.6)
      canvas.width = W + hw * 2 + 8; canvas.height = H + B * 2
      ctx.fillStyle = '#1A1A1A'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, hw + 4, B, W, H)
      const n = Math.floor(H / hg), sy = B + Math.round((H - n * hg) / 2)
      for (let i = 0; i < n; i++) {
        const hy = sy + i * hg
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.beginPath(); ctx.roundRect(4, hy, hw, hh, 3); ctx.fill()
        ctx.beginPath(); ctx.roundRect(canvas.width - hw - 4, hy, hw, hh, 3); ctx.fill()
      }
      break
    }
    case 'gallery-portfolio': {
      canvas.width = W + B * 2; canvas.height = H + B * 3
      ctx.fillStyle = '#FDFBF9'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.shadowColor = 'rgba(0,0,0,0.06)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2
      ctx.drawImage(img, B, B, W, H); ctx.shadowColor = 'transparent'
      ctx.fillStyle = '#8a7f74'; ctx.font = `${Math.round(W*0.025)}px Georgia,serif`
      ctx.textAlign = 'center'
      ctx.fillText('SnapTogether', canvas.width/2, H + B * 2.2)
      break
    }
    case 'vinyl-album': {
      const th = Math.round(W * 0.08)
      canvas.width = W + B * 2; canvas.height = H + B * 2 + th
      ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1; ctx.strokeRect(0.5,0.5,canvas.width-1,canvas.height-1)
      ctx.drawImage(img, B, B, W, H)
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(B, H+B+4, W, 2)
      ctx.font = `bold ${Math.round(W*0.022)}px monospace`
      ctx.textAlign = 'left'; ctx.fillText('[ SESSION_07 ]', B+4, H+B+th-4)
      ctx.fillStyle = '#888'; ctx.textAlign = 'right'; ctx.fillText('// ST.APP', B+W-4, H+B+th-4)
      break
    }
    case 'sweetheart-candy': {
      const fh = Math.round(W * 0.07)
      canvas.width = W + B * 2; canvas.height = H + B * 2 + fh
      ctx.fillStyle = '#FFF0F5'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, B, B, W, H)
      ctx.fillStyle = '#e89ab4'; ctx.font = `italic ${Math.round(W*0.028)}px Georgia,serif`
      ctx.textAlign = 'center'; ctx.fillText('✨ together ✨', canvas.width/2, H+B*2+fh*0.65)
      break
    }
    case 'vintage-valentine': {
      const sh = Math.round(W * 0.03), fh = Math.round(W * 0.06)
      canvas.width = W + B * 2; canvas.height = H + B * 2 + sh * 2 + fh
      ctx.fillStyle = '#F9F1F2'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e8c0c8'; ctx.lineWidth = 1; ctx.strokeRect(0.5,0.5,canvas.width-1,canvas.height-1)
      const drawScallop = (y: number) => {
        ctx.beginPath()
        for (let x = 0; x < canvas.width; x += 12) { ctx.moveTo(x,y); ctx.quadraticCurveTo(x+6,y-sh*2,x+12,y) }
        ctx.strokeStyle='#d4657a'; ctx.lineWidth=1; ctx.globalAlpha=0.5; ctx.stroke(); ctx.globalAlpha=1
      }
      drawScallop(sh + 2); ctx.drawImage(img, B, sh + B + 2, W, H); drawScallop(H + sh + B + 4)
      ctx.fillStyle='#c06070'; ctx.font=`bold ${Math.round(W*0.022)}px monospace`
      ctx.textAlign='center'; ctx.fillText('❆ WITH LOVE · SNAPTOGETHER ❆', canvas.width/2, canvas.height - 8)
      break
    }
    case 'love-letter': {
      const nh = Math.round(W * 0.12)
      canvas.width = W + B * 2; canvas.height = H + B * 2 + nh
      ctx.fillStyle = '#FFFCF8'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      const lg = Math.round(W * 0.048)
      ctx.strokeStyle='#e8d8d0'; ctx.lineWidth=0.8
      for (let y = lg; y < canvas.height; y += lg) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke() }
      ctx.strokeStyle='#f0b0b0'; ctx.lineWidth=1; ctx.globalAlpha=0.4
      ctx.beginPath(); ctx.moveTo(B*2,0); ctx.lineTo(B*2,canvas.height); ctx.stroke(); ctx.globalAlpha=1
      ctx.drawImage(img, B, B, W, H)
      ctx.fillStyle='#c07080'; ctx.font=`italic ${Math.round(W*0.05)}px cursive`
      ctx.textAlign='left'; ctx.fillText('xoxo, always', B+4, H+B+nh*0.6)
      break
    }
    case 'parallel-lines': {
      const fh = Math.round(W * 0.09)
      canvas.width = W + B * 2; canvas.height = H + B * 2 + fh
      ctx.fillStyle = '#FCFAF7'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, B, B, W, H)
      const cy = H + B + fh / 2
      ctx.strokeStyle='#d4cdc6'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(B,cy); ctx.lineTo(canvas.width-B,cy); ctx.stroke()
      ctx.fillStyle='#e8897a'; ctx.beginPath(); ctx.arc(canvas.width/2,cy,6,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='rgba(232,137,122,0.3)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(canvas.width/2,cy,11,0,Math.PI*2); ctx.stroke()
      const fs = Math.round(W*0.028)
      ctx.fillStyle='#6b5f54'; ctx.font=`bold ${fs}px monospace`
      ctx.textAlign='left'; ctx.fillText('SYD', B, cy+5)
      ctx.textAlign='right'; ctx.fillText('NYC', canvas.width-B, cy+5)
      break
    }
    case 'lovers-polaroid': {
      canvas.width = W + B * 4; canvas.height = H + B * 4 + Math.round(W * 0.08)
      ctx.fillStyle = '#FAF7F2'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      const pw = Math.round(W * 0.45), ph = Math.round(pw * 1.15)
      const drawPol = (cx: number, cy: number, rot: number, label: string, sx: number) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
        ctx.shadowColor='rgba(0,0,0,0.18)'; ctx.shadowBlur=16; ctx.shadowOffsetY=6
        ctx.fillStyle='#fff'; ctx.fillRect(-pw/2-8,-ph/2-8,pw+16,ph+40); ctx.shadowColor='transparent'
        ctx.drawImage(img, sx, 0, img.naturalWidth/2, img.naturalHeight, -pw/2, -ph/2, pw, ph)
        ctx.fillStyle='#8a7060'; ctx.font=`italic ${Math.round(pw*0.1)}px cursive`
        ctx.textAlign='center'; ctx.fillText(label, 0, ph/2+22); ctx.restore()
      }
      drawPol(canvas.width*0.3, canvas.height*0.44, -0.06, 'you', 0)
      drawPol(canvas.width*0.7, canvas.height*0.44,  0.05, 'me',  img.naturalWidth/2)
      ctx.fillStyle='#a08878'; ctx.font=`italic ${Math.round(W*0.045)}px cursive`
      ctx.textAlign='center'; ctx.fillText('You & Me.', canvas.width/2, canvas.height - B)
      break
    }
    default: {
      canvas.width = W + B; canvas.height = H + B
      ctx.fillStyle = '#FDFBF9'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, B/2, B/2, W, H)
    }
  }
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Public entry point ──────────────────────────────────────────────────────────────────────────────────
export async function renderStrip(
  photos: CapturedPhoto[],
  options: StripOptions = {},
): Promise<string | null> {
  if (photos.length === 0) return null
  const layout = options.layout ?? 'classic'
  let result: string | null
  switch (layout) {
    case 'magazine': result = await renderMagazine(photos, options); break
    case 'couple':   result = await renderCouple(photos, options); break
    case 'memory':   result = await renderMemory(photos, options); break
    default:         result = await renderClassic(photos, options)
  }
  if (!result) return null
  if (options.frameId && options.frameId !== 'none') {
    return applyFrame(result, options.frameId)
  }
  return result
}