'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, RefreshCw, Loader2,
  AlertCircle, BarChart3, Building2, Server, Zap, Database,
  Cloud
} from 'lucide-react'
import { api } from '@/lib/api'
import type { FinOpsCosts, FinOpsMargins, TenantMargin } from '@/lib/api'

export default function FinOpsPage() {
  const [costs, setCosts] = useState<FinOpsCosts | null>(null)
  const [margins, setMargins] = useState<FinOpsMargins | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily')
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, m] = await Promise.all([
        api.adminFinopsCosts(period, days),
        api.adminFinopsMargins(),
      ])
      setCosts(c)
      setMargins(m)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load FinOps data')
    } finally { setLoading(false) }
  }, [period, days])

  useEffect(() => { load() }, [load])

  const grossMargin = costs && margins
    ? Math.round(((margins.total_mrr - costs.monthly_estimate) / Math.max(margins.total_mrr, 1)) * 100)
    : 0

  return (
    <div className="p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6" style={{ color: 'var(--accent-1)' }} />
              FinOps Control Tower
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              AWS cost tracking &middot; Per-tenant margins &middot; Real-time unit economics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
              {(['daily', 'monthly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 text-xs font-medium transition-all capitalize"
                  style={{
                    background: period === p ? 'var(--accent-1)' : 'var(--bg-elevated)',
                    color: period === p ? 'white' : 'var(--text-muted)',
                  }}>
                  {p}
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all disabled:opacity-50"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-sm flex items-center gap-2"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--danger)' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Top KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="h-8 w-20 rounded" style={{ background: 'var(--bg-elevated)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* AWS Monthly Cost */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.15)' }}>
                  <Cloud className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>AWS Monthly Est.</span>
              </div>
              <div className="text-2xl font-black text-white">${costs?.monthly_estimate?.toLocaleString() ?? '0'}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>${costs?.daily_average ?? 0}/day avg</div>
            </div>

            {/* MRR */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <TrendingUp className="w-4 h-4" style={{ color: 'var(--success)' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>MRR (Revenue)</span>
              </div>
              <div className="text-2xl font-black text-white">${margins?.total_mrr?.toLocaleString() ?? '0'}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>ARR: ${margins?.total_arr?.toLocaleString() ?? '0'}</div>
            </div>

            {/* Gross Margin */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: grossMargin >= 70 ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)' }}>
                  <BarChart3 className="w-4 h-4" style={{ color: grossMargin >= 70 ? 'var(--success)' : 'var(--gold)' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Gross Margin</span>
              </div>
              <div className="text-2xl font-black" style={{ color: grossMargin >= 70 ? 'var(--success)' : 'var(--gold)' }}>
                {grossMargin}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Target: &gt;80% for SaaS
              </div>
            </div>

            {/* Tenants */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(94,106,210,0.15)' }}>
                  <Building2 className="w-4 h-4" style={{ color: 'var(--accent-2)' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Active Tenants</span>
              </div>
              <div className="text-2xl font-black text-white">{margins?.tenant_count ?? 0}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Paying customers</div>
            </div>
          </div>
        )}

        {/* Cost Breakdown + Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* AWS Cost by Service */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Server className="w-4 h-4" style={{ color: 'var(--accent-1)' }} />
              AWS Cost by Service
            </h2>
            {costs?.services?.length ? (
              <div className="space-y-2">
                {costs.services.slice(0, 10).map((s, i) => {
                  const pct = costs.grand_total > 0 ? Math.round((s.cost / costs.grand_total) * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                            {s.service.replace('Amazon ', '').replace('AWS ', '')}
                          </span>
                          <span className="text-xs font-bold text-white">${s.cost.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: 'var(--accent-1)' }} />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono w-10 text-right" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {costs?.error || 'No cost data available. Enable Cost Allocation Tags on AWS.'}
              </p>
            )}
          </div>

          {/* Cost Timeline */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" style={{ color: 'var(--gold)' }} />
              Cost Timeline ({period})
            </h2>
            {costs?.timeline?.length ? (
              <div className="space-y-1">
                {costs.timeline.slice(-14).map((t, i) => {
                  const maxCost = Math.max(...costs.timeline.map(x => x.cost), 1)
                  const pct = Math.round((t.cost / maxCost) * 100)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-20 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {t.date.slice(5)}
                      </span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: `var(--accent-1)`, opacity: 0.7 + (pct / 300) }} />
                      </div>
                      <span className="text-[10px] font-mono w-14 text-right" style={{ color: 'var(--text-secondary)' }}>
                        ${t.cost.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No timeline data yet</p>
            )}
          </div>
        </div>

        {/* Per-Tenant Revenue Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4" style={{ color: 'var(--accent-2)' }} />
              Per-Tenant Revenue
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {margins?.tenant_count ?? 0} tenants
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Tenant', 'Plan', 'Seats', 'MRR', 'ARR'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {margins?.tenants?.length ? margins.tenants.slice(0, 20).map((t: TenantMargin) => (
                  <tr key={t.tenantId} className="transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-6 py-3">
                      <div className="text-sm font-medium text-white">{t.tenantName || t.tenantId}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.tenantId}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: t.plan === 'premium' ? 'rgba(255,140,0,0.15)' : 'rgba(94,106,210,0.15)',
                          color: t.plan === 'premium' ? 'var(--gold)' : 'var(--accent-2)',
                        }}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{t.seats}</td>
                    <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--success)' }}>
                      ${t.monthly_revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-white">
                      ${t.annual_revenue.toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No tenant revenue data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
