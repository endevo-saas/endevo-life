'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Shield, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const emailSchema = z.object({ email: z.string().email('Enter a valid email') })
const resetSchema = z.object({
  code:     z.string().length(6, 'Code must be 6 digits'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
})

export default function ForgotPasswordPage() {
  const router  = useRouter()
  const [step, setStep]       = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const API = process.env.NEXT_PUBLIC_API_URL || ''

  const emailForm = useForm({ resolver: zodResolver(emailSchema) })
  const resetForm = useForm({ resolver: zodResolver(resetSchema) })

  const sendCode = async (data: { email: string }) => {
    setLoading(true); setError('')
    try {
      await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email.toLowerCase() }),
      })
      setEmail(data.email.toLowerCase())
      setStep('reset')
    } catch { setError('Failed to send reset code') }
    finally { setLoading(false) }
  }

  const doReset = async (data: { code: string; password: string }) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: data.code, new_password: data.password }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || 'Reset failed')
      setStep('done')
      setTimeout(() => router.push('/login'), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 border border-brand-500/30 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === 'done' ? 'Password Reset!' : 'Reset Password'}
          </h1>
        </div>
        <div className="glass p-8">
          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

          {step === 'email' && (
            <form onSubmit={emailForm.handleSubmit(sendCode)} className="space-y-4">
              <p className="text-sm text-slate-400">Enter your email and we will send a reset code.</p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input {...emailForm.register('email')} type="email" placeholder="you@company.com" className="input-field" />
                {emailForm.formState.errors.email && <p className="mt-1 text-xs text-red-400">{emailForm.formState.errors.email.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Send Reset Code'}
              </button>
              <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mt-2">
                <ArrowLeft className="w-3 h-3" /> Back to login
              </Link>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={resetForm.handleSubmit(doReset)} className="space-y-4">
              <p className="text-sm text-slate-400">Enter the 6-digit code sent to <span className="text-brand-400">{email}</span></p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Reset Code</label>
                <input {...resetForm.register('code')} maxLength={6} placeholder="000000" className="input-field text-center text-xl tracking-widest font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                <input {...resetForm.register('password')} type="password" placeholder="Min 12 characters" className="input-field" />
                {resetForm.formState.errors.password && <p className="mt-1 text-xs text-red-400">{resetForm.formState.errors.password.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-slate-300">Password updated. Redirecting to login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
