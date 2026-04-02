'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  PlayCircle, Award, CheckCircle, Loader2, RefreshCw,
  Star, Flame, Target, Zap, Trophy, ClipboardList, User, Sparkles,
  TrendingUp, ArrowRight, Lock
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

interface LmsStatus {
  assessmentTaken?: boolean
  score?: number
  tier?: { label: string; color: string }
}

// Count-up hook
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return count
}

// Confetti burst
function burst(x: number, y: number) {
  const colors = ['#6366f1','#8b5cf6','#f59e0b','#10b981','#f43f5e','#22d3ee','#fbbf24']
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    el.style.cssText = `
      left: ${x}px; top: ${y}px;
      background: ${colors[i % colors.length]};
      transform: rotate(${Math.random()*360}deg);
      animation-duration: ${0.8 + Math.random() * 1.2}s;
      animation-delay: ${Math.random() * 0.3}s;
    `
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2000)
  }
}

// Streak dots (last 7 days mock — will be real in v2)
function StreakRow({ streak }: { streak: number }) {
  const days = ['M','T','W','T','F','S','S']
  return (
    <div className="flex items-center gap-2">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={`streak-dot ${i < streak ? 'streak-dot-active' : 'streak-dot-inactive'}`} />
          <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{d}</span>
        </div>
      ))}
    </div>
  )
}

