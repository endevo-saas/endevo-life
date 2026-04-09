'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  CreditCard, Loader2, AlertCircle, RefreshCw, TrendingUp,
  Building2, CheckCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight,
  Star, Crown, ArrowUpRight, Edit3, DollarSign,
  Users, Plus, Save, X, BarChart3, Calendar, Settings, Download,
  FileText, Send, Eye, Search, Filter
} from 'lucide-react'
import { api, Tenant } from '@/lib/api'
import { apiFetch } from '@/lib/api'
import { exportCsv } from '@/lib/export'

// ── Constants ────────────────────────────────────────────────────────────────

const PLANS = {
  basic:   { key: 'basic',   label: 'Endevo Basic',   priceYearly: 299, sessions: 2,  icon: Star,  badge: 'bg-brand-500/20 text-brand-400 border-brand-500/30' },
  premium: { key: 'premium', label: 'Endevo Premium', priceYearly: 499, sessions: 6,  icon: Crown, badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
} as const

type PlanKey = keyof typeof PLANS

const PLAN_KEYS: PlanKey[] = ['basic', 'premium']

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-500/10 text-green-400 border border-green-500/30',
  suspended: 'bg-red-500/10 text-red-400 border border-red-500/30',
  inactive:  'bg-slate-500/10 text-slate-400 border border-slate-500/30',
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
  sent:  'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  paid:  'bg-green-500/10 text-green-400 border border-green-500/30',
}

const ROWS_PER_PAGE = 10

// ── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionData {
  totalTenants: number
  activeSubscriptions: number
  mrr: number
  arr: number
  planDistribution: Record<string, number>
  recentChanges: RecentChange[]
}

interface RecentChange {
  tenantId: string
  tenantName: string
  change: string
  date: string
}

interface Invoice {
  invoiceId: string
  tenantId: string
  tenantName: string
  amount: number
  status: 'draft' | 'sent' | 'paid'
  date: string
  plan: string
  seats: number
}

interface InvoiceModalState {
  tenant: Tenant
  amount: string
  description: string
  saving: boolean
  error: string
}

interface ChangePlanModalState {
  tenant: Tenant
  newPlan: PlanKey
  saving: boolean
  error: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPlan(key: string) {
  return PLANS[key as PlanKey] ?? PLANS.basic
}

function computeMrr(seats: number, planKey: string): number {
  const plan = getPlan(planKey)
  return Math.round((seats * plan.priceYearly) / 12 * 100) / 100
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ── Skeleton Components ──────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-5 border border-white/5 bg-white/3 animate-pulse">
      <div className="w-5 h-5 bg-white/10 rounded mb-3" />
      <div className="w-20 h-8 bg-white/10 rounded mb-2" />
      <div className="w-16 h-3 bg-white/5 rounded mb-1" />
      <div className="w-12 h-3 bg-white/5 rounded" />
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ── Pie Chart Component ──────────────────────────────────────────────────────

function PlanPieChart({ basic, premium }: { basic: number; premium: number }) {
  const total = basic + premium
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-slate-500">No data</p>
      </div>
    )
  }
  const basicPct = (basic / total) * 100
  const premiumPct = (premium / total) * 100
  const basicAngle = (basicPct / 100) * 360

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="4"
            stroke="rgb(var(--color-brand-500) / 0.4)"
            strokeDasharray={`${basicPct} ${100 - basicPct}`}
            strokeDashoffset="0" />
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="4"
            stroke="rgb(249 115 22 / 0.6)"
            strokeDasharray={`${premiumPct} ${100 - premiumPct}`}
            strokeDashoffset={`${-basicPct}`} />
        </svg>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-brand-400" />
          <span className="text-xs text-slate-400">Basic {basic}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-xs text-slate-400">Premium {premium}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tenants, setTenants]                 = useState<Tenant[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState('')
  const [searchQuery, setSearchQuery]         = useState('')
  const [filterPlan, setFilterPlan]           = useState<'all' | PlanKey>('all')
  const [filterStatus, setFilterStatus]       = useState('all')
  const [sortField, setSortField]             = useState<'name' | 'mrr' | 'seats'>('name')
  const [sortAsc, setSortAsc]                 = useState(true)
  const [page, setPage]                       = useState(1)
  const [invoiceModal, setInvoiceModal]       = useState<InvoiceModalState | null>(null)
  const [changePlanModal, setChangePlanModal] = useState<ChangePlanModalState | null>(null)
  const [invoiceFilter, setInvoiceFilter]     = useState<'all' | 'draft' | 'sent' | 'paid'>('all')

