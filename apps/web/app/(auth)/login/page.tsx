'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Shield, Mail, ArrowRight, AlertCircle, Clock } from 'lucide-react'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type Step = 'email' | 'otp'

interface SendOtpResponse {
  otp_ref: string
  email: string
  phone: string
  channels: string[]
  expires_in: number
}

interface VerifyResponse {
  access_token: string
  id_token?: string
  role: string
  email?: string
  tenant_name?: string
  first_name?: string
  last_name?: string
}

function routeByRole(role: string, router: ReturnType<typeof useRouter>) {
  if (role === 'GLOBAL_ADMIN') router.push('/admin/dashboard')
  else if (role === 'HR_ADMIN') router.push('/hr/dashboard')
  else router.push('/employee/dashboard')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// --- OTP Input Component ---
interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, '').split('').slice(0, 6)

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus()
  }

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    onChange(next.join('').replace(/ /g, ''))
    if (digit && index < 5) {
      focusInput(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const next = [...digits]
        next[index - 1] = ''
        onChange(next.join('').replace(/ /g, ''))
        focusInput(index - 1)
      } else {
        const next = [...digits]
        next[index] = ''
        onChange(next.join('').replace(/ /g, ''))
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) focusInput(index - 1)
    if (e.key === 'ArrowRight' && index < 5) focusInput(index + 1)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      onChange(pasted)
      focusInput(Math.min(pasted.length, 5))
    }
  }

  return (
    <div className="flex justify-center gap-3" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]?.trim() || ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          className="otp-box"
          style={{
            width: '52px',
            height: '60px',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '0',
            borderRadius: '12px',
            border: `2px solid ${digits[i]?.trim() ? '#2BBFC5' : 'rgba(255,255,255,0.1)'}`,
            background: 'rgba(255,255,255,0.04)',
            color: '#ffffff',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: digits[i]?.trim() ? '0 0 16px rgba(43,191,197,0.25)' : 'none',
            caretColor: '#2BBFC5',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#2BBFC5'
            e.target.style.boxShadow = '0 0 16px rgba(43,191,197,0.25)'
          }}
          onBlur={(e) => {
            if (!digits[i]?.trim()) {
              e.target.style.borderColor = 'rgba(255,255,255,0.1)'
              e.target.style.boxShadow = 'none'
            }
          }}
        />
      ))}
    </div>
  )
}

