'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield, CheckCircle } from 'lucide-react'

const schema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName:  z.string().min(1, 'Last name required'),
  password:  z.string().min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[a-z]/, 'Must include lowercase')
    .regex(/[0-9]/, 'Must include a number')
    .regex(/[^A-Za-z0-9]/, 'Must include a symbol'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type FormData = z.infer<typeof schema>

// Inner component — uses useSearchParams, MUST be inside <Suspense>
function RegisterForm() {
  const router      = useRouter()
  const params      = useSearchParams()
  const token       = params.get('token') || ''
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [showPwd, setShowPwd]   = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const pwd = watch('password', '')
  const checks = [
    { label: '12+ characters',   ok: pwd.length >= 12 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(pwd) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(pwd) },
    { label: 'Number',           ok: /[0-9]/.test(pwd) },
    { label: 'Symbol',           ok: /[^A-Za-z0-9]/.test(pwd) },
  ]

  const onSubmit = async (data: FormData) => {
    if (!token) return setError('Invalid invite link')
    setLoading(true); setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_token: token, password: data.password, first_name: data.firstName, last_name: data.lastName }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || 'Registration failed')
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass p-10 text-center animate-slide-up">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
        <p className="text-slate-400">Redirecting to login...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse-slow" />
      </div>
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 border border-brand-500/30 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 mt-1 text-sm">Complete your invitation to Endevo Life</p>
        </div>
        <div className="glass p-8">
          {!token && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">Invalid or missing invite link.</div>}
          {error  && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                <input {...register('firstName')} placeholder="John" className="input-field" />
                {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                <input {...register('lastName')} placeholder="Smith" className="input-field" />
                {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input {...register('password')} type={showPwd ? 'text' : 'password'} placeholder="Min 12 characters" className="input-field pr-12" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {checks.map(c => (
                  <div key={c.label} className={`flex items-center gap-1.5 text-xs transition-colors ${c.ok ? 'text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-green-400' : 'bg-slate-600'}`} />
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <input {...register('confirm')} type="password" placeholder="••••••••••••" className="input-field" />
              {errors.confirm && <p className="mt-1 text-xs text-red-400">{errors.confirm.message}</p>}
            </div>
            <button type="submit" disabled={loading || !token} className="btn-primary w-full flex items-center justify-center gap-2 ripple">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// Outer page — wraps RegisterForm in Suspense (required by Next.js 15 for useSearchParams)
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 text-center">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
