'use client'

import { PlayCircle, FileText, HelpCircle, Headphones, BookOpen, Check, Circle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export interface LessonSummary {
  lessonId: string
  moduleNum: string
  order: number
  title: string
  lessonType: string
  durationMinutes: number
  isRequired: boolean
  status: string
  percentWatched: number
  quizPassed: boolean
  quizBestScore: number
}

const typeIcon: Record<string, React.ReactNode> = {
  video: <PlayCircle className="w-4 h-4" />,
  podcast: <Headphones className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
  resource: <BookOpen className="w-4 h-4" />,
}

const statusIcon = (status: string) => {
  if (status === 'completed') return <Check className="w-4 h-4 text-emerald-400" />
  if (status === 'in_progress') return <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
  return <Circle className="w-3.5 h-3.5 text-slate-600" />
}

interface Props {
  lessons: LessonSummary[]
  currentLessonId?: string
  moduleNum: string
}

export default function LessonSidebar({ lessons, currentLessonId, moduleNum }: Props) {
  const completed = lessons.filter(l => l.status === 'completed').length
  const pct = lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0

  return (
    <div className="w-full lg:w-80 shrink-0 bg-[#0a1220] border border-slate-800 rounded-xl overflow-hidden lg:sticky lg:top-4 lg:self-start" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>
      {/* Progress header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>{completed} of {lessons.length} lessons</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lesson list */}
      <nav className="flex-1 overflow-y-auto">
        {lessons.map((lesson) => {
          const active = lesson.lessonId === currentLessonId
          return (
            <Link
              key={lesson.lessonId}
              href={`/employee/lms/module/${moduleNum}/lesson/${lesson.lessonId}`}
              className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 transition-colors ${
                active
                  ? 'bg-teal-500/10 border-l-2 border-l-teal-400'
                  : 'hover:bg-slate-800/50'
              }`}
            >
              <span className="text-slate-500 text-xs w-5 text-right shrink-0">
                {lesson.order}
              </span>
              <span className="text-slate-400 shrink-0">
                {typeIcon[lesson.lessonType] || typeIcon.resource}
              </span>
              <span className={`text-sm flex-1 truncate ${
                active ? 'text-teal-300 font-medium' : 'text-slate-300'
              }`}>
                {lesson.title}
              </span>
              <span className="shrink-0">
                {statusIcon(lesson.status)}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
