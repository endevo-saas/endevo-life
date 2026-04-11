'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  ArrowRight, Award, BookOpen, CheckCircle, ChevronRight,
  Lock, Loader2, RefreshCw, Shield, User, Heart, Sparkles, Video, Crown
} from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'
import Cookies from 'js-cookie'

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  total_courses: number
  completed_courses: number
  certificates: number
  progress_pct: number
}

interface DomainScore {
  domain: string
  percentage: number
  gapCount?: number
}

interface AssessmentStatus {
  attempted: boolean
  latestResult?: {
    overallScore: number
    submittedAt: string
    attemptNumber: number
    scorecard?: {
      domainScores: Record<string, DomainScore>
    }
  }
}

interface Lesson {
  lessonId: string
  moduleNum: string
  order: number
  title: string
  description: string
  lessonType: string
  durationMinutes: number
  isRequired: boolean
  status: 'not_started' | 'in_progress' | 'completed'
  percentWatched: number
}

interface LessonsResponse {
  lessons: Lesson[]
  total: number
  completed: number
  totalRequired: number
  completedRequired: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = {
  base: '#0D1825',
  card: '#0a1220',
  teal: '#2BBFC5',
  orange: '#E8612A',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  border: 'rgba(255,255,255,0.08)',
  success: '#10b981',
} as const

function useCountUp(target: number, duration = 1200): number {
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

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const QUOTES = [
  'The best time to plan your legacy was yesterday. The second best time is now.',
  'A well-prepared legacy is the greatest gift you can leave behind.',
  'Peace of mind comes from knowing those you love are protected.',
  'Your legacy is not just what you leave for people, but what you leave in them.',
]

const DOMAIN_LABELS: Record<string, string> = {
  'Legal Readiness': 'Legal',
  'Financial Readiness': 'Financial',
  'Physical Assets Readiness': 'Physical',
  'Digital Readiness': 'Digital',
  'Legal': 'Legal',
  'Financial': 'Financial',
  'Physical': 'Physical',
  'Digital': 'Digital',
}

const DOMAIN_COLORS: Record<string, string> = {
  Legal: '#2BBFC5',
  Financial: '#E8612A',
  Physical: '#10b981',
  Digital: '#8b5cf6',
}

const MODULE_INFO = [
  { num: '1', title: 'Project Worth Developing', icon: '1' },
  { num: '2', title: 'Legal Foundations', icon: '2' },
  { num: '3', title: 'Financial Readiness', icon: '3' },
  { num: '4', title: 'Physical Assets', icon: '4' },
  { num: '5', title: 'Digital Legacy', icon: '5' },
  { num: '6', title: 'Communicate Your Wishes', icon: '6' },
]

// ── Components ───────────────────────────────────────────────────────────────

function ProgressRing({ percent, size = 140, stroke = 10 }: {
  percent: number; size?: number; stroke?: number
}) {
  const [animatedPercent, setAnimatedPercent] = useState(0)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedPercent / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(percent), 200)
    return () => clearTimeout(timer)
  }, [percent])

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={COLORS.teal} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  )
}

function DomainBar({ label, percent, color }: {
  label: string; percent: number; color: string
}) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 300)
    return () => clearTimeout(t)
  }, [percent])

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium w-16 text-right" style={{ color: COLORS.textSecondary }}>
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: color,
            transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
      <span className="text-xs font-bold w-10" style={{ color }}>{percent}%</span>
    </div>
  )
}

interface BadgeInfo {
  label: string
  sublabel: string
  unlocked: boolean
  emoji: string
}

