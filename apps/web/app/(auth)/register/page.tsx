'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Shield, CheckCircle, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

function ActivateAccount() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const emailParam = params.get('email') || ''

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Invalid or missing invite link.')
      return
    }

    // Auto-activate on page load
    const activate = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || data.error || 'Activation failed')
        setUserName(data.first_name || '')
        setStatus('success')
        // Redirect to login after 3 seconds
        setTimeout(() => router.push('/login'), 3000)
      } catch (e: unknown) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Activation failed')
      }
    }

    activate()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0D1825' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(43,191,197,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative w-full max-w-[420px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: 'linear-gradient(135deg, #2BBFC5, #1a8f94)', boxShadow: '0 8px 32px rgba(43,191,197,0.3)' }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {status === 'success' ? 'Account Activated!' : 'Activating Account'}
          </h1>
          {emailParam && (
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{emailParam}</p>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px', padding: '2.5rem', backdropFilter: 'blur(20px)',
          textAlign: 'center',
        }}>
          {status === 'loading' && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: '#2BBFC5' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Setting up your account...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="w-16 h-16 mx-auto" style={{ color: '#22c55e' }} />
              <div>
                <p className="text-lg font-semibold text-white">
                  Welcome{userName ? `, ${userName}` : ''}!
                </p>
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your account is ready. Redirecting to login...
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(43,191,197,0.06)', border: '1px solid rgba(43,191,197,0.12)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  You&apos;ll login with a secure OTP code sent to your email and phone. No password needed.
                </p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="w-full flex items-center justify-center gap-2 font-semibold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #2BBFC5, #1a8f94)',
                  color: '#ffffff', borderRadius: '12px', padding: '13px 20px', border: 'none',
                  cursor: 'pointer', boxShadow: '0 4px 16px rgba(43,191,197,0.25)',
                }}>
                Go to Login
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <AlertCircle className="w-16 h-16 mx-auto" style={{ color: '#ef4444' }} />
              <div>
                <p className="text-lg font-semibold text-white">Activation Failed</p>
                <p className="text-sm mt-2" style={{ color: '#fca5a5' }}>{error}</p>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Contact your HR administrator or email support@endevo.life
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Protected by Amazon Cognito &middot; TLS 1.3 &middot; Email OTP
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
      <ActivateAccount />
    </Suspense>
  )
}
