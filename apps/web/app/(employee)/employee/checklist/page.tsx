'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Target, TrendingUp, Award } from 'lucide-react'
import { api } from '@/lib/api'

interface Task {
  taskId: string
  title: string
  description: string
  domain: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: number
  guidance?: string
  completedAt?: string
}

interface DomainProgress {
  [domain: string]: number
}

export default function ChecklistPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [domainProgress, setDomainProgress] = useState<DomainProgress>({})
  const [overallProgress, setOverallProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [milestoneMessage, setMilestoneMessage] = useState('')

  async function loadChecklist() {
    try {
      const result = await api.employeeGetChecklist()
      setTasks(result.tasks || [])
      setDomainProgress(result.domainProgress || {})
      setOverallProgress(result.overallProgress || 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load checklist')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteTask(taskId: string) {
    setCompleting(taskId)
    setMilestoneMessage('')
    try {
      const result = await api.employeeCompleteChecklistTask(taskId)
      setTasks(
        tasks.map(t =>
          t.taskId === taskId
            ? { ...t, status: 'completed', completedAt: result.completedAt }
            : t
        )
      )
      setDomainProgress(result.domainProgress)
      setOverallProgress(result.overallProgress)
      if (result.milestoneMessage) {
        setMilestoneMessage(result.milestoneMessage)
        setTimeout(() => setMilestoneMessage(''), 5000)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete task')
    } finally {
      setCompleting(null)
    }
  }

  useEffect(() => {
    loadChecklist()
  }, [])

  const getDomainColor = (domain: string) => {
    const colors: { [key: string]: string } = {
      legal: 'bg-blue-50 border-blue-200',
      financial: 'bg-green-50 border-green-200',
      physical: 'bg-purple-50 border-purple-200',
      digital: 'bg-orange-50 border-orange-200',
    }
    return colors[domain.toLowerCase()] || 'bg-gray-50 border-gray-200'
  }

  const getDomainBadgeColor = (domain: string) => {
    const colors: { [key: string]: string } = {
      legal: 'bg-blue-100 text-blue-800',
      financial: 'bg-green-100 text-green-800',
      physical: 'bg-purple-100 text-purple-800',
      digital: 'bg-orange-100 text-orange-800',
    }
    return colors[domain.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const totalTasks = tasks.length

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your checklist...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-6 h-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Legacy Planning Checklist</h1>
          </div>
          <p className="text-gray-600">Track your progress across legal, financial, physical, and digital planning domains.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Milestone Message */}
        {milestoneMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-start gap-3 animate-pulse">
            <Award className="w-5 h-5 text-green-600 mt-0.5" />
            <p className="text-green-700 font-semibold">{milestoneMessage}</p>
          </div>
        )}

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Overall Progress */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Overall</h3>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{overallProgress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">{completedTasks.length}/{totalTasks} tasks</p>
          </div>

          {/* Domain Progress */}
          {Object.entries(domainProgress).map(([domain, progress]) => (
            <div key={domain} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600 capitalize">{domain}</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-2">{progress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    domain === 'legal'
                      ? 'bg-blue-600'
                      : domain === 'financial'
                        ? 'bg-green-600'
                        : domain === 'physical'
                          ? 'bg-purple-600'
                          : 'bg-orange-600'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Tasks by Domain */}
        {pendingTasks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Tasks to Complete</h2>
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <div
                  key={task.taskId}
                  className={`border rounded-lg p-4 cursor-pointer transition ${getDomainColor(task.domain)}`}
                  onClick={() => setExpandedTask(expandedTask === task.taskId ? null : task.taskId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getDomainBadgeColor(task.domain)}`}>
                          {task.domain}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>

                      {expandedTask === task.taskId && task.guidance && (
                        <div className="bg-white bg-opacity-60 p-3 rounded mb-3 border-l-2 border-gray-300">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Guidance: </span>
                            {task.guidance}
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        handleCompleteTask(task.taskId)
                      }}
                      disabled={completing === task.taskId}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {completing === task.taskId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Complete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Completed Tasks ({completedTasks.length})</h2>
            <div className="space-y-2">
              {completedTasks.map(task => (
                <div key={task.taskId} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{task.title}</h3>
                    <p className="text-xs text-gray-600">{task.domain}</p>
                  </div>
                  {task.completedAt && (
                    <p className="text-xs text-gray-500">{new Date(task.completedAt).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {totalTasks === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No tasks in your checklist yet. Complete your assessment to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
