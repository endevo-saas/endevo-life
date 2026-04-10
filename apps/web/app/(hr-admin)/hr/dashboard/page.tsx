'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Users, UserPlus, RefreshCw, Calendar,
  ArrowUpRight, TrendingUp, CheckCircle2, Zap
} from 'lucide-react'
import { apiFetch, User } from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HrMetrics {
  activationRate: number
  completionRate: number
  overallProgress: number
  totalUsers: number
  activeUsers: number
  pendingUsers: number
}

interface HrSubscription {
  tenantId: string
  plan: string
  seats: number
  usedSeats: number
  pricePerEmployee: number
  sessionsPerEmployee: number
  totalSessions: number
  usedSessions: number
  billingHistory: unknown[]
}

interface RecentUser {
  userId: string
  firstName: string
  lastName: string
  email: string
  status: string
  lastActive?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getColorClass(value: number): string {
  if (value > 70) return 'text-green-400'
  if (value >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function getRingColor(value: number): string {
  if (value > 70) return 'stroke-green-400'
  if (value >= 40) return 'stroke-yellow-400'
  return 'stroke-red-400'
}

function getBgGradient(value: number): string {
  if (value > 70) return 'from-green-600/20 to-green-800/10 border-green-500/20'
  if (value >= 40) return 'from-yellow-600/20 to-yellow-800/10 border-yellow-500/20'
  return 'from-red-600/20 to-red-800/10 border-red-500/20'
}

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (target === 0) {
      setCurrent(0)
      return
    }
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return <>{current}</>
}

// ─── Progress Ring ───────────────────────────────────────────────────────────

function ProgressRing({ value, size = 88, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={`${getRingColor(value)} transition-all duration-1000 ease-out`}
      />
    </svg>
  )
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="h-10 w-20 bg-white/10 rounded" />
          <div className="h-3 w-40 bg-white/5 rounded" />
        </div>
        <div className="w-[88px] h-[88px] rounded-full bg-white/5" />
      </div>
    </div>
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string
  value: number
  subtitle: string
  icon: React.ElementType
}

function MetricCard({ title, value, subtitle, icon: Icon }: MetricCardProps) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${getBgGradient(value)}`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/[0.02]" />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 border border-white/10">
              <Icon className={`w-4 h-4 ${getColorClass(value)}`} />
            </div>
            <span className="text-sm font-semibold text-white/70">{title}</span>
          </div>
          <div className={`text-4xl font-black tracking-tight mb-1 ${getColorClass(value)}`}>
            <AnimatedNumber target={value} />%
          </div>
          <p className="text-xs text-white/40 leading-relaxed">{subtitle}</p>
        </div>
        <div className="flex-shrink-0 ml-4">
          <div className="relative">
            <ProgressRing value={value} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${getColorClass(value)}`}>
                <AnimatedNumber target={value} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HrDashboard() {
  const [metrics, setMetrics] = useState<HrMetrics | null>(null)
  const [subscription, setSubscription] = useState<HrSubscription | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState(Cookies.get('tenant_name') || '')

  const firstName = Cookies.get('first_name') || ''
  const displayName = firstName || Cookies.get('user_email')?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || 'HR Admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [metricsData, subData, employeesData] = await Promise.allSettled([
        apiFetch<HrMetrics>('/api/hr/metrics'),
        apiFetch<HrSubscription>('/api/hr/subscription'),
        apiFetch<{ employees: User[] }>('/api/hr/employees'),
      ])

      // Metrics — use API data or compute fallback from employees
      if (metricsData.status === 'fulfilled') {
        setMetrics(metricsData.value)
      } else {
        // Fallback: compute from employee list if metrics endpoint not ready
        // Exclude archived/inactive users from metrics
        const allEmployees = employeesData.status === 'fulfilled'
          ? (employeesData.value.employees || [])
          : []
        const employees = allEmployees.filter((u: User) => u.status !== 'archived')
        const total = employees.length
        const active = employees.filter((u: User) => u.status === 'active').length
        setMetrics({
          activationRate: total > 0 ? Math.round((active / total) * 100) : 0,
          completionRate: 0,
          overallProgress: 0,
          totalUsers: total,
          activeUsers: active,
          pendingUsers: employees.filter((u: User) => u.status === 'pending' || u.status === 'invited').length,
        })
      }

      // Subscription — optional, gracefully handle if not available
      if (subData.status === 'fulfilled') {
        setSubscription(subData.value)
      }

      // Recent users — last 10 non-archived from employee list
      if (employeesData.status === 'fulfilled') {
        const emps = employeesData.value.employees || []
        const sorted = [...emps]
          .filter(u => u.status !== 'archived')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
        setRecentUsers(sorted.map(u => ({
          userId: u.userId,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          status: u.status,
        })))
      }

      // Tenant name resolution
      if (!tenantName) {
        try {
          const tenant = await apiFetch<{ name?: string }>('/api/hr/tenant')
          if (tenant.name) {
            setTenantName(tenant.name)
            Cookies.set('tenant_name', tenant.name, { expires: 1, sameSite: 'strict' })
          }
        } catch {
          // Non-critical — tenant name is cosmetic
        }
      }

      // Show error if ALL three API calls failed
      if (metricsData.status === 'rejected' && subData.status === 'rejected' && employeesData.status === 'rejected') {
        setError('Unable to load dashboard data. Please check your connection and try again.')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen p-4 sm:p-6">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-600/6 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {tenantName || 'Company'} Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Welcome back, <span className="text-white font-medium capitalize">{displayName}</span>
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50 self-start"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            <span className="flex-1">{error}</span>
            <button onClick={load} className="text-red-300 hover:text-white font-medium whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        {/* ── 3 Metric Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <MetricCard
                title="Activation Rate"
                value={metrics?.activationRate ?? 0}
                subtitle={`${metrics?.activeUsers ?? 0} of ${metrics?.totalUsers ?? 0} invited users activated`}
                icon={Zap}
              />
              <MetricCard
                title="Module Completion"
                value={metrics?.completionRate ?? 0}
                subtitle={`Active users who completed at least 1 module`}
                icon={CheckCircle2}
              />
              <MetricCard
                title="Overall User Progress"
                value={metrics?.overallProgress ?? 0}
                subtitle="Average progress across all users"
                icon={TrendingUp}
              />
            </>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/hr/invite', icon: UserPlus, label: 'Invite User', color: 'hover:border-green-500/50 hover:bg-green-600/10', iconColor: 'text-green-400' },
            { href: '/hr/employees', icon: Users, label: 'View Users', color: 'hover:border-blue-500/50 hover:bg-blue-600/10', iconColor: 'text-blue-400' },
            { href: '/hr/training', icon: Calendar, label: 'View Sessions', color: 'hover:border-purple-500/50 hover:bg-purple-600/10', iconColor: 'text-purple-400' },
          ].map(action => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`group flex items-center gap-3 p-4 rounded-xl border border-white/8 bg-white/3 transition-all duration-200 hover:-translate-y-0.5 ${action.color}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <Icon className={`w-5 h-5 ${action.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">{action.label}</span>
                <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors ml-auto" />
              </Link>
            )
          })}
        </div>

        {/* ── Subscription Summary (if available) ── */}
        {subscription && (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
              <span className="text-slate-400">
                Plan: <span className="text-white font-semibold capitalize">{subscription.plan}</span>
              </span>
              <span className="text-slate-400">
                Seats: <span className="text-white font-semibold">{subscription.usedSeats}/{subscription.seats}</span>
              </span>
              <span className="text-slate-400">
                Sessions: <span className="text-white font-semibold">{subscription.usedSessions}/{subscription.totalSessions}</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Recent User Activity ── */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" />
              Recent Users
            </h2>
            <Link href="/hr/employees" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-white/3 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No users yet. Invite your first user to get started.</p>
              <Link href="/hr/invite" className="inline-flex items-center gap-1.5 mt-3 text-sm text-green-400 hover:text-green-300 transition-colors">
                <UserPlus className="w-4 h-4" /> Invite User
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-white/5">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="pb-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(user => (
                    <tr key={user.userId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-brand-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
                          </div>
                          <span className="text-white font-medium truncate max-w-[150px]">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.email.split('@')[0]}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-500 truncate max-w-[200px] hidden sm:table-cell">
                        {user.email}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : user.status === 'pending' || user.status === 'invited'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between text-xs text-slate-600 pb-2">
          <span>Endevo Life {tenantName ? `· ${tenantName}` : ''}</span>
          <span>HR Dashboard</span>
        </div>
      </div>
    </div>
  )
}
