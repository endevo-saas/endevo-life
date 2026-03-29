'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  CreditCard, Loader2, RefreshCw, AlertCircle, Users, Globe,
  Mail, Building2, CheckCircle, Crown, Calendar, Shield
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

const PLAN_META: Record<string, { label: string; color: string; features: string[] }> = {
  trial: {
    label: 'Trial',
    color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    features: ['Up to 10 seats', '14-day free trial', '2 training courses', 'Email support']
  },
  starter: {
    label: 'Starter',
    color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    features: ['Up to 25 seats', 'All training courses', 'Certificates', 'Email support']
  },
  professional: {
    label: 'Professional',
    color: 'text-brand-300 border-brand-500/30 bg-brand-500/10',
    features: ['Up to 100 seats', 'All training courses', 'Certificates', 'Priority support', 'Audit logs']
  },
  enterprise: {
    label: 'Enterprise',
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    features: ['Up to 500 seats', 'All features', 'Dedicated support', 'SLA guarantee', 'Custom reporting']
  },
  'enterprise-plus': {
    label: 'Enterprise Plus',
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    features: ['Unlimited seats', 'All features', 'Dedicated account manager', 'Custom integrations', '24/7 support']
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
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const plan = tenant ? (PLAN_META[tenant.plan] || PLAN_META['starter']) : null
  const seatPct = tenant ? Math.round((tenant.user_count / Math.max(tenant.maxSeats, 1)) * 100) : 0

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Subscription & Plan</h1>
            <p className="text-slate-400 text-sm mt-0.5">Your organisation's current plan and usage</p>
          </div>
          <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}</div>}

        {loading ? (
          <div className="glass p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-green-400"/></div>
        ) : tenant && plan ? (
          <div className="space-y-4">

            {/* Current plan */}
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-5">
                <Crown className="w-5 h-5 text-slate-400"/>
                <h2 className="text-base font-semibold text-white">Current Plan</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-xl text-sm font-bold border ${plan.color}`}>
                  {plan.label}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  tenant.status === 'active' ? 'bg-green-500/10 text-green-400' :
                  tenant.status === 'trial'  ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}>{tenant.status}</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0"/>
                    {f}
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-white/5">
                <p className="text-xs text-slate-500">To upgrade your plan or change billing, contact your platform administrator.</p>
              </div>
            </div>

            {/* Seat usage */}
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-5">
                <Users className="w-5 h-5 text-slate-400"/>
                <h2 className="text-base font-semibold text-white">Seat Usage</h2>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className={`text-4xl font-black ${seatPct >= 90 ? 'text-red-400' : seatPct >= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {tenant.user_count}
                  </span>
                  <span className="text-slate-500 text-lg"> / {tenant.maxSeats} seats</span>
                </div>
                <span className={`text-sm font-medium ${seatPct >= 90 ? 'text-red-400' : seatPct >= 70 ? 'text-yellow-400' : 'text-slate-400'}`}>
                  {seatPct}% used
                </span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${seatPct >= 90 ? 'bg-red-500' : seatPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{width:`${Math.min(seatPct,100)}%`}}/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'Active Users',  value: tenant.active_count,   color: 'text-green-400'},
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

            {/* Organisation info */}
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
                    <a href={tenant.website} target="_blank" rel="noreferrer" className="text-sm text-brand-400 hover:underline">{tenant.website}</a>
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

          </div>
        ) : null}
      </div>
    </div>
  )
}
