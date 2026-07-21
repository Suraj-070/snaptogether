'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Camera, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

type Mode = 'signin' | 'signup'

export default function AuthView() {
  const setView    = useAppStore(s => s.setView)
  const setUsername = useAppStore(s => s.setUsername)
  const setUserId  = useAppStore(s => s.setUserId)

  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email required'
    if (password.length < 6) e.password = 'Min 6 characters'
    if (mode === 'signup' && name.trim().length < 2) e.name = 'Name too short'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    setErrors({})
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
        username: name.trim(),
        isSignUp: mode === 'signup' ? 'true' : 'false',
      })
      if (res?.error) {
        setErrors({ form: res.error })
      } else {
        toast.success(mode === 'signup' ? 'Account created! Welcome 🎉' : 'Welcome back! 👋')
        setView('landing')
      }
    } catch {
      setErrors({ form: 'Something went wrong. Try again.' })
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setGLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  function switchMode(m: Mode) {
    setMode(m)
    setErrors({})
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -left-16 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute -bottom-20 -right-16 w-[320px] h-[320px] rounded-full bg-violet-500/6 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center px-5 h-14 border-b border-border">
        <button
          onClick={() => setView('landing')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">SnapTogether</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[360px]">

          {/* Title */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'signin'
                ? 'Sign in to save your memories'
                : 'Join to capture moments together'}
            </p>
          </div>

          {/* Card */}
          <div className="glass-strong rounded-3xl p-5 shadow-2xl shadow-foreground/10">

            {/* Tab toggle */}
            <div className="flex bg-foreground/[0.05] rounded-2xl p-1 mb-5 gap-1">
              {(['signin', 'signup'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                    mode === m ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
                  }`}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="auth-tab"
                      className="absolute inset-0 bg-foreground/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">
                    {m === 'signin' ? 'Sign in' : 'Sign up'}
                  </span>
                </button>
              ))}
            </div>

            {/* Google button */}
            <button
              onClick={handleGoogle}
              disabled={gLoading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-card hover:bg-card/80 transition-all active:scale-[0.98] mb-4 disabled:opacity-60"
            >
              {gLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span className="text-sm font-medium text-foreground">
                Continue with Google
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground font-medium">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Form */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {/* Name field — signup only */}
                {mode === 'signup' && (
                  <div>
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border bg-foreground/[0.04] transition-all ${
                      errors.name ? 'border-destructive' : 'border-border focus-within:border-primary/50 focus-within:bg-foreground/[0.06]'
                    }`}>
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={20}
                        autoComplete="name"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
                      />
                    </div>
                    {errors.name && <p className="text-[11px] text-destructive mt-1 pl-1">{errors.name}</p>}
                  </div>
                )}

                {/* Email */}
                <div>
                  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border bg-foreground/[0.04] transition-all ${
                    errors.email ? 'border-destructive' : 'border-border focus-within:border-primary/50 focus-within:bg-foreground/[0.06]'
                  }`}>
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                  </div>
                  {errors.email && <p className="text-[11px] text-destructive mt-1 pl-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border bg-foreground/[0.04] transition-all ${
                    errors.password ? 'border-destructive' : 'border-border focus-within:border-primary/50 focus-within:bg-foreground/[0.06]'
                  }`}>
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Create password (6+ chars)' : 'Password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[11px] text-destructive mt-1 pl-1">{errors.password}</p>}
                </div>

                {/* Form-level error */}
                {errors.form && (
                  <div className="px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
                    <p className="text-[12px] text-destructive">{errors.form}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 mt-1"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    mode === 'signin' ? 'Sign in' : 'Create account'
                  )}
                </button>

                {/* Switch mode hint */}
                <p className="text-center text-[12px] text-muted-foreground pt-1">
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                    className="text-primary font-semibold hover:underline"
                  >
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Guest note */}
          <p className="text-center text-[11px] text-muted-foreground mt-5">
            Just want to take photos?{' '}
            <button
              onClick={() => setView('landing')}
              className="text-foreground/70 hover:text-foreground font-medium transition-colors"
            >
              Continue as guest →
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}