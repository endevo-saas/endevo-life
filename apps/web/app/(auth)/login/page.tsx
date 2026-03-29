'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Shield, RefreshCw, Mail, KeyRound, Sparkles, Lock } from 'lucide-react'
import Link from 'next/link'
import Cookies from 'js-cookie'
import { signIn } from '@/lib/auth/cognito'
import { api } from '@/lib/api'
import { useTheme } from '@/components/ThemePicker'

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

// Animated orbs background
function Orbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="blur-orb w-[600px] h-[600px] -top-40 -left-40 animate-pulse-slow"
        style={{ background: 'var(--accent-1)', opacity: 0.12 }} />
      <div className="blur-orb w-[500px] h-[500px] -bottom-40 -right-40 animate-pulse-slow"
        style={{ background: 'var(--accent-2)', opacity: 0.10, animationDelay: '2s' }} />
      <div className="blur-orb w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'var(--accent-1)', opacity: 0.06 }} />
      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <div key={i}
          className="absolute w-1.5 h-1.5 rounded-full animate-float"
          style={{
            background: `var(--accent-${i % 2 === 0 ? '1' : '2'})`,
            left: `${10 + i * 11}%`,
            top: `${15 + (i % 4) * 20}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${5 + i}s`,
            opacity: 0.4,
          }}
        />
      ))}
    </div>
  )
}

