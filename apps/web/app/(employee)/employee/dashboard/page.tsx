'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import {
  PlayCircle, Award, CheckCircle, TrendingUp, Loader2, RefreshCw,
  Star, Flame, Target, Zap, Trophy, ClipboardList, User, Sparkles
} from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'

interface EmpDashData {
  total_courses: number
  completed_courses: number
  certificates: number
  progress_pct: number
}

function XPBar({ pct }: { pct: number }) {
  const level = pct < 20 ? 1 : pct < 40 ? 2 : pct < 60 ? 3 : pct < 80 ? 4 : 5
  const labels = ['', 'Beginner', 'Learner', 'Practitioner', 'Expert', 'Master']
  const next   = Math.min(level * 20, 100)
  const within = pct - (level - 1) * 20
  const pctWithin = Math.min(Math.round((within / 20) * 100), 100)

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-600/15 to-brand-600/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-brand-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <span className="text-xl font-black text-white">{level}</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Current Level</p>
            <p className="text-lg font-black text-white">{labels[level]}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-white">{pct}%</p>
          <p className="text-xs text-slate-400">Overall Progress</p>
        </div>
      </div>

      {/* XP bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Level {level}</span>
          <span>{pctWithin}% to Level {Math.min(level + 1, 5)}</span>
          <span>Level {Math.min(level + 1, 5)}</span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-brand-500 to-cyan-400 transition-all duration-1000 relative"
            style={{ width: `${pctWithin}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </div>
        </div>
      </div>

      {/* Level dots */}
      <div className="flex items-center gap-1 mt-3">
        {[1,2,3,4,5].map(l => (
          <div key={l} className={`flex-1 h-1 rounded-full transition-all ${l <= level ? 'bg-brand-500' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  )
}

function AchievementBadge({ icon: Icon, label, unlocked, color }: { icon: React.ElementType; label: string; unlocked: boolean; color: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
      unlocked
        ? `border-${color}-500/30 bg-${color}-500/10`
        : 'border-white/5 bg-white/3 opacity-40 grayscale'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        unlocked ? `bg-${color}-500/20` : 'bg-white/5'
      }`}>
        <Icon className={`w-5 h-5 ${unlocked ? `text-${color}-400` : 'text-slate-500'}`} />
      </div>
      <span className={`text-xs font-medium text-center ${unlocked ? 'text-white' : 'text-slate-600'}`}>{label}</span>
      {unlocked && <div className={`w-1.5 h-1.5 rounded-full bg-${color}-400`} />}
    </div>
  )
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<EmpDashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const name = Cookies.get('user_email')?.split('@')[0] || 'Learner'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.employeeDashboard() as EmpDashData
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const pct       = data?.progress_pct ?? 0
  const completed = data?.completed_courses ?? 0
  const total     = data?.total_courses ?? 0
  const certs     = data?.certificates ?? 0

  return (
    <div className="min-h-screen p-6">
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-purple-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Hey, <span className="capitalize text-purple-400">{name}</span> <span className="animate-pulse">👋</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Your digital legacy journey continues</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
            {error} <button onClick={load} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* XP / Level bar */}
        {loading ? (
          <div className="h-36 rounded-2xl bg-white/3 border border-white/5 animate-pulse" />
        ) : (
          <XPBar pct={pct} />
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: PlayCircle, label: 'Courses', value: total, sub: 'available to you',
              color: 'text-blue-400', gradient: 'from-blue-600/20 to-blue-800/10 border-blue-500/30', href: '/employee/training'
            },
            {
              icon: CheckCircle, label: 'Completed', value: completed, sub: `${total > 0 ? Math.round((completed/total)*100) : 0}% done`,
              color: 'text-green-400', gradient: 'from-green-600/20 to-green-800/10 border-green-500/30', href: '/employee/training'
            },
            {
              icon: Award, label: 'Certificates', value: certs, sub: 'earned so far',
              color: 'text-yellow-400', gradient: 'from-yellow-600/20 to-yellow-800/10 border-yellow-500/30', href: '/employee/certificates'
            },
          ].map(s => {
            const Icon = s.icon
            return (
              <Link key={s.label} href={s.href}
                className={`group relative overflow-hidden rounded-2xl p-5 border bg-gradient-to-br ${s.gradient} transition-all hover:-translate-y-1 hover:shadow-2xl`}>
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center mb-3">
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-3xl font-black text-white">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : s.value}</div>
                <div className="text-sm font-semibold text-white/80 mt-0.5">{s.label}</div>
                <div className="text-xs text-white/40">{s.sub}</div>
              </Link>
            )
          })}
        </div>

        {/* Achievements + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Achievements */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-yellow-400" /> Achievements
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <AchievementBadge icon={Zap}         label="First Login"     unlocked={true}           color="brand" />
              <AchievementBadge icon={PlayCircle}  label="First Course"    unlocked={completed > 0}  color="blue" />
              <AchievementBadge icon={CheckCircle} label="Completed One"   unlocked={completed >= 1}  color="green" />
              <AchievementBadge icon={Award}       label="Certified"       unlocked={certs > 0}       color="yellow" />
              <AchievementBadge icon={Star}        label="5 Courses"       unlocked={completed >= 5}  color="purple" />
              <AchievementBadge icon={Flame}       label="All Done"        unlocked={total > 0 && completed >= total} color="red" />
            </div>
          </div>

          {/* Quick nav */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" /> What's Next
            </h2>
            <div className="space-y-2">
              {[
                { href: '/employee/training',     icon: PlayCircle,   label: 'Continue Training',    sub: `${total - completed} courses remaining`,  color: 'hover:border-blue-500/50 hover:bg-blue-600/8',    iconColor: 'text-blue-400' },
                { href: '/employee/assessment',   icon: ClipboardList,label: 'Take an Assessment',   sub: 'Test what you know',                      color: 'hover:border-purple-500/50 hover:bg-purple-600/8', iconColor: 'text-purple-400' },
                { href: '/employee/certificates', icon: Award,        label: 'My Certificates',      sub: `${certs} earned`,                          color: 'hover:border-yellow-500/50 hover:bg-yellow-600/8', iconColor: 'text-yellow-400' },
                { href: '/employee/profile',      icon: User,         label: 'Update Profile',       sub: 'Keep your info current',                  color: 'hover:border-green-500/50 hover:bg-green-600/8',   iconColor: 'text-green-400' },
              ].map(a => {
                const Icon = a.icon
                return (
                  <Link key={a.href} href={a.href}
                    className={`flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/3 transition-all hover:-translate-x-0.5 ${a.color}`}>
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${a.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{a.label}</p>
                      <p className="text-xs text-slate-500">{a.sub}</p>
                    </div>
                    <TrendingUp className="w-3 h-3 text-slate-600" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Motivational footer */}
        <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-600/10 to-purple-600/10 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {pct >= 100 ? '🎉 You completed everything! Outstanding work.' :
               pct >= 50  ? `You're ${pct}% through — keep the momentum going!` :
               pct > 0    ? `Great start! ${100 - pct}% more to go.` :
                            'Start your first course to begin your journey.'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Digital legacy planning protects the people you love most</p>
          </div>
          {pct < 100 && (
            <Link href="/employee/training"
              className="ml-auto flex-shrink-0 px-4 py-2 rounded-xl bg-brand-600/30 border border-brand-500/40 text-brand-300 text-sm font-medium hover:bg-brand-600/50 transition-all">
              Continue →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