  // Mock invoices (will be replaced by API data when backend is ready)
  const [invoices, setInvoices] = useState<Invoice[]>([])

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const loadTenants = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.adminTenants()
      setTenants((d?.tenants || []).filter(t => t.status !== 'deleted'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions. Showing cached data if available.')
      // Keep previous tenants data if available so cards don't go blank
      setTenants(prev => prev.length > 0 ? prev : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTenants() }, [loadTenants])

  // ── Derived Data ───────────────────────────────────────────────────────────

  const activeTenants = useMemo(() => tenants.filter(t => t.status === 'active'), [tenants])

  const mrr = useMemo(() =>
    activeTenants.reduce((sum, t) => {
      // Use actual user count (user_count from API), NOT maxSeats (which is the limit)
      const seats = (t as Record<string, unknown>).user_count as number || (t as Record<string, unknown>).employee_count as number || t.employeeCount || 1
      return sum + computeMrr(seats, t.plan)
    }, 0),
    [activeTenants]
  )

  const arr = useMemo(() => mrr * 12, [mrr])

  const planDistribution = useMemo(() => ({
    basic:   tenants.filter(t => t.plan === 'basic').length,
    premium: tenants.filter(t => t.plan === 'premium').length,
  }), [tenants])

  const filtered = useMemo(() => {
    let result = tenants.filter(t => {
      if (filterPlan !== 'all' && t.plan !== filterPlan) return false
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          t.name.toLowerCase().includes(q) ||
          t.tenantId.toLowerCase().includes(q)
        )
      }
      return true
    })

    result = [...result].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return sortAsc
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name)
        case 'mrr': {
          const mrrA = computeMrr((a as Record<string, unknown>).user_count as number || a.employeeCount || 1, a.plan)
          const mrrB = computeMrr((b as Record<string, unknown>).user_count as number || b.employeeCount || 1, b.plan)
          return sortAsc ? mrrA - mrrB : mrrB - mrrA
        }
        case 'seats':
          return sortAsc
            ? (a.user_count || a.employeeCount || 0) - (b.user_count || b.employeeCount || 0)
            : (b.user_count || b.employeeCount || 0) - (a.user_count || a.employeeCount || 0)
        default:
          return 0
      }
    })

    return result
  }, [tenants, filterPlan, filterStatus, searchQuery, sortField, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const filteredInvoices = useMemo(() =>
    invoiceFilter === 'all' ? invoices : invoices.filter(inv => inv.status === invoiceFilter),
    [invoices, invoiceFilter]
  )

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [filterPlan, filterStatus, searchQuery])

  // ── Actions ────────────────────────────────────────────────────────────────

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  function handleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  function openCreateInvoice(t: Tenant) {
    const plan = getPlan(t.plan)
    const defaultAmount = (t.maxSeats || 1) * plan.priceYearly
    setInvoiceModal({
      tenant: t,
      amount: String(defaultAmount),
      description: `${plan.label} — ${t.maxSeats || 1} seats @ ${formatCurrency(plan.priceYearly)}/yr`,
      saving: false,
      error: '',
    })
  }

  async function submitInvoice() {
    if (!invoiceModal) return
    setInvoiceModal(prev => prev ? { ...prev, saving: true, error: '' } : null)
    try {
      await apiFetch(`/api/admin/subscriptions/${invoiceModal.tenant.tenantId}/invoice`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(invoiceModal.amount),
          description: invoiceModal.description,
        }),
      })

      // Add to local invoices list
      const newInvoice: Invoice = {
        invoiceId: `INV-${Date.now().toString(36).toUpperCase()}`,
        tenantId: invoiceModal.tenant.tenantId,
        tenantName: invoiceModal.tenant.name,
        amount: parseFloat(invoiceModal.amount),
        status: 'draft',
        date: new Date().toISOString(),
        plan: invoiceModal.tenant.plan,
        seats: invoiceModal.tenant.maxSeats || 1,
      }
      setInvoices(prev => [newInvoice, ...prev])
      setInvoiceModal(null)
      showSuccess(`Invoice created for ${invoiceModal.tenant.name}`)
    } catch (e: unknown) {
      setInvoiceModal(prev => prev ? { ...prev, saving: false, error: e instanceof Error ? e.message : 'Failed to create invoice' } : null)
    }
  }

  function openChangePlan(t: Tenant) {
    const current = t.plan as PlanKey
    const other: PlanKey = current === 'premium' ? 'basic' : 'premium'
    setChangePlanModal({
      tenant: t,
      newPlan: other,
      saving: false,
      error: '',
    })
  }

  async function submitChangePlan() {
    if (!changePlanModal) return
    setChangePlanModal(prev => prev ? { ...prev, saving: true, error: '' } : null)
    try {
      await api.adminUpdateTenant(changePlanModal.tenant.tenantId, {
        plan: changePlanModal.newPlan,
      })
      await loadTenants()
      setChangePlanModal(null)
      showSuccess(`${changePlanModal.tenant.name} changed to ${getPlan(changePlanModal.newPlan).label}`)
    } catch (e: unknown) {
      setChangePlanModal(prev => prev ? {
        ...prev,
        saving: false,
        error: e instanceof Error ? e.message : 'Plan change failed',
      } : null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-brand-400" />
              Subscriptions & Billing
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Revenue overview, tenant billing, and invoice management</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportCsv('endevo_subscriptions', filtered as unknown as Record<string, unknown>[], [
                { key: 'name', label: 'Organization' },
                { key: 'tenantId', label: 'Tenant ID' },
                { key: 'plan', label: 'Plan' },
                { key: 'status', label: 'Status' },
                { key: 'user_count', label: 'Active Users' },
                { key: 'maxSeats', label: 'Max Seats' },
                { key: 'createdAt', label: 'Created' },
              ])}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-sm border border-white/10 transition-all"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={loadTenants}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{success}
          </div>
        )}

        {/* ── Section 1: Revenue Overview ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            <>
              {/* MRR */}
              <div className="rounded-2xl p-5 border bg-gradient-to-br from-green-600/20 to-green-800/10 border-green-500/30">
                <DollarSign className="w-5 h-5 text-green-400 mb-2" />
                <div className="text-3xl font-black text-green-400">{formatCurrency(mrr)}</div>
                <div className="text-xs text-slate-400 mt-1">Monthly Recurring Revenue</div>
                <div className="text-xs text-slate-500">Based on active seats x plan price / 12</div>
              </div>

              {/* ARR */}
              <div className="rounded-2xl p-5 border bg-gradient-to-br from-brand-600/20 to-brand-800/10 border-brand-500/30">
                <TrendingUp className="w-5 h-5 text-brand-400 mb-2" />
                <div className="text-3xl font-black text-brand-400">{formatCurrency(arr)}</div>
                <div className="text-xs text-slate-400 mt-1">Annual Recurring Revenue</div>
                <div className="text-xs text-slate-500">{activeTenants.length} active tenants</div>
              </div>

              {/* Total Active Subscriptions */}
              <div className="rounded-2xl p-5 border bg-gradient-to-br from-blue-600/20 to-blue-800/10 border-blue-500/30">
                <Building2 className="w-5 h-5 text-blue-400 mb-2" />
                <div className="text-3xl font-black text-blue-400">{activeTenants.length}</div>
                <div className="text-xs text-slate-400 mt-1">Active Subscriptions</div>
                <div className="text-xs text-slate-500">{tenants.length} total tenants</div>
              </div>

              {/* Plan Distribution */}
              <div className="rounded-2xl p-5 border bg-gradient-to-br from-purple-600/20 to-purple-800/10 border-purple-500/30">
                <BarChart3 className="w-5 h-5 text-purple-400 mb-2" />
                <div className="text-xs text-slate-400 mb-2">Plan Distribution</div>
                <PlanPieChart basic={planDistribution.basic} premium={planDistribution.premium} />
              </div>
            </>
          )}
        </div>

        {/* ── Section 2: Tenant Billing Table ─────────────────────────────────── */}
        <div className="glass overflow-hidden rounded-2xl">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" />
              Tenant Billing
            </h2>

            {/* Search */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:border-brand-500/50 focus:outline-none w-48"
                />
              </div>

              {/* Plan filter */}
              <div className="flex items-center gap-1">
                {(['all', ...PLAN_KEYS] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPlan(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterPlan === p
                        ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                        : 'bg-white/3 text-slate-500 border border-white/8 hover:text-white'
                    }`}
                  >
                    {p === 'all' ? 'All Plans' : getPlan(p).label}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1">
                {['all', 'active', 'suspended', 'inactive'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterStatus === s
                        ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                        : 'bg-white/3 text-slate-500 border border-white/8 hover:text-white'
                    }`}
                  >
                    {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <table className="w-full">
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}
              </tbody>
            </table>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <CreditCard className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No tenants match your filters</p>
              {(filterPlan !== 'all' || filterStatus !== 'all' || searchQuery) && (
                <button
                  onClick={() => { setFilterPlan('all'); setFilterStatus('all'); setSearchQuery('') }}
                  className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        Tenant Name {sortField === 'name' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Plan</th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('seats')}
                      >
                        Seats {sortField === 'seats' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('mrr')}
                      >
                        MRR {sortField === 'mrr' && (sortAsc ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginated.map(t => {
                      const plan = getPlan(t.plan)
                      const PlanIcon = plan.icon
                      const tenantMrr = computeMrr(t.user_count || t.employeeCount || 1, t.plan)
                      const seatPct = Math.min(((t.user_count || 0) / (t.maxSeats || 1)) * 100, 100)

                      return (
                        <tr key={t.tenantId} className="hover:bg-white/3 transition-colors group">
                          {/* Tenant Name */}
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

                          {/* Plan */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${plan.badge}`}>
                              <PlanIcon className="w-3 h-3" />{plan.label}
                            </span>
                          </td>

                          {/* Seats */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${seatPct > 90 ? 'bg-red-500' : seatPct > 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                                  style={{ width: `${seatPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">{t.user_count || 0}/{t.maxSeats || 0}</span>
                            </div>
                          </td>

                          {/* MRR */}
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-white">{formatCurrency(tenantMrr)}</span>
                            <span className="text-xs text-slate-500">/mo</span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[t.status] || STATUS_COLORS.inactive}`}>
                              {t.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => window.open(`/admin/tenants/${t.tenantId}`, '_blank')}
                                className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 text-xs transition-all"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openCreateInvoice(t)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-medium transition-all border border-blue-500/30"
                                title="Create Invoice"
                              >
                                <FileText className="w-3 h-3" /> Invoice
                              </button>
                              <button
                                onClick={() => openChangePlan(t)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 text-xs font-medium transition-all border border-brand-500/30"
                                title="Change Plan"
                              >
                                <Edit3 className="w-3 h-3" /> Plan
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                          page === p
                            ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Section 3: Recent Invoices ──────────────────────────────────────── */}
        <div className="glass overflow-hidden rounded-2xl">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Recent Invoices
            </h2>
            <div className="flex items-center gap-1">
              {(['all', 'draft', 'sent', 'paid'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setInvoiceFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    invoiceFilter === s
                      ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                      : 'bg-white/3 text-slate-500 border border-white/8 hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">No invoices yet</p>
              <p className="text-xs text-slate-600 mt-1">Create an invoice from the tenant billing table above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Invoice ID', 'Tenant', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.invoiceId} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-brand-300">{inv.invoiceId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white">{inv.tenantName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-white">{formatCurrency(inv.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status] || INVOICE_STATUS_COLORS.draft}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400">{formatDate(inv.date)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Invoice Modal ────────────────────────────────────────────── */}
      {invoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setInvoiceModal(null) }}
        >
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Create Invoice
              </h3>
              <button onClick={() => setInvoiceModal(null)} className="text-slate-400 hover:text-white text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tenant info */}
            <div className="mb-4 p-3 bg-white/5 rounded-xl grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500">Tenant</p>
                <p className="text-white font-semibold">{invoiceModal.tenant.name}</p>
              </div>
              <div>
                <p className="text-slate-500">Current Plan</p>
                <p className="text-brand-300 font-semibold">{getPlan(invoiceModal.tenant.plan).label}</p>
              </div>
              <div>
                <p className="text-slate-500">Seats</p>
                <p className="text-white">{invoiceModal.tenant.maxSeats || 1}</p>
              </div>
              <div>
                <p className="text-slate-500">Price/Seat/Year</p>
                <p className="text-white">{formatCurrency(getPlan(invoiceModal.tenant.plan).priceYearly)}</p>
              </div>
            </div>

            {invoiceModal.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />{invoiceModal.error}
              </div>
            )}

            {/* Amount */}
            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-1.5 font-medium">Invoice Amount</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={invoiceModal.amount}
                  onChange={e => setInvoiceModal(prev => prev ? { ...prev, amount: e.target.value } : null)}
                  className="input-field text-sm flex-1"
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-sm text-slate-300 mb-1.5 font-medium">Description</label>
              <textarea
                value={invoiceModal.description}
                onChange={e => setInvoiceModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                rows={2}
                className="input-field text-sm w-full resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setInvoiceModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitInvoice}
                disabled={invoiceModal.saving || !invoiceModal.amount}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {invoiceModal.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {invoiceModal.saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Plan Modal ───────────────────────────────────────────────── */}
      {changePlanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setChangePlanModal(null) }}
        >
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-brand-400" />
                Change Plan
              </h3>
              <button onClick={() => setChangePlanModal(null)} className="text-slate-400 hover:text-white text-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current plan info */}
            <div className="mb-4 p-3 bg-white/5 rounded-xl text-xs">
              <p className="text-slate-500 mb-1">Current Plan for {changePlanModal.tenant.name}</p>
              <p className="text-brand-300 font-semibold text-sm">{getPlan(changePlanModal.tenant.plan).label}</p>
            </div>

            {changePlanModal.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />{changePlanModal.error}
              </div>
            )}

            {/* Plan selection */}
            <div className="mb-5 space-y-2">
              <label className="block text-sm text-slate-300 mb-2 font-medium">Select New Plan</label>
              {PLAN_KEYS.map(key => {
                const plan = PLANS[key]
                const PlanIcon = plan.icon
                const isCurrent = changePlanModal.tenant.plan === key
                const isSelected = changePlanModal.newPlan === key

                return (
                  <button
                    key={key}
                    onClick={() => setChangePlanModal(prev => prev ? { ...prev, newPlan: key } : null)}
                    disabled={isCurrent}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      isSelected && !isCurrent
                        ? 'border-brand-500/50 bg-brand-600/15'
                        : isCurrent
                          ? 'border-white/5 bg-white/3 opacity-50 cursor-not-allowed'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${plan.badge}`}>
                        <PlanIcon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">
                          {plan.label}
                          {isCurrent && <span className="text-yellow-400 text-xs ml-2">(current)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{plan.sessions} sessions per employee</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCurrency(plan.priceYearly)}/yr</p>
                      <p className="text-xs text-slate-500">per employee</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Change summary */}
            {changePlanModal.newPlan !== changePlanModal.tenant.plan && (
              <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl text-xs text-brand-300">
                Changing: <strong>{getPlan(changePlanModal.tenant.plan).label}</strong> →{' '}
                <strong>{getPlan(changePlanModal.newPlan).label}</strong>
                {' '}({formatCurrency(getPlan(changePlanModal.newPlan).priceYearly)}/yr per employee)
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setChangePlanModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitChangePlan}
                disabled={changePlanModal.saving || changePlanModal.newPlan === changePlanModal.tenant.plan}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {changePlanModal.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {changePlanModal.saving ? 'Saving...' : 'Change Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
