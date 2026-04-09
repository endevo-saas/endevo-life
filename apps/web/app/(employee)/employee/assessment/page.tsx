'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { ClipboardList, PlayCircle, Loader2, AlertCircle } from 'lucide-react'
import { api, Course } from '@/lib/api'
import Link from 'next/link'

export default function AssessmentListPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.employeeTraining()
      .then(d => setCourses(d?.courses || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-purple-400" />
            Assessments
          </h1>
          <p className="text-slate-400 text-sm mt-1">Select a course to take its assessment</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : courses.length === 0 ? (
          <div className="glass p-12 text-center">
            <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <div className="text-slate-400">No courses available for assessment yet.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map(course => (
              <div key={course.courseId} className="glass p-5 flex items-center justify-between gap-4 animate-slide-up">
                <div>
                  <div className="font-semibold text-white">{course.title}</div>
                  {course.description && (
                    <div className="text-sm text-slate-400 mt-0.5">{course.description}</div>
                  )}
                  {course.completed && (
                    <span className="text-xs text-green-400 mt-1 block">✓ Completed — {course.progress_pct}%</span>
                  )}
                </div>
                <Link
                  href={`/employee/assessment/${course.courseId}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                    course.completed
                      ? 'border border-green-500/30 text-green-400 hover:bg-green-500/10'
                      : 'btn-primary'
                  }`}
                >
                  <PlayCircle className="w-4 h-4" />
                  {course.completed ? 'Retake' : 'Start Assessment'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
