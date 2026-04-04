'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'

interface QuizField {
  fieldId: string
  label: string
  placeholder: string
  required: boolean
}

interface QuizQuestion {
  questionId: string
  title: string
  text: string
  questionType: string
  order: number
  // Multiple choice
  answers?: { label: string; text: string }[]
  points?: number
  // Likert scale
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMidLabel?: string
  scaleMaxLabel?: string
  // Open text
  fields?: QuizField[]
}

interface QuizData {
  quizId: string
  lessonId: string
  title: string
  quizMode: string
  passThreshold: number
  maxAttempts: number
  attemptsUsed: number
  alreadyCompleted: boolean
  questions: QuizQuestion[]
  totalQuestions: number
}

interface Props {
  quiz: QuizData
  onComplete: () => void
}

// ── LIKERT SCALE COMPONENT ──────────────────────────────────────────────────

function LikertQuiz({ quiz, onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ averageRating: number; totalRating: number; maxPossible: number; results: { questionId: string; title: string; text: string; rating: number }[] } | null>(null)

  const q = quiz.questions[currentQ]
  const totalQ = quiz.questions.length
  const allRated = Object.keys(ratings).length === totalQ
  const currentRating = ratings[q?.questionId] || 0

  const handleRate = (rating: number) => {
    if (!q) return
    setRatings(prev => ({ ...prev, [q.questionId]: rating }))
  }

  const handleNext = () => {
    if (currentQ < totalQ - 1) setCurrentQ(currentQ + 1)
  }

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1)
  }

  const handleSubmit = async () => {
    if (!allRated) return
    setSubmitting(true)
    try {
      const answers = Object.entries(ratings).map(([questionId, rating]) => ({
        questionId,
        rating,
      }))
      const res = await api.lmsSubmitQuiz(quiz.lessonId, answers as unknown as { questionId: string; selectedLabel: string }[]) as {
        averageRating: number; totalRating: number; maxPossible: number;
        results: { questionId: string; title: string; text: string; rating: number }[]
      }
      setResult(res)
      onComplete()
    } catch {
      // Silent
    } finally {
      setSubmitting(false)
    }
  }

  // Results view
  if (result) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-emerald-300 mb-1">Assessment Complete</h3>
          <p className="text-slate-400 text-sm">
            Your average score: <span className="text-white font-semibold">{result.averageRating}</span> / 5
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Total: {result.totalRating} out of {result.maxPossible}
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-400">Your Responses</h4>
          {result.results.map((r, i) => (
            <div key={r.questionId} className="flex items-center gap-3 p-3 bg-[#0a1220] rounded-lg border border-slate-800">
              <span className="text-xs text-slate-600 w-5">{i + 1}</span>
              <span className="text-sm text-slate-300 flex-1">{r.title || r.text}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <span
                    key={n}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                      n === r.rating
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (quiz.alreadyCompleted) {
    return (
      <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-emerald-300">Assessment Already Completed</h3>
        <p className="text-slate-400 text-sm mt-1">You have already completed this self-assessment.</p>
      </div>
    )
  }

  // One question at a time
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{quiz.title}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          {currentQ + 1} of {totalQ}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentQ
                ? 'bg-teal-400 scale-125'
                : ratings[quiz.questions[i].questionId]
                ? 'bg-teal-600'
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      {q && (
        <div className="p-8 bg-[#0a1220] rounded-xl border border-slate-800 text-center space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">{q.title}</h3>
            <p className="text-slate-400">{q.text}</p>
          </div>

          {/* 1-5 scale buttons */}
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => handleRate(n)}
                className={`w-14 h-14 rounded-full text-lg font-semibold transition-all ${
                  currentRating === n
                    ? 'bg-teal-500 text-white scale-110 shadow-lg shadow-teal-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:scale-105'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-xs text-slate-500 px-4">
            <span>{q.scaleMinLabel || 'Not at all accurate'}</span>
            <span>{q.scaleMidLabel || 'Somewhat accurate'}</span>
            <span>{q.scaleMaxLabel || 'Very accurate'}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentQ === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-teal-400 disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>

        {currentQ < totalQ - 1 ? (
          <button
            onClick={handleNext}
            disabled={!currentRating}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allRated || submitting}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Complete Assessment'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── MULTIPLE CHOICE COMPONENT ───────────────────────────────────────────────

function MultipleChoiceQuiz({ quiz, onComplete }: Props) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number; passed: boolean; passThreshold: number; correct: number; total: number;
    results: { questionId: string; selectedLabel: string; correctLabel: string; isCorrect: boolean; explanation: string }[]
  } | null>(null)
  const [error, setError] = useState('')

  const allAnswered = Object.keys(selectedAnswers).length === quiz.questions.length

  const handleSelect = (questionId: string, label: string) => {
    if (result) return
    setSelectedAnswers(prev => ({ ...prev, [questionId]: label }))
  }

  const handleSubmit = async () => {
    if (!allAnswered) return
    setSubmitting(true)
    setError('')
    try {
      const answers = Object.entries(selectedAnswers).map(([questionId, selectedLabel]) => ({
        questionId, selectedLabel,
      }))
      const res = await api.lmsSubmitQuiz(quiz.lessonId, answers) as typeof result
      setResult(res)
      if (res?.passed) onComplete()
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

  if (result) {
    return (
      <div className="space-y-6">
        <div className={`p-6 rounded-xl border ${
          result.passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {result.passed
              ? <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              : <AlertTriangle className="w-8 h-8 text-orange-400" />}
            <div>
              <h3 className={`text-lg font-bold ${result.passed ? 'text-emerald-300' : 'text-orange-300'}`}>
                {result.passed ? 'Congratulations! You passed!' : 'Not quite — keep going!'}
              </h3>
              <p className="text-sm text-slate-400">
                Score: {result.score}% ({result.correct}/{result.total}) — Pass: {result.passThreshold}%
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {quiz.questions.map((q, i) => {
            const r = result.results.find(r => r.questionId === q.questionId)
            return (
              <div key={q.questionId} className="p-4 bg-[#0a1220] rounded-xl border border-slate-800">
                <div className="flex items-start gap-2 mb-3">
                  {r?.isCorrect
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />}
                  <p className="text-sm text-slate-200">{i + 1}. {q.text}</p>
                </div>
                <div className="ml-7 space-y-1.5">
                  {(q.answers || []).map(a => {
                    const selected = r?.selectedLabel === a.label
                    const correct = r?.correctLabel === a.label
                    let bg = 'bg-slate-800/50'
                    if (correct) bg = 'bg-emerald-500/15 border-emerald-500/30'
                    else if (selected) bg = 'bg-red-500/15 border-red-500/30'
                    return (
                      <div key={a.label} className={`px-3 py-2 rounded-lg border border-slate-700 text-sm ${bg}`}>
                        <span className="font-medium text-slate-400 mr-2">{a.label}.</span>
                        <span className={correct ? 'text-emerald-300' : selected ? 'text-red-300' : 'text-slate-400'}>{a.text}</span>
                      </div>
                    )
                  })}
                  {r?.explanation && <p className="text-xs text-slate-500 mt-2 italic">{r.explanation}</p>}
                </div>
              </div>
            )
          })}
        </div>

        {!result.passed && (
          <button onClick={handleRetry} className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-colors">
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{quiz.title}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          {Object.keys(selectedAnswers).length}/{quiz.totalQuestions} answered
        </span>
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">{error}</div>}

      <div className="space-y-6">
        {quiz.questions.map((q, i) => (
          <div key={q.questionId} className="p-5 bg-[#0a1220] rounded-xl border border-slate-800">
            <p className="text-sm text-slate-200 mb-4">{i + 1}. {q.text}</p>
            <div className="space-y-2">
              {(q.answers || []).map(a => {
                const selected = selectedAnswers[q.questionId] === a.label
                return (
                  <button
                    key={a.label}
                    onClick={() => handleSelect(q.questionId, a.label)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selected ? 'bg-teal-500/15 border-teal-500/50 text-teal-200' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-medium text-slate-400 mr-2">{a.label}.</span>{a.text}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
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

// ── OPEN TEXT COMPONENT ────────────────────────────────────────────────────

function OpenTextQuiz({ quiz, onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0)
  // responses[questionId][fieldId] = value
  const [responses, setResponses] = useState<Record<string, Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    completed: boolean
    responses: { questionId: string; responses: { fieldId: string; value: string }[] }[]
  } | null>(null)
  const [error, setError] = useState('')

  const q = quiz.questions[currentQ]
  const totalQ = quiz.questions.length
  const fields = q?.fields || []

  const handleFieldChange = (questionId: string, fieldId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [fieldId]: value },
    }))
  }

  const isQuestionComplete = (question: QuizQuestion): boolean => {
    const qResponses = responses[question.questionId] || {}
    return (question.fields || [])
      .filter(f => f.required)
      .every(f => (qResponses[f.fieldId] || '').trim() !== '')
  }

  const allComplete = quiz.questions.every(isQuestionComplete)

  const handleNext = () => {
    if (currentQ < totalQ - 1) setCurrentQ(currentQ + 1)
  }

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1)
  }

  const handleSubmit = async () => {
    if (!allComplete) return
    setSubmitting(true)
    setError('')
    try {
      const answers = quiz.questions.map(question => ({
        questionId: question.questionId,
        responses: (question.fields || []).map(f => ({
          fieldId: f.fieldId,
          value: (responses[question.questionId]?.[f.fieldId] || '').trim(),
        })),
      }))
      const res = await api.lmsSubmitQuiz(quiz.lessonId, answers as unknown as { questionId: string; selectedLabel: string }[]) as typeof result
      setResult(res)
      onComplete()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetake = () => {
    setResponses({})
    setResult(null)
    setError('')
    setCurrentQ(0)
  }

  // Results / confirmation view
  if (result) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-emerald-300 mb-1">Responses Saved</h3>
          <p className="text-slate-400 text-sm">Your answers have been securely recorded.</p>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-400">Your Responses</h4>
          {result.responses.map((r) => {
            const qDef = quiz.questions.find(q => q.questionId === r.questionId)
            return (
              <div key={r.questionId} className="p-4 bg-[#0a1220] rounded-xl border border-slate-800">
                <p className="text-sm font-medium text-white mb-3">{qDef?.title || r.questionId}</p>
                <div className="space-y-2">
                  {r.responses.map((resp) => {
                    const fieldDef = qDef?.fields?.find(f => f.fieldId === resp.fieldId)
                    return (
                      <div key={resp.fieldId} className="flex items-start gap-2">
                        <span className="text-xs text-slate-500 min-w-[80px]">{fieldDef?.label || resp.fieldId}:</span>
                        <span className="text-sm text-teal-300">{resp.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleRetake}
          className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Retake
        </button>
      </div>
    )
  }

  if (quiz.alreadyCompleted) {
    return (
      <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-emerald-300">Already Completed</h3>
        <p className="text-slate-400 text-sm mt-1">You have already completed this exercise.</p>
      </div>
    )
  }

  // One question at a time
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{quiz.title}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          {currentQ + 1} of {totalQ}
        </span>
      </div>

      {/* Progress dots */}
      {totalQ > 1 && (
        <div className="flex gap-1.5 justify-center">
          {quiz.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentQ
                  ? 'bg-teal-400 scale-125'
                  : isQuestionComplete(quiz.questions[i])
                  ? 'bg-teal-600'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      )}

      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">{error}</div>}

      {/* Question card */}
      {q && (
        <div className="p-8 bg-[#0a1220] rounded-xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">{q.title}</h3>
            {q.text && <p className="text-slate-400">{q.text}</p>}
          </div>

          {/* Text input fields */}
          <div className="space-y-5">
            {fields.map((field) => (
              <div key={field.fieldId}>
                <label className="block text-sm text-slate-300 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <input
                  type="text"
                  value={responses[q.questionId]?.[field.fieldId] || ''}
                  onChange={(e) => handleFieldChange(q.questionId, field.fieldId, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentQ === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-teal-400 disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>

        {currentQ < totalQ - 1 ? (
          <button
            onClick={handleNext}
            disabled={!isQuestionComplete(q)}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allComplete || submitting}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Save My Answers'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── CHECKLIST COMPONENT ──────────────────────────────────────────────────────

function ChecklistQuiz({ quiz, onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    doneCount: number; totalItems: number; completed: boolean;
    results: { questionId: string; selectedLabel: string; done: boolean }[]
  } | null>(null)

  const q = quiz.questions[currentQ]
  const totalQ = quiz.questions.length
  const allAnswered = Object.keys(selections).length === totalQ

  const handleSelect = (label: string) => {
    if (!q) return
    setSelections(prev => ({ ...prev, [q.questionId]: label }))
  }

  const handleNext = () => {
    if (currentQ < totalQ - 1) setCurrentQ(currentQ + 1)
  }
  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1)
  }

  const handleSubmit = async () => {
    if (!allAnswered) return
    setSubmitting(true)
    try {
      const answers = Object.entries(selections).map(([questionId, selectedLabel]) => ({
        questionId, selectedLabel,
      }))
      const res = await api.lmsSubmitQuiz(quiz.lessonId, answers) as typeof result
      setResult(res)
      onComplete()
    } catch {
      // Silent
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-emerald-300 mb-1">Checklist Complete</h3>
          <p className="text-slate-400 text-sm">
            {result.doneCount} of {result.totalItems} items checked off
          </p>
        </div>
        <div className="space-y-3">
          {result.results.map((r, i) => {
            const qDef = quiz.questions.find(q => q.questionId === r.questionId)
            return (
              <div key={r.questionId} className={`flex items-center gap-3 p-4 rounded-xl border ${
                r.done ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'
              }`}>
                <span className={`text-lg ${r.done ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {r.done ? '\u2705' : '\u23F3'}
                </span>
                <span className="text-sm text-slate-300">{qDef?.text || `Item ${i + 1}`}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (quiz.alreadyCompleted) {
    return (
      <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-emerald-300">Checklist Already Completed</h3>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{quiz.title}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          {currentQ + 1} of {totalQ}
        </span>
      </div>

      <div className="flex gap-1.5 justify-center">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentQ ? 'bg-teal-400 scale-125'
              : selections[quiz.questions[i].questionId] ? 'bg-teal-600' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {q && (
        <div className="p-8 bg-[#0a1220] rounded-xl border border-slate-800 space-y-6">
          <p className="text-lg text-white font-medium text-center">{q.text}</p>
          <div className="flex justify-center gap-4">
            {(q.answers || []).map(a => {
              const selected = selections[q.questionId] === a.label
              const isCheck = a.label === 'A'
              return (
                <button
                  key={a.label}
                  onClick={() => handleSelect(a.label)}
                  className={`px-8 py-4 rounded-xl text-sm font-semibold transition-all ${
                    selected
                      ? isCheck
                        ? 'bg-emerald-500 text-white scale-105 shadow-lg shadow-emerald-500/30'
                        : 'bg-orange-500 text-white scale-105 shadow-lg shadow-orange-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:scale-105'
                  }`}
                >
                  {isCheck ? '\u2705 ' : ''}{a.text}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={handlePrev} disabled={currentQ === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-teal-400 disabled:opacity-30 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>
        {currentQ < totalQ - 1 ? (
          <button onClick={handleNext} disabled={!selections[q?.questionId]}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!allAnswered || submitting}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-medium transition-colors">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Complete Checklist'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── MAIN EXPORT — routes to correct component ───────────────────────────────

export default function QuizEngine({ quiz, onComplete }: Props) {
  if (quiz.quizMode === 'likert_scale') {
    return <LikertQuiz quiz={quiz} onComplete={onComplete} />
  }
  if (quiz.quizMode === 'open_text') {
    return <OpenTextQuiz quiz={quiz} onComplete={onComplete} />
  }
  if (quiz.quizMode === 'checklist') {
    return <ChecklistQuiz quiz={quiz} onComplete={onComplete} />
  }
  return <MultipleChoiceQuiz quiz={quiz} onComplete={onComplete} />
}
