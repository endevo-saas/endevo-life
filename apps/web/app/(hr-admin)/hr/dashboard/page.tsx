'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import {
  Users, UserCheck, Clock, TrendingUp, Loader2, RefreshCw,
  UserPlus, Activity, Award, Target, Sparkles, ArrowUpRight,
  BookOpen, CreditCard, FileText, Settings
} from 'lucide-react'
import { api, User } from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'

interface HrDashData {
  total_users: number
  active_users: number
  pending_invites: number
  total_employees: number
}

function PulseRing({ color = 'green' }: { color?: string }) {
  const c: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-yellow-500', brand: 'bg-brand-500' }
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c[color]} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${c[color]}`} />
    </span>
  )
}

export default function HrDashboard() {
  const [data, setData] = useState<HrDashData | null>(null)
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const name = Cookies.get('user_email')?.split('@')[0] || 'HR Admin'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [dash, emp] = await Promise.all([
        api.hrDashboard() as Promise<HrDashData>,
        api.hrEmployees(),
      ])
      setData(dash)
      setEmployees(emp.employees || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const activeRate = data ? Math.round((data.active_users / Math.max(data.total_users, 1)) * 100) : 0
  const recent = employees.slice(0, 5)

  return (
    <div className="min-h-screen p-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-600/6 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PulseRing color="green" />
              <span className="text-xs text-slate-500">Team portal live</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Team Command <span className="text-green-400">⚡</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Welcome, <span className="text-white font-medium capitalize">{name}</span> · Manage your team
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            {error}
            <button onClick={load} className="ml-auto text-red-300 hover:text-white font-medium">Retry</button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Users, label: 'Total Team', value: loading ? '—' : (data?.total_users ?? 0),
              sub: 'registered members', color: 'text-blue-400',
              gradient: 'bg-gradient-to-br from-blue-600/20 to-blue-800/10 border-blue-500/30',
              href: '/hr/employees'
            },
            {
              icon: UserCheck, label: 'Active Now', value: loading ? '—' : (data?.active_users ?? 0),
              sub: `${activeRate}% activation rate`, color: 'text-green-400',
              gradient: 'bg-gradient-to-br from-green-600/20 to-green-800/10 border-green-500/30',
              href: '/hr/employees'
            },
            {
              icon: Clock, label: 'Pending Invites', value: loading ? '—' : (data?.pending_invites ?? 0),
              sub: 'awaiting acceptance', color: 'text-yellow-400',
              gradient: 'bg-gradient-to-br from-yellow-600/20 to-yellow-800/10 border-yellow-500/30',
              href: '/hr/invite'
            },
            {
              icon: TrendingUp, label: 'Employees', value: loading ? '—' : (data?.total_employees ?? 0),
              sub: 'in your organisation', color: 'text-purple-400',
              gradient: 'bg-gradient-to-br from-purple-600/20 to-purple-800/10 border-purple-500/30',
              href: '/hr/employees'
            },
          ].map(s => {
            const Icon = s.icon
            return (
              <Link key={s.label} href={s.href}
                className={`group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${s.gradient}`}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/3" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 border border-white/10 mb-4">
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="text-3xl font-black text-white tracking-tight mb-1">{s.value}</div>
                  <div className="text-sm font-semibold text-white/80 mb-0.5">{s.label}</div>
                  <div className="text-xs text-white/50">{s.sub}</div>
                </div>
                <ArrowUpRight className="absolute bottom-4 right-4 w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
              </Link>
            )
          })}
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Team health */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-5">
              <Target className="w-4 h-4 text-green-400" /> Team Health
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Activation Rate', value: activeRate, color: 'bg-green-500' },
                { label: 'Engagement',      value: loading ? 0 : Math.min(activeRate + 10, 100), color: 'bg-blue-500' },
                { label: 'Invite Fill Rate',value: loading || !data ? 0 : Math.round(((data.total_users - data.pending_invites) / Math.max(data.total_users, 1)) * 100), color: 'bg-purple-500' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400">{m.label}</span>
                    <span className="text-white font-semibold">{loading ? '—' : `${m.value}%`}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full transition-all duration-700`}
                      style={{ width: loading ? '0%' : `${m.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent employees */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/3 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-400" /> Recent Team Members
              </h2>
              <Link href="/hr/employees" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-white/3 rounded-xl animate-pulse" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No team members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((emp, i) => (
                  <div key={emp.userId} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-brand-500/20 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                        {(emp.firstName?.[0] || emp.email?.[0] || '?').toUpperCase()}
                      </div>
                      {i < 3 && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-slate-900" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-slate-500 truncate">{emp.jobTitle || emp.department || emp.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${
                      emp.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>{emp.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-green-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/hr/employees',    icon: Users,      label: 'All Employees',     color: 'hover:border-blue-500/50 hover:bg-blue-600/10',    iconColor: 'text-blue-400' },
              { href: '/hr/invite',       icon: UserPlus,   label: 'Invite Employee',   color: 'hover:border-green-500/50 hover:bg-green-600/10',   iconColor: 'text-green-400' },
              { href: '/hr/training',     icon: BookOpen,   label: 'Training',          color: 'hover:border-brand-500/50 hover:bg-brand-600/10',   iconColor: 'text-brand-300' },
              { href: '/hr/certificates', icon: Award,      label: 'Certificates',      color: 'hover:border-purple-500/50 hover:bg-purple-600/10', iconColor: 'text-purple-400' },
              { href: '/hr/subscription', icon: CreditCard, label: 'Subscription',      color: 'hover:border-orange-500/50 hover:bg-orange-600/10', iconColor: 'text-orange-400' },
              { href: '/hr/audit',        icon: FileText,   label: 'Audit Log',         color: 'hover:border-yellow-500/50 hover:bg-yellow-600/10', iconColor: 'text-yellow-400' },
              { href: '/hr/settings',     icon: Settings,   label: 'Settings',          color: 'hover:border-slate-500/50 hover:bg-slate-600/10',   iconColor: 'text-slate-400' },
            ].map(a => {
              const Icon = a.icon
              return (
                <Link key={a.href} href={a.href}
                  className={`group flex flex-col items-center gap-2 p-4 rounded-xl border border-white/8 bg-white/3 transition-all duration-200 hover:-translate-y-0.5 ${a.color}`}>
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className={`w-5 h-5 ${a.iconColor}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors text-center">{a.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600 pb-2">
          <span>Endevo Life · HR Admin Portal</span>
          <span className="flex items-center gap-1.5"><PulseRing color="green" /> Tenant-scoped · Secure</span>
        </div>
      </div>
    </div>
  )
}