function BadgeCard({ badge }: { badge: BadgeInfo }) {
  return (
    <div
      className="flex-shrink-0 w-28 rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition-all duration-300"
      style={{
        background: badge.unlocked ? 'rgba(43,191,197,0.08)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${badge.unlocked ? 'rgba(43,191,197,0.25)' : COLORS.border}`,
        opacity: badge.unlocked ? 1 : 0.5,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
        style={{
          background: badge.unlocked
            ? 'linear-gradient(135deg, rgba(43,191,197,0.2), rgba(232,97,42,0.2))'
            : 'rgba(255,255,255,0.04)',
          boxShadow: badge.unlocked ? '0 0 20px rgba(43,191,197,0.15)' : 'none',
        }}
      >
        {badge.unlocked ? badge.emoji : <Lock className="w-4 h-4" style={{ color: COLORS.textMuted }} />}
      </div>
      <span className="text-[11px] font-semibold leading-tight" style={{ color: badge.unlocked ? '#fff' : COLORS.textMuted }}>
        {badge.label}
      </span>
      <span className="text-[10px]" style={{ color: badge.unlocked ? COLORS.teal : COLORS.textMuted }}>
        {badge.unlocked ? badge.sublabel : 'Locked'}
      </span>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [assessment, setAssessment] = useState<AssessmentStatus | null>(null)
  const [lessonsData, setLessonsData] = useState<LessonsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [entered, setEntered] = useState(false)
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [userPlan, setUserPlan] = useState<string>('basic')

  const email = Cookies.get('user_email') || ''
  const firstName = email.split('@')[0]?.split('.')[0] || 'there'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dash, assess, lessons] = await Promise.allSettled([
        api.employeeDashboard(),
        api.lmsGetAssessmentStatus(),
        api.lmsGetLessons('1'),
      ])

      if (dash.status === 'fulfilled') setDashData(dash.value as DashboardData)
      if (assess.status === 'fulfilled') setAssessment(assess.value as AssessmentStatus)
      if (lessons.status === 'fulfilled') setLessonsData(lessons.value as LessonsResponse)

      // Detect plan from /api/auth/me or cookies
      try {
        const me = await api.me() as unknown as Record<string, unknown>
        const p = (me?.plan || me?.tenant_plan || (me?.subscription as unknown as Record<string, unknown>)?.plan) as string | undefined
        if (p) setUserPlan(p.toLowerCase())
        else setUserPlan(Cookies.get('tenant_plan')?.toLowerCase() || 'basic')
      } catch {
        setUserPlan(Cookies.get('tenant_plan')?.toLowerCase() || 'basic')
      }

      if (dash.status === 'rejected') {
        throw new Error(dash.reason instanceof Error ? dash.reason.message : 'Failed to load dashboard')
      }

      setTimeout(() => setEntered(true), 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Rotate quotes
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIdx(prev => (prev + 1) % QUOTES.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // Derived state
  const completedLessons = lessonsData?.completed ?? 0
  const totalLessons = lessonsData?.total ?? 15
  const lessonPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const nextLesson = lessonsData?.lessons?.find(l => l.status !== 'completed')
  const nextLessonHref = nextLesson
    ? `/employee/lms/lessons/${nextLesson.lessonId}`
    : '/employee/lms'

  const certs = dashData?.certificates ?? 0
  const assessmentTaken = assessment?.attempted ?? false
  const overallScore = assessment?.latestResult?.overallScore ?? 0
  const domainScores = assessment?.latestResult?.scorecard?.domainScores

  const animatedLessonCount = useCountUp(completedLessons)
  const animatedScore = useCountUp(assessmentTaken ? overallScore : 0)

  // Badges based on real data
  const badges: BadgeInfo[] = [
    { label: 'First Lesson', sublabel: 'Started!', unlocked: completedLessons >= 1, emoji: '\u{1F4D6}' },
    { label: 'Quiz Master', sublabel: 'Passed a quiz', unlocked: (lessonsData?.lessons?.some(l => l.status === 'completed') ?? false), emoji: '\u{1F3AF}' },
    { label: 'Module 1 Done', sublabel: 'Milestone!', unlocked: completedLessons >= totalLessons && totalLessons > 0, emoji: '\u{1F3C6}' },
    { label: 'Assessment Done', sublabel: 'Evaluated!', unlocked: assessmentTaken, emoji: '\u{1F4CB}' },
    { label: 'Certified', sublabel: 'Official!', unlocked: certs > 0, emoji: '\u{1F4DC}' },
  ]

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.base }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: COLORS.teal }} />
          <p className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
            Loading your dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.base }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-slide-up {
          animation: fadeSlideUp 0.6s ease-out forwards;
          opacity: 0;
        }
        .fade-slide-up-1 { animation-delay: 0.05s; }
        .fade-slide-up-2 { animation-delay: 0.12s; }
        .fade-slide-up-3 { animation-delay: 0.2s; }
        .fade-slide-up-4 { animation-delay: 0.28s; }
        .fade-slide-up-5 { animation-delay: 0.36s; }
        .fade-slide-up-6 { animation-delay: 0.44s; }
        @keyframes quoteIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quote-animate { animation: quoteIn 0.8s ease-out forwards; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className={`max-w-4xl mx-auto px-5 py-8 space-y-6 transition-opacity duration-500 ${entered ? 'opacity-100' : 'opacity-0'}`}>

        {/* ── 1. Welcome Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between fade-slide-up fade-slide-up-1">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.orange})`,
                color: '#fff',
              }}
            >
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back, <span className="capitalize" style={{ color: COLORS.teal }}>{firstName}</span>
              </h1>
              <p className="text-sm mt-0.5" style={{ color: COLORS.textSecondary }}>
                {formatDate()}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2.5 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="p-4 rounded-2xl text-sm flex items-center gap-3"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}
          >
            {error}
            <button onClick={load} className="ml-auto underline font-medium">Retry</button>
          </div>
        )}

        {/* ── 2. Assessment Banner ──────────────────────────────────── */}
        {assessment && !assessmentTaken && (
          <div
            className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 fade-slide-up fade-slide-up-2"
            style={{
              background: `linear-gradient(135deg, rgba(43,191,197,0.12) 0%, rgba(232,97,42,0.12) 100%)`,
              border: '1px solid rgba(43,191,197,0.25)',
            }}
          >
            <div className="flex-1">
              <p className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: COLORS.teal }} />
                Start Your Readiness Assessment
              </p>
              <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                40 questions across 4 domains. Discover where your legacy stands and get a personalised plan.
              </p>
            </div>
            <Link
              href="/employee/lms/assessment"
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.orange})`,
                color: '#fff',
                boxShadow: `0 0 24px rgba(43,191,197,0.25)`,
              }}
            >
              Begin Assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {assessment && assessmentTaken && domainScores && (
          <div
            className="rounded-2xl p-6 fade-slide-up fade-slide-up-2"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" style={{ color: COLORS.teal }} />
                <span className="text-sm font-bold text-white">Readiness Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: COLORS.teal }}>
                  {animatedScore}%
                </span>
                <Link
                  href="/employee/lms/assessment"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                  style={{ background: 'rgba(43,191,197,0.12)', color: COLORS.teal, border: '1px solid rgba(43,191,197,0.25)' }}
                >
                  Retake
                </Link>
              </div>
            </div>
            <div className="space-y-2.5">
              {Object.entries(domainScores).map(([key, val]) => {
                const shortLabel = DOMAIN_LABELS[key] || key.replace(' Readiness', '')
                const color = DOMAIN_COLORS[shortLabel] || COLORS.teal
                const pct = typeof val === 'object' ? (val as DomainScore).percentage : (val as number)
                return (
                  <DomainBar
                    key={key}
                    label={shortLabel}
                    percent={Math.round(pct)}
                    color={color}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── 3. Learning Progress ──────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 fade-slide-up fade-slide-up-3"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Progress ring */}
            <div className="relative flex-shrink-0">
              <ProgressRing percent={lessonPercent} size={140} stroke={10} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{animatedLessonCount}</span>
                <span className="text-[11px]" style={{ color: COLORS.textSecondary }}>
                  of {totalLessons}
                </span>
              </div>
            </div>

            {/* Module 1 info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4" style={{ color: COLORS.teal }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                  Current Module
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Module 1: Project Worth Developing
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                {completedLessons === totalLessons && totalLessons > 0
                  ? 'All lessons completed! Great work.'
                  : `${completedLessons} of ${totalLessons} lessons completed`}
              </p>

              {/* Progress bar */}
              <div className="h-2.5 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${lessonPercent}%`,
                    background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.orange})`,
                    transition: 'width 1.5s cubic-bezier(0.22,1,0.36,1)',
                    boxShadow: `0 0 12px ${COLORS.teal}40`,
                  }}
                />
              </div>

              {/* Upcoming modules */}
              <div className="flex flex-wrap gap-2">
                {MODULE_INFO.slice(1).map(m => (
                  <div
                    key={m.num}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.textMuted,
                    }}
                  >
                    <Lock className="w-3 h-3" />
                    <span>M{m.num}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Quick Actions ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 fade-slide-up fade-slide-up-4">
          {[
            {
              href: nextLessonHref,
              icon: BookOpen,
              label: 'Continue Learning',
              sub: nextLesson ? nextLesson.title : 'Go to modules',
              color: COLORS.teal,
            },
            {
              href: '/employee/certificates',
              icon: Award,
              label: 'My Certificates',
              sub: `${certs} earned`,
              color: COLORS.orange,
            },
            {
              href: '/employee/profile',
              icon: User,
              label: 'My Profile',
              sub: 'View & update',
              color: COLORS.success,
            },
          ].map(action => {
            const Icon = action.icon
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: `${action.color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{action.label}</p>
                  <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>{action.sub}</p>
                </div>
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5"
                  style={{ color: COLORS.textMuted }}
                />
              </Link>
            )
          })}
        </div>

        {/* ── 4a. New Features ──────────────────────────────────────── */}
        <div className="fade-slide-up fade-slide-up-4">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: COLORS.orange }} />
            Learning Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { href: '/employee/lms/assessment', icon: '🛡️', label: 'Assessment', desc: 'Domain readiness' },
              { href: '/employee/playbook', icon: '📋', label: 'Playbook', desc: 'Interactive guides' },
              { href: '/employee/checklist', icon: '✅', label: 'Checklist', desc: 'Task tracking' },
              { href: '/employee/master-classes', icon: '🎥', label: 'Master Classes', desc: 'Video library' },
              { href: '/employee/sessions', icon: '👥', label: '1:1 Sessions', desc: 'Expert coaching' },
            ].map(feature => (
              <Link
                key={feature.label}
                href={feature.href}
                className="group relative rounded-xl p-4 flex flex-col items-center text-center transition-all duration-200 hover:scale-105"
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <p className="text-xs font-bold text-white leading-tight">{feature.label}</p>
                <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                  {feature.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── 4b. Premium Booking Card ──────────────────────────────── */}
        {userPlan === 'premium' ? (
          <div
            className="rounded-2xl p-5 fade-slide-up fade-slide-up-4"
            style={{
              background: 'linear-gradient(135deg, rgba(232,97,42,0.12) 0%, rgba(232,97,42,0.04) 100%)',
              border: '1px solid rgba(232,97,42,0.3)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(232,97,42,0.15)', border: '1px solid rgba(232,97,42,0.25)' }}
              >
                <Video className="w-6 h-6 text-[#E8612A]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">1-on-1 Session with Legacy Expert</h3>
                <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                  Included with your Premium subscription
                </p>
              </div>
              <a
                href={process.env.NEXT_PUBLIC_BOOKING_LINK || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #E8612A, #d4541f)',
                  boxShadow: '0 4px 16px rgba(232,97,42,0.3)',
                }}
              >
                Book Session <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : (
          <Link
            href="/employee/subscription"
            className="group rounded-2xl p-5 flex items-center gap-4 transition-all hover:scale-[1.01] fade-slide-up fade-slide-up-4"
            style={{
              background: 'linear-gradient(135deg, rgba(232,97,42,0.06) 0%, rgba(232,97,42,0.02) 100%)',
              border: '1px solid rgba(232,97,42,0.15)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(232,97,42,0.1)' }}
            >
              <Crown className="w-5 h-5 text-[#E8612A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Unlock Premium Features</p>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Get 1-on-1 expert sessions, priority support & more
              </p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-all" style={{ color: '#E8612A' }} />
          </Link>
        )}

        {/* ── 5. Achievement Badges ─────────────────────────────────── */}
        <div className="fade-slide-up fade-slide-up-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: COLORS.orange }} />
              Achievements
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
              background: 'rgba(43,191,197,0.1)',
              border: '1px solid rgba(43,191,197,0.2)',
              color: COLORS.teal,
            }}>
              {badges.filter(b => b.unlocked).length}/{badges.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {badges.map(b => <BadgeCard key={b.label} badge={b} />)}
          </div>
        </div>

        {/* ── 6. Motivational Footer ────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4 fade-slide-up fade-slide-up-6"
          style={{
            background: `linear-gradient(135deg, ${COLORS.teal}15, ${COLORS.orange}15)`,
            border: `1px solid ${COLORS.teal}20`,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${COLORS.teal}15` }}
          >
            <Heart className="w-5 h-5" style={{ color: COLORS.teal }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              key={quoteIdx}
              className="text-sm font-medium text-white italic quote-animate"
            >
              &ldquo;{QUOTES[quoteIdx]}&rdquo;
            </p>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
              Protecting the people you love most
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
