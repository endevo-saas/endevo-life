'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import ScorecardDisplay, { type ScorecardResult } from '@/components/lms/ScorecardDisplay'

interface AssessmentQuestion {
  questionId: string
  domain: string
  text: string
  answers: { label: string; text: string }[]
  scoreWeight?: number
}

interface LegacyResult {
  passed: boolean
  score: number
  maxScore: number
  domainBreakdown: { domain: string; score: number; maxScore: number }[]
  scorecard?: ScorecardResult
}

type Phase = 'intro' | 'questions' | 'submitting' | 'results'

const DOMAIN_COLORS: Record<string, string> = {
  Legal: '#5E6AD2',
  Financial: '#E8612A',
  Physical: '#2BBFC5',
  Digital: '#8B5CF6',
}

const DOMAIN_ICONS: Record<string, string> = {
  Legal: '⚖️',
  Financial: '💰',
  Physical: '🏠',
  Digital: '💻',
}

export default function AssessmentPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('intro')
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<LegacyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  async function startAssessment() {
    setLoading(true)
    setError('')
    try {
      const res = await api.lmsGetAssessmentQuestions() as { questions: AssessmentQuestion[] }
      setQuestions(res.questions || [])
      setPhase('questions')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  function selectOption(label: string) {
    setSelectedOption(label)
  }

  function handleNext() {
    if (!selectedOption) return
    const q = questions[currentIndex]
    const newAnswers = { ...answers, [q.questionId]: selectedOption }
    setAnswers(newAnswers)
    setSelectedOption(null)

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      submitAssessment(newAnswers)
    }
  }

  async function submitAssessment(finalAnswers: Record<string, string>) {
    setPhase('submitting')
    try {
      const payload = Object.entries(finalAnswers).map(([questionId, selectedLabel]) => ({
        questionId,
        selectedLabel,
      }))
      const res = await api.lmsSubmitAssessment(payload) as LegacyResult
      setResult(res)
      setPhase('results')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit assessment')
      setPhase('questions')
    }
  }

  function handleRetake() {
    setQuestions([])
    setAnswers({})
    setCurrentIndex(0)
    setSelectedOption(null)
    setResult(null)
    setPhase('intro')
  }

  const currentQuestion = questions[currentIndex]
  const progressPct = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0

  // ── Intro Screen ──────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow" style={{ background: '#2BBFC5', opacity: 0.06 }} />
          <div className="blur-orb w-80 h-80 bottom-0 right-0 animate-pulse-slow" style={{ background: '#E8612A', opacity: 0.05, animationDelay: '2s' }} />
        </div>

        <div className="relative max-w-lg w-full space-y-6 text-center">
          <div className="text-6xl mb-2">📋</div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Readiness Assessment</h1>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Before you begin your journey, we want to understand where you stand — so we can show you the path that matters most for your family.
            </p>
          </div>

          <div
            className="rounded-2xl p-6 text-left space-y-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Questions', value: '40', icon: '❓' },
                { label: 'Unlocks All', value: '6 Modules', icon: '🔓' },
                { label: 'Domains', value: '4', icon: '📚' },
                { label: 'Est. Time', value: '20 min', icon: '⏱️' },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <span className="text-xl">{s.icon}</span>
                  <div>
                    <p className="text-lg font-black text-white">{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-white mb-2">4 Life Domains We Cover</p>
              <div className="grid grid-cols-2 gap-2">
                {['Legal', 'Financial', 'Physical', 'Digital'].map(domain => (
                  <div
                    key={domain}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--bg-base)', color: DOMAIN_COLORS[domain] }}
                  >
                    <span>{DOMAIN_ICONS[domain]}</span>
                    {domain}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              Back
            </button>
            <button
              onClick={startAssessment}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
            >
              {loading ? 'Loading…' : 'Start Assessment →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Submitting ────────────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center space-y-4">
          <div className="text-5xl animate-pulse">🔍</div>
          <p className="text-xl font-black text-white">Mapping your legacy picture…</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Analysing your answers across 4 life domains
          </p>
        </div>
      </div>
    )
  }

  // ── Results Screen — Rich Scorecard ───────────────────────────────
  if (phase === 'results' && result) {
    const hasScorecard = !!result.scorecard

    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow"
            style={{ background: hasScorecard ? (result.scorecard?.overallTier.color ?? '#2BBFC5') : (result.passed ? '#2BBFC5' : '#E8612A'), opacity: 0.07 }}
          />
          <div
            className="blur-orb w-80 h-80 bottom-0 right-0 animate-pulse-slow"
            style={{ background: '#5E6AD2', opacity: 0.05, animationDelay: '1.5s' }}
          />
        </div>

        <div className="relative max-w-2xl mx-auto">
          {/* Back link */}
          <button
            onClick={() => router.push('/employee/lms')}
            className="flex items-center gap-1.5 text-sm mb-5 font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Back to LMS
          </button>

          {/* Scorecard or legacy results */}
          {hasScorecard && result.scorecard ? (
            <ScorecardDisplay
              scorecard={result.scorecard}
              showRetake={true}
              onRetake={handleRetake}
            />
          ) : (
            /* Fallback: simple results when no scorecard object returned */
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-6xl mb-3">{result.passed ? '🎉' : '📚'}</div>
                <h1 className="text-3xl font-black text-white">
                  {result.passed ? 'Assessment Passed!' : 'Keep Going'}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {result.passed
                    ? 'Your knowledge is solid. Module 1 is now unlocked.'
                    : `You scored ${result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0}%. You need 90% to proceed — every attempt builds your understanding.`}
                </p>
              </div>

              {/* Score display */}
              <div
                className="rounded-2xl p-6 text-center"
                style={{
                  background: result.passed
                    ? 'linear-gradient(135deg, rgba(43,191,197,0.15), rgba(16,185,129,0.08))'
                    : 'linear-gradient(135deg, rgba(232,97,42,0.15), rgba(249,115,22,0.08))',
                  border: `1px solid ${result.passed ? 'rgba(43,191,197,0.4)' : 'rgba(232,97,42,0.4)'}`,
                }}
              >
                <p className="text-6xl font-black" style={{ color: result.passed ? '#2BBFC5' : '#E8612A' }}>
                  {result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0}%
                </p>
                <p className="text-sm mt-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {result.score} / {result.maxScore} points
                </p>
                <div className="mt-3 w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: `${result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0}%`,
                      background: result.passed
                        ? 'linear-gradient(90deg,#2BBFC5,#10b981)'
                        : 'linear-gradient(90deg,#E8612A,#f97316)',
                    }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Pass threshold: 90%</p>
              </div>

              {/* Domain breakdown */}
              {result.domainBreakdown?.length > 0 && (
                <div
                  className="rounded-2xl p-5 space-y-3"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <p className="text-sm font-black text-white">Your Four Pillars</p>
                  {result.domainBreakdown.map(d => {
                    const pct = d.maxScore > 0 ? Math.round((d.score / d.maxScore) * 100) : 0
                    return (
                      <div key={d.domain}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold" style={{ color: DOMAIN_COLORS[d.domain] || 'var(--text-secondary)' }}>
                            {DOMAIN_ICONS[d.domain]} {d.domain}
                          </span>
                          <span className="font-bold text-white">{pct}%</span>
                        </div>
                        <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-elevated)' }}>
                          <div
                            className="h-1.5 rounded-full transition-all duration-1000"
                            style={{
                              width: `${pct}%`,
                              background: DOMAIN_COLORS[d.domain] || 'var(--accent-1)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {result.passed ? (
                  <>
                    <button
                      onClick={() => router.push('/employee/lms')}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      Back to LMS
                    </button>
                    <button
                      onClick={() => router.push('/employee/lms/module/1')}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg,#2BBFC5,#10b981)' }}
                    >
                      Start Module 1 →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => router.push('/employee/lms')}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      Back to LMS
                    </button>
                    <button
                      onClick={handleRetake}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
                    >
                      Retake Assessment
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Questions Screen ──────────────────────────────────────────────
  if (!currentQuestion) return null

  const domainColor = DOMAIN_COLORS[currentQuestion.domain] || 'var(--accent-1)'

  return (
    <div className="min-h-screen flex flex-col p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blur-orb w-72 h-72 top-0 right-0 animate-pulse-slow" style={{ background: domainColor, opacity: 0.04 }} />
      </div>

      <div className="relative max-w-2xl mx-auto w-full flex-1 flex flex-col gap-5">
        {/* Progress header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: `${domainColor}20`, color: domainColor }}
            >
              {DOMAIN_ICONS[currentQuestion.domain]} {currentQuestion.domain}
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${domainColor}, var(--accent-2))`,
              }}
            />
          </div>
        </div>

        {/* Question card */}
        <div
          className="rounded-2xl p-6 flex-1 flex flex-col gap-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-base font-bold text-white leading-relaxed">
            {currentQuestion.text}
          </p>

          {/* Answer options */}
          <div className="space-y-3">
            {currentQuestion.answers.map(opt => {
              const isSelected = selectedOption === opt.label
              return (
                <button
                  key={opt.label}
                  onClick={() => selectOption(opt.label)}
                  className="w-full text-left flex items-start gap-3 p-4 rounded-xl transition-all duration-150"
                  style={{
                    background: isSelected
                      ? `${domainColor}18`
                      : 'var(--bg-elevated)',
                    border: isSelected
                      ? `2px solid ${domainColor}`
                      : '2px solid transparent',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5"
                    style={{
                      background: isSelected ? domainColor : 'var(--bg-base)',
                      color: isSelected ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {opt.label}
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: isSelected ? 'white' : 'var(--text-secondary)' }}
                  >
                    {opt.text}
                  </p>
                </button>
              )
            })}
          </div>

          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {Object.keys(answers).length} answered
          </p>
          <button
            onClick={handleNext}
            disabled={!selectedOption}
            className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
          >
            {currentIndex === questions.length - 1 ? 'Submit Assessment' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  )
}
