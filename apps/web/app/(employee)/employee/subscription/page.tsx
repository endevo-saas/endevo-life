'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, RefreshCw, AlertCircle, CheckCircle, Crown,
  Calendar, Star, Sparkles, Video, Building2, Clock, User,
  ArrowRight, XCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Cookies from 'js-cookie'

// ── Types (aligned with backend response shapes) ────────────────────────────

interface SubscriptionData {
  plan: string
  planLabel: string
  priceMonthly: number
  priceYearly: number
  sessionsTotal: number
  sessionsUsed: number
  sessionsRemaining: number
  features: string[]
  premiumFeatures: string[]
  managedBy: string
}

interface SessionRecord {
  sessionId: string
  scheduledAt: string
  coachName: string
  duration: number
  status: string
}

interface SessionsData {
  sessions: SessionRecord[]
  total: number
  used: number
  remaining: number
}

// ── Mock Data (fallback until API is ready) ─────────────────────────────────

function detectPlanFromCookie(): 'basic' | 'premium' {
  const cookiePlan = Cookies.get('tenant_plan') || Cookies.get('user_plan')
  if (cookiePlan?.toLowerCase() === 'premium') return 'premium'
  return 'basic'
}

function getMockSubscription(plan: 'basic' | 'premium'): SubscriptionData {
  const isPremium = plan === 'premium'
  return {
    plan,
    planLabel: isPremium ? 'Endevo Premium' : 'Endevo Basic',
    priceMonthly: isPremium ? 41.58 : 24.92,
    priceYearly: isPremium ? 499 : 299,
    sessionsTotal: isPremium ? 6 : 2,
    sessionsUsed: 0,
    sessionsRemaining: isPremium ? 6 : 2,
    features: isPremium
      ? ['Readiness Assessment', '6 Learning Modules', '6x 30-min 1:1 Sessions per year', 'AI Guide (Jesse)', 'Priority scheduling', 'Extended session recordings']
      : ['Readiness Assessment', '6 Learning Modules', '2x 30-min 1:1 Sessions per year', 'AI Guide (Jesse)'],
    premiumFeatures: [
      'Everything in Basic',
      '6x 30-min 1:1 Sessions per year',
      'Priority scheduling',
      'Extended session recordings',
    ],
    managedBy: 'Your Employer',
  }
}

function getMockSessions(): SessionsData {
  return {
    sessions: [],
    total: 0,
    used: 0,
    remaining: 0,
  }
}

// ── Plan Comparison Data ────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { feature: 'Readiness Assessment (40 questions)', basic: true, premium: true },
  { feature: '6 Learning Modules', basic: true, premium: true },
  { feature: 'AI Guide (Jesse)', basic: true, premium: true },
  { feature: 'Progress tracking & certificates', basic: true, premium: true },
  { feature: '1-on-1 sessions per year', basic: '2', premium: '6' },
  { feature: 'Priority scheduling', basic: false, premium: true },
  { feature: 'Extended session recordings', basic: false, premium: true },
]

const BOOKING_URL = 'https://link.endevo.life/widget/booking/HUYkq6QZs0fI7AMtt6qH'

// ── Skeleton Loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className ?? ''}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}

// ── Session Status Badge ────────────────────────────────────────────────────

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    booked: { label: 'Upcoming', color: '#2BBFC5', bg: 'rgba(43,191,197,0.12)' },
    upcoming: { label: 'Upcoming', color: '#2BBFC5', bg: 'rgba(43,191,197,0.12)' },
    scheduled: { label: 'Scheduled', color: '#2BBFC5', bg: 'rgba(43,191,197,0.12)' },
    cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    'no-show': { label: 'No Show', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  }
  const c = config[status] || { label: status || 'Unknown', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}
    >
      {c.label}
    </span>
  )
}

// ── Progress Bar ────────────────────────────────────────────────────────────

function SessionProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const remaining = total - used
  const isLow = remaining <= 1 && total > 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-white">{remaining}</span>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            of {total} sessions remaining
          </span>
        </div>
        {isLow && (
          <span className="text-xs font-medium text-amber-400">Running low</span>
        )}
      </div>
      <div
        className="h-3 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${100 - pct}%`,
            background: isLow
              ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
              : 'linear-gradient(90deg, #2BBFC5, #E8612A)',
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <span>{used} used</span>
        <span>{total} total</span>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function EmployeeSubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [sessions, setSessions] = useState<SessionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showYearly, setShowYearly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const fallbackPlan = detectPlanFromCookie()

    // Fetch subscription + sessions in parallel, fallback to mock on failure
    const [subResult, sessResult] = await Promise.allSettled([
      apiFetch<SubscriptionData>('/api/employee/subscription'),
      apiFetch<SessionsData>('/api/employee/sessions'),
    ])

    const mockSub = getMockSubscription(fallbackPlan)

    if (subResult.status === 'fulfilled' && subResult.value) {
      setSubscription(subResult.value)
    } else {
      setSubscription(mockSub)
    }

    if (sessResult.status === 'fulfilled' && sessResult.value) {
      setSessions(sessResult.value)
    } else {
      setSessions({
        ...getMockSessions(),
        total: mockSub.sessionsTotal,
        remaining: mockSub.sessionsRemaining,
      })
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const isPremium = subscription?.plan?.toLowerCase() === 'premium'
  const planColor = isPremium ? '#E8612A' : '#2BBFC5'
  const PlanIcon = isPremium ? Crown : Star

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Sparkles className="w-6 h-6" style={{ color: planColor }} />
              My Subscription
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              View your plan details and 1:1 sessions
            </p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            title="Refresh"
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
          <LoadingSkeleton />
        ) : !subscription || !sessions ? (
          <div className="glass p-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-3">Unable to load subscription data</p>
            <button onClick={load} className="px-4 py-2 rounded-xl bg-[#2BBFC5]/10 text-[#2BBFC5] border border-[#2BBFC5]/30 text-sm font-medium hover:bg-[#2BBFC5]/20 transition-all">
              <RefreshCw className="w-4 h-4 inline mr-2" />Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ═══════════════════════════════════════════════════════════
                SECTION 1: Current Plan Card
               ═══════════════════════════════════════════════════════════ */}
            <div
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${planColor}12 0%, ${planColor}04 100%)`,
                border: `1px solid ${planColor}40`,
              }}
            >
              {/* Managed-by badge */}
              <div className="absolute top-4 right-4">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <Building2 className="w-3 h-3" />
                  {subscription.managedBy}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${planColor}15`, border: `1px solid ${planColor}30` }}
                >
                  <PlanIcon className="w-7 h-7" style={{ color: planColor }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{subscription.planLabel}</h2>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: `${planColor}20`, color: planColor, border: `1px solid ${planColor}30` }}
                    >
                      Active
                    </span>
                  </div>

                  {/* Price toggle */}
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-white">
                      ${showYearly ? subscription.priceYearly : subscription.priceMonthly.toFixed(2)}
                    </span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      /{showYearly ? 'year' : 'month'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowYearly(prev => !prev)}
                    className="text-xs mt-1 underline underline-offset-2 transition-colors hover:text-white"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {showYearly
                      ? `View as $${subscription.priceMonthly.toFixed(2)}/month`
                      : `View as $${subscription.priceYearly}/year`}
                  </button>
                </div>
              </div>

              {/* Feature list */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {subscription.features.map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <CheckCircle className="w-4 h-4 text-[#2BBFC5] flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
                {isPremium && subscription.premiumFeatures.map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <CheckCircle className="w-4 h-4 text-[#E8612A] flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
              </div>

              {/* Employer-managed notice */}
              <div
                className="mt-5 p-3 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Your employer manages your subscription. For plan changes, contact your HR administrator.
                </p>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2: 1:1 Sessions
               ═══════════════════════════════════════════════════════════ */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(232,97,42,0.08) 0%, rgba(43,191,197,0.04) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-[#E8612A]" />
                  1:1 Sessions
                </h3>
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: isPremium ? 'rgba(232,97,42,0.12)' : 'rgba(43,191,197,0.12)',
                    color: isPremium ? '#E8612A' : '#2BBFC5',
                    border: `1px solid ${isPremium ? 'rgba(232,97,42,0.25)' : 'rgba(43,191,197,0.25)'}`,
                  }}
                >
                  {isPremium ? 'Premium — 6/yr' : 'Basic — 2/yr'}
                </span>
              </div>

              {/* Progress bar */}
              <SessionProgressBar
                used={sessions.used}
                total={sessions.total > 0 ? sessions.total : subscription.sessionsTotal}
              />

              {/* Session history */}
              {sessions.sessions.length > 0 && (
                <div className="mt-5 space-y-2">
                  <h4
                    className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    Session History
                  </h4>
                  {sessions.sessions.map((s, i) => (
                    <div
                      key={s.sessionId || i}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          <User className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{s.coachName || 'Coach TBD'}</p>
                          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            <Calendar className="w-3 h-3" />
                            {s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString() : 'Not scheduled'}
                            <span className="mx-1">·</span>
                            <Clock className="w-3 h-3" />
                            {s.duration || 30} min
                          </div>
                        </div>
                      </div>
                      <SessionStatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              )}

              {sessions.sessions.length === 0 && (
                <div
                  className="mt-5 p-4 rounded-xl text-center"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                >
                  <Calendar className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No sessions booked yet
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Book your first session with an estate planning expert
                  </p>
                </div>
              )}

              {/* Book session button */}
              {(sessions.total > 0 ? sessions.remaining : subscription.sessionsRemaining) > 0 && (
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #E8612A, #d4541f)',
                    boxShadow: '0 4px 24px rgba(232,97,42,0.3)',
                  }}
                >
                  Book a Session <ArrowRight className="w-4 h-4" />
                </a>
              )}

              {(sessions.total > 0 ? sessions.remaining : subscription.sessionsRemaining) <= 0 && (
                <div
                  className="mt-5 p-3 rounded-xl flex items-center gap-3"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                >
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">
                    You have used all your sessions for this year. Contact your HR administrator for options.
                  </p>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 3: Plan Comparison (read-only)
               ═══════════════════════════════════════════════════════════ */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: planColor }} />
                  Plan Comparison
                </h3>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  See what is included in each plan
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                      >
                        Feature
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium relative" style={{ color: '#2BBFC5' }}>
                        Basic ($24.92/mo)
                        {!isPremium && (
                          <div
                            className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest"
                            style={{ background: '#2BBFC520', color: '#2BBFC5', border: '1px solid #2BBFC530' }}
                          >
                            Your Plan
                          </div>
                        )}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium relative" style={{ color: '#E8612A' }}>
                        Premium ($41.58/mo)
                        {isPremium && (
                          <div
                            className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest"
                            style={{ background: '#E8612A20', color: '#E8612A', border: '1px solid #E8612A30' }}
                          >
                            Your Plan
                          </div>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {COMPARISON_ROWS.map(row => (
                      <tr key={row.feature} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {row.feature}
                        </td>
                        <td
                          className="px-6 py-3 text-center"
                          style={!isPremium ? { background: 'rgba(43,191,197,0.04)' } : undefined}
                        >
                          {renderCell(row.basic, '#2BBFC5')}
                        </td>
                        <td
                          className="px-6 py-3 text-center"
                          style={isPremium ? { background: 'rgba(232,97,42,0.04)' } : undefined}
                        >
                          {renderCell(row.premium, '#E8612A')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Contact HR note */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Contact your HR administrator for plan changes. Employees cannot modify their subscription directly.
                </p>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Your subscription is managed by your employer. For questions, contact{' '}
                <a href="mailto:support@endevo.life" className="text-[#2BBFC5] hover:underline">
                  support@endevo.life
                </a>.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderCell(value: boolean | string, color: string) {
  if (typeof value === 'string') {
    return <span className="text-sm font-semibold" style={{ color }}>{value}</span>
  }
  if (value) {
    return <CheckCircle className="w-4 h-4 mx-auto" style={{ color }} />
  }
  return <span style={{ color: 'rgba(255,255,255,0.15)' }}>--</span>
}
