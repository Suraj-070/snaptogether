import type { CapturedPhoto } from '@/lib/types'

export interface StripOptions {
  layout?: 'classic' | 'magazine' | 'couple' | 'memory'
  showHeader?: boolean
  showCaption?: boolean
  caption?: string
  isCreator?: boolean
  frameId?: string
}

const PAD = 32   // generous horizontal mat margin
const GAP = 10
const PHOTO_W = 400
const FOOTER_H = 34   // premium footer height
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

// ─── Premium strip footer ─────────────────────────────────────────────────────
// Clean minimal bottom strip — no big header, just a tasteful mark
function drawPremiumFooter(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Very light spaced tracking — like embossed print date
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.font = '900 10px system-ui, sans-serif'
  ctx.letterSpacing = '0.18em'
  ctx.fillText(dateStr.toUpperCase(), cw / 2, ch - FOOTER_H / 2)

  ctx.restore()
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
  const { caption = '' } = opts
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const imgs = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const heights = imgs.map(img => Math.round(PHOTO_W * (img.naturalHeight / img.naturalWidth)))

  // Premium layout: no top header, photos with tight gaps, clean footer
  const topPad   = PAD         // minimal top breathing room
  const photoGap = 12          // comfortable vertical gap between photos
  const totalPhotoH = heights.reduce((a, b) => a + b, 0) + photoGap * (imgs.length - 1)

  canvas.width  = PHOTO_W + PAD * 2
  canvas.height = topPad + totalPhotoH + FOOTER_H

  // Warm cream background — feels like premium photo paper
  ctx.fillStyle = '#faf8f5'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw photos — no rounded corners, edge-to-edge strip feel
  let y = topPad
  imgs.forEach((img, i) => {
    const h = heights[i]
    // Subtle vignette shadow between photos
    if (i > 0) {
      const grad = ctx.createLinearGradient(0, y - photoGap, 0, y + 4)
      grad.addColorStop(0, 'rgba(0,0,0,0.08)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(PAD, y - photoGap, PHOTO_W, 6)
    }
    ctx.save()
    roundRect(ctx, PAD, y, PHOTO_W, h, 2)   // minimal corner radius
    ctx.clip()
    ctx.drawImage(img, PAD, y, PHOTO_W, h)
    ctx.restore()
    y += h + photoGap
  })

  // Premium footer — date left, ✦ centre, wordmark right
  drawPremiumFooter(ctx, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.95)  // slightly higher quality
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
  // hero takes left half; right column gets up to 3 photos stacked
  const heroW = Math.round(W * 0.55) - PAD * 2 - GAP / 2
  const colW = W - PAD * 2 - GAP - heroW
  const heroH = Math.round(heroW * 1.25)
  const rightPhotos = photos.slice(1, 4)
  const rightH = Math.round((heroH - GAP * (rightPhotos.length - 1)) / rightPhotos.length)
  const totalH = PAD + heroH + FOOTER_H
  canvas.width = W; canvas.height = totalH

  ctx.fillStyle = '#faf8f5'
  ctx.fillRect(0, 0, W, totalH)

  const imgs = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const heroX = PAD; const heroY = PAD

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
    // imgs[i+1] matches rightPhotos index correctly
    if (imgs[i + 1]) ctx.drawImage(imgs[i + 1], rightX, ry, colW, rightH)
    ctx.restore()
  })

  drawPremiumFooter(ctx, W, totalH)
  return canvas.toDataURL('image/jpeg', 0.95)
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
  const colW = Math.round(PHOTO_W * 0.9)
  const W = PAD * 2 + colW * 2 + GAP * 3

  // Load + compute row heights
  const imgs = await Promise.all(photos.map(p => loadImage(p.dataUrl)))
  const rowH = Math.round(colW * (imgs[0].naturalHeight / imgs[0].naturalWidth))
  const rows = Math.ceil(photos.length / 2)
  const H = PAD + rows * rowH + (rows - 1) * GAP + FOOTER_H

  canvas.width = W; canvas.height = H

  // Warm cream background
  ctx.fillStyle = '#faf8f5'
  ctx.fillRect(0, 0, W, H)

  // Subtle column name labels — minimal
  const leftLabel = isCreator ? 'you' : 'them'
  const rightLabel = isCreator ? 'them' : 'you'
  ctx.font = 'italic 9px Georgia, serif'
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(leftLabel, PAD + colW / 2, 6)
  ctx.fillText(rightLabel, PAD + colW + GAP + colW / 2, 6)
  ctx.textBaseline = 'alphabetic'

  // Photos in pairs
  for (let row = 0; row < rows; row++) {
    const y = PAD + row * (rowH + GAP)
    const leftIdx = row * 2
    const rightIdx = row * 2 + 1

    if (imgs[leftIdx]) {
      ctx.save()
      roundRect(ctx, PAD, y, colW, rowH, CORNER)
      ctx.clip()
      ctx.drawImage(imgs[leftIdx], PAD, y, colW, rowH)
      ctx.restore()
    }
    if (imgs[rightIdx]) {
      ctx.save()
      roundRect(ctx, PAD + colW + GAP, y, colW, rowH, CORNER)
      ctx.clip()
      ctx.drawImage(imgs[rightIdx], PAD + colW + GAP, y, colW, rowH)
      ctx.restore()
    }

    // Divider heart between cols
    ctx.font = '13px serif'
    ctx.textAlign = 'center'
    ctx.fillText('♥', PAD + colW + GAP / 2, y + rowH / 2 + 5)
  }

  drawPremiumFooter(ctx, W, H)
  return canvas.toDataURL('image/jpeg', 0.95)
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
  const CARD_PAD = PAD
  const captionH = caption ? 36 : 0
  const H = PAD + CARD_PAD + photoH + (captionH || 0) + FOOTER_H

  canvas.width = W; canvas.height = H

  // Warm cream paper
  ctx.fillStyle = '#faf8f5'
  ctx.fillRect(0, 0, W, H)

  // Main photo (only first)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 4
  roundRect(ctx, CARD_PAD, PAD + CARD_PAD, PHOTO_W, photoH, 4)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, CARD_PAD + 6, PAD + CARD_PAD + 6, PHOTO_W - 12, photoH - 12, 2)
  ctx.clip()
  ctx.drawImage(imgs[0], CARD_PAD + 6, PAD + CARD_PAD + 6, PHOTO_W - 12, photoH - 12)
  ctx.restore()

  // Caption area
  const capY = PAD + CARD_PAD + photoH + 16
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

  drawPremiumFooter(ctx, W, H)
  return canvas.toDataURL('image/jpeg', 0.95)
}

