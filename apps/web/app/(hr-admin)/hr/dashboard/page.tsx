'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Users, UserCheck, Clock, TrendingUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface HrDashData {
  total_users: number
  active_users: number
  pending_invites: number
  total_employees: number
}

export default function HrDashboard() {
  const [data, setData] = useState<HrDashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.hrDashboard() as HrDashData
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
      <Loader2 className="w-8 h-8 animate-spin text-green-400" />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="glass p-6 flex items-center gap-4 border border-red-500/30">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <div className="flex-1">
          <div className="text-white font-medium">Failed to load</div>
          <div className="text-sm text-slate-400">{error}</div>
        </div>
        <button onClick={load} className="btn-primary text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  )

  const stats = [
    { icon: Users,      label: 'Total Users',      value: data?.total_users ?? 0,      color: 'text-blue-400' },
    { icon: UserCheck,  label: 'Active Users',      value: data?.active_users ?? 0,     color: 'text-green-400' },
    { icon: Clock,      label: 'Pending Invites',   value: data?.pending_invites ?? 0,  color: 'text-yellow-400' },
    { icon: TrendingUp, label: 'Total Employees',   value: data?.total_employees ?? 0,  color: 'text-purple-400' },
  ]

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">HR Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your team and training</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className="glass p-6 animate-slide-up">
              <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-sm text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="glass p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/hr/employees" className="btn-primary text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> View Employees
            </Link>
            <Link href="/hr/invite" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
              Invite New Employee
            </Link>
            <Link href="/hr/audit" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
              View Audit Log
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