// XP / Level bar — animated
function XPBar({ pct }: { pct: number }) {
  const [filled, setFilled] = useState(0)
  const level  = pct < 20 ? 1 : pct < 40 ? 2 : pct < 60 ? 3 : pct < 80 ? 4 : 5
  const labels = ['', 'Beginner', 'Learner', 'Practitioner', 'Expert', 'Master']
  const within    = pct - (level - 1) * 20
  const pctWithin = Math.min(Math.round((within / 20) * 100), 100)

  useEffect(() => {
    const t = setTimeout(() => setFilled(pctWithin), 300)
    return () => clearTimeout(t)
  }, [pctWithin])

  return (
    <div className="glass-accent rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Level badge */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white"
              style={{ background: 'var(--gradient-brand)', boxShadow: '0 0 24px var(--accent-glow)' }}>
              {level}
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center"
              style={{ boxShadow: '0 0 8px rgba(251,191,36,0.8)' }}>
              <Star className="w-3 h-3 text-yellow-900" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Current Level</p>
            <p className="text-xl font-black text-white">{labels[level]}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400">3 day streak</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-white">{pct}%</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Overall Progress</p>
        </div>
      </div>

      {/* XP bar */}
      <div className="xp-bar-track mb-2">
        <div className="xp-bar-fill" style={{ width: `${filled}%`, transition: 'width 1.5s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Level {level}</span>
        <span className="font-semibold text-white">{pctWithin}% to Level {Math.min(level + 1, 5)}</span>
        <span>Level {Math.min(level + 1, 5)}</span>
      </div>

      {/* Level milestone dots */}
      <div className="flex items-center gap-1 mt-4">
        {[1,2,3,4,5].map(l => (
          <div key={l} className="flex-1 h-1.5 rounded-full transition-all duration-500"
            style={{
              background: l <= level ? 'var(--gradient-brand)' : 'var(--bg-elevated)',
              boxShadow: l === level ? '0 0 8px var(--accent-glow)' : 'none',
            }} />
        ))}
      </div>

      {/* Streak */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Login Streak</span>
          <span className="text-xs font-bold text-orange-400">🔥 3 days</span>
        </div>
        <StreakRow streak={3} />
      </div>
    </div>
  )
}

// Achievement badge
function Badge({ icon: Icon, label, sublabel, unlocked, gradient, glow }: {
  icon: React.ElementType; label: string; sublabel: string
  unlocked: boolean; gradient: string; glow: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  function handleUnlock(e: React.MouseEvent) {
    if (!unlocked) return
    const rect = ref.current?.getBoundingClientRect()
    if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  return (
    <div ref={ref} onClick={handleUnlock}
      className={`${unlocked ? 'badge badge-unlocked' : 'badge badge-locked'} cursor-pointer`}
      title={unlocked ? label : `Complete more to unlock: ${label}`}>
      <div className={`badge-icon ${unlocked ? 'badge-icon-glow' : ''}`}
        style={unlocked ? { background: gradient, boxShadow: glow } : {}}>
        {unlocked
          ? <Icon className="w-5 h-5 text-white" />
          : <Lock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        }
      </div>
      <span className="text-xs font-semibold text-center leading-tight text-white">{label}</span>
      {unlocked
        ? <span className="text-[10px] font-medium" style={{ color: 'var(--accent-2)' }}>{sublabel}</span>
        : <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Locked</span>
      }
    </div>
  )
}

// Stat card with count-up
function StatCard({ icon: Icon, label, value, sub, href, gradient, glow }: {
  icon: React.ElementType; label: string; value: number; sub: string
  href: string; gradient: string; glow: string
}) {
  const count = useCountUp(value)
  return (
    <Link href={href} className="stat-card group block">
      <div className="relative z-10">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
          style={{ background: gradient, boxShadow: glow }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="text-4xl font-black text-white mb-1">{count}</div>
        <div className="text-sm font-bold text-white mb-0.5">{label}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1"
        style={{ color: 'var(--accent-1)' }} />
    </Link>
  )
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<EmpDashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [entered, setEntered] = useState(false)
  const [lmsStatus, setLmsStatus] = useState<LmsStatus | null>(null)
  const name = Cookies.get('user_email')?.split('@')[0] || 'Learner'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.employeeDashboard() as EmpDashData
      setData(d)
      setTimeout(() => setEntered(true), 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.lmsGetAssessmentStatus()
      .then((d: unknown) => setLmsStatus(d as LmsStatus))
      .catch(() => { /* silently ignore — banner is optional */ })
  }, [])

  const pct       = data?.progress_pct ?? 0
  const completed = data?.completed_courses ?? 0
  const total     = data?.total_courses ?? 0
  const certs     = data?.certificates ?? 0

  const badges = [
    { icon: Zap,         label: 'First Login',   sublabel: 'Day 1!',       unlocked: true,             gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', glow: '0 0 16px rgba(99,102,241,0.5)' },
    { icon: PlayCircle,  label: 'First Course',  sublabel: 'Getting started', unlocked: completed > 0,  gradient: 'linear-gradient(135deg,#06b6d4,#0ea5e9)', glow: '0 0 16px rgba(6,182,212,0.5)' },
    { icon: CheckCircle, label: 'Completed One', sublabel: 'Milestone!',    unlocked: completed >= 1,  gradient: 'linear-gradient(135deg,#10b981,#34d399)', glow: '0 0 16px rgba(16,185,129,0.5)' },
    { icon: Award,       label: 'Certified',     sublabel: 'Official!',    unlocked: certs > 0,        gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', glow: '0 0 16px rgba(245,158,11,0.5)' },
    { icon: Star,        label: '5 Courses',     sublabel: 'Star learner', unlocked: completed >= 5,   gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', glow: '0 0 16px rgba(139,92,246,0.5)' },
    { icon: Flame,       label: 'All Done!',     sublabel: 'Legend!',      unlocked: total > 0 && completed >= total, gradient: 'linear-gradient(135deg,#f43f5e,#fb7185)', glow: '0 0 16px rgba(244,63,94,0.5)' },
  ]

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blur-orb w-96 h-96 top-0 left-0 animate-pulse-slow" style={{ background: 'var(--accent-1)', opacity: 0.08 }} />
        <div className="blur-orb w-80 h-80 bottom-0 right-0 animate-pulse-slow" style={{ background: 'var(--accent-2)', opacity: 0.07, animationDelay: '2s' }} />
        <div className="blur-orb w-64 h-64 top-1/2 right-1/4 animate-float" style={{ background: 'var(--gold)', opacity: 0.04 }} />
      </div>

      <div className={`relative max-w-5xl mx-auto space-y-5 transition-all duration-700 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* Header */}
        <div className="flex items-start justify-between" style={{ animationDelay: '0s' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Live session</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Hey, <span className="capitalize text-gradient">{name}</span>! 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Your digital legacy journey — keep the momentum going!
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2.5 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl text-sm flex items-center gap-3 animate-fade-in"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>
            {error}
            <button onClick={load} className="ml-auto underline font-medium">Retry</button>
          </div>
        )}

        {/* LMS Banner */}
        {lmsStatus && !lmsStatus.assessmentTaken && (
          <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(249,115,22,0.15) 100%)', border: '1px solid rgba(20,184,166,0.3)' }}>
            <div className="text-3xl flex-shrink-0">🎯</div>
            <div className="flex-1">
              <p className="text-base font-black text-white">Start Your Readiness Assessment</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Discover exactly where your legacy stands — 40 questions, 4 domains, your personalised plan in under 20 minutes.
              </p>
            </div>
            <Link href="/employee/lms/assessment"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#14b8a6,#f97316)', color: 'white', boxShadow: '0 0 20px rgba(20,184,166,0.3)' }}>
              Start Assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {lmsStatus && lmsStatus.assessmentTaken && lmsStatus.score !== undefined && (
          <div className="rounded-2xl px-5 py-3.5 flex items-center gap-3"
            style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)' }}>
            <span className="text-lg">✅</span>
            <p className="text-sm font-semibold text-white flex-1">
              Your Readiness Score: <span className="text-teal-400">{lmsStatus.score}%</span>
              {lmsStatus.tier?.label && (
                <span className="ml-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                  — {lmsStatus.tier.label} 💡
                </span>
              )}
            </p>
            <Link href="/employee/lms"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(20,184,166,0.2)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}>
              View My Modules <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* XP bar */}
        {loading
          ? <div className="skeleton h-52" />
          : <XPBar pct={pct} />
        }

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {loading ? [1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)
          : [
            { icon: PlayCircle, label: 'Courses',    value: total,     sub: 'available to you',           href: '/employee/training',     gradient: 'linear-gradient(135deg,#06b6d4,#0ea5e9)', glow: '0 0 20px rgba(6,182,212,0.4)' },
            { icon: CheckCircle,label: 'Completed',  value: completed, sub: `${total > 0 ? Math.round(completed/total*100) : 0}% complete`, href: '/employee/training', gradient: 'linear-gradient(135deg,#10b981,#34d399)', glow: '0 0 20px rgba(16,185,129,0.4)' },
            { icon: Award,      label: 'Certs Earned',value: certs,   sub: 'official certificates',        href: '/employee/certificates', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', glow: '0 0 20px rgba(245,158,11,0.4)' },
          ].map(s => <StatCard key={s.label} {...s} />)
          }
        </div>

        {/* Achievements + Quick nav */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Achievements */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" /> Achievements
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--gradient-card)', border: '1px solid var(--border)', color: 'var(--accent-1)' }}>
                {badges.filter(b => b.unlocked).length}/{badges.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {badges.map(b => <Badge key={b.label} {...b} />)}
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
              Click unlocked badges for a celebration! 🎉
            </p>
          </div>

          {/* Quick nav */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-base font-black text-white flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-1)' }} /> What&apos;s Next
            </h2>
            <div className="space-y-2">
              {[
                { href: '/employee/training',     icon: PlayCircle,    label: 'Continue Training',   sub: `${total - completed} course${total - completed !== 1 ? 's' : ''} remaining`,  gradient: 'linear-gradient(135deg,#06b6d4,#0ea5e9)' },
                { href: '/employee/assessment',   icon: ClipboardList, label: 'Take an Assessment',  sub: 'Test your knowledge',    gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
                { href: '/employee/certificates', icon: Award,         label: 'View Certificates',   sub: `${certs} earned`,         gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
                { href: '/employee/profile',      icon: User,          label: 'Update Profile',      sub: 'Keep your info current',  gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
              ].map(a => {
                const Icon = a.icon
                return (
                  <Link key={a.href} href={a.href}
                    className="group flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-x-0.5"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ background: a.gradient, boxShadow: '0 0 12px rgba(99,102,241,0.3)' }}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{a.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.sub}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1"
                      style={{ color: 'var(--accent-1)' }} />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Motivational banner */}
        <div className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'var(--gradient-brand)', boxShadow: '0 0 40px var(--accent-glow)' }}>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-base font-black text-white">
              {pct >= 100 ? '🎉 You completed everything! You\'re a Digital Legacy Champion!' :
               pct >= 75  ? `Almost there! Just ${100 - pct}% more to become a champion 🔥` :
               pct >= 50  ? `Halfway there! ${100 - pct}% left — you\'ve got this! 💪` :
               pct > 0    ? `Great start! Keep going — ${100 - pct}% more to unlock your certificate 🎯` :
                            'Start your first course and begin your digital legacy journey 🚀'}
            </p>
            <p className="text-sm text-white/70 mt-0.5">Digital legacy planning protects the people you love most</p>
          </div>
          {pct < 100 && (
            <Link href="/employee/training"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              Continue <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

      </div>
    </div>
  )
}
