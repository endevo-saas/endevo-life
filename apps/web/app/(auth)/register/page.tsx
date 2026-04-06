'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Shield, CheckCircle, AlertCircle, User, Phone } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const emailParam = params.get('email') || ''

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const canSubmit = firstName.trim() && lastName.trim() && phone.trim().length >= 10 && token

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_token: token,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || body.error || 'Registration failed')
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1825' }}>
      <div className="p-10 text-center" style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px', backdropFilter: 'blur(20px)',
      }}>
        <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#22c55e' }} />
        <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Redirecting to login... You&apos;ll receive an OTP via email &amp; SMS.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0D1825' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(43,191,197,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative w-full max-w-[440px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: 'linear-gradient(135deg, #2BBFC5, #1a8f94)', boxShadow: '0 8px 32px rgba(43,191,197,0.3)' }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Complete Your Account</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {emailParam ? `Invitation for ${emailParam}` : 'Complete your Endevo Life invitation'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px', padding: '2rem', backdropFilter: 'blur(20px)',
        }}>
          {!token && (
            <div className="mb-5 p-3 rounded-xl flex items-start gap-2.5 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <span style={{ color: '#fca5a5' }}>Invalid or missing invite link.</span>
            </div>
          )}
          {error && (
            <div className="mb-5 p-3 rounded-xl flex items-start gap-2.5 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <span style={{ color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>First Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
                  <input type="text" value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name" autoFocus disabled={loading}
                    className="w-full" style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px', padding: '12px 14px 12px 42px', fontSize: '0.938rem',
                      color: '#ffffff', outline: 'none',
                    }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Last Name</label>
                <input type="text" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last name" disabled={loading}
                  className="w-full" style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '12px 14px', fontSize: '0.938rem',
                    color: '#ffffff', outline: 'none',
                  }} />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
                <input type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567" disabled={loading}
                  className="w-full" style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '12px 14px 12px 42px', fontSize: '0.938rem',
                    color: '#ffffff', outline: 'none',
                  }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Required for SMS verification codes at login
              </p>
            </div>

            {/* Info box */}
            <div className="p-3 rounded-xl" style={{ background: 'rgba(43,191,197,0.06)', border: '1px solid rgba(43,191,197,0.12)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                No password needed — you&apos;ll login with a secure OTP code sent to your email and phone.
              </p>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading || !canSubmit}
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-40 transition-all"
              style={{
                background: loading ? 'linear-gradient(135deg, #1a8f94, #178589)' : 'linear-gradient(135deg, #2BBFC5, #1a8f94)',
                color: '#ffffff', borderRadius: '12px', padding: '13px 20px', border: 'none',
                cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
                boxShadow: canSubmit ? '0 4px 16px rgba(43,191,197,0.25)' : 'none',
              }}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Protected by WorkOS &middot; TLS 1.3 &middot; Email + SMS OTP
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1825' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2BBFC5' }} />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