// --- Main Login Page ---
export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpRef, setOtpRef] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [expiryCountdown, setExpiryCountdown] = useState(0)
  const [mounted, setMounted] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // 5-minute expiry countdown timer
  useEffect(() => {
    if (expiryCountdown <= 0) return
    const timer = setTimeout(() => setExpiryCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [expiryCountdown])

  const sendOtp = useCallback(async () => {
    if (!isValidEmail(email)) {
      setError('Please enter a valid work email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.detail || data.message || 'Failed to send verification code')
      }
      const otpData = data as SendOtpResponse
      setOtpRef(otpData.otp_ref)
      setMaskedEmail(otpData.email)
      setMaskedPhone(otpData.phone)
      setExpiryCountdown(otpData.expires_in || 300)
      setStep('otp')
      setResendCooldown(60)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }, [email])

  const verifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }
    if (expiryCountdown <= 0) {
      setError('Code has expired. Please request a new one.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_ref: otpRef, code: otpCode }),
      })
      const data: VerifyResponse = await res.json()
      if (!res.ok) {
        const errData = data as unknown as { error?: string; message?: string }
        throw new Error(errData.error || errData.message || 'Verification failed')
      }
      // Store auth tokens
      if (data.access_token) {
        Cookies.set('access_token', data.access_token, { expires: 1, sameSite: 'strict' })
        if (data.id_token) Cookies.set('id_token', data.id_token, { expires: 1, sameSite: 'strict' })
        Cookies.set('user_role', data.role, { expires: 1, sameSite: 'strict' })
        if (data.email) Cookies.set('user_email', data.email, { expires: 1, sameSite: 'strict' })
        if (data.tenant_name) Cookies.set('tenant_name', data.tenant_name, { expires: 1, sameSite: 'strict' })
        if (data.first_name) Cookies.set('first_name', data.first_name, { expires: 1, sameSite: 'strict' })
        if (data.last_name) Cookies.set('last_name', data.last_name, { expires: 1, sameSite: 'strict' })
      }
      routeByRole(data.role, router)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed')
      setOtpCode('')
    } finally {
      setLoading(false)
    }
  }, [email, otpCode, otpRef, expiryCountdown, router])

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return
    setOtpCode('')
    setError('')
    await sendOtp()
  }, [resendCooldown, sendOtp])

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendOtp()
  }

  const handleBack = () => {
    setStep('email')
    setOtpCode('')
    setError('')
    setExpiryCountdown(0)
    setOtpRef('')
  }

  if (!mounted) return null

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0D1825' }}
    >
      {/* Subtle background gradient accents */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(43,191,197,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(232,97,42,0.05) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div
        className="relative w-full max-w-[420px] transition-all duration-700"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{
              background: 'linear-gradient(135deg, #2BBFC5, #1a8f94)',
              boxShadow: '0 8px 32px rgba(43,191,197,0.3)',
            }}
          >
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
            Legacy Readiness OS
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.6)' }}
            />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Secure Login
            </span>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
            padding: '2rem',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Error message */}
          {error && (
            <div
              className="mb-5 p-3 rounded-xl flex items-start gap-2.5 text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <span style={{ color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          {/* --- STEP 1: Email --- */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  />
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    placeholder="Enter your work email"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    className="w-full"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '12px 14px 12px 42px',
                      fontSize: '0.938rem',
                      color: '#ffffff',
                      outline: 'none',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(43,191,197,0.5)'
                      e.target.style.boxShadow = '0 0 0 3px rgba(43,191,197,0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all"
                style={{
                  background: loading
                    ? 'linear-gradient(135deg, #1a8f94, #178589)'
                    : 'linear-gradient(135deg, #2BBFC5, #1a8f94)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '13px 20px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(43,191,197,0.25)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    Send Code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* --- STEP 2: OTP Verification --- */}
          {step === 'otp' && (
            <div className="space-y-6">
              {/* Info banner — masked email + phone */}
              <div
                className="p-4 rounded-xl flex items-start gap-3"
                style={{
                  background: 'rgba(43,191,197,0.06)',
                  border: '1px solid rgba(43,191,197,0.12)',
                }}
              >
                <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#2BBFC5' }} />
                <div>
                  <p className="text-sm font-medium text-white">Check your inbox &amp; phone</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Code sent to{' '}
                    <span style={{ color: '#2BBFC5' }}>{maskedEmail}</span>
                    {maskedPhone && (
                      <>
                        {' '}and{' '}
                        <span style={{ color: '#2BBFC5' }}>{maskedPhone}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Countdown timer */}
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" style={{ color: expiryCountdown <= 60 ? '#ef4444' : '#2BBFC5' }} />
                <span
                  className="text-sm font-medium"
                  style={{ color: expiryCountdown <= 60 ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}
                >
                  {expiryCountdown > 0
                    ? `Code expires in ${formatTime(expiryCountdown)}`
                    : 'Code expired — please request a new one'}
                </span>
              </div>

              {/* OTP Input */}
              <div>
                <p
                  className="text-sm font-medium text-center mb-4"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Enter verification code
                </p>
                <OtpInput
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={loading || expiryCountdown <= 0}
                />
              </div>

              {/* Verify button */}
              <button
                type="button"
                onClick={verifyOtp}
                disabled={loading || otpCode.length !== 6 || expiryCountdown <= 0}
                className="w-full flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all"
                style={{
                  background: loading
                    ? 'linear-gradient(135deg, #1a8f94, #178589)'
                    : 'linear-gradient(135deg, #2BBFC5, #1a8f94)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '13px 20px',
                  border: 'none',
                  cursor: loading || otpCode.length !== 6 || expiryCountdown <= 0 ? 'not-allowed' : 'pointer',
                  boxShadow: otpCode.length === 6 && expiryCountdown > 0 ? '0 4px 16px rgba(43,191,197,0.25)' : 'none',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </button>

              {/* Resend + Back */}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  className="font-medium transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  &larr; Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="font-medium transition-colors disabled:opacity-40"
                  style={{ color: '#2BBFC5', background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend code'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-1.5">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Protected by{' '}
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              WorkOS
            </span>
            {' '}&middot; TLS 1.3 &middot; Email + SMS OTP
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            &copy; 2026{' '}
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Endevo.life
            </span>
            {' '}&middot; US Data Residency &middot; SOC 2 Compliant
          </p>
        </div>
      </div>
    </div>
  )
}
