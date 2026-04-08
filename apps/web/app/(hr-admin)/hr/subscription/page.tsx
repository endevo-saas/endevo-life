'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  CreditCard, Loader2, RefreshCw, AlertCircle, Users, Globe,
  Mail, Building2, CheckCircle, Crown, Calendar, Shield, Star, Sparkles,
  Video, ArrowRight, Receipt
} from 'lucide-react'
import { api } from '@/lib/api'

interface TenantInfo {
  tenantId: string
  name: string
  plan: string
  status: string
  website?: string
  hrContact?: string
  hrEmail?: string
  maxSeats: number
  createdAt?: string
  user_count: number
  active_count: number
  employee_count: number
  hr_count: number
}

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

const PLAN_META: Record<string, { label: string; priceYearly: number; priceMonthly: number; color: string; features: string[]; icon: typeof Star }> = {
  basic: {
    label: 'Endevo Basic',
    priceYearly: 299,
    priceMonthly: 29,
    color: 'brand',
    features: BASIC_FEATURES,
    icon: Star,
  },
  premium: {
    label: 'Endevo Premium',
    priceYearly: 499,
    priceMonthly: 49,
    color: 'orange',
    features: [...BASIC_FEATURES, ...PREMIUM_FEATURES],
    icon: Crown,
  },
}

