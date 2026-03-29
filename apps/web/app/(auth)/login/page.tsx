'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield, Sparkles, RefreshCw, Mail, KeyRound } from 'lucide-react'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { signIn } from '@/lib/auth/cognito'
import { api } from '@/lib/api'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1
  const b = Math.floor(Math.random() * 9) + 1
  const ops = ['+', '-', '×'] as const
  const op  = ops[Math.floor(Math.random() * ops.length)]
  const answer = op === '+' ? a + b : op === '-' ? Math.abs(a - b) : a * b
  const q = op === '-' ? `${Math.max(a,b)} ${op} ${Math.min(a,b)}` : `${a} ${op} ${b}`
  return { question: q, answer }
}

type Step = 'credentials' | 'otp' | 'mfa'

function routeByRole(role: string, router: ReturnType<typeof useRouter>) {
  if (role === 'GLOBAL_ADMIN') router.push('/admin/dashboard')
  else if (role === 'HR_ADMIN') router.push('/hr/dashboard')
  else router.push('/employee/dashboard')
}

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>('credentials')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  // OTP step
  const [otpRef, setOtpRef]       = useState('')
  const [otpEmail, setOtpEmail]   = useState('')
  const [otpCode, setOtpCode]     = useState('')
  // MFA (TOTP authenticator) step
  const [mfaCode, setMfaCode]     = useState('')
  const [session, setSession]     = useState('')
  // CAPTCHA
  const [captcha, setCaptcha]     = useState({ question: '', answer: 0 })
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaErr, setCaptchaErr]     = useState(false)

  useEffect(() => { setCaptcha(generateCaptcha()) }, [])
  const refreshCaptcha = () => { setCaptcha(generateCaptcha()); setCaptchaInput('') }

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setCaptchaErr(false)
    if (parseInt(captchaInput) !== captcha.answer) {
      setCaptchaErr(true); setCaptcha(generateCaptcha()); setCaptchaInput(''); return
    }
    setLoading(true); setError('')
    try {
      const res = await signIn(data.email, data.password) as Record<string, unknown>
      if (res.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        setSession(res.Session as string || ''); setStep('mfa')
      } else if (res.otp_required) {
        // Backend sent OTP to email — show OTP entry step
        setOtpRef(res.otp_ref as string)
        setOtpEmail(data.email)
        setStep('otp')
      } else {
        routeByRole(res.role as string, router)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
      refreshCaptcha()
    } finally { setLoading(false) }
  }

  const onOtpSubmit = async () => {
    if (otpCode.length !== 6) { setError('Enter the 6-digit code from your email'); return }
    setLoading(true); setError('')
    try {
      const res = await api.verifyOtp(otpEmail, otpRef, otpCode) as Record<string, string>
      // Set auth cookies — same as signIn() in cognito.ts
      if (res.access_token) {
        Cookies.set('access_token', res.access_token, { expires: 1, sameSite: 'strict' })
        Cookies.set('id_token',     res.id_token,     { expires: 1, sameSite: 'strict' })
        Cookies.set('user_role',    res.role,          { expires: 1, sameSite: 'strict' })
        Cookies.set('user_email',   res.email || '',   { expires: 1, sameSite: 'strict' })
      }
      routeByRole(res.role, router)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed')
      setOtpCode('')
    } finally { setLoading(false) }
  }

  const onMfaSubmit = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/mfa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode, session })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'MFA failed')
      routeByRole(data.role, router)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'MFA verification failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/20 border border-brand-500/30 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Endevo Life</h1>
          <p className="text-slate-400 mt-1 text-sm">Digital Legacy Platform</p>
        </div>

        <div className="glass p-8">
          <div className="flex items-center gap-2 mb-6">
            {step === 'otp' ? <Mail className="w-4 h-4 text-brand-400" /> : step === 'mfa' ? <KeyRound className="w-4 h-4 text-brand-400" /> : <Sparkles className="w-4 h-4 text-brand-400" />}
            <h2 className="text-lg font-semibold text-white">
              {step === 'otp' ? 'Email Verification' : step === 'mfa' ? 'Authenticator Verification' : 'Sign in to your account'}
            </h2>
          </div>

          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

          {/* ── Step 1: Email + Password + CAPTCHA ── */}
          {step === 'credentials' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input {...register('email')} type="email" placeholder="you@company.com" className="input-field" autoComplete="email" />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input {...register('password')} type={showPwd ? 'text' : 'password'} placeholder="••••••••••••" className="input-field pr-12" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
              </div>

              {/* Math CAPTCHA */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Security Check</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-base font-bold tracking-wider select-none">
                      {captcha.question} = ?
                    </div>
                    <input
                      type="number"
                      value={captchaInput}
                      onChange={e => { setCaptchaInput(e.target.value); setCaptchaErr(false) }}
                      placeholder="Answer"
                      className={`input-field w-24 text-center font-mono ${captchaErr ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  <button type="button" onClick={refreshCaptcha} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="New question">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {captchaErr && <p className="mt-1 text-xs text-red-400">Incorrect answer — try again</p>}
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">Forgot password?</Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 ripple">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending verification code...</> : 'Sign In →'}
              </button>
            </form>
          )}

          {/* ── Step 2: Email OTP ── */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-start gap-3">
                <Mail className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium">Verification code sent</p>
                  <p className="text-xs text-slate-400 mt-0.5">We emailed a 6-digit code to <strong className="text-brand-300">{otpEmail}</strong>. Check your inbox and enter the code below.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">6-Digit Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="000000"
                  className="input-field text-center text-3xl tracking-[0.5em] font-mono"
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500">Code expires in 10 minutes</p>
              </div>

              <button
                onClick={onOtpSubmit}
                disabled={loading || otpCode.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : 'Verify & Sign In'}
              </button>

              <button
                onClick={() => { setStep('credentials'); setOtpCode(''); setError(''); refreshCaptcha() }}
                className="w-full text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Back to login (re-enter password to resend code)
              </button>
            </div>
          )}

          {/* ── Step 3: TOTP MFA (authenticator app) ── */}
          {step === 'mfa' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Enter the 6-digit code from your authenticator app.</p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Authentication Code</label>
                <input type="text" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="input-field text-center text-2xl tracking-widest font-mono" autoFocus />
              </div>
              <button onClick={onMfaSubmit} disabled={loading || mfaCode.length !== 6} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : 'Verify Code'}
              </button>
              <button onClick={() => setStep('credentials')} className="w-full text-sm text-slate-400 hover:text-white transition-colors">← Back to login</button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">Protected by AWS Cognito · TLS 1.3 · Email OTP · Math CAPTCHA</p>
      </div>
    </div>
  )
}
