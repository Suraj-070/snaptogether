'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const theme  = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)

  // Apply theme class on mount (covers SSR hydration gap)
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <button
      onClick={toggle}
      className={`theme-toggle ${className}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span key={theme} className="animate-spin-in text-base select-none">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
    </button>
  )
}