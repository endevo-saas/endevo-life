'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield, CheckCircle, Building2, User, Mail, Lock } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

const schema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName:  z.string().min(1, 'Last name required'),
  email:     z.string().email('Enter a valid email'),
  company:   z.string().optional(),
  password:  z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[a-z]/, 'Must include lowercase')
    .regex(/[0-9]/, 'Must include a number')
    .regex(/[^A-Za-z0-9]/, 'Must include a symbol'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

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
  const strength = checks.filter(c => c.ok).length

  const onSubmit = async (data: FormData) => {
    setLoading(true); setError('')
    try {
      await api.signup({
        email:      data.email,
        password:   data.password,
        first_name: data.firstName,
        last_name:  data.lastName,
        company:    data.company || '',
      })
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Signup failed')
    } finally { setLoading(false) }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass p-10 text-center animate-slide-up max-w-sm">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Endevo Life!</h2>
        <p className="text-slate-400 text-sm">Your account has been created. Redirecting to login...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 border border-brand-500/30 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-black text-white">Get Started Free</h1>
          <p className="text-slate-400 mt-1 text-sm">Create your Endevo Life account</p>
        </div>

        <div className="glass p-8">
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input {...register('firstName')} placeholder="John" className="input-field pl-9" />
                </div>
                {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                <input {...register('lastName')} placeholder="Smith" className="input-field" />
                {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input {...register('email')} type="email" placeholder="you@company.com" className="input-field pl-9" />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Company (optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Company <span className="text-slate-500 font-normal">(optional)</span></label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input {...register('company')} placeholder="Your company name" className="input-field pl-9" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input {...register('password')} type={showPwd ? 'text' : 'password'} placeholder="Min 12 characters" className="input-field pl-9 pr-12" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              <div className="mt-2 flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= strength
                      ? strength <= 1 ? 'bg-red-500' : strength <= 2 ? 'bg-orange-500' : strength <= 3 ? 'bg-yellow-500' : strength <= 4 ? 'bg-blue-500' : 'bg-green-500'
                      : 'bg-white/10'
                  }`} />
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {checks.map(c => (
                  <div key={c.label} className={`flex items-center gap-1.5 text-xs transition-colors ${c.ok ? 'text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-green-400' : 'bg-slate-600'}`} />
                    {c.label}
                  </div>
                ))}
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <input {...register('confirm')} type="password" placeholder="••••••••••••" className="input-field" />
              {errors.confirm && <p className="mt-1 text-xs text-red-400">{errors.confirm.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 ripple mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create Free Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
          </p>
          <p className="mt-2 text-center text-xs text-slate-600">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
