'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Building2, Users, Award, Activity, RefreshCw,
  TrendingUp, Shield, Globe, CreditCard, ArrowUpRight,
  CheckCircle, AlertTriangle, Sparkles, BookOpen, ClipboardList,
  Clock
} from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'

interface DashboardData {
  total_tenants: number
  active_tenants: number
  total_users: number
  active_users: number
  total_certificates: number
  system_status: string
  lms_assessments_taken?: number
  lms_modules_completed?: number
  lms_certificates_issued?: number
  subscription_basic?: number
  subscription_premium?: number
  recent_audit?: AuditEntry[]
}

interface AuditEntry {
  action: string
  email?: string
  timestamp: string
  ip?: string
}

function PulseRing({ color = 'brand' }: { color?: string }) {
  const c: Record<string, string> = {
    brand:  'bg-brand-500',
    green:  'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    red:    'bg-red-500',
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c[color]} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${c[color]}`} />
    </span>
  )
}

function StatCard({
  icon: Icon, label, value, sub, color, href, gradient
}: {
  icon: React.ElementType; label: string; value: string | number; sub: string
  color: string; href: string; gradient: string
}) {
  return (
    <Link href={href} className={`group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${gradient}`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/3" />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 border border-white/10">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        <div className="text-3xl font-black text-white tracking-tight mb-1">{value}</div>
        <div className="text-sm font-semibold text-white/80 mb-0.5">{label}</div>
        <div className="text-xs text-white/50">{sub}</div>
      </div>
      <ArrowUpRight className="absolute bottom-4 right-4 w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 border border-white/5 bg-white/3 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-white/5 mb-4" />
      <div className="h-8 w-16 bg-white/5 rounded mb-2" />
      <div className="h-3 w-24 bg-white/5 rounded mb-1" />
      <div className="h-3 w-16 bg-white/3 rounded" />
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const name = Cookies.get('user_email')?.split('@')[0] || 'Admin'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.adminDashboard() as DashboardData
      setData(d)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const healthy = data?.system_status === 'healthy'
  const activePct = data ? Math.round((data.active_tenants / Math.max(data.total_tenants, 1)) * 100) : 0

  return (
    <div className="min-h-screen p-6">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PulseRing color={healthy ? 'green' : 'red'} />
              <span className="text-xs text-slate-500 font-medium">
                {healthy ? 'All systems operational' : 'System issues detected'}
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Global Admin Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Welcome back, <span className="text-white font-medium capitalize">{name}</span> · Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
            <button onClick={load} className="ml-auto text-red-300 hover:text-white font-medium">Retry</button>
          </div>
        )}

        {/* Row 1: Primary KPIs (4 cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [1,2,3,4].map(i => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                icon={Building2} label="Total Tenants" value={data?.total_tenants ?? 0}
                sub={`${data?.active_tenants ?? 0} active · ${activePct}% active rate`}
                color="text-brand-400" href="/admin/tenants"
                gradient="bg-gradient-to-br from-brand-600/20 to-brand-800/10 border-brand-500/30"
              />
              <StatCard
                icon={Users} label="Total Users" value={data?.total_users ?? 0}
                sub={`${data?.active_users ?? 0} active accounts`}
                color="text-green-400" href="/admin/users"
                gradient="bg-gradient-to-br from-green-600/20 to-green-800/10 border-green-500/30"
              />
              <StatCard
                icon={Activity}
                label="Active Users"
                value={data?.active_users ?? 0}
                sub={`${data ? Math.round((data.active_users / Math.max(data.total_users, 1)) * 100) : 0}% of total users`}
                color="text-cyan-400"
                href="/admin/users"
                gradient="bg-gradient-to-br from-cyan-600/20 to-cyan-800/10 border-cyan-500/30"
              />
              <StatCard
                icon={Award} label="Total Certificates" value={data?.total_certificates ?? 0}
                sub="Issued across all tenants"
                color="text-yellow-400" href="/admin/certificates"
                gradient="bg-gradient-to-br from-yellow-600/20 to-yellow-800/10 border-yellow-500/30"
              />
            </>
          )}
        </div>

        {/* Row 2: LMS + Subscriptions (4 cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [1,2,3,4].map(i => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                icon={BookOpen}
                label="LMS Modules"
                value={6}
                sub="15 lessons in Module 1"
                color="text-teal-400"
                href="/admin/lms/modules"
                gradient="bg-gradient-to-br from-teal-600/20 to-teal-800/10 border-teal-500/30"
              />
              <StatCard
                icon={ClipboardList}
                label="Assessments Taken"
                value={data?.lms_assessments_taken ?? 0}
                sub="Readiness diagnostics completed"
                color="text-indigo-400"
                href="/admin/lms/progress"
                gradient="bg-gradient-to-br from-indigo-600/20 to-indigo-800/10 border-indigo-500/30"
              />
              <StatCard
                icon={CreditCard}
                label="Basic Plans"
                value={data?.subscription_basic ?? 0}
                sub="Active basic subscriptions"
                color="text-purple-400"
                href="/admin/subscriptions"
                gradient="bg-gradient-to-br from-purple-600/20 to-purple-800/10 border-purple-500/30"
              />
              <StatCard
                icon={CreditCard}
                label="Premium Plans"
                value={data?.subscription_premium ?? 0}
                sub="Active premium subscriptions"
                color="text-amber-400"
                href="/admin/subscriptions"
                gradient="bg-gradient-to-br from-amber-600/20 to-amber-800/10 border-amber-500/30"
              />
            </>
          )}
        </div>

        {/* Middle row: Platform Overview + System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Platform Overview */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/3 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-brand-400" /> Platform Overview
              </h2>
              <span className="text-xs text-slate-500">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Tenant Activation Rate', value: activePct, color: 'bg-brand-500' },
                { label: 'User Activity Rate', value: data ? Math.round((data.active_users / Math.max(data.total_users, 1)) * 100) : 0, color: 'bg-green-500' },
                { label: 'Certificate Rate', value: data ? Math.min(Math.round((data.total_certificates / Math.max(data.total_users, 1)) * 100), 100) : 0, color: 'bg-yellow-500' },
                { label: 'System Uptime', value: healthy ? 100 : 85, color: healthy ? 'bg-emerald-500' : 'bg-red-500' },
              ].map(m => (
                <div key={m.label} className="bg-white/3 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">{m.label}</span>
                    <span className="text-sm font-bold text-white">{loading ? '---' : `${m.value}%`}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${m.color} rounded-full transition-all duration-700`}
                      style={{ width: loading ? '0%' : `${m.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-yellow-400" /> Recent Activity
            </h2>
            <div className="space-y-2">
              {data?.recent_audit && data.recent_audit.length > 0 ? (
                data.recent_audit.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                    <Activity className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{entry.action}</p>
                      <p className="text-xs text-slate-500">
                        {entry.email && <span>{entry.email} · </span>}
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                      <Activity className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-3 w-3/4 bg-white/5 rounded" />
                        <div className="h-2 w-1/2 bg-white/3 rounded mt-1.5" />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-600 text-center pt-1">
                    <Link href="/admin/audit" className="hover:text-white transition-colors">
                      View full audit log
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-brand-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { href: '/admin/tenants',       icon: Building2,  label: 'Tenants',       color: 'hover:border-brand-500/50 hover:bg-brand-600/10',   iconColor: 'text-brand-400' },
              { href: '/admin/users',         icon: Users,      label: 'Users',         color: 'hover:border-green-500/50 hover:bg-green-600/10',    iconColor: 'text-green-400' },
              { href: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions', color: 'hover:border-purple-500/50 hover:bg-purple-600/10',  iconColor: 'text-purple-400' },
              { href: '/admin/audit',         icon: Activity,   label: 'Audit Log',     color: 'hover:border-yellow-500/50 hover:bg-yellow-600/10',  iconColor: 'text-yellow-400' },
              { href: '/admin/health',        icon: CheckCircle,label: 'Health',        color: 'hover:border-emerald-500/50 hover:bg-emerald-600/10',iconColor: 'text-emerald-400' },
              { href: '/admin/settings',      icon: Shield,     label: 'Settings',      color: 'hover:border-slate-500/50 hover:bg-slate-600/10',    iconColor: 'text-slate-400' },
            ].map(a => {
              const Icon = a.icon
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`group flex flex-col items-center gap-2 p-4 rounded-xl border border-white/8 bg-white/3 transition-all duration-200 hover:-translate-y-0.5 ${a.color}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className={`w-5 h-5 ${a.iconColor}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">{a.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* LMS Management quick links */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">LMS Management</h2>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/admin/lms/modules" className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors">
              <BookOpen className="w-5 h-5 text-teal-400" />
              <div>
                <p className="text-sm font-semibold text-white">Manage Modules</p>
                <p className="text-xs text-slate-500">6 modules, edit content &amp; settings</p>
              </div>
            </Link>
            <Link href="/admin/lms/questions" className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors">
              <ClipboardList className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-white">Assessment Questions</p>
                <p className="text-xs text-slate-500">40 questions across 4 domains</p>
              </div>
            </Link>
            <Link href="/admin/lms/progress" className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm font-semibold text-white">User Progress</p>
                <p className="text-xs text-slate-500">Scorecard &amp; module completion</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Footer status */}
        <div className="flex items-center justify-between text-xs text-slate-600 pb-2">
          <span>Global Admin · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="flex items-center gap-1.5">
            <PulseRing color="green" />
            AWS us-east-1 · Cognito · DynamoDB · Lambda · Amplify
          </span>
        </div>
      </div>
    </div>
  )
}
