'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Clock, Flag, Sparkles, Trophy, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'

interface DomainScore {
  [domain: string]: number
}

interface PlaybookTask {
  rank: number
  domain: string
  domainLabel: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedHours: number
  status: 'pending' | 'in_progress' | 'completed'
}

interface Playbook {
  title: string
  subtitle: string
  overview: string
  nextSteps: string
  tasks: PlaybookTask[]
  generatedAt: string
}

interface PlaybookData {
  playbookId: string
  overallScore: number
  domainScores: DomainScore
  weakDomains: string[]
  strongDomains: string[]
  analysis: string
  playbook: Playbook
  generatedAt: string
}

const DOMAIN_COLORS: { [key: string]: { bg: string; border: string; text: string; icon: string } } = {
  legal: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '⚖️' },
  financial: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: '💰' },
  physical: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '❤️' },
  digital: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '🔐' },
}

const PRIORITY_COLORS: { [key: string]: string } = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-green-600 bg-green-50 border-green-200',
}

export default function MyPlaybookPage() {
  const [playbook, setPlaybook] = useState<PlaybookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function loadPlaybook() {
    setLoading(true)
    setError('')
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30000)
      )
      const result = await Promise.race([api.employeeGeneratePlaybook(), timeout])
      setPlaybook(result as PlaybookData)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load playbook'
      setError(msg === 'TIMEOUT'
        ? 'Playbook generation is taking too long. Please try again in a moment.'
        : msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    try {
      await api.employeeSendPlaybookEmail()
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 5000)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  useEffect(() => {
    loadPlaybook()
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Generating your personalized playbook...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-700">Error Loading Playbook</h3>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => loadPlaybook()}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!playbook) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600">Complete your assessment first to generate your playbook.</p>
        </div>
      </div>
    )
  }

  const highPriorityTasks = playbook.playbook.tasks.filter(t => t.priority === 'high')
  const otherTasks = playbook.playbook.tasks.filter(t => t.priority !== 'high')

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">{playbook.playbook.title}</h1>
              </div>
              <p className="text-gray-600">{playbook.playbook.subtitle}</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-blue-600">{playbook.overallScore}%</div>
              <p className="text-gray-600 text-sm">Overall Readiness</p>
            </div>
          </div>
        </div>

        {/* Overview & Analysis */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <p className="text-gray-700 mb-4">{playbook.playbook.overview}</p>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-blue-900 text-sm"><strong>Assessment Insight:</strong> {playbook.analysis}</p>
          </div>
        </div>

        {/* Domain Scores */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Your Readiness by Domain
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(playbook.domainScores).map(([domain, score]) => {
              const colors = DOMAIN_COLORS[domain] || DOMAIN_COLORS.legal
              const isWeak = playbook.weakDomains.includes(domain)
              return (
                <div
                  key={domain}
                  className={`${colors.bg} border ${colors.border} rounded-lg p-4`}
                >
                  <div className="text-2xl mb-2">{colors.icon}</div>
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
                    {domain.charAt(0).toUpperCase() + domain.slice(1)}
                  </p>
                  <p className={`text-3xl font-bold ${colors.text}`}>{score}%</p>
                  {isWeak && (
                    <p className="text-xs mt-2 font-semibold text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Focus Area
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* High Priority Tasks */}
        {highPriorityTasks.length > 0 && (
          <div className="bg-white border border-red-200 bg-red-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 text-red-900 flex items-center gap-2">
              <Flag className="w-5 h-5" />
              High Priority Actions
            </h2>
            <div className="space-y-4">
              {highPriorityTasks.map(task => (
                <div key={task.rank} className="bg-white border border-red-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {task.rank}. {task.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    </div>
                    <span className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold whitespace-nowrap">
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ~{task.estimatedHours} hours
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{task.domainLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Tasks */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Your Complete Action Plan ({playbook.playbook.tasks.length} tasks)
          </h2>
          <div className="space-y-3">
            {playbook.playbook.tasks.map(task => (
              <div
                key={task.rank}
                className={`border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition ${PRIORITY_COLORS[task.priority]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{task.rank}.</span>
                      <h3 className="font-semibold">{task.title}</h3>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-xs whitespace-nowrap">{task.estimatedHours}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Success Message */}
        {emailSent && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-green-700 font-semibold">Email sent successfully!</p>
              <p className="text-green-600 text-sm">Check your inbox for your personalized playbook.</p>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3 text-blue-900">Next Steps</h2>
          <p className="text-blue-900">{playbook.playbook.nextSteps}</p>
          <div className="mt-4 flex gap-3 flex-wrap">
            <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">
              Start First Task
            </button>
            <button className="px-6 py-2 border border-blue-300 text-blue-600 rounded hover:bg-blue-100 font-semibold">
              Book 1:1 Session
            </button>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Email to Me
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-500 text-center">
          Generated on {new Date(playbook.generatedAt).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  )
}
