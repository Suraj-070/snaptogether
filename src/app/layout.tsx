import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import SessionProviderWrapper from '@/components/session-provider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SnapTogether — Capture Moments Together, Anywhere',
  description: 'A real-time photobooth for two. Create a room, invite your person, capture synchronized photo strips.',
  keywords: ['photobooth', 'memories', 'photos', 'couples', 'friends', 'filters', 'photo strip'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,       // prevent iOS zoom on input focus
  userScalable: false,
  themeColor: '#09090f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {/* Apply saved theme before first paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('snap_theme');if(t==='light')document.documentElement.classList.add('light')}catch(e){}})()` }} />
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              background: '#1c1c25',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f2f2f5',
            },
          }}
        />
      </body>
    </html>
  )
}