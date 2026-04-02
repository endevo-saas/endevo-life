'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

type QuestionType = 'assessment' | 'quiz'

interface AnswerOption {
  label: string
  text: string
  scoreWeight?: number
}

interface LmsQuestion {
  questionId: string
  type: QuestionType
  domain?: string
  text: string
  answers: AnswerOption[]
  correctLabel: string
  explanation?: string
  videoId?: string
  timestamp?: number
  scoreWeight?: number
}

const DOMAINS = ['Legal', 'Financial', 'Physical', 'Digital']

const EMPTY_QUESTION: Omit<LmsQuestion, 'questionId'> = {
  type: 'assessment',
  domain: 'Legal',
  text: '',
  answers: [
    { label: 'A', text: '' },
    { label: 'B', text: '' },
    { label: 'C', text: '' },
    { label: 'D', text: '' },
  ],
  correctLabel: 'A',
  explanation: '',
  scoreWeight: 1,
}

function QuestionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<LmsQuestion>
  onSave: (data: Partial<LmsQuestion>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<LmsQuestion>>({ ...EMPTY_QUESTION, ...initial })

  function updateAnswer(idx: number, text: string) {
    const answers = (form.answers ?? []).map((a, i) => i === idx ? { ...a, text } : a)
    setForm(prev => ({ ...prev, answers }))
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid rgba(94,106,210,0.35)' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Type */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Question Type
          </label>
          <select
            value={form.type}
            onChange={e => setForm(prev => ({ ...prev, type: e.target.value as QuestionType }))}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
          >
            <option value="assessment">Assessment</option>
            <option value="quiz">Inline Quiz</option>
          </select>
        </div>

        {/* Domain */}
        {form.type === 'assessment' && (
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Domain
            </label>
            <select
              value={form.domain}
              onChange={e => setForm(prev => ({ ...prev, domain: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
            >
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {/* Video ID (quiz only) */}
        {form.type === 'quiz' && (
          <>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Video ID
              </label>
              <input
                type="text"
                value={form.videoId ?? ''}
                onChange={e => setForm(prev => ({ ...prev, videoId: e.target.value }))}
                placeholder="e.g. module1-main"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Trigger Timestamp (seconds)
              </label>
              <input
                type="number"
                min={0}
                value={form.timestamp ?? ''}
                onChange={e => setForm(prev => ({ ...prev, timestamp: parseInt(e.target.value) || 0 }))}
                placeholder="e.g. 120"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
              />
            </div>
          </>
        )}
      </div>

      {/* Question text */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Question Text
        </label>
        <textarea
          rows={3}
          value={form.text ?? ''}
          onChange={e => setForm(prev => ({ ...prev, text: e.target.value }))}
          placeholder="Enter the question…"
          className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
        />
      </div>

      {/* Answer options */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Answer Options
        </label>
        {(form.answers ?? []).map((ans, i) => (
          <div key={ans.label} className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{
                background: form.correctLabel === ans.label ? '#2BBFC5' : 'var(--bg-elevated)',
                color: form.correctLabel === ans.label ? 'white' : 'var(--text-muted)',
              }}
            >
              {ans.label}
            </div>
            <input
              type="text"
              value={ans.text}
              onChange={e => updateAnswer(i, e.target.value)}
              placeholder={`Answer ${ans.label}`}
              className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
            />
            <button
              onClick={() => setForm(prev => ({ ...prev, correctLabel: ans.label }))}
              className="text-xs px-3 py-2 rounded-lg font-semibold transition-all flex-shrink-0"
              style={{
                background: form.correctLabel === ans.label ? 'rgba(43,191,197,0.2)' : 'var(--bg-elevated)',
                color: form.correctLabel === ans.label ? '#2BBFC5' : 'var(--text-muted)',
                border: `1px solid ${form.correctLabel === ans.label ? 'rgba(43,191,197,0.4)' : 'var(--border-subtle)'}`,
              }}
            >
              {form.correctLabel === ans.label ? '✓ Correct' : 'Mark correct'}
            </button>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Explanation (shown after answer)
        </label>
        <textarea
          rows={2}
          value={form.explanation ?? ''}
          onChange={e => setForm(prev => ({ ...prev, explanation: e.target.value }))}
          placeholder="Brief explanation of the correct answer…"
          className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', outline: 'none' }}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.text?.trim()}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#5E6AD2,#8B5CF6)' }}
        >
          {saving ? 'Saving…' : 'Save Question'}
        </button>
      </div>
    </div>
  )
}

export default function AdminLmsQuestionsPage() {
  const [activeTab, setActiveTab] = useState<QuestionType>('assessment')
  const [questions, setQuestions] = useState<LmsQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [entered, setEntered] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.lmsAdminGetQuestions(activeTab) as { questions: LmsQuestion[] }
      setQuestions(res.questions || [])
      setTimeout(() => setEntered(true), 80)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    setEntered(false)
    load()
  }, [load])

  async function handleSave(id: string | null, data: Partial<LmsQuestion>) {
    setSaving(true)
    try {
      if (id) {
        await api.lmsAdminUpdateQuestion(id, data as Record<string, unknown>)
      } else {
        await api.lmsAdminCreateQuestion(data as Record<string, unknown>)
      }
      setShowAddForm(false)
      setEditingId(null)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await api.lmsAdminDeleteQuestion(id)
      setDeleteConfirmId(null)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete question')
    } finally {
      setDeleting(false)
    }
  }

  const DOMAIN_COLORS: Record<string, string> = {
    Legal: '#5E6AD2', Financial: '#E8612A', Physical: '#2BBFC5', Digital: '#8B5CF6',
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow" style={{ background: '#5E6AD2', opacity: 0.05 }} />
      </div>

      <div
        className={`relative max-w-5xl mx-auto space-y-5 transition-all duration-700 ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">LMS Question Manager</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Manage assessment and inline quiz questions
            </p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#5E6AD2,#8B5CF6)' }}
            >
              + Add Question
            </button>
          )}
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          {(['assessment', 'quiz'] as QuestionType[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setShowAddForm(false); setEditingId(null) }}
              className="px-5 py-2 rounded-lg font-semibold text-sm transition-all capitalize"
              style={{
                background: activeTab === tab ? 'var(--gradient-brand)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
              }}
            >
              {tab === 'assessment' ? '📋 Assessment Questions' : '⚡ Inline Quiz Questions'}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="p-4 rounded-2xl text-sm flex items-center gap-3"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {error}
            <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <QuestionForm
            initial={{ type: activeTab, domain: 'Legal' }}
            onSave={data => handleSave(null, data)}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        )}

        {/* Questions list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : questions.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-4xl mb-3">📭</p>
            <p className="text-base font-bold text-white">No questions yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Add your first {activeTab} question above
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.questionId}>
                {editingId === q.questionId ? (
                  <QuestionForm
                    initial={q}
                    onSave={data => handleSave(q.questionId, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <div
                    className="rounded-2xl p-5 transition-all"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {q.domain && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${DOMAIN_COLORS[q.domain] || '#5E6AD2'}20`, color: DOMAIN_COLORS[q.domain] || '#5E6AD2' }}
                            >
                              {q.domain}
                            </span>
                          )}
                          {q.videoId && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}
                            >
                              Video: {q.videoId} @ {q.timestamp}s
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white leading-snug">{q.text}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {q.answers.map(a => (
                            <span
                              key={a.label}
                              className="text-xs px-2 py-0.5 rounded-lg font-medium"
                              style={{
                                background: a.label === q.correctLabel ? 'rgba(43,191,197,0.15)' : 'var(--bg-elevated)',
                                color: a.label === q.correctLabel ? '#2BBFC5' : 'var(--text-muted)',
                                border: a.label === q.correctLabel ? '1px solid rgba(43,191,197,0.3)' : '1px solid transparent',
                              }}
                            >
                              {a.label}: {a.text}
                              {a.label === q.correctLabel && ' ✓'}
                            </span>
                          ))}
                        </div>
                        {q.explanation && (
                          <p className="text-xs mt-1.5 italic" style={{ color: 'var(--text-muted)' }}>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setEditingId(q.questionId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(q.questionId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Delete confirm */}
                    {deleteConfirmId === q.questionId && (
                      <div
                        className="mt-3 pt-3 flex items-center gap-3"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      >
                        <p className="text-sm flex-1" style={{ color: '#f87171' }}>
                          Delete this question? This cannot be undone.
                        </p>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(q.questionId)}
                          disabled={deleting}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: '#ef4444' }}
                        >
                          {deleting ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && questions.length > 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {questions.length} {activeTab} question{questions.length !== 1 ? 's' : ''} total
          </p>
        )}
      </div>
    </div>
  )
}
