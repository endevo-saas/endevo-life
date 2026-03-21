'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, Users, Award, Activity, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface DashboardData {
  total_tenants: number
  active_tenants: number
  total_users: number
  active_users: number
  total_certificates: number
  system_status: string
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.adminDashboard() as DashboardData
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="glass p-6 flex items-center gap-4 border border-red-500/30">
        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
        <div>
          <div className="text-white font-medium">Failed to load dashboard</div>
          <div className="text-sm text-slate-400 mt-1">{error}</div>
        </div>
        <button onClick={load} className="ml-auto btn-primary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  )

  const stats = [
    { icon: Building2, label: 'Total Tenants',       value: data?.total_tenants ?? 0,       sub: `${data?.active_tenants ?? 0} active`, color: 'text-brand-400', href: '/admin/tenants' },
    { icon: Users,     label: 'Total Users',          value: data?.total_users ?? 0,         sub: `${data?.active_users ?? 0} active`,  color: 'text-green-400', href: '/admin/users' },
    { icon: Award,     label: 'Certificates Issued',  value: data?.total_certificates ?? 0,  sub: 'across all tenants',                  color: 'text-yellow-400', href: '/admin/users' },
    { icon: Activity,  label: 'System Status',        value: data?.system_status === 'healthy' ? '✓ Healthy' : '✗ Issues', sub: 'all services operational', color: data?.system_status === 'healthy' ? 'text-emerald-400' : 'text-red-400', href: '/admin/health' },
  ]

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Global Admin Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">System-wide management &amp; monitoring</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <Link key={s.label} href={s.href} className="glass p-6 animate-slide-up hover:-translate-y-1 transition-transform block">
              <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-sm font-medium text-slate-300 mt-1">{s.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="glass p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/tenants" className="btn-primary text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Manage Tenants
            </Link>
            <Link href="/admin/users" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
              <Users className="w-4 h-4" /> View All Users
            </Link>
            <Link href="/admin/audit" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
              <Activity className="w-4 h-4" /> Audit Log
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
