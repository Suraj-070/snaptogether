'use client'

import { useState } from 'react'
import {
  FRAMES,
  GalleryPortfolioFrame,
  CinemaReelFrame,
  VinylAlbumFrame,
  CinematicStoryboardFrame,
  ParallelLinesFrame,
  PostcardFromAfarFrame,
  SweetheartCandyFrame,
  LoveLetterFrame,
  VintageValentineFrame,
  LoversPolaroidFrame,
} from './PhotoFrames'

// ─── Placeholder photos (grey gradient tiles with numbers) ────────────────────
const PLACEHOLDER_PHOTOS = Array.from({ length: 6 }, (_, i) => {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return ''
  canvas.width = 400; canvas.height = 300
  const ctx = canvas.getContext('2d')!
  const colors = ['#d4c5b0','#c8b8a0','#bfae98','#cfc4b2','#c5b9a5','#d0c6b4']
  ctx.fillStyle = colors[i % colors.length]
  ctx.fillRect(0, 0, 400, 300)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = 'bold 64px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${i + 1}`, 200, 150)
  return canvas.toDataURL()
})

// ─── Component map ────────────────────────────────────────────────────────────
const FRAME_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'gallery-portfolio':    GalleryPortfolioFrame,
  'cinema-reel':          CinemaReelFrame,
  'vinyl-album':          VinylAlbumFrame,
  'cinematic-storyboard': CinematicStoryboardFrame,
  'parallel-lines':       ParallelLinesFrame,
  'postcard-from-afar':   PostcardFromAfarFrame,
  'sweetheart-candy':     SweetheartCandyFrame,
  'love-letter':          LoveLetterFrame,
  'vintage-valentine':    VintageValentineFrame,
  'lovers-polaroid':      LoversPolaroidFrame,
}

export default function FramePreviewPage() {
  const [active, setActive] = useState(FRAMES[0].id)
  const frame = FRAMES.find(f => f.id === active)!
  const Component = FRAME_COMPONENTS[active]

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-black/6 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-neutral-800">SnapTogether</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Frame Studio</p>
        </div>
        <span className="text-xs font-mono text-neutral-400">{FRAMES.length} frames</span>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 gap-0">
        {/* Sidebar */}
        <aside className="lg:w-56 bg-white/60 border-b lg:border-b-0 lg:border-r border-black/6 p-4 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]">
          <p className="hidden lg:block text-[10px] font-bold tracking-widest uppercase text-neutral-400 mb-2 shrink-0">Select Frame</p>
          {FRAMES.map(f => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={`shrink-0 text-left px-3 py-2 rounded-lg text-xs transition-all ${
                active === f.id
                  ? 'bg-rose-500 text-white font-semibold shadow-sm'
                  : 'text-neutral-600 hover:bg-black/5'
              }`}
            >
              {f.name}
            </button>
          ))}
        </aside>

        {/* Preview */}
        <main className="flex-1 flex flex-col items-center justify-start p-8 gap-6">
          {/* Frame title */}
          <div className="text-center">
            <h2 className="text-lg font-semibold text-neutral-800">{frame.name}</h2>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Requires {frame.minPhotos}+ photos · id: {frame.id}
            </p>
          </div>

          {/* Frame preview */}
          <div className="w-full max-w-lg bg-white/50 rounded-2xl p-4 shadow-sm border border-black/6">
            <Component
              photos={PLACEHOLDER_PHOTOS}
              partnerAName="Alex"
              partnerBName="Jordan"
              partnerACity="SYD"
              partnerBCity="NYC"
              caption="A moment worth keeping"
              sessionTag="SESSION_07"
            />
          </div>

          {/* Usage code */}
          <div className="w-full max-w-lg bg-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-mono text-neutral-500 mb-2 uppercase tracking-widest">Usage</p>
            <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">{`import { ${
              FRAME_COMPONENTS[active].displayName ||
              active.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('') + 'Frame'
            } } from '@/components/frames/PhotoFrames'

<${
  active.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('') + 'Frame'
}
  photos={capturedPhotos.map(p => p.dataUrl)}
  partnerAName={username}
  partnerBName={partnerName}
  caption="A moment worth keeping"
/>`}</pre>
          </div>
        </main>
      </div>
    </div>
  )
}