// ─── Frame overlay ───────────────────────────────────────────────────────────
// applyFrame receives the already-rendered strip image and wraps it with a
// decorative border. It never recomposes photos — just adds chrome around the
// finished strip image.
async function applyFrame(dataUrl: string, frameId: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const W = img.naturalWidth
  const H = img.naturalHeight
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Border thickness relative to strip width
  const B = Math.round(Math.max(W, H) * 0.035)
  const FOOTER = Math.round(Math.max(W, H) * 0.06)

  const place = () => ctx.drawImage(img, B, B, W, H)

  switch (frameId) {

    // ── Cinema Reel: charcoal bg + sprocket holes left & right ──────────────
    case 'cinema-reel': {
      const hw = Math.round(W * 0.055)   // hole width
      const hh = Math.round(hw * 0.65)   // hole height
      const hgap = Math.round(hh * 2.2)  // gap between holes
      const gutterL = hw + 8
      const gutterR = hw + 8
      canvas.width  = W + gutterL + gutterR
      canvas.height = H + B * 2

      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // draw strip image centred vertically with small top/bottom pad
      ctx.drawImage(img, gutterL, B, W, H)

      // holes: evenly spaced, inset from top/bottom
      const usableH = H - B
      const nHoles  = Math.max(1, Math.floor(usableH / hgap))
      const spacing = usableH / nHoles
      const startY  = B + spacing / 2 - hh / 2

      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      for (let i = 0; i < nHoles; i++) {
        const hy = Math.round(startY + i * spacing)
        // left gutter hole
        ctx.beginPath()
        ctx.roundRect(4, hy, hw, hh, 2)
        ctx.fill()
        // right gutter hole
        ctx.beginPath()
        ctx.roundRect(canvas.width - hw - 4, hy, hw, hh, 2)
        ctx.fill()
      }

      // timestamp footer
      ctx.fillStyle = '#555'
      ctx.font = `${Math.round(W * 0.018)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(
        new Date().toLocaleTimeString('en-US', { hour12: false }) + ' · SNAPTOGETHER',
        canvas.width / 2,
        canvas.height - 4,
      )
      break
    }

    // ── Gallery Portfolio: cream mat with serif footer ───────────────────────
    case 'gallery-portfolio': {
      canvas.width  = W + B * 2
      canvas.height = H + B + FOOTER + B

      ctx.fillStyle = '#FDFBF9'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // subtle inset shadow on the photo area
      ctx.save()
      ctx.shadowColor   = 'rgba(0,0,0,0.10)'
      ctx.shadowBlur    = 12
      ctx.shadowOffsetY = 3
      ctx.fillStyle = '#fff'
      ctx.fillRect(B - 2, B - 2, W + 4, H + 4)
      ctx.restore()

      ctx.drawImage(img, B, B, W, H)

      // serif footer
      const fSize = Math.round(Math.min(W, H) * 0.025)
      ctx.fillStyle   = '#8a7f74'
      ctx.font        = `${fSize}px Georgia,serif`
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        'SnapTogether',
        canvas.width / 2,
        H + B + FOOTER * 0.42,
      )
      ctx.fillStyle = '#b5aca3'
      ctx.font      = `${Math.round(fSize * 0.8)}px monospace`
      ctx.fillText(
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        canvas.width / 2,
        H + B + FOOTER * 0.72,
      )
      break
    }

    // ── Vinyl Album: chalk white, thick bottom tag ───────────────────────────
    case 'vinyl-album': {
      const tagH = Math.round(Math.min(W, H) * 0.06)
      canvas.width  = W + B * 2
      canvas.height = H + B * 2 + tagH

      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth   = 1
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)

      ctx.drawImage(img, B, B, W, H)

      // thick rule above tag
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(B, H + B + 4, W, 2)

      const tSize = Math.round(Math.min(W, H) * 0.022)
      ctx.font         = `bold ${tSize}px monospace`
      ctx.textBaseline = 'middle'
      const tagMidY    = H + B + 4 + (tagH - 4) / 2 + 4

      ctx.fillStyle  = '#1a1a1a'
      ctx.textAlign  = 'left'
      ctx.fillText('[ SESSION_07 ]', B + 6, tagMidY)

      ctx.fillStyle = '#888'
      ctx.textAlign = 'right'
      ctx.fillText('// ST.APP', B + W - 6, tagMidY)
      break
    }

    // ── Sweetheart Candy: soft pink mat, italic footer ───────────────────────
    case 'sweetheart-candy': {
      canvas.width  = W + B * 2
      canvas.height = H + B + FOOTER + B

      ctx.fillStyle = '#FFF0F5'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // soft pink border line
      ctx.strokeStyle = 'rgba(255,160,190,0.35)'
      ctx.lineWidth   = B / 2
      ctx.strokeRect(B / 4, B / 4, canvas.width - B / 2, canvas.height - B / 2)

      ctx.drawImage(img, B, B, W, H)

      const fSize = Math.round(Math.min(W, H) * 0.028)
      ctx.fillStyle    = '#e89ab4'
      ctx.font         = `italic ${fSize}px Georgia,serif`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('✨  together  ✨', canvas.width / 2, H + B + FOOTER / 2)
      break
    }

    // ── Vintage Valentine: rose bg, scallop border top+bottom ───────────────
    case 'vintage-valentine': {
      const scH    = Math.round(B * 0.7)   // scallop wave height
      const scW    = Math.round(B * 0.6)   // scallop wave width
      const tagH   = Math.round(Math.min(W, H) * 0.045)
      const topPad = scH + B
      const botPad = scH + tagH + B

      canvas.width  = W + B * 2
      canvas.height = H + topPad + botPad

      ctx.fillStyle = '#F9F1F2'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e8c0c8'
      ctx.lineWidth   = 1
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)

      // draw image
      ctx.drawImage(img, B, topPad, W, H)

      // scallop helper — draws wave along a horizontal line at y
      // peaks go UP (toward y=0)
      const scallop = (baseY: number) => {
        ctx.beginPath()
        ctx.moveTo(0, baseY)
        let x = 0
        while (x < canvas.width) {
          ctx.quadraticCurveTo(x + scW / 2, baseY - scH, x + scW, baseY)
          x += scW
        }
        ctx.lineTo(canvas.width, baseY)
        ctx.strokeStyle = '#d4657a'
        ctx.lineWidth   = 1.2
        ctx.globalAlpha = 0.55
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      scallop(scH + 2)                     // top edge
      scallop(H + topPad + scH + 2)        // bottom edge (above tag)

      const tSize = Math.round(Math.min(W, H) * 0.02)
      ctx.fillStyle    = '#c06070'
      ctx.font         = `bold ${tSize}px monospace`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        '✦  WITH LOVE  ·  SNAPTOGETHER  ✦',
        canvas.width / 2,
        H + topPad + scH * 2 + tagH / 2 + 4,
      )
      break
    }

    // ── Love Letter: ruled paper bg, handwritten footer ──────────────────────
    case 'love-letter': {
      const noteH = Math.round(Math.min(W, H) * 0.11)
      canvas.width  = W + B * 2
      canvas.height = H + B * 2 + noteH

      ctx.fillStyle = '#FFFCF8'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // ruled lines across full canvas
      const lineGap = Math.round(Math.min(W, H) * 0.048)
      ctx.strokeStyle = '#e8d8d0'
      ctx.lineWidth   = 0.7
      for (let y = lineGap; y < canvas.height; y += lineGap) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // red margin line
      const marginX = Math.round(B * 1.8)
      ctx.strokeStyle = '#f0b0b0'
      ctx.lineWidth   = 1
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(marginX, 0)
      ctx.lineTo(marginX, canvas.height)
      ctx.stroke()
      ctx.globalAlpha = 1

      ctx.drawImage(img, B, B, W, H)

      const sigSize = Math.round(Math.min(W, H) * 0.048)
      ctx.fillStyle    = '#c07080'
      ctx.font         = `italic ${sigSize}px cursive`
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('xoxo, always', marginX + 6, H + B + noteH * 0.45)

      const psSize = Math.round(sigSize * 0.5)
      ctx.fillStyle = '#c4a8a0'
      ctx.font      = `${psSize}px monospace`
      ctx.fillText('P.S. I Love You', marginX + 6, H + B + noteH * 0.78)
      break
    }

    // ── Parallel Lines: linen bg, city codes + pulsing node footer ──────────
    case 'parallel-lines': {
      const footH = Math.round(Math.min(W, H) * 0.09)
      canvas.width  = W + B * 2
      canvas.height = H + B * 2 + footH

      ctx.fillStyle = '#FCFAF7'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.drawImage(img, B, B, W, H)

      const lineY = H + B + footH / 2

      // horizontal line
      ctx.strokeStyle = '#d4cdc6'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(B + 36, lineY)
      ctx.lineTo(canvas.width - B - 36, lineY)
      ctx.stroke()

      // pulsing node at centre
      ctx.fillStyle = 'rgba(232,137,122,0.25)'
      ctx.beginPath()
      ctx.arc(canvas.width / 2, lineY, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#e8897a'
      ctx.beginPath()
      ctx.arc(canvas.width / 2, lineY, 6, 0, Math.PI * 2)
      ctx.fill()

      const cSize = Math.round(Math.min(W, H) * 0.028)
      ctx.fillStyle    = '#6b5f54'
      ctx.font         = `bold ${cSize}px monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign    = 'left'
      ctx.fillText('SYD', B + 4, lineY)
      ctx.textAlign = 'right'
      ctx.fillText('NYC', canvas.width - B - 4, lineY)
      break
    }

    // ── Lovers' Polaroid: two tilted polaroid prints on warm beige ──────────
    case 'lovers-polaroid': {
      // The incoming strip is one image. We treat it as-is and place it twice
      // as two "prints" — same photo, slightly different crop/scale + tilt.
      const PAD  = Math.round(Math.max(W, H) * 0.12)
      const capH = Math.round(Math.max(W, H) * 0.08)
      canvas.width  = W + PAD * 4
      canvas.height = H + PAD * 2 + capH

      ctx.fillStyle = '#FAF7F2'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // polaroid frame dimensions — each takes ~45% of canvas width
      const pW   = Math.round(canvas.width * 0.44)
      const pMat = Math.round(pW * 0.05)
      const pPad = Math.round(pW * 0.05)  // bottom white space for label
      const pImg = pW - pMat * 2          // inner photo width
      const pImgH= Math.round(pImg * (H / W)) // maintain strip aspect
      const pH   = pMat * 2 + pImgH + Math.round(pW * 0.12)

      const cx = canvas.width / 2
      const cy = (canvas.height - capH) / 2

      const drawPolaroid = (offX: number, angle: number, label: string) => {
        ctx.save()
        ctx.translate(cx + offX, cy)
        ctx.rotate(angle)

        // white polaroid card with shadow
        ctx.shadowColor   = 'rgba(0,0,0,0.20)'
        ctx.shadowBlur    = 20
        ctx.shadowOffsetY = 8
        ctx.fillStyle     = '#ffffff'
        ctx.fillRect(-pW / 2, -pH / 2, pW, pH)
        ctx.shadowColor = 'transparent'

        // photo inside polaroid
        ctx.save()
        ctx.rect(-pW / 2 + pMat, -pH / 2 + pMat, pImg, pImgH)
        ctx.clip()
        ctx.drawImage(img, -pW / 2 + pMat, -pH / 2 + pMat, pImg, pImgH)
        ctx.restore()

        // label below photo
        const lSize = Math.round(pW * 0.09)
        ctx.fillStyle    = '#8a7060'
        ctx.font         = `italic ${lSize}px cursive`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, 0, pH / 2 - Math.round(pW * 0.07))

        ctx.restore()
      }

      // left polaroid tilted left, right polaroid tilted right
      const spread = Math.round(canvas.width * 0.22)
      drawPolaroid(-spread, -0.07, 'you')
      drawPolaroid( spread,  0.06, 'me')

      // caption at bottom
      const capSize = Math.round(Math.max(W, H) * 0.038)
      ctx.fillStyle    = '#a08878'
      ctx.font         = `italic ${capSize}px cursive`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('You & Me.', canvas.width / 2, canvas.height - capH / 2)
      break
    }

    // ── Postcard: cream bg with stamp corner + wish text ────────────────────
    case 'postcard-from-afar': {
      const borderV = B
      const borderH = B
      const stampW  = Math.round(W * 0.18)
      const stampH  = Math.round(stampW * 0.8)
      const wishH   = Math.round(Math.min(W, H) * 0.07)

      canvas.width  = W + borderH * 2
      canvas.height = H + borderV * 2 + wishH

      // cream parchment bg
      ctx.fillStyle = '#FFFEF9'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // outer border
      ctx.strokeStyle = '#e0d8ce'
      ctx.lineWidth   = 1.5
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

      // dashed centre divider
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#ccc5b8'
      ctx.lineWidth   = 1.2
      ctx.beginPath()
      ctx.moveTo(canvas.width / 2, borderV)
      ctx.lineTo(canvas.width / 2, borderV + H)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.drawImage(img, borderH, borderV, W, H)

      // stamp in top-right corner
      const sx = canvas.width - borderH - stampW - 4
      const sy = borderV + 4
      ctx.strokeStyle = '#d4a0a0'
      ctx.lineWidth   = 2
      ctx.fillStyle   = '#fff5f5'
      ctx.fillRect(sx, sy, stampW, stampH)
      ctx.strokeRect(sx, sy, stampW, stampH)
      ctx.font         = `${Math.round(stampW * 0.35)}px serif`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle    = '#000'
      ctx.fillText('📮', sx + stampW / 2, sy + stampH * 0.45)
      ctx.fillStyle = '#c08080'
      ctx.font      = `${Math.round(stampW * 0.14)}px monospace`
      ctx.fillText(
        new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        sx + stampW / 2,
        sy + stampH * 0.82,
      )

      // "Wish You Were Here" in cursive
      const wSize = Math.round(Math.min(W, H) * 0.042)
      ctx.fillStyle    = '#8a7060'
      ctx.font         = `italic ${wSize}px cursive`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText('Wish You Were Here', canvas.width - borderH - 6, H + borderV + wishH / 2)
      break
    }

    // ── Default: simple warm white mat ───────────────────────────────────────
    default: {
      canvas.width  = W + B * 2
      canvas.height = H + B * 2
      ctx.fillStyle = '#FDFBF9'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, B, B, W, H)
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