'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ClipboardList, CheckCircle, XCircle, Loader2, AlertCircle, Award } from 'lucide-react'
import { api, Question } from '@/lib/api'

export default function AssessmentPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number; passed: boolean; correct: number; total: number; certificate_issued: boolean
  } | null>(null)

  useEffect(() => {
    api.employeeAssessment(courseId)
      .then(d => setQuestions(d.questions))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load assessment'))
      .finally(() => setLoading(false))
  }, [courseId])

  async function submit() {
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all questions before submitting.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const r = await api.employeeSubmitAssessment(courseId, answers) as typeof result
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  )

  if (result) return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className={`glass p-8 text-center border ${result.passed ? 'border-green-500/30' : 'border-red-500/30'} animate-slide-up`}>
          {result.passed
            ? <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            : <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />}
          <div className="text-4xl font-bold text-white mb-2">{result.score}%</div>
          <div className={`text-xl font-semibold mb-2 ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
            {result.passed ? 'Congratulations! You passed!' : 'Not quite — try again'}
          </div>
          <div className="text-slate-400 mb-6">
            {result.correct} of {result.total} correct answers
          </div>
          {result.certificate_issued && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-6 flex items-center gap-3">
              <Award className="w-6 h-6 text-yellow-400" />
              <div className="text-left">
                <div className="text-yellow-400 font-semibold">Certificate Issued!</div>
                <div className="text-sm text-slate-400">Check your certificates page to view and download</div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            {!result.passed && (
              <button onClick={() => { setResult(null); setAnswers({}) }} className="btn-primary text-sm">
                Try Again
              </button>
            )}
            <button onClick={() => router.push('/employee/training')} className="px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm">
              Back to Training
            </button>
            {result.certificate_issued && (
              <button onClick={() => router.push('/employee/certificates')} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all text-sm">
                <Award className="w-4 h-4" /> View Certificate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-purple-400" />
            Assessment
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {Object.keys(answers).length} of {questions.length} questions answered · Pass score: 70%
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {questions.length === 0 ? (
          <div className="glass p-12 text-center">
            <div className="text-slate-400">No questions available for this course yet.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div key={q.questionId} className="glass p-6 animate-slide-up">
                <div className="font-medium text-white mb-4">
                  <span className="text-purple-400 mr-2">Q{idx + 1}.</span>
                  {q.question}
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        answers[q.questionId] === opt
                          ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                          : 'border-white/5 hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.questionId}
                        value={opt}
                        checked={answers[q.questionId] === opt}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.questionId]: opt }))}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                        answers[q.questionId] === opt
                          ? 'border-purple-400 bg-purple-400'
                          : 'border-slate-500'
                      }`} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                : <><CheckCircle className="w-5 h-5" /> Submit Assessment</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
