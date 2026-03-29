'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { BookOpen, Loader2, RefreshCw, AlertCircle, Users, CheckCircle, Clock, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { exportCsv } from '@/lib/export'

interface CourseStats {
  videoId: string
  courseId: string
  title: string
  description?: string
  duration?: string
  enrolled: number
  completed: number
  not_started: number
  total_employees: number
  completion_rate: number
  enrollment_rate: number
}

export default function HrTrainingPage() {
  const [courses, setCourses] = useState<CourseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api.hrTraining()
      setCourses((d as unknown as { courses: CourseStats[] }).courses || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load training data')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const totalEnrolled  = courses.reduce((s, c) => s + c.enrolled, 0)
  const totalCompleted = courses.reduce((s, c) => s + c.completed, 0)
  const avgCompletion  = courses.length ? Math.round(courses.reduce((s, c) => s + c.completion_rate, 0) / courses.length) : 0

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Training & Courses</h1>
            <p className="text-slate-400 text-sm mt-0.5">Enrollment and completion stats for your team</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportCsv('hr_training', courses as unknown as Record<string, unknown>[], [
              {key:'title',label:'Course'},{key:'total_employees',label:'Total Employees'},
              {key:'enrolled',label:'Enrolled'},{key:'completed',label:'Completed'},
              {key:'not_started',label:'Not Started'},{key:'enrollment_rate',label:'Enrollment %'},
              {key:'completion_rate',label:'Completion %'}
            ])} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/5 text-slate-300 hover:text-white border border-white/10 transition-all">
              <Download className="w-4 h-4"/>CSV
            </button>
            <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <RefreshCw className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}</div>}

        {/* KPI summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Enrollments', value: totalEnrolled,  color: 'text-blue-400',  icon: Users },
            { label: 'Completions',       value: totalCompleted, color: 'text-green-400', icon: CheckCircle },
            { label: 'Avg Completion',    value: `${avgCompletion}%`, color: 'text-brand-300', icon: BookOpen },
          ].map(k => (
            <div key={k.label} className="glass p-4 rounded-2xl">
              <k.icon className={`w-5 h-5 ${k.color} mb-2`}/>
              <div className={`text-3xl font-black ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="glass p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-green-400"/></div>
        ) : courses.length === 0 ? (
          <div className="glass p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400">No courses found for your organisation.</p>
            <p className="text-slate-600 text-xs mt-1">Contact your platform admin to add training content.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map(c => (
              <div key={c.courseId} className="glass p-5 rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-green-400"/>
                      <h3 className="text-base font-semibold text-white">{c.title}</h3>
                      {c.duration && <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3"/>{c.duration}</span>}
                    </div>
                    {c.description && <p className="text-xs text-slate-500 mt-1">{c.description}</p>}
                  </div>
                  <div className="text-right ml-4">
                    <div className={`text-2xl font-black ${c.completion_rate >= 80 ? 'text-green-400' : c.completion_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {c.completion_rate}%
                    </div>
                    <div className="text-xs text-slate-500">completion</div>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="space-y-2 mb-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Enrolled ({c.enrolled}/{c.total_employees})</span>
                      <span>{c.enrollment_rate}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{width:`${c.enrollment_rate}%`}}/>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Completed ({c.completed}/{c.total_employees})</span>
                      <span>{c.completion_rate}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${c.completion_rate >= 80 ? 'bg-green-500' : c.completion_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width:`${c.completion_rate}%`}}/>
                    </div>
                  </div>
                </div>

                {/* Stat pills */}
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs">{c.enrolled} enrolled</span>
                  <span className="px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs">{c.completed} completed</span>
                  <span className="px-2.5 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-lg text-xs">{c.not_started} not started</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
