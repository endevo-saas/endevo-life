'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  CreditCard, Loader2, RefreshCw, AlertCircle, CheckCircle, Crown,
  Calendar, Star, Sparkles, ArrowRight, Lock, Video
} from 'lucide-react'
import { api } from '@/lib/api'
import Cookies from 'js-cookie'

// ── Plan Constants ──────────────────────────────────────────────────────────

const BASIC_FEATURES = [
  '6-module LMS access',
  '40-question readiness assessment',
  'Progress tracking',
  'Completion certificates',
  'Email support',
]

const PREMIUM_FEATURES = [
  '1-on-1 live sessions with estate planning expert',
  'Priority support (24-hour response)',
  'Advanced analytics dashboard',
  'Custom company branding',
  'Dedicated account manager',
  'API access',
]

const BOOKING_URL = 'https://link.endevo.life/widget/booking/HUYkq6QZs0fI7AMtt6qH'

// ── Types ───────────────────────────────────────────────────────────────────

interface MeResponse {
  plan?: string
  tenant_plan?: string
  subscription?: {
    plan: string
    billing_cycle?: string
    next_billing_date?: string
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectPlan(): string {
  const cookiePlan = Cookies.get('tenant_plan') || Cookies.get('user_plan')
  if (cookiePlan) return cookiePlan.toLowerCase()
  return 'basic'
}

function mockNextBillingDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── Components ──────────────────────────────────────────────────────────────

function BookingCard({ isPremium }: { isPremium: boolean }) {
  if (isPremium) {
    return (
      <div
        className="rounded-2xl p-6 transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(232,97,42,0.12) 0%, rgba(232,97,42,0.04) 100%)',
          border: '1px solid rgba(232,97,42,0.3)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(232,97,42,0.15)', border: '1px solid rgba(232,97,42,0.25)' }}
          >
            <Video className="w-6 h-6 text-[#E8612A]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white">1-on-1 Session with Legacy Expert</h3>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Included with your Premium subscription
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Get personalised guidance from a certified estate planning expert. 30-minute sessions available weekly.
            </p>
          </div>
        </div>
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #E8612A, #d4541f)',
            boxShadow: '0 4px 24px rgba(232,97,42,0.3)',
          }}
        >
          Book Your Session <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Lock className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white">1-on-1 Session with Legacy Expert</h3>
          <p className="text-sm mt-1 text-[#E8612A] font-medium">
            Upgrade to Premium to access 1-on-1 sessions
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Premium subscribers get personalised sessions with certified estate planning experts to review their legacy plan.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function EmployeeSubscriptionPage() {
  const [plan, setPlan] = useState<string>('basic')
  const [billingCycle] = useState<string>('Yearly')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.me() as MeResponse
      const apiPlan = data?.subscription?.plan || data?.tenant_plan || data?.plan
      if (apiPlan) {
        setPlan(apiPlan.toLowerCase())
      } else {
        setPlan(detectPlan())
      }
    } catch {
      setPlan(detectPlan())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const isPremium = plan === 'premium'
  const planLabel = isPremium ? 'Endevo Premium' : 'Endevo Basic'
  const planPrice = isPremium ? 499 : 299
  const monthlyPrice = isPremium ? 49 : 29
  const planColor = isPremium ? '#E8612A' : '#2BBFC5'
  const PlanIcon = isPremium ? Crown : Star
  const nextBilling = mockNextBillingDate()

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <CreditCard className="w-6 h-6" style={{ color: planColor }} />
              My Subscription
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Manage your plan and billing
            </p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {loading ? (
          <div className="glass p-12 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#2BBFC5]" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Current Plan Card ── */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: `${planColor}08`,
                border: `1px solid ${planColor}40`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: `${planColor}15`, border: `1px solid ${planColor}30` }}
                  >
                    <PlanIcon className="w-7 h-7" style={{ color: planColor }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{planLabel}</h2>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: `${planColor}20`, color: planColor, border: `1px solid ${planColor}30` }}
                      >
                        Active
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-white">${planPrice}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }} className="text-sm">/year</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      or ${monthlyPrice}/month billed monthly
                    </p>
                  </div>
                </div>
              </div>

              {/* Billing Details */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Billing Cycle
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{billingCycle}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Next Billing
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{nextBilling}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Payment
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">Managed by HR</p>
                </div>
              </div>
            </div>

            {/* ── 1-on-1 Booking Card ── */}
            <BookingCard isPremium={isPremium} />

            {/* ── Plan Features ── */}
            <div className="glass p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: planColor }} />
                Your Plan Features
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BASIC_FEATURES.map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <CheckCircle className="w-4 h-4 text-[#2BBFC5] flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
                {isPremium && PREMIUM_FEATURES.map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <CheckCircle className="w-4 h-4 text-[#E8612A] flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Upgrade CTA (Basic only) ── */}
            {!isPremium && (
              <div className="space-y-6">
                {/* Feature Comparison */}
                <div className="glass overflow-hidden">
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[#E8612A]" />
                      Upgrade to Premium
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Unlock advanced features and 1-on-1 expert sessions
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Feature</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-[#2BBFC5]">Basic ($299/yr)</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-[#E8612A]">Premium ($499/yr)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        {[
                          { feature: '6-module LMS access', basic: true, premium: true },
                          { feature: '40-question readiness assessment', basic: true, premium: true },
                          { feature: 'Progress tracking', basic: true, premium: true },
                          { feature: 'Completion certificates', basic: true, premium: true },
                          { feature: 'Email support', basic: true, premium: true },
                          { feature: '1-on-1 live sessions with expert', basic: false, premium: true },
                          { feature: 'Priority support (24-hour response)', basic: false, premium: true },
                          { feature: 'Advanced analytics dashboard', basic: false, premium: true },
                          { feature: 'Custom company branding', basic: false, premium: true },
                          { feature: 'Dedicated account manager', basic: false, premium: true },
                          { feature: 'API access', basic: false, premium: true },
                        ].map(row => (
                          <tr key={row.feature} className="hover:bg-white/[0.02]">
                            <td className="px-6 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{row.feature}</td>
                            <td className="px-6 py-3 text-center">
                              {row.basic
                                ? <CheckCircle className="w-4 h-4 text-[#2BBFC5] mx-auto" />
                                : <span style={{ color: 'rgba(255,255,255,0.15)' }}>--</span>}
                            </td>
                            <td className="px-6 py-3 text-center">
                              {row.premium
                                ? <CheckCircle className="w-4 h-4 text-[#E8612A] mx-auto" />
                                : <span style={{ color: 'rgba(255,255,255,0.15)' }}>--</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Upgrade button */}
                <div
                  className="rounded-2xl p-6 text-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(232,97,42,0.08) 0%, rgba(232,97,42,0.03) 100%)',
                    border: '1px solid rgba(232,97,42,0.25)',
                  }}
                >
                  <Crown className="w-8 h-8 text-[#E8612A] mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">Ready to upgrade?</h3>
                  <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Contact your HR administrator to upgrade your company plan to Premium
                  </p>
                  <a
                    href="mailto:support@endevo.life?subject=Upgrade to Premium"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, #E8612A, #d4541f)',
                      boxShadow: '0 4px 24px rgba(232,97,42,0.3)',
                    }}
                  >
                    Upgrade to Premium <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Footer note */}
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Subscription is managed by your company administrator. For billing questions, contact{' '}
                <a href="mailto:support@endevo.life" className="text-[#2BBFC5] hover:underline">support@endevo.life</a>.
                Stripe integration coming soon.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
