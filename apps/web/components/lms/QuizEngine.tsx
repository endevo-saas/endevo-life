'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react'

interface QuizQuestion {
  questionId: string
  text: string
  questionType: string
  order: number
  answers: { label: string; text: string }[]
  points: number
}

interface QuizData {
  quizId: string
  lessonId: string
  title: string
  passThreshold: number
  maxAttempts: number
  attemptsUsed: number
  alreadyPassed: boolean
  canRetry: boolean
  questions: QuizQuestion[]
  totalQuestions: number
}

interface QuizResult {
  questionId: string
  selectedLabel: string
  correctLabel: string
  isCorrect: boolean
  explanation: string
}

interface SubmitResponse {
  score: number
  passed: boolean
  passThreshold: number
  correct: number
  total: number
  attemptNumber: number
  bestScore: number
  results: QuizResult[]
}

interface Props {
  quiz: QuizData
  onComplete: () => void
}

export default function QuizEngine({ quiz, onComplete }: Props) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [error, setError] = useState('')

  const allAnswered = Object.keys(selectedAnswers).length === quiz.questions.length

  const handleSelect = (questionId: string, label: string) => {
    if (result) return // Don't allow changes after submit
    setSelectedAnswers(prev => ({ ...prev, [questionId]: label }))
  }

  const handleSubmit = async () => {
    if (!allAnswered) return
    setSubmitting(true)
    setError('')

    try {
      const answers = Object.entries(selectedAnswers).map(([questionId, selectedLabel]) => ({
        questionId,
        selectedLabel,
      }))
      const res = await api.lmsSubmitQuiz(quiz.lessonId, answers) as SubmitResponse
      setResult(res)
      if (res.passed) {
        onComplete()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    setSelectedAnswers({})
    setResult(null)
    setError('')
  }

  // Show results view
  if (result) {
    return (
      <div className="space-y-6">
        {/* Score card */}
        <div className={`p-6 rounded-xl border ${
          result.passed
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {result.passed
              ? <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              : <AlertTriangle className="w-8 h-8 text-orange-400" />
            }
            <div>
              <h3 className={`text-lg font-bold ${result.passed ? 'text-emerald-300' : 'text-orange-300'}`}>
                {result.passed ? 'Congratulations! You passed!' : 'Not quite — keep going!'}
              </h3>
              <p className="text-sm text-slate-400">
                Score: {result.score}% ({result.correct}/{result.total} correct) — Pass mark: {result.passThreshold}%
              </p>
            </div>
          </div>
        </div>

        {/* Detailed results */}
        <div className="space-y-4">
          {quiz.questions.map((q, i) => {
            const r = result.results.find(r => r.questionId === q.questionId)
            return (
              <div key={q.questionId} className="p-4 bg-[#0a1220] rounded-xl border border-slate-800">
                <div className="flex items-start gap-2 mb-3">
                  {r?.isCorrect
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  }
                  <p className="text-sm text-slate-200">{i + 1}. {q.text}</p>
                </div>
                <div className="ml-7 space-y-1.5">
                  {q.answers.map(a => {
                    const selected = r?.selectedLabel === a.label
                    const correct = r?.correctLabel === a.label
                    let bg = 'bg-slate-800/50'
                    if (correct) bg = 'bg-emerald-500/15 border-emerald-500/30'
                    else if (selected && !r?.isCorrect) bg = 'bg-red-500/15 border-red-500/30'

                    return (
                      <div key={a.label} className={`px-3 py-2 rounded-lg border border-slate-700 text-sm ${bg}`}>
                        <span className="font-medium text-slate-400 mr-2">{a.label}.</span>
                        <span className={correct ? 'text-emerald-300' : selected ? 'text-red-300' : 'text-slate-400'}>
                          {a.text}
                        </span>
                      </div>
                    )
                  })}
                  {r?.explanation && (
                    <p className="text-xs text-slate-500 mt-2 italic">{r.explanation}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Retry button */}
        {!result.passed && (
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        )}
      </div>
    )
  }

  // Quiz-taking view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{quiz.title}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          {Object.keys(selectedAnswers).length}/{quiz.totalQuestions} answered
        </span>
      </div>

      {quiz.alreadyPassed && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-300">
          You have already passed this quiz.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {quiz.questions.map((q, i) => (
          <div key={q.questionId} className="p-5 bg-[#0a1220] rounded-xl border border-slate-800">
            <p className="text-sm text-slate-200 mb-4">{i + 1}. {q.text}</p>
            <div className="space-y-2">
              {q.answers.map(a => {
                const selected = selectedAnswers[q.questionId] === a.label
                return (
                  <button
                    key={a.label}
                    onClick={() => handleSelect(q.questionId, a.label)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selected
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-200'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-medium text-slate-400 mr-2">{a.label}.</span>
                    {a.text}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting || quiz.alreadyPassed}
        className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit Answers'}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Pass mark: {quiz.passThreshold}%
        {quiz.maxAttempts > 0 && ` — Attempt ${quiz.attemptsUsed + 1} of ${quiz.maxAttempts}`}
      </p>
    </div>
  )
}
