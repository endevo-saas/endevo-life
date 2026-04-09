'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { PlayCircle, CheckCircle, Clock, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { api, Course } from '@/lib/api'
import Link from 'next/link'

export default function TrainingPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.employeeTraining()
      setCourses(d?.courses || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load training')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <PlayCircle className="w-8 h-8 text-blue-400" />
              Training Courses
            </h1>
            <p className="text-slate-400 text-sm mt-1">{courses.length} courses available</p>
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : courses.length === 0 ? (
          <div className="glass p-12 text-center">
            <PlayCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <div className="text-slate-400">No courses available yet.</div>
            <div className="text-sm text-slate-500 mt-1">Your HR team will assign training courses here.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map(course => {
              const pct = course.progress_pct ?? 0
              const done = course.completed ?? false
              return (
                <div key={course.courseId} className="glass p-6 animate-slide-up">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {done
                          ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                          : <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />}
                        <h3 className="font-semibold text-white">{course.title}</h3>
                        {done && (
                          <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium">Completed</span>
                        )}
                      </div>
                      {course.description && (
                        <p className="text-sm text-slate-400 mb-4 ml-8">{course.description}</p>
                      )}
                      {/* Progress Bar */}
                      <div className="ml-8">
                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                          <span>Progress</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {!done && (
                        <Link
                          href={`/employee/assessment/${course.courseId}`}
                          className="btn-primary text-sm flex items-center gap-2 whitespace-nowrap"
                        >
                          <PlayCircle className="w-4 h-4" /> Take Assessment
                        </Link>
                      )}
                      {done && (
                        <Link
                          href="/employee/certificates"
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all text-sm whitespace-nowrap"
                        >
                          View Certificate
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
