'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { PlayCircle, Award, CheckCircle, TrendingUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface EmpDashData {
  total_courses: number
  completed_courses: number
  certificates: number
  progress_pct: number
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<EmpDashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.employeeDashboard() as EmpDashData
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
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
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

  const pct = data?.progress_pct ?? 0

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Continue your digital legacy journey</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="glass p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Overall Progress</span>
            <span className="text-sm font-bold text-purple-400">{pct}%</span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {data?.completed_courses} of {data?.total_courses} courses completed
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass p-5 animate-slide-up">
            <PlayCircle className="w-6 h-6 text-blue-400 mb-3" />
            <div className="text-2xl font-bold text-white">{data?.total_courses ?? 0}</div>
            <div className="text-sm text-slate-400 mt-1">Available Courses</div>
          </div>
          <div className="glass p-5 animate-slide-up">
            <CheckCircle className="w-6 h-6 text-green-400 mb-3" />
            <div className="text-2xl font-bold text-white">{data?.completed_courses ?? 0}</div>
            <div className="text-sm text-slate-400 mt-1">Completed</div>
          </div>
          <div className="glass p-5 animate-slide-up">
            <Award className="w-6 h-6 text-yellow-400 mb-3" />
            <div className="text-2xl font-bold text-white">{data?.certificates ?? 0}</div>
            <div className="text-sm text-slate-400 mt-1">Certificates</div>
          </div>
        </div>

        {/* Quick Nav Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { href: '/employee/training',     icon: PlayCircle,    label: 'Start Training',     sub: 'Browse and complete courses',     color: 'border-blue-500/20 hover:border-blue-500/40' },
            { href: '/employee/assessment',   icon: TrendingUp,    label: 'Take Assessment',    sub: 'Test your knowledge',              color: 'border-purple-500/20 hover:border-purple-500/40' },
            { href: '/employee/certificates', icon: Award,         label: 'My Certificates',    sub: 'View and download certificates',   color: 'border-yellow-500/20 hover:border-yellow-500/40' },
            { href: '/employee/profile',      icon: CheckCircle,   label: 'My Profile',         sub: 'Update your information',          color: 'border-green-500/20 hover:border-green-500/40' },
          ].map(c => (
            <Link
              key={c.href}
              href={c.href}
              className={`glass p-5 border ${c.color} hover:-translate-y-1 transition-all cursor-pointer animate-slide-up`}
            >
              <c.icon className="w-7 h-7 text-white mb-3" />
              <div className="font-semibold text-white">{c.label}</div>
              <div className="text-sm text-slate-400 mt-1">{c.sub}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