// Step indicator
function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
      done   ? 'scale-100' :
      active ? 'scale-125 shadow-lg' : 'scale-75 opacity-30'
    }`}
      style={{
        background: done || active ? 'var(--gradient-brand)' : 'var(--bg-elevated)',
        boxShadow: active ? '0 0 12px var(--accent-glow)' : 'none',
      }}
    />
  )
}

export default function LoginPage() {
  useTheme() // apply saved theme
  const router = useRouter()
  const [step, setStep]           = useState<Step>('credentials')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [otpRef, setOtpRef]       = useState('')
  const [otpEmail, setOtpEmail]   = useState('')
  const [otpCode, setOtpCode]     = useState('')
  const [mfaCode, setMfaCode]     = useState('')
  const [session, setSession]     = useState('')
  const [captcha, setCaptcha]     = useState({ question: '', answer: 0 })
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaErr, setCaptchaErr]     = useState(false)
  const [mounted, setMounted]     = useState(false)
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  useEffect(() => { setCaptcha(generateCaptcha()); setMounted(true) }, [])
  const refreshCaptcha = () => { setCaptcha(generateCaptcha()); setCaptchaInput(''); setCaptchaErr(false) }

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  // OTP digit input handling
  function handleOtpDigit(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = otpCode.split('')
    next[i] = digit
    setOtpCode(next.join(''))
    if (digit && i < 5) otpRefs[i + 1].current?.focus()
    if (!digit && i > 0) otpRefs[i - 1].current?.focus()
  }

  const onSubmit = async (data: FormData) => {
    setCaptchaErr(false)
    if (parseInt(captchaInput) !== captcha.answer) {
      setCaptchaErr(true); refreshCaptcha(); return
    }
    setLoading(true); setError('')
    try {
      const res = await signIn(data.email, data.password) as Record<string, unknown>
      if (res.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        setSession(res.Session as string || ''); setStep('mfa')
      } else if (res.otp_required) {
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
    if (otpCode.length !== 6) { setError('Enter all 6 digits'); return }
    setLoading(true); setError('')
    try {
      const res = await api.verifyOtp(otpEmail, otpRef, otpCode) as Record<string, string>
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
      otpRefs[0].current?.focus()
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

  if (!mounted) return null

  return (
    <div className="bg-hero min-h-screen flex items-center justify-center p-4">
      <Orbs />

      <div className={`relative w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ animation: 'fadeUp 0.7s ease-out both' }}>

        {/* Logo + brand */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-5">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-3xl animate-pulse-slow"
              style={{ background: 'var(--gradient-brand)', opacity: 0.3, filter: 'blur(12px)' }} />
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--gradient-brand)', boxShadow: '0 0 40px var(--accent-glow), 0 0 80px var(--accent-glow-2)' }}>
              <Shield className="w-10 h-10 text-white drop-shadow-lg" />
            </div>
            {/* Orbit dot */}
            <div className="absolute w-3 h-3 rounded-full animate-orbit"
              style={{ background: 'var(--gold)', boxShadow: '0 0 8px var(--gold-glow)', top: '50%', left: '50%', marginTop: '-6px', marginLeft: '-6px' }} />
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white mb-1">
            Endevo <span className="text-gradient">Life</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Digital Legacy & Estate Planning Platform
          </p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <StepDot active={step === 'credentials'} done={step === 'otp' || step === 'mfa'} />
            <div className="w-6 h-px" style={{ background: 'var(--border-subtle)' }} />
            <StepDot active={step === 'otp' || step === 'mfa'} done={false} />
          </div>
        </div>

        {/* Card */}
        <div className="glass-elevated" style={{ padding: '2rem' }}>

          {/* Step label */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--gradient-card)', border: '1px solid var(--border)' }}>
              {step === 'otp' ? <Mail className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
               : step === 'mfa' ? <KeyRound className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
               : <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />}
            </div>
            <h2 className="text-lg font-black text-white">
              {step === 'otp' ? 'Email Verification'
               : step === 'mfa' ? 'Authenticator Code'
               : 'Sign in'}
            </h2>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-fade-in"
              style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>
              <Lock className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── CREDENTIALS ── */}
          {step === 'credentials' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Email Address
                </label>
                <input {...register('email')} type="email" placeholder="you@company.com"
                  className="input-field" autoComplete="email" />
                {errors.email && <p className="mt-1.5 text-xs" style={{ color: '#fb7185' }}>{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <input {...register('password')} type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••••••" className="input-field pr-12" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs" style={{ color: '#fb7185' }}>{errors.password.message}</p>}
              </div>

              {/* CAPTCHA */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Security Check
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-3">
                    <div className="px-4 py-2.5 font-black text-lg select-none rounded-xl font-mono"
                      style={{ background: 'var(--gradient-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      {captcha.question} = ?
                    </div>
                    <input type="number" value={captchaInput}
                      onChange={e => { setCaptchaInput(e.target.value); setCaptchaErr(false) }}
                      placeholder="?"
                      className={`input-field w-20 text-center font-black text-lg ${captchaErr ? 'border-rose-500' : ''}`}
                    />
                  </div>
                  <button type="button" onClick={refreshCaptcha}
                    className="p-2.5 rounded-xl transition-all hover:scale-110"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {captchaErr && <p className="mt-1.5 text-xs" style={{ color: '#fb7185' }}>Incorrect — try again</p>}
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--accent-1)' }}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 ripple">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Sending verification code...</>
                  : <><Sparkles className="w-4 h-4" />Sign In</>
                }
              </button>
            </form>
          )}

          {/* ── OTP ── */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl flex items-start gap-3"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)' }}>
                <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-1)' }} />
                <div>
                  <p className="text-sm font-semibold text-white">Check your inbox</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    6-digit code sent to <strong style={{ color: 'var(--accent-2)' }}>{otpEmail}</strong>
                  </p>
                </div>
              </div>

              {/* 6 individual digit boxes */}
              <div>
                <label className="block text-sm font-semibold mb-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                  Enter verification code
                </label>
                <div className="flex justify-center gap-2">
                  {[0,1,2,3,4,5].map(i => (
                    <input
                      key={i}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otpCode[i] || ''}
                      onChange={e => handleOtpDigit(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Backspace' && !otpCode[i] && i > 0) otpRefs[i-1].current?.focus() }}
                      className="w-12 h-14 text-center text-xl font-black rounded-xl transition-all"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: `2px solid ${otpCode[i] ? 'var(--accent-1)' : 'var(--border-subtle)'}`,
                        color: 'var(--text-primary)',
                        outline: 'none',
                        boxShadow: otpCode[i] ? '0 0 12px var(--accent-glow)' : 'none',
                      }}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>Expires in 10 minutes</p>
              </div>

              <button onClick={onOtpSubmit} disabled={loading || otpCode.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : '✓ Verify & Sign In'}
              </button>

              <button onClick={() => { setStep('credentials'); setOtpCode(''); setError(''); refreshCaptcha() }}
                className="w-full text-sm font-medium transition-colors" style={{ color: 'var(--text-muted)' }}>
                ← Back to login
              </button>
            </div>
          )}

          {/* ── MFA ── */}
          {step === 'mfa' && (
            <div className="space-y-5">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <input type="text" maxLength={6} value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="input-field text-center text-3xl tracking-[0.6em] font-black"
                autoFocus />
              <button onClick={onMfaSubmit} disabled={loading || mfaCode.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : 'Verify Code'}
              </button>
              <button onClick={() => setStep('credentials')}
                className="w-full text-sm font-medium transition-colors" style={{ color: 'var(--text-muted)' }}>
                ← Back
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Protected by AWS Cognito · TLS 1.3 · Email OTP · Math CAPTCHA
        </p>
      </div>
    </div>
  )
}
