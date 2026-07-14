'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Chrome } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function SignInPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) return
    if (mode === 'signup' && !username) { toast.error('Username required'); return }
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        username,
        isSignUp: mode === 'signup' ? 'true' : 'false',
        redirect: false,
      })
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success(mode === 'signup' ? 'Account created!' : 'Welcome back!')
        router.push('/')
      }
    } catch {
      toast.error('Something went wrong')
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    await signIn('google', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0e12] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-white">SnapTogether</span>
        </div>

        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-primary text-white shadow' : 'text-white/50 hover:text-white'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {/* Google */}
            <Button
              variant="outline"
              onClick={handleGoogle}
              className="w-full rounded-xl border-white/20 text-white hover:bg-white/10 gap-2"
            >
              <Chrome className="w-4 h-4" />
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Username (signup only) */}
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={e => setUsername(e.target.value.replace(/\s/g, '').slice(0, 20))}
                      className="w-full bg-white/8 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/12 border border-white/10 focus:border-primary/50 transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-white/8 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/12 border border-white/10 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-white/8 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/12 border border-white/10 focus:border-primary/50 transition-all"
              />
              <button
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold py-3 mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </div>
        </div>

        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-sm mt-6 mx-auto transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Continue without account
        </button>
      </motion.div>
    </div>
  )
}