export default function HrSubscriptionPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api.hrTenant()
      setTenant(d as TenantInfo)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenant info')
      // Set fallback tenant so plan cards still render
      setTenant(prev => prev ?? {
        tenantId: '',
        name: 'Your Organisation',
        plan: 'basic',
        status: 'active',
        maxSeats: 0,
        user_count: 0,
        active_count: 0,
        employee_count: 0,
        hr_count: 0,
      })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const activePlan = tenant?.plan || 'basic'
  const seatPct = tenant ? Math.round((tenant.user_count / Math.max(tenant.maxSeats, 1)) * 100) : 0

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Subscription & Plans</h1>
            <p className="text-slate-400 text-sm mt-0.5">Choose the plan that fits your organisation</p>
          </div>
          <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}</div>}

        {loading ? (
          <div className="glass p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#2BBFC5]"/></div>
        ) : tenant ? (
          <div className="space-y-6">

            {/* ── Plan Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Basic Plan */}
              <div className={`relative rounded-2xl border p-6 transition-all ${
                activePlan === 'basic'
                  ? 'border-[#2BBFC5]/50 bg-[#2BBFC5]/5 shadow-lg shadow-[#2BBFC5]/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}>
                {activePlan === 'basic' && (
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold bg-[#2BBFC5] text-slate-900">
                    Current Plan
                  </div>
                )}
                <div className="flex items-center gap-3 mb-4 mt-1">
                  <div className="w-10 h-10 rounded-xl bg-[#2BBFC5]/10 border border-[#2BBFC5]/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-[#2BBFC5]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Endevo Basic</h3>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">$299</span>
                    <span className="text-slate-400 text-sm">/year</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-1">or $29/month billed monthly</p>
                </div>

                <div className="space-y-3 mb-6">
                  {BASIC_FEATURES.map(f => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-[#2BBFC5] flex-shrink-0 mt-0.5"/>
                      {f}
                    </div>
                  ))}
                </div>

                {activePlan === 'basic' ? (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium bg-[#2BBFC5]/10 text-[#2BBFC5] border border-[#2BBFC5]/30">
                    Your Active Plan
                  </div>
                ) : (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium bg-white/5 text-slate-400 border border-white/10">
                    Contact admin to switch
                  </div>
                )}
              </div>

              {/* Premium Plan */}
              <div className={`relative rounded-2xl border p-6 transition-all ${
                activePlan === 'premium'
                  ? 'border-[#E8612A]/50 bg-[#E8612A]/5 shadow-lg shadow-[#E8612A]/10'
                  : 'border-[#E8612A]/30 bg-gradient-to-br from-[#E8612A]/5 to-transparent hover:border-[#E8612A]/50'
              }`}>
                <div className="absolute -top-3 right-6 px-3 py-1 rounded-full text-xs font-bold bg-[#E8612A] text-white flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Recommended
                </div>
                {activePlan === 'premium' && (
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold bg-[#E8612A] text-white">
                    Current Plan
                  </div>
                )}
                <div className="flex items-center gap-3 mb-4 mt-1">
                  <div className="w-10 h-10 rounded-xl bg-[#E8612A]/10 border border-[#E8612A]/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-[#E8612A]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Endevo Premium</h3>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">$499</span>
                    <span className="text-slate-400 text-sm">/year</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-1">or $49/month billed monthly</p>
                </div>

                <p className="text-xs text-[#E8612A] font-medium mb-3 uppercase tracking-wider">Everything in Basic, plus:</p>
                <div className="space-y-3 mb-6">
                  {PREMIUM_FEATURES.map(f => (
                    <div key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-[#E8612A] flex-shrink-0 mt-0.5"/>
                      {f}
                    </div>
                  ))}
                </div>

                {activePlan === 'premium' ? (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium bg-[#E8612A]/10 text-[#E8612A] border border-[#E8612A]/30">
                    Your Active Plan
                  </div>
                ) : (
                  <button className="w-full py-2.5 rounded-xl text-center text-sm font-bold bg-[#E8612A] text-white hover:bg-[#E8612A]/90 transition-all shadow-lg shadow-[#E8612A]/20">
                    Contact admin to upgrade
                  </button>
                )}
              </div>
            </div>

            {/* ── Feature Comparison Table ── */}
            <div className="glass overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="text-base font-semibold text-white">Feature Comparison</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Feature</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-[#2BBFC5]">Basic</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-[#E8612A]">Premium</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
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
                        <td className="px-6 py-3 text-sm text-slate-300">{row.feature}</td>
                        <td className="px-6 py-3 text-center">
                          {row.basic
                            ? <CheckCircle className="w-4 h-4 text-[#2BBFC5] mx-auto" />
                            : <span className="text-slate-600">--</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {row.premium
                            ? <CheckCircle className="w-4 h-4 text-[#E8612A] mx-auto" />
                            : <span className="text-slate-600">--</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Seat Usage ── */}
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-5">
                <Users className="w-5 h-5 text-slate-400"/>
                <h2 className="text-base font-semibold text-white">Seat Usage</h2>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className={`text-4xl font-black ${seatPct >= 90 ? 'text-red-400' : seatPct >= 70 ? 'text-yellow-400' : 'text-[#2BBFC5]'}`}>
                    {tenant.user_count}
                  </span>
                  <span className="text-slate-500 text-lg"> / {tenant.maxSeats} seats</span>
                </div>
                <span className={`text-sm font-medium ${seatPct >= 90 ? 'text-red-400' : seatPct >= 70 ? 'text-yellow-400' : 'text-slate-400'}`}>
                  {seatPct}% used
                </span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${seatPct >= 90 ? 'bg-red-500' : seatPct >= 70 ? 'bg-yellow-500' : 'bg-[#2BBFC5]'}`}
                  style={{width:`${Math.min(seatPct,100)}%`}}/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'Active Users',  value: tenant.active_count,   color: 'text-[#2BBFC5]'},
                  {label:'HR Admins',     value: tenant.hr_count,       color: 'text-brand-300'},
                  {label:'Employees',     value: tenant.employee_count, color: 'text-blue-400'},
                ].map(s => (
                  <div key={s.label} className="text-center p-3 bg-white/3 rounded-xl">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Organisation Details ── */}
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-5">
                <Building2 className="w-5 h-5 text-slate-400"/>
                <h2 className="text-base font-semibold text-white">Organisation Details</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-sm text-slate-400"><Building2 className="w-4 h-4"/>Organisation Name</div>
                  <span className="text-sm text-white font-medium">{tenant.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-sm text-slate-400"><Shield className="w-4 h-4"/>Tenant ID</div>
                  <span className="text-xs font-mono text-slate-300 bg-white/5 px-2 py-1 rounded">{tenant.tenantId}</span>
                </div>
                {tenant.website && (
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-2 text-sm text-slate-400"><Globe className="w-4 h-4"/>Website</div>
                    <a href={tenant.website} target="_blank" rel="noreferrer" className="text-sm text-[#2BBFC5] hover:underline">{tenant.website}</a>
                  </div>
                )}
                {tenant.hrContact && (
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-2 text-sm text-slate-400"><Mail className="w-4 h-4"/>HR Contact</div>
                    <span className="text-sm text-white">{tenant.hrContact}</span>
                  </div>
                )}
                {tenant.createdAt && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400"><Calendar className="w-4 h-4"/>Member Since</div>
                    <span className="text-sm text-slate-300">{new Date(tenant.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Billing Information ── */}
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-5">
                <Receipt className="w-5 h-5 text-slate-400"/>
                <h2 className="text-base font-semibold text-white">Billing Information</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Billing Cycle</span>
                  </div>
                  <p className="text-sm font-medium text-white">Yearly</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next Billing Date</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment Method</span>
                  </div>
                  <p className="text-sm font-medium text-white">Stripe (coming soon)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Invoice-based billing available</p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-[#2BBFC5]/5 border border-[#2BBFC5]/15">
                <p className="text-xs text-slate-400">
                  <span className="font-medium text-[#2BBFC5]">Per-seat pricing:</span>{' '}
                  ${(PLAN_META[activePlan]?.priceYearly ?? 299)} / seat / year × {tenant.user_count} seats = {' '}
                  <span className="font-bold text-white">
                    ${((PLAN_META[activePlan]?.priceYearly ?? 299) * tenant.user_count).toLocaleString()}/year
                  </span>
                </p>
              </div>
            </div>

            {/* ── Premium Booking (if Premium plan) ── */}
            {activePlan === 'premium' && (
              <div className="rounded-2xl p-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(232,97,42,0.12) 0%, rgba(232,97,42,0.04) 100%)',
                  border: '1px solid rgba(232,97,42,0.3)',
                }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#E8612A]/15 border border-[#E8612A]/25">
                    <Video className="w-6 h-6 text-[#E8612A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white">1-on-1 Sessions with Legacy Expert</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Included with your Premium subscription. Employees can book personalised sessions with certified estate planning experts.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Booking link: <a href="https://link.endevo.life/widget/booking/HUYkq6QZs0fI7AMtt6qH" target="_blank" rel="noopener noreferrer" className="text-[#E8612A] hover:underline">link.endevo.life/widget/booking/...</a>
                    </p>
                  </div>
                  <a
                    href="https://link.endevo.life/widget/booking/HUYkq6QZs0fI7AMtt6qH"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, #E8612A, #d4541f)',
                      boxShadow: '0 4px 16px rgba(232,97,42,0.3)',
                    }}
                  >
                    Book Session <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* ── Upgrade CTA ── */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-slate-500">To upgrade your plan or change billing, contact your platform administrator or email <a href="mailto:support@endevo.life" className="text-[#2BBFC5] hover:underline">support@endevo.life</a>.</p>
            </div>

          </div>
        ) : (
          <div className="glass p-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-3">Unable to load subscription data</p>
            <button onClick={load} className="px-4 py-2 rounded-xl bg-[#2BBFC5]/10 text-[#2BBFC5] border border-[#2BBFC5]/30 text-sm font-medium hover:bg-[#2BBFC5]/20 transition-all">
              <RefreshCw className="w-4 h-4 inline mr-2" />Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
