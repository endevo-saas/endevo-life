'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, CheckCircle, ChevronLeft, ChevronRight, Loader2, AlertCircle, Award,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  DOMAIN_ORDER,
  calculateDomainProgress,
  findResumeIndex,
  calculateOverallProgress,
  type AssessmentQuestion,
  type DomainProgress,
} from '@/lib/domain-assessment'

// ---------------------------------------------------------------------------
// Domain stepper — shows all four domains with completion state
// ---------------------------------------------------------------------------

interface DomainStepperProps {
  progress: DomainProgress[]
  currentDomain: string
}

function DomainStepper({ progress, currentDomain }: DomainStepperProps) {
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
      {progress.map((p, idx) => {
        const isCurrent = p.domain === currentDomain
        return (
          <div key={p.domain} className="flex items-center gap-1 flex-shrink-0">
            <div
              data-domain={p.domain}
              data-active={isCurrent ? 'true' : 'false'}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={p.isLocked ? 'true' : 'false'}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${p.isComplete
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : isCurrent
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                    : p.isLocked
                      ? 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                      : 'bg-white/5 text-slate-400 border border-white/10'
                }
              `}
            >
              {p.isComplete
                ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                : <span className="w-3.5 h-3.5 rounded-full border border-current flex-shrink-0 inline-block" />}
              {p.label}
              {p.total > 0 && (
                <span className="text-xs opacity-60">{p.answered}/{p.total}</span>
              )}
            </div>
            {idx < progress.length - 1 && (
              <div className={`w-5 h-px flex-shrink-0 ${
                p.isComplete ? 'bg-green-500/40' : 'bg-white/10'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Answer option button
// ---------------------------------------------------------------------------

interface AnswerOptionProps {
  label: string
  text: string
  selected: boolean
  onSelect: () => void
}

function AnswerOption({ label, text, selected, onSelect }: AnswerOptionProps) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        selected
          ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
          : 'border-white/5 hover:bg-white/5 text-slate-300'
      }`}
    >
      <input
        type="radio"
        name="answer"
        value={label}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
        selected ? 'border-purple-400 bg-purple-400' : 'border-slate-500'
      }`} />
      <span className="text-sm font-medium text-slate-400 flex-shrink-0">{label}.</span>
      {text}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function DomainAssessmentPage() {
  const router = useRouter()

  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    submittedAt: string
    attemptNumber: number
    modulesUnlocked: boolean
    scorecard: {
      overallScore: number
      domainScores: Record<string, { percentage: number; tier: string }>
    }
  } | null>(null)

  // Load questions on mount; resume from status endpoint if available
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [questionsResp, statusResp] = await Promise.all([
          api.lmsGetAssessmentQuestions() as Promise<{
            questions: AssessmentQuestion[]
            totalQuestions: number
          }>,
          api.lmsGetAssessmentStatus() as Promise<{
            attempted: boolean
            currentQuestion?: number
            lastAnsweredQuestion?: number
          }>,
        ])

        if (cancelled) return

        const qs = questionsResp?.questions ?? []
        setQuestions(qs)

        // Restore answers from status if available (future extension point)
        const savedAnswers: Record<string, string> = {}
        setAnswers(savedAnswers)

        // Resume from last answered position if status indicates progress
        if (statusResp?.lastAnsweredQuestion && statusResp.lastAnsweredQuestion > 0) {
          const resumeAt = Math.min(statusResp.lastAnsweredQuestion, qs.length - 1)
          setCurrentIndex(resumeAt)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load assessment')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const currentQuestion = questions[currentIndex] ?? null
  const domainProgress = calculateDomainProgress(questions, answers)
  const overallProgress = calculateOverallProgress(questions, answers)
  const currentDomain = currentQuestion?.domain ?? ''

  const isFirstQuestion = currentIndex === 0
  const isLastQuestion = currentIndex === questions.length - 1
  const currentAnswered = currentQuestion ? currentQuestion.questionId in answers : false

  const handleAnswer = useCallback((questionId: string, label: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: label }))
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1))
  }, [questions.length])

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const handleSubmit = useCallback(async () => {
    const unanswered = questions.filter(q => !(q.questionId in answers))
    if (unanswered.length > 0) {
      setError(`Please answer all ${questions.length} questions before submitting. ${unanswered.length} remaining.`)
      // Jump to first unanswered question
      const firstUnansweredIdx = findResumeIndex(questions, answers)
      setCurrentIndex(firstUnansweredIdx)
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const submittedAnswers = questions.map(q => ({
        questionId: q.questionId,
        selectedLabel: answers[q.questionId],
      }))

      const r = await api.lmsSubmitAssessment(submittedAnswers) as typeof result
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }, [questions, answers])

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  // ── Result state ─────────────────────────────────────────────────────────────
  if (result) {
    const score = result.scorecard?.overallScore ?? 0
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="glass p-8 text-center border border-green-500/30 animate-slide-up">
            <Award className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <div className="text-4xl font-bold text-white mb-2">{score}%</div>
            <div className="text-xl font-semibold text-green-400 mb-2">
              Assessment Complete — All Modules Unlocked!
            </div>
            <div className="text-slate-400 mb-6 text-sm">
              Attempt #{result.attemptNumber} · {new Date(result.submittedAt).toLocaleDateString()}
            </div>

            {result.scorecard?.domainScores && (
              <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                {DOMAIN_ORDER.map(domain => {
                  const ds = result.scorecard.domainScores[
                    Object.keys(result.scorecard.domainScores).find(
                      k => k.toLowerCase().includes(domain)
                    ) ?? ''
                  ]
                  if (!ds) return null
                  return (
                    <div key={domain} className="p-3 bg-white/5 rounded-xl">
                      <div className="text-xs text-slate-400 capitalize mb-1">{domain}</div>
                      <div className="text-lg font-bold text-white">{ds.percentage}%</div>
                      <div className="text-xs text-slate-500">{ds.tier}</div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push('/employee/dashboard')}
                className="btn-primary text-sm"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => router.push('/employee/lms')}
                className="px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm"
              >
                Start Learning
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto glass p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <div className="text-slate-400">No assessment questions available yet.</div>
        </div>
      </div>
    )
  }

  // ── Assessment UI ────────────────────────────────────────────────────────────
  const displayNumber = currentIndex + 1
  const domainDisplayIndex = currentQuestion
    ? questions.slice(0, currentIndex + 1).filter(q => q.domain === currentDomain).length
    : 0
  const domainTotal = questions.filter(q => q.domain === currentDomain).length

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-purple-400" />
            Life Readiness Assessment
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Question {displayNumber} of {questions.length} · {overallProgress}% complete
          </p>
        </div>

        {/* Domain stepper */}
        <DomainStepper progress={domainProgress} currentDomain={currentDomain} />

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Domain section header */}
        {currentQuestion && (
          <div className="mb-3 flex items-center gap-2">
            <span
              data-domain={currentDomain}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-purple-600/20 text-purple-300 border border-purple-500/20"
            >
              {currentDomain}
            </span>
            <span className="text-slate-500 text-xs">
              Question {domainDisplayIndex} of {domainTotal} in this domain
            </span>
          </div>
        )}

        {/* Question card */}
        {currentQuestion && (
          <div key={currentQuestion.questionId} className="glass p-6 animate-slide-up mb-4">
            <div className="font-medium text-white mb-4 leading-relaxed">
              <span className="text-purple-400 mr-2">Q{displayNumber}.</span>
              {currentQuestion.text}
            </div>
            <div className="space-y-2">
              {currentQuestion.answers.map(opt => (
                <AnswerOption
                  key={opt.label}
                  label={opt.label}
                  text={opt.text}
                  selected={answers[currentQuestion.questionId] === opt.label}
                  onSelect={() => handleAnswer(currentQuestion.questionId, opt.label)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={isFirstQuestion}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <div className="text-slate-500 text-xs text-center">
            {Object.keys(answers).length} of {questions.length} answered
          </div>

          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                : <><CheckCircle className="w-4 h-4" /> Submit Assessment</>}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!currentAnswered}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
