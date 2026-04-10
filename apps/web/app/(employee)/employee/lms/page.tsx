'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import ScorecardDisplay, { type ScorecardResult } from '@/components/lms/ScorecardDisplay'

interface ModuleSummary {
  moduleNum: string
  title: string
  description: string
  lockStatus: 'locked' | 'unlocked' | 'complete'
  videosTotal: number
  videosComplete: number
  quizScore?: number
}

interface AssessmentStatusResponse {
  attempted: boolean
  latestResult?: {
    overallScore: number
    submittedAt: string
    attemptNumber: number
    scorecard: ScorecardResult
  }
}

interface AssessmentHistoryEntry {
  attemptNumber: number
  overallScore: number
  attemptedAt: string
  overallTier?: { label: string; emoji: string; color: string }
}

interface AssessmentHistory {
  attempts: AssessmentHistoryEntry[]
  bestScore?: number
  latestScorecard?: ScorecardResult
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-elevated)' }}>
      <div
        className="h-1.5 rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: pct === 100 ? 'var(--success)' : 'linear-gradient(90deg, #2BBFC5, #5E6AD2)',
        }}
      />
    </div>
  )
}

function ModuleCard({ module, index }: { module: ModuleSummary; index: number }) {
  const router = useRouter()
  const isLocked = module.lockStatus === 'locked'
  const isComplete = module.lockStatus === 'complete'
  const isUnlocked = module.lockStatus === 'unlocked'

  function handleClick() {
    if (!isLocked) {
      router.push(`/employee/lms/module/${module.moduleNum}`)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200"
      style={{
        background: 'var(--bg-card)',
        border: isComplete
          ? '1px solid rgba(43,191,197,0.4)'
          : isUnlocked
          ? '1px solid rgba(94,106,210,0.3)'
          : '1px solid var(--border-subtle)',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.6 : 1,
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Module header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
            style={{
              background: isComplete
                ? 'linear-gradient(135deg,#2BBFC5,#10b981)'
                : isUnlocked
                ? 'var(--gradient-brand)'
                : 'var(--bg-elevated)',
              color: isLocked ? 'var(--text-muted)' : 'white',
            }}
          >
            {module.moduleNum}
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Module {module.moduleNum}
            </p>
            <p className="text-sm font-bold text-white leading-tight">{module.title}</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-xl">
          {isLocked ? '🔒' : isComplete ? '✅' : '▶️'}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {module.description}
      </p>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span style={{ color: 'var(--text-muted)' }}>
            {module.videosComplete}/{module.videosTotal} videos
          </span>
          {module.quizScore !== undefined && (
            <span style={{ color: '#2BBFC5' }} className="font-semibold">
              Quiz: {module.quizScore}%
            </span>
          )}
        </div>
        <ProgressBar value={module.videosComplete} max={module.videosTotal} />
      </div>

      {/* Action */}
      <div className="mt-auto pt-1">
        {isLocked ? (
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Complete the Readiness Assessment to unlock
          </p>
        ) : isComplete ? (
          <p className="text-xs font-semibold" style={{ color: '#2BBFC5' }}>
            Completed — review anytime
          </p>
        ) : (
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
          >
            {module.videosComplete > 0 ? 'Continue' : 'Start'} →
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreTrendBadge({ attempts }: { attempts: AssessmentHistoryEntry[] }) {
  if (attempts.length < 2) return null
  const latest = attempts[attempts.length - 1].overallScore
  const previous = attempts[attempts.length - 2].overallScore
  const diff = latest - previous
  if (diff === 0) return null
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{
        background: diff > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: diff > 0 ? '#22c55e' : '#ef4444',
      }}
    >
      {diff > 0 ? `↑ +${diff}%` : `↓ ${diff}%`} from last attempt
    </span>
  )
}

export default function LMSDashboard() {
  const router = useRouter()
  const [modules, setModules] = useState<ModuleSummary[]>([])
  const [assessment, setAssessment] = useState<AssessmentStatusResponse | null>(null)
  const [history, setHistory] = useState<AssessmentHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [entered, setEntered] = useState(false)
  const [showScorecard, setShowScorecard] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [modulesRes, assessRes, historyRes] = await Promise.all([
        api.lmsGetModules() as Promise<{ modules: ModuleSummary[] }>,
        api.lmsGetAssessmentStatus() as Promise<AssessmentStatusResponse>,
        api.lmsGetAssessmentHistory() as Promise<AssessmentHistory>,
      ])
      setModules(modulesRes.modules || [])
      setAssessment(assessRes)
      setHistory(historyRes)
      setTimeout(() => setEntered(true), 80)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load LMS data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const assessmentCompleted = assessment?.attempted ?? false
  const latestResult = assessment?.latestResult ?? null
  const latestScorecard = latestResult?.scorecard ?? history?.latestScorecard ?? null
  const overallComplete = modules.length > 0 && modules.every(m => m.lockStatus === 'complete')
  const hasHistory = (history?.attempts?.length ?? 0) > 0

  // Find weakest domain for recommendation
  const weakestDomain = latestScorecard
    ? Object.values(latestScorecard.domainScores).reduce(
        (weakest, d) => (d.percentage < (weakest?.percentage ?? 101) ? d : weakest),
        null as (typeof latestScorecard.domainScores)[string] | null
      )
    : null

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow"
          style={{ background: '#2BBFC5', opacity: 0.06 }}
        />
        <div
          className="blur-orb w-80 h-80 bottom-0 right-0 animate-pulse-slow"
          style={{ background: '#E8612A', opacity: 0.05, animationDelay: '2s' }}
        />
      </div>

      <div
        className={`relative max-w-5xl mx-auto space-y-6 transition-all duration-700 ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Digital Legacy{' '}
              <span style={{ color: '#2BBFC5' }}>Training</span>
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {modules.length > 0 ? `${modules.length} modules` : 'Modules'} to help you protect the people you love most
            </p>
          </div>
          {overallComplete && (
            <div
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#2BBFC5,#10b981)' }}
            >
              🎉 All Complete!
            </div>
          )}
        </div>

        {error && (
          <div
            className="p-4 rounded-2xl text-sm flex items-center gap-3"
            style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              color: '#f87171',
            }}
          >
            {error}
            <button onClick={load} className="ml-auto underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Assessment banner — not yet taken */}
        {!loading && !assessmentCompleted && (
          <div
            className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(232,97,42,0.15), rgba(249,115,22,0.08))',
              border: '1px solid rgba(232,97,42,0.4)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: 'rgba(232,97,42,0.2)' }}
            >
              📋
            </div>
            <div className="flex-1">
              <p className="text-base font-black text-white">
                Start with the Readiness Assessment to unlock all modules
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Answer questions across multiple life domains. This helps us personalise your learning journey.
              </p>
            </div>
            <Link
              href="/employee/lms/assessment"
              className="flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
            >
              Take Assessment →
            </Link>
          </div>
        )}

        {/* Assessment completed — domain breakdown + recommendation */}
        {!loading && assessmentCompleted && latestScorecard && (
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(43,191,197,0.25)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-bold text-white">
                    Readiness Assessment Complete — Overall: {latestScorecard.overallScore}%
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    All {modules.length} modules are unlocked
                  </p>
                </div>
              </div>
              <Link
                href="/employee/lms/assessment"
                className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-xs text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
              >
                Retake →
              </Link>
            </div>

            {/* Per-domain score bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(latestScorecard.domainScores).map(d => {
                const domainShort = d.domain.replace(' Readiness', '')
                const isWeakest = weakestDomain?.domain === d.domain
                return (
                  <div key={d.domain} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold" style={{ color: d.tier.color }}>
                        {d.tier.emoji} {domainShort}
                        {isWeakest && (
                          <span className="ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            FOCUS
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-white">{d.percentage}%</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-elevated)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-1000"
                        style={{
                          width: `${d.percentage}%`,
                          background: `linear-gradient(90deg, ${d.tier.color}, ${d.tier.color}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recommendation */}
            {weakestDomain && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: 'rgba(232,97,42,0.08)', border: '1px solid rgba(232,97,42,0.2)' }}
              >
                <span className="text-sm">🧭</span>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We recommend starting with{' '}
                  <button
                    onClick={() => router.push(`/employee/lms/module/${weakestDomain.moduleNum}`)}
                    className="font-bold underline underline-offset-2"
                    style={{ color: '#E8612A' }}
                  >
                    Module {weakestDomain.moduleNum}: {weakestDomain.domain.replace(' Readiness', '')}
                  </button>{' '}
                  (your weakest area at {weakestDomain.percentage}%)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Assessment completed but no scorecard (edge case) */}
        {!loading && assessmentCompleted && !latestScorecard && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: 'rgba(43,191,197,0.08)',
              border: '1px solid rgba(43,191,197,0.25)',
            }}
          >
            <span className="text-lg">✅</span>
            <p className="text-sm font-semibold" style={{ color: '#2BBFC5' }}>
              Readiness Assessment complete. All modules are unlocked.
            </p>
          </div>
        )}

        {/* ── AI Recommendation / Last Scorecard ────────────────── */}
        {!loading && hasHistory && latestScorecard && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <button
              onClick={() => setShowScorecard(prev => !prev)}
              className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'rgba(43,191,197,0.15)' }}
                >
                  🧭
                </div>
                <div>
                  <p className="text-sm font-black text-white">Your AI Recommendation</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Overall: <span className="font-bold" style={{ color: latestScorecard.overallTier.color }}>
                        {latestScorecard.overallScore}% — {latestScorecard.overallTier.label}
                      </span>
                    </p>
                    {history && <ScoreTrendBadge attempts={history.attempts} />}
                    {(history?.attempts?.length ?? 0) > 1 && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        · {history!.attempts.length} attempts
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#2BBFC5' }}>
                {showScorecard ? 'Hide ↑' : 'View ↓'}
              </span>
            </button>

            {showScorecard && (
              <div className="px-5 pb-5">
                <ScorecardDisplay
                  scorecard={latestScorecard}
                  showRetake={true}
                  onRetake={() => router.push('/employee/lms/assessment')}
                />
              </div>
            )}
          </div>
        )}

        {/* Module grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton h-56 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod, i) => (
              <ModuleCard key={mod.moduleNum} module={mod} index={i} />
            ))}
          </div>
        )}

        {/* Overall progress summary */}
        {!loading && modules.length > 0 && (
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-white">Overall Progress</p>
                <p className="text-sm font-black" style={{ color: '#2BBFC5' }}>
                  {modules.filter(m => m.lockStatus === 'complete').length}/{modules.length} modules
                </p>
              </div>
              <ProgressBar
                value={modules.filter(m => m.lockStatus === 'complete').length}
                max={modules.length}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
