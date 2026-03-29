'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  CreditCard, Loader2, AlertCircle, RefreshCw, TrendingUp,
  Building2, CheckCircle, Clock, AlertTriangle, ChevronDown,
  Star, Zap, Crown, Sparkles, ArrowUpRight, Edit3, DollarSign,
  Users, Plus, Save, X, BarChart3, Calendar, Settings
} from 'lucide-react'
import { api, Tenant } from '@/lib/api'

// ── Plan definitions (editable pricing) ───────────────────────────────────────
const DEFAULT_PLANS = [
  { key: 'trial',           label: 'Trial',         price: 0,   seats: 5,    color: 'slate',  icon: Clock,     badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { key: 'starter',         label: 'Starter',        price: 49,  seats: 25,   color: 'blue',   icon: Zap,       badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { key: 'professional',    label: 'Professional',   price: 149, seats: 100,  color: 'brand',  icon: Star,      badge: 'bg-brand-500/20 text-brand-400 border-brand-500/30' },
  { key: 'enterprise',      label: 'Enterprise',     price: 399, seats: 500,  color: 'purple', icon: Crown,     badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { key: 'enterprise-plus', label: 'Enterprise+',    price: 999, seats: 9999, color: 'yellow', icon: Sparkles,  badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
]

const BILLING_PERIODS = [
  { key: 'monthly',   label: 'Monthly',    multiplier: 1 },
  { key: 'quarterly', label: '3 Months',   multiplier: 2.85 },
  { key: 'biannual',  label: '6 Months',   multiplier: 5.5 },
  { key: 'annual',    label: '12 Months',  multiplier: 10 },
]

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-500/10 text-green-400 border border-green-500/30',
  trial:     'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  suspended: 'bg-red-500/10 text-red-400 border border-red-500/30',
  inactive:  'bg-slate-500/10 text-slate-400 border border-slate-500/30',
}

interface EditModal {
  tenant: Tenant
  newPlan: string
  period: string
  customPrice: string
  useCustomPrice: boolean
  maxSeats: string
  saving: boolean
  error: string
}

interface PricingModal {
  open: boolean
  plans: typeof DEFAULT_PLANS
  saving: boolean
}

function planInfo(key: string, plans = DEFAULT_PLANS) {
  return plans.find(p => p.key === key) || plans[0]
}

export default function SubscriptionsPage() {
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [modal, setModal]           = useState<EditModal | null>(null)
  const [pricingModal, setPricing]  = useState<PricingModal>({ open: false, plans: DEFAULT_PLANS, saving: false })
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [plans, setPlans]           = useState(DEFAULT_PLANS)

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api.adminTenants()
      setTenants(d.tenants.filter(t => t.status !== 'deleted'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  function openEdit(t: Tenant) {
    setModal({
      tenant: t,
      newPlan: t.plan,
      period: 'monthly',
      customPrice: '',
      useCustomPrice: false,
      maxSeats: String(t.maxSeats || 50),
      saving: false,
      error: ''
    })
  }

  async function saveChanges() {
    if (!modal) return
    setModal(m => m ? { ...m, saving: true, error: '' } : null)
    try {
      const p = planInfo(modal.newPlan, plans)
      const updates: Record<string, unknown> = {
        plan: modal.newPlan,
        maxSeats: parseInt(modal.maxSeats) || p.seats,
      }
      if (modal.useCustomPrice && modal.customPrice) {
        updates.customPrice = parseFloat(modal.customPrice)
        updates.billingPeriod = modal.period
      } else {
        updates.billingPeriod = modal.period
      }
      await api.adminUpdateTenant(modal.tenant.tenantId, updates)
      await load()
      setModal(null)
      showSuccess(`${modal.tenant.name} updated to ${p.label}`)
    } catch (e: unknown) {
      setModal(m => m ? { ...m, saving: false, error: e instanceof Error ? e.message : 'Update failed' } : null)
    }
  }

  async function suspendTenant(t: Tenant) {
    if (!confirm(`Suspend ${t.name}? They will lose access immediately.`)) return
    try {
      await api.adminUpdateTenant(t.tenantId, { status: 'suspended' })
      await load()
      showSuccess(`${t.name} suspended`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suspend failed')
    }
  }

  async function activateTenant(t: Tenant) {
    try {
      await api.adminUpdateTenant(t.tenantId, { status: 'active' })
      await load()
      showSuccess(`${t.name} reactivated`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Activate failed')
    }
  }

  function savePricing() {
    setPricing(p => ({ ...p, saving: true }))
    setTimeout(() => {
      setPlans(pricingModal.plans)
      setPricing({ open: false, plans: pricingModal.plans, saving: false })
      showSuccess('Pricing updated successfully')
    }, 500)
  }

  const filtered = tenants.filter(t => {
    if (filterPlan !== 'all' && t.plan !== filterPlan) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    return true
  })

  const totalMRR    = tenants.reduce((s, t) => s + (planInfo(t.plan, plans).price), 0)
  const activeMRR   = tenants.filter(t => t.status === 'active').reduce((s, t) => s + (planInfo(t.plan, plans).price), 0)
  const planCounts  = plans.reduce((acc, p) => { acc[p.key] = tenants.filter(t => t.plan === p.key).length; return acc }, {} as Record<string, number>)

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
            <p className="text-slate-400 text-sm mt-0.5">Full control — plans, pricing, seats, billing</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPricing({ open: true, plans: [...plans], saving: false })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 text-sm transition-all"
            >
              <DollarSign className="w-4 h-4" /> Edit Pricing
            </button>
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-sm transition-all">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {error   && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>{error}</div>}
        {success && <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {success}</div>}

        {/* Revenue KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total MRR',     value: `$${totalMRR.toLocaleString()}`,  sub: `${tenants.length} tenants`, color: 'text-green-400', icon: TrendingUp, bg: 'from-green-600/20 to-green-800/10 border-green-500/30' },
            { label: 'Active MRR',    value: `$${activeMRR.toLocaleString()}`, sub: `${tenants.filter(t=>t.status==='active').length} active`, color: 'text-brand-400', icon: BarChart3, bg: 'from-brand-600/20 to-brand-800/10 border-brand-500/30' },
            { label: 'Trial Tenants', value: String(tenants.filter(t=>t.plan==='trial'||t.status==='trial').length), sub: 'Converting soon', color: 'text-yellow-400', icon: Clock, bg: 'from-yellow-600/20 to-yellow-800/10 border-yellow-500/30' },
            { label: 'Suspended',     value: String(tenants.filter(t=>t.status==='suspended').length), sub: 'Need action', color: 'text-red-400', icon: AlertTriangle, bg: 'from-red-600/20 to-red-800/10 border-red-500/30' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className={`rounded-2xl p-5 border bg-gradient-to-br ${s.bg}`}>
                <Icon className={`w-5 h-5 ${s.color} mb-2`} />
                <div className={`text-3xl font-black ${s.color}`}>{loading ? '—' : s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
                <div className="text-xs text-slate-500">{s.sub}</div>
              </div>
            )
          })}
        </div>

        {/* Plan breakdown cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {plans.map(p => {
            const Icon = p.icon
            const count = planCounts[p.key] || 0
            return (
              <button
                key={p.key}
                onClick={() => setFilterPlan(filterPlan === p.key ? 'all' : p.key)}
                className={`glass p-4 text-left rounded-2xl border transition-all hover:-translate-y-0.5 ${
                  filterPlan === p.key ? 'border-brand-500/50 bg-brand-600/10' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium mb-3 ${p.badge}`}>
                  <Icon className="w-3 h-3" />{p.label}
                </div>
                <p className="text-2xl font-black text-white">{count}</p>
                <p className="text-xs text-slate-500">${p.price}/mo base</p>
                {count > 0 && <p className="text-xs text-brand-400 mt-1">${(p.price * count).toLocaleString()} MRR</p>}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {['all','active','trial','suspended','inactive'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40' : 'bg-white/3 text-slate-500 border border-white/8 hover:text-white'}`}>
                {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {(filterPlan !== 'all' || filterStatus !== 'all') && (
            <button onClick={() => { setFilterPlan('all'); setFilterStatus('all') }}
              className="text-xs text-slate-400 hover:text-white transition-colors">
              Clear filters ×
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">{filtered.length} tenants shown</span>
        </div>

        {/* Tenants table */}
        <div className="glass overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">All Subscriptions</h2>
            <span className="text-xs text-slate-500">Full control — change plan, seats, billing, status</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <CreditCard className="w-12 h-12 mb-3 opacity-30" />
              <p>No tenants match filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Tenant', 'Plan', 'Status', 'Seats', 'MRR', 'Billing', 'Since', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(t => {
                    const p   = planInfo(t.plan, plans)
                    const Icon = p.icon
                    const seatPct = Math.min(((t.user_count||0) / (t.maxSeats||1)) * 100, 100)
                    return (
                      <tr key={t.tenantId} className="hover:bg-white/3 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                              {(t.name?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{t.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{t.tenantId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${p.badge}`}>
                            <Icon className="w-3 h-3" />{p.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[t.status] || STATUS_COLORS.inactive}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${seatPct > 90 ? 'bg-red-500' : seatPct > 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                                style={{ width: `${seatPct}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{t.user_count||0}/{t.maxSeats}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-white">${p.price}</span>
                          <span className="text-xs text-slate-500">/mo</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">Monthly</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(t)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 text-xs font-medium transition-all border border-brand-500/30"
                              title="Edit plan, seats, pricing"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            {t.status === 'suspended' ? (
                              <button onClick={() => activateTenant(t)}
                                className="px-2.5 py-1.5 rounded-lg bg-green-600/20 text-green-300 hover:bg-green-600/30 text-xs font-medium border border-green-500/30 transition-all"
                                title="Reactivate">Activate</button>
                            ) : (
                              <button onClick={() => suspendTenant(t)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 text-xs font-medium border border-red-500/20 transition-all"
                                title="Suspend tenant">Suspend</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Subscription Modal ───────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-brand-400" />
                Edit Subscription — {modal.tenant.name}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white text-lg">×</button>
            </div>

            <div className="mb-4 p-3 bg-white/5 rounded-xl grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-slate-500">Tenant ID</p><p className="text-white font-mono">{modal.tenant.tenantId}</p></div>
              <div><p className="text-slate-500">Current Plan</p><p className="text-brand-300 font-semibold">{planInfo(modal.tenant.plan, plans).label}</p></div>
            </div>

            {modal.error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5"/>{modal.error}</div>}

            {/* Plan selection */}
            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-2 font-medium">Plan</label>
              <div className="grid grid-cols-1 gap-2">
                {plans.map(p => {
                  const Icon = p.icon
                  const selected = modal.newPlan === p.key
                  const current  = modal.tenant.plan === p.key
                  return (
                    <button key={p.key}
                      onClick={() => setModal(m => m ? { ...m, newPlan: p.key } : null)}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${selected ? 'border-brand-500/50 bg-brand-600/15' : 'border-white/10 hover:border-white/20 hover:bg-white/3'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${p.badge}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">{p.label} {current && <span className="text-yellow-400 text-xs ml-1">current</span>}</p>
                          <p className="text-xs text-slate-500">Up to {p.seats === 9999 ? 'Unlimited' : p.seats} seats</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</p>
                        {selected && !current && <CheckCircle className="w-4 h-4 text-brand-400 ml-auto mt-0.5" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Billing period + seats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">Billing Period</label>
                <div className="relative">
                  <select value={modal.period} onChange={e => setModal(m => m ? { ...m, period: e.target.value } : null)}
                    className="input-field appearance-none pr-8 text-sm">
                    {BILLING_PERIODS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">Max Seats</label>
                <input type="number" min={1} max={10000} value={modal.maxSeats}
                  onChange={e => setModal(m => m ? { ...m, maxSeats: e.target.value } : null)}
                  className="input-field text-sm" placeholder="Seats" />
              </div>
            </div>

            {/* Custom pricing override */}
            <div className="mb-5 p-3 bg-white/3 rounded-xl border border-white/5">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={modal.useCustomPrice}
                  onChange={e => setModal(m => m ? { ...m, useCustomPrice: e.target.checked } : null)}
                  className="rounded" />
                <span className="text-sm text-slate-300 font-medium">Custom Price Override</span>
                <span className="text-xs text-slate-500">(overrides plan default)</span>
              </label>
              {modal.useCustomPrice && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-slate-400 text-sm">$</span>
                  <input type="number" min={0} step={0.01} value={modal.customPrice}
                    onChange={e => setModal(m => m ? { ...m, customPrice: e.target.value } : null)}
                    placeholder={String(planInfo(modal.newPlan, plans).price)}
                    className="input-field text-sm flex-1" />
                  <span className="text-slate-400 text-sm">/mo</span>
                </div>
              )}
            </div>

            {/* Summary */}
            {modal.newPlan !== modal.tenant.plan && (
              <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl text-xs text-brand-300">
                Changing: <strong>{planInfo(modal.tenant.plan, plans).label}</strong> → <strong>{planInfo(modal.newPlan, plans).label}</strong>
                {' '}· ${modal.useCustomPrice && modal.customPrice ? modal.customPrice : planInfo(modal.newPlan, plans).price}/mo
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-all">
                Cancel
              </button>
              <button onClick={saveChanges} disabled={modal.saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                {modal.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {modal.saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pricing Management Modal ─────────────────────────────────────────── */}
      {pricingModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setPricing(p => ({ ...p, open: false })) }}>
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Manage Plan Pricing
              </h3>
              <button onClick={() => setPricing(p => ({ ...p, open: false }))} className="text-slate-400 hover:text-white text-lg">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Set base price per plan. This affects MRR calculations and new subscription offers.</p>
            <div className="space-y-3 mb-5">
              {pricingModal.plans.map((p, i) => {
                const Icon = p.icon
                return (
                  <div key={p.key} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.badge}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-white flex-1 font-medium">{p.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-sm">$</span>
                      <input
                        type="number" min={0} step={1}
                        value={pricingModal.plans[i].price}
                        onChange={e => setPricing(pm => {
                          const updated = [...pm.plans]
                          updated[i] = { ...updated[i], price: parseInt(e.target.value) || 0 }
                          return { ...pm, plans: updated }
                        })}
                        className="w-24 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm text-right"
                      />
                      <span className="text-slate-500 text-xs">/mo</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPricing(p => ({ ...p, open: false }))}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm">
                Cancel
              </button>
              <button onClick={savePricing} disabled={pricingModal.saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                {pricingModal.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Pricing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
