'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { signIn } from '@/lib/auth/cognito'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mfaRequired, setMfa]   = useState(false)
  const [mfaCode, setMfaCode]   = useState('')
  const [session, setSession]   = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await signIn(data.email, data.password)
      if (res.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        setSession(res.Session || '')
        setMfa(true)
      } else {
        const role = res.role
        if (role === 'GLOBAL_ADMIN') router.push('/admin/dashboard')
        else if (role === 'HR_ADMIN')   router.push('/hr/dashboard')
        else                             router.push('/employee/dashboard')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const onMfaSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode, session }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'MFA failed')
      const role = data.role
      if (role === 'GLOBAL_ADMIN') router.push('/admin/dashboard')
      else if (role === 'HR_ADMIN')  router.push('/hr/dashboard')
      else                            router.push('/employee/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'MFA verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 border border-brand-500/30 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Endevo Life</h1>
          <p className="text-slate-400 mt-1 text-sm">Digital Legacy Platform</p>
        </div>

        {/* Card */}
        <div className="glass p-8">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">
              {mfaRequired ? 'Two-Factor Authentication' : 'Sign in to your account'}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {!mfaRequired ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@company.com"
                  className="input-field"
                  autoComplete="email"
                />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="input-field pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 ripple">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Enter the 6-digit code from your authenticator app.</p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Authentication Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="input-field text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>
              <button onClick={onMfaSubmit} disabled={loading || mfaCode.length !== 6} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify Code'}
              </button>
              <button onClick={() => setMfa(false)} className="w-full text-sm text-slate-400 hover:text-white transition-colors">
                ← Back to login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Protected by AWS Cognito · TLS 1.3 · MFA Available
        </p>
      </div>
    </div>
  )
}
