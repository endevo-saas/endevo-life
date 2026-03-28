'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  CreditCard, Loader2, AlertCircle, RefreshCw, TrendingUp,
  Building2, CheckCircle, Clock, AlertTriangle, ChevronDown,
  Star, Zap, Crown, Sparkles, ArrowUpRight
} from 'lucide-react'
import { api, Tenant } from '@/lib/api'

const PLANS = [
  { key: 'trial',            label: 'Trial',            price: 0,    color: 'slate',  icon: Clock,     seats: 5,    badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { key: 'starter',          label: 'Starter',          price: 49,   color: 'blue',   icon: Zap,       seats: 25,   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { key: 'professional',     label: 'Professional',     price: 149,  color: 'brand',  icon: Star,      seats: 100,  badge: 'bg-brand-500/20 text-brand-400 border-brand-500/30' },
  { key: 'enterprise',       label: 'Enterprise',       price: 399,  color: 'purple', icon: Crown,     seats: 500,  badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { key: 'enterprise-plus',  label: 'Enterprise+',      price: 999,  color: 'yellow', icon: Sparkles,  seats: 9999, badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
]

const PERIODS = ['Monthly', '3 Months', '6 Months', '12 Months', 'Custom']

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active:    'bg-green-500/10 text-green-400 border border-green-500/30',
    trial:     'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
    suspended: 'bg-red-500/10 text-red-400 border border-red-500/30',
    deleted:   'bg-slate-500/10 text-slate-500 border border-slate-500/20',
    inactive:  'bg-slate-500/10 text-slate-400 border border-slate-500/30',
  }
  return map[status] || map.inactive
}

function planIcon(planKey: string) {
  const p = PLANS.find(x => x.key === planKey)
  const Icon = p?.icon || CreditCard
  return <Icon className="w-3.5 h-3.5" />
}

function planBadge(planKey: string) {
  const p = PLANS.find(x => x.key === planKey)
  return p?.badge || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

function planPrice(planKey: string) {
  const p = PLANS.find(x => x.key === planKey)
  return p?.price ?? 0
}

function planLabel(planKey: string) {
  const p = PLANS.find(x => x.key === planKey)
  return p?.label || planKey
}

interface SubModal {
  tenant: Tenant
  newPlan: string
  period: string
  saving: boolean
  error: string
}

export default function SubscriptionsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [modal, setModal]     = useState<SubModal | null>(null)
  const [filterPlan, setFilterPlan] = useState('all')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api.adminTenants()
      setTenants(d.tenants.filter(t => t.status !== 'deleted'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function upgradePlan() {
    if (!modal) return
    setModal(m => m ? { ...m, saving: true, error: '' } : null)
    try {
      await api.adminUpdateTenant(modal.tenant.tenantId, { plan: modal.newPlan })
      await load()
      setModal(null)
    } catch (e: unknown) {
      setModal(m => m ? { ...m, saving: false, error: e instanceof Error ? e.message : 'Failed to update plan' } : null)
    }
  }

  // Summary stats
  const totalMRR = tenants.reduce((sum, t) => sum + planPrice(t.plan), 0)
  const planCounts = PLANS.reduce((acc, p) => {
    acc[p.key] = tenants.filter(t => t.plan === p.key).length
    return acc
  }, {} as Record<string, number>)

  const filtered = filterPlan === 'all' ? tenants : tenants.filter(t => t.plan === filterPlan)

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-brand-400" />
              Subscription Master
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage tenant plans, billing and upgrades</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-sm transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5"/>{error}</div>}

        {/* MRR Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <p className="text-xs text-slate-500">Monthly Revenue</p>
            </div>
            <p className="text-3xl font-bold text-white">${totalMRR.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">MRR across {tenants.length} tenants</p>
          </div>
          <div className="glass p-5">
            <p className="text-xs text-slate-500 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{tenants.filter(t=>t.status==='active').length}</p>
          </div>
          <div className="glass p-5">
            <p className="text-xs text-slate-500 mb-1">Trial</p>
            <p className="text-2xl font-bold text-yellow-400">{tenants.filter(t=>t.status==='trial'||t.plan==='trial').length}</p>
          </div>
          <div className="glass p-5">
            <p className="text-xs text-slate-500 mb-1">Suspended</p>
            <p className="text-2xl font-bold text-red-400">{tenants.filter(t=>t.status==='suspended').length}</p>
          </div>
        </div>

        {/* Plan breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {PLANS.map(p => {
            const Icon = p.icon
            const count = planCounts[p.key] || 0
            return (
              <button
                key={p.key}
                onClick={() => setFilterPlan(filterPlan === p.key ? 'all' : p.key)}
                className={`glass p-4 text-left rounded-2xl border transition-all ${
                  filterPlan === p.key ? 'border-brand-500/50 bg-brand-600/10' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium mb-3 ${p.badge}`}>
                  <Icon className="w-3 h-3" />{p.label}
                </div>
                <p className="text-xl font-bold text-white">{count}</p>
                <p className="text-xs text-slate-500">${p.price}/mo each</p>
                {count > 0 && <p className="text-xs text-slate-400 mt-1">${(p.price * count).toLocaleString()} MRR</p>}
              </button>
            )
          })}
        </div>

        {/* Tenants table */}
        <div className="glass overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">
              {filterPlan === 'all' ? 'All Subscriptions' : `${planLabel(filterPlan)} Tenants`}
              <span className="ml-2 text-xs text-slate-500">({filtered.length})</span>
            </h2>
            {filterPlan !== 'all' && (
              <button onClick={() => setFilterPlan('all')} className="text-xs text-slate-400 hover:text-white transition-colors">
                Clear filter ×
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <CreditCard className="w-12 h-12 mb-3 opacity-30" />
              <p>No tenants on this plan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Tenant', 'Current Plan', 'Status', 'Seats Used', 'MRR', 'Since', 'Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(t => (
                    <tr key={t.tenantId} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                            {t.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{t.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{t.tenantId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${planBadge(t.plan)}`}>
                          {planIcon(t.plan)}{planLabel(t.plan)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-16">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${Math.min(((t.user_count||0) / (t.maxSeats||1)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{t.user_count||0}/{t.maxSeats}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-white">${planPrice(t.plan)}</span>
                        <span className="text-xs text-slate-500">/mo</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setModal({ tenant: t, newPlan: t.plan, period: 'Monthly', saving: false, error: '' })}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 text-xs font-medium transition-all border border-brand-500/30"
                        >
                          <ArrowUpRight className="w-3 h-3" /> Change Plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Change Plan Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">Change Subscription Plan</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
            </div>

            <div className="mb-4 p-3 bg-white/5 rounded-xl">
              <p className="text-xs text-slate-500">Tenant</p>
              <p className="text-sm font-semibold text-white">{modal.tenant.name}</p>
              <p className="text-xs text-slate-500 font-mono">{modal.tenant.tenantId}</p>
            </div>

            {modal.error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5"/>{modal.error}</div>}

            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-2">Select New Plan</label>
              <div className="space-y-2">
                {PLANS.map(p => {
                  const Icon = p.icon
                  const selected = modal.newPlan === p.key
                  const current = modal.tenant.plan === p.key
                  return (
                    <button
                      key={p.key}
                      onClick={() => setModal(m => m ? { ...m, newPlan: p.key } : null)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                        selected
                          ? 'border-brand-500/50 bg-brand-600/15'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.badge}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">{p.label}</p>
                          <p className="text-xs text-slate-500">Up to {p.seats === 9999 ? 'Unlimited' : p.seats} seats</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</p>
                        {current && <p className="text-xs text-yellow-400">Current</p>}
                        {selected && !current && <CheckCircle className="w-4 h-4 text-brand-400 ml-auto" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-slate-300 mb-2">Billing Period</label>
              <div className="relative">
                <select
                  value={modal.period}
                  onChange={e => setModal(m => m ? { ...m, period: e.target.value } : null)}
                  className="input-field appearance-none pr-10"
                >
                  {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {modal.newPlan !== modal.tenant.plan && (
              <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl">
                <p className="text-xs text-brand-300">
                  Changing from <strong>{planLabel(modal.tenant.plan)}</strong> (${planPrice(modal.tenant.plan)}/mo) →{' '}
                  <strong>{planLabel(modal.newPlan)}</strong> (${planPrice(modal.newPlan)}/mo)
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-all">
                Cancel
              </button>
              <button
                onClick={upgradePlan}
                disabled={modal.saving || modal.newPlan === modal.tenant.plan}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {modal.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {modal.saving ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
