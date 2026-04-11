'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Loader2, AlertCircle, CheckCircle2, Send, HelpCircle, Star, Search } from 'lucide-react'
import { api } from '@/lib/api'

interface Question {
  questionId: string
  question: string
  answer: string
  confidence: number
  shouldEscalate: boolean
  createdAt: string
  rating?: number
}

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
}

export default function SupportPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [faqList, setFaqList] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [searchFaq, setSearchFaq] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [error, setError] = useState('')

  async function loadFAQ() {
    try {
      const result = await api.employeeGetFAQ()
      setFaqList(result.faq || [])
    } catch (e: unknown) {
      Sentry.captureException(e, { tags: { action: 'loadFAQ' } })
    }
  }

  async function handlePostQuestion() {
    if (!questionText.trim()) {
      setError('Please enter a question')
      return
    }

    setPosting(true)
    setError('')
    try {
      const result = await api.employeePostQuestion(questionText)
      setQuestions([result, ...questions])
      setQuestionText('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to post question')
    } finally {
      setPosting(false)
    }
  }

  async function handleRateAnswer(questionId: string, rating: number) {
    try {
      await api.employeeRateAnswer(questionId, rating)
      setQuestions(
        questions.map(q =>
          q.questionId === questionId ? { ...q, rating } : q
        )
      )
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to rate answer')
    }
  }

  async function searchFAQ() {
    if (!searchFaq.trim()) {
      loadFAQ()
      return
    }

    try {
      const result = await api.employeeGetFAQ(searchFaq)
      setFaqList(result.faq || [])
    } catch (e: unknown) {
      Sentry.captureException(e, { tags: { action: 'searchFAQ' } })
    }
  }

  useEffect(() => {
    loadFAQ()
    setLoading(false)
  }, [])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-50 border-green-200'
    if (confidence >= 0.6) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'High confidence'
    if (confidence >= 0.6) return 'Moderate confidence'
    return 'Low confidence - HR review recommended'
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading support section...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Support & Help</h1>
          </div>
          <p className="text-gray-600">Ask questions about your legacy planning journey. Our AI assistant answers instantly.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Post Question Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Ask a Question</h2>
          <div className="space-y-4">
            <textarea
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="What would you like to know about your legacy planning?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              maxLength={1000}
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{questionText.length}/1000 characters</p>
              <button
                onClick={handlePostQuestion}
                disabled={posting || !questionText.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {posting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Post Question
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Your Questions */}
        {questions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Your Questions ({questions.length})</h2>
            <div className="space-y-4">
              {questions.map(q => (
                <div key={q.questionId} className={`border rounded-lg p-4 ${getConfidenceColor(q.confidence)}`}>
                  {/* Question */}
                  <h3 className="font-semibold text-gray-900 mb-2">{q.question}</h3>

                  {/* Answer */}
                  <p className="text-gray-700 mb-3">{q.answer}</p>

                  {/* Metadata */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-sm text-gray-600">
                      <span>{getConfidenceText(q.confidence)}</span>
                      {q.shouldEscalate && (
                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">HR Review Needed</span>
                      )}
                    </div>

                    {/* Rating */}
                    {!q.rating ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Was this helpful?</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(rating => (
                            <button
                              key={rating}
                              onClick={() => handleRateAnswer(q.questionId, rating)}
                              className="p-1 hover:bg-gray-200 rounded transition"
                            >
                              <Star className={`w-4 h-4 ${rating <= 2 ? 'text-gray-400' : 'text-yellow-500'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        <span>Rated: </span>
                        <span className="font-semibold">{q.rating}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>

          {/* Search */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={searchFaq}
              onChange={e => setSearchFaq(e.target.value)}
              placeholder="Search FAQ..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={searchFAQ}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* FAQ List */}
          {faqList.length > 0 ? (
            <div className="space-y-3">
              {faqList.map(faq => (
                <details key={faq.id} className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition">
                  <summary className="font-semibold text-gray-900">{faq.question}</summary>
                  <p className="text-gray-700 mt-3">{faq.answer}</p>
                  <span className="inline-block mt-3 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{faq.category}</span>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">No FAQs found. Try a different search.</p>
          )}
        </div>
      </div>
    </div>
  )
}
