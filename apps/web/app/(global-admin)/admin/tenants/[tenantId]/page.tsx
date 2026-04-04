'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, Users, Award, Activity, Loader2, RefreshCw,
  ChevronLeft, Shield, UserCheck, Clock, CheckCircle,
  AlertTriangle, Mail, Briefcase, TrendingUp, BarChart3,
  Lock, Unlock, Trash2, KeyRound, ArrowUpRight, Crown
} from 'lucide-react'
import { api, TenantDetail, User } from '@/lib/api'

const PLAN_BADGE: Record<string, string> = {
  basic:           'bg-brand-500/10 text-brand-300 border-brand-500/20',
  premium:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-500/10 text-green-400',
  pending:  'bg-yellow-500/10 text-yellow-400',
  locked:   'bg-red-500/10 text-red-400',
  inactive: 'bg-slate-500/10 text-slate-400',
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className={`rounded-2xl p-5 border bg-gradient-to-br ${bg}`}>
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  )
}

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const router = useRouter()
  const [data, setData]         = useState<TenantDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [tab, setTab]           = useState<'overview' | 'hr' | 'employees' | 'training'>('overview')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.adminGetTenant(tenantId)
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenant')
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function showSuccess(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  async function lockUser(u: User) {
    try {
      await api.adminLockUser(u.userId)
      showSuccess(`${u.email} locked`)
      load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Lock failed') }
  }

  async function unlockUser(u: User) {
    try {
      await api.adminUnlockUser(u.userId)
      showSuccess(`${u.email} unlocked`)
      load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Unlock failed') }
  }

  async function resetPw(u: User) {
    try {
      const r = await api.adminResetPassword(u.userId)
      showSuccess(`Password reset: ${r.temporary_password}`)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Reset failed') }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-brand-400" />
    </div>
  )

  if (error && !data) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass p-8 rounded-2xl text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-white font-semibold mb-2">Failed to load tenant</p>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button onClick={() => router.push('/admin/tenants')} className="btn-primary text-sm">Back to Tenants</button>
      </div>
    </div>
  )

  if (!data) return null

  const activeUsers = data.employees.filter(u => u.status === 'active').length
  const pendingUsers = [...data.employees, ...data.hr_admins].filter(u => u.status === 'pending').length

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb + Header */}
        <div>
          <button onClick={() => router.push('/admin/tenants')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Tenants
          </button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-2xl font-black text-brand-300">
                {(data.name?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{data.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500 font-mono">{data.tenantId}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${PLAN_BADGE[data.plan] || PLAN_BADGE.basic}`}>
                    {data.plan}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLOR[data.status] || STATUS_COLOR.inactive}`}>
                    {data.status}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {error   && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {success}</div>}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users}     label="Total Users"    value={data.stats.total_users}  color="text-brand-400"  bg="from-brand-600/20 to-brand-800/10 border-brand-500/30" />
          <StatCard icon={UserCheck} label="Active Users"   value={data.stats.active_users}  color="text-green-400"  bg="from-green-600/20 to-green-800/10 border-green-500/30" />
          <StatCard icon={Shield}    label="HR Admins"      value={data.stats.hr_admins}     color="text-purple-400" bg="from-purple-600/20 to-purple-800/10 border-purple-500/30" />
          <StatCard icon={Users}     label="Employees"      value={data.stats.employees}     color="text-yellow-400" bg="from-yellow-600/20 to-yellow-800/10 border-yellow-500/30" />
        </div>

        {/* Seat usage */}
        <div className="glass p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Seat Utilization</p>
            <p className="text-sm text-slate-400">{data.stats.total_users} / {data.maxSeats} seats</p>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            {(() => {
              const pct = Math.min((data.stats.total_users / Math.max(data.maxSeats, 1)) * 100, 100)
              return (
                <div className={`h-full rounded-full transition-all duration-700 ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                  style={{ width: `${pct}%` }} />
              )
            })()}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{Math.round((data.stats.total_users / Math.max(data.maxSeats, 1)) * 100)}% used</span>
            <span>{data.maxSeats - data.stats.total_users} seats remaining</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/3 rounded-xl p-1 w-fit border border-white/5">
          {[
            { key: 'overview',   label: 'Overview',   icon: BarChart3 },
            { key: 'hr',         label: 'HR Admins',  icon: Shield },
            { key: 'employees',  label: 'Employees',  icon: Users },
            { key: 'training',   label: 'Training',   icon: Award },
          ].map(t => {
            const Icon = t.icon
            return (
              <button key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30' : 'text-slate-400 hover:text-white'
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            )
          })}
        </div>

        {/* ── Overview Tab ───────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-400" /> Tenant Details
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Tenant ID',   value: data.tenantId,  mono: true },
                  { label: 'Plan',        value: data.plan },
                  { label: 'Status',      value: data.status },
                  { label: 'Max Seats',   value: String(data.maxSeats) },
                  { label: 'Created',     value: data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={`text-white ${row.mono ? 'font-mono text-xs' : ''}`}>{row.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" /> Engagement
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Active Rate',   value: data.stats.total_users > 0 ? `${Math.round((data.stats.active_users / data.stats.total_users) * 100)}%` : '—', color: 'text-green-400' },
                  { label: 'HR Coverage',   value: data.stats.hr_admins > 0 ? `${data.stats.hr_admins} admin(s)` : 'None assigned', color: 'text-purple-400' },
                  { label: 'Pending Users', value: String(pendingUsers), color: pendingUsers > 0 ? 'text-yellow-400' : 'text-slate-400' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-500 text-sm">{row.label}</span>
                    <span className={`font-bold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HR Admins Tab ──────────────────────────────────────────────────── */}
        {tab === 'hr' && (
          <UserTable
            users={data.hr_admins}
            title="HR Administrators"
            emptyMsg="No HR admins assigned to this tenant"
            onLock={lockUser}
            onUnlock={unlockUser}
            onResetPw={resetPw}
            badge="text-purple-400 bg-purple-500/10"
          />
        )}

        {/* ── Employees Tab ──────────────────────────────────────────────────── */}
        {tab === 'employees' && (
          <UserTable
            users={data.employees}
            title="Employees"
            emptyMsg="No employees in this tenant yet"
            onLock={lockUser}
            onUnlock={unlockUser}
            onResetPw={resetPw}
            badge="text-green-400 bg-green-500/10"
          />
        )}

        {/* ── Training Tab ───────────────────────────────────────────────────── */}
        {tab === 'training' && (
          <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center text-center">
            <Award className="w-12 h-12 text-yellow-400 mb-3 opacity-60" />
            <p className="text-white font-semibold mb-1">Training data scoped to HR Admin view</p>
            <p className="text-slate-500 text-sm">Course enrollment and completion data is managed per-tenant by HR Admins.</p>
            <p className="text-slate-500 text-sm mt-1">Phase 2 LMS integration will surface this data here.</p>
          </div>
        )}

      </div>
    </div>
  )
}

function UserTable({ users, title, emptyMsg, onLock, onUnlock, onResetPw, badge }: {
  users: User[]
  title: string
  emptyMsg: string
  onLock: (u: User) => void
  onUnlock: (u: User) => void
  onResetPw: (u: User) => void
  badge: string
}) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-500">{users.length} total</span>
      </div>
      {users.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{emptyMsg}</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Status', 'Department', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(u => (
              <tr key={u.userId} className="hover:bg-white/3 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${badge}`}>
                      {(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                    u.status === 'active' ? 'bg-green-500/10 text-green-400' :
                    u.status === 'locked' ? 'bg-red-500/10 text-red-400' :
                    u.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.department || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {u.status === 'locked' ? (
                      <button onClick={() => onUnlock(u)} title="Unlock" className="p-1.5 rounded-lg text-slate-400 hover:text-green-400 hover:bg-green-500/10 transition-all">
                        <Unlock className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => onLock(u)} title="Lock" className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all">
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => onResetPw(u)} title="Reset Password" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
