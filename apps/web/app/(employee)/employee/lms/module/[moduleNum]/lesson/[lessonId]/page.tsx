'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import LessonSidebar, { type LessonSummary } from '@/components/lms/LessonSidebar'
import VideoLesson from '@/components/lms/VideoLesson'
import QuizEngine from '@/components/lms/QuizEngine'
import PdfLesson from '@/components/lms/PdfLesson'
import Link from 'next/link'

interface LessonDetail {
  lessonId: string
  moduleNum: string
  order: number
  title: string
  description: string
  lessonType: string
  durationMinutes: number
  isRequired: boolean
  thumbnailKey: string
  streamUrl?: string
  s3Key?: string
  downloadUrl?: string
  assetKey?: string
  assetName?: string
  quizId?: string
  passThreshold?: number
  maxAttempts?: number
  progress: {
    status: string
    lastPosition: number
    percentWatched: number
    quizAttempts: number
    bestScore: number
    passed: boolean
    startedAt: string
    completedAt: string
  }
  prevLessonId: string | null
  nextLessonId: string | null
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
  questions: {
    questionId: string
    title: string
    text: string
    questionType: string
    order: number
    answers?: { label: string; text: string }[]
    points?: number
    scaleMin?: number
    scaleMax?: number
    scaleMinLabel?: string
    scaleMidLabel?: string
    scaleMaxLabel?: string
    fields?: { fieldId: string; label: string; placeholder: string; required: boolean }[]
  }[]
  totalQuestions: number
}

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const moduleNum = params.moduleNum as string
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [lessonData, lessonsData] = await Promise.all([
        api.lmsGetLesson(lessonId) as Promise<LessonDetail>,
        api.lmsGetLessons(moduleNum) as Promise<{ lessons: LessonSummary[] }>,
      ])
      setLesson(lessonData)
      setLessons(lessonsData.lessons || [])

      // If quiz type, also load quiz questions
      if (lessonData.lessonType === 'quiz') {
        const quizData = await api.lmsGetQuiz(lessonId) as QuizData
        setQuiz(quizData)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load lesson')
    } finally {
      setLoading(false)
    }
  }, [lessonId, moduleNum])

  useEffect(() => { load() }, [load])

  const handleComplete = useCallback(() => {
    // Refresh sidebar progress
    api.lmsGetLessons(moduleNum).then((data) => {
      const d = data as { lessons: LessonSummary[] }
      setLessons(d.lessons || [])
    }).catch(() => {})
  }, [moduleNum])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400">{error || 'Lesson not found'}</p>
        <Link href={`/employee/lms/module/${moduleNum}`} className="text-teal-400 hover:underline text-sm">
          Back to module
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/employee/lms" className="hover:text-teal-400 transition-colors">LMS</Link>
        <span>/</span>
        <Link href={`/employee/lms/module/${moduleNum}`} className="hover:text-teal-400 transition-colors">
          Module {moduleNum}
        </Link>
        <span>/</span>
        <span className="text-slate-300">{lesson.title}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <LessonSidebar
          lessons={lessons}
          currentLessonId={lessonId}
          moduleNum={moduleNum}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Lesson content by type */}
          {lesson.lessonType === 'video' || lesson.lessonType === 'podcast' ? (
            <VideoLesson
              lessonId={lessonId}
              streamUrl={lesson.streamUrl || ''}
              title={lesson.title}
              description={lesson.description}
              lastPosition={lesson.progress?.lastPosition || 0}
              percentWatched={lesson.progress?.percentWatched || 0}
              onComplete={handleComplete}
              nextLessonId={lesson.nextLessonId}
              onNavigateNext={lesson.nextLessonId ? () => router.push(`/employee/lms/module/${moduleNum}/lesson/${lesson.nextLessonId}`) : undefined}
            />
          ) : lesson.lessonType === 'quiz' && quiz ? (
            <QuizEngine
              quiz={quiz}
              onComplete={handleComplete}
            />
          ) : lesson.lessonType === 'pdf' ? (
            <PdfLesson
              lessonId={lessonId}
              title={lesson.title}
              description={lesson.description}
              downloadUrl={lesson.downloadUrl || ''}
              assetName={lesson.assetName || ''}
              completed={lesson.progress?.status === 'completed'}
              onComplete={handleComplete}
            />
          ) : (
            <div className="p-6 bg-[#0a1220] rounded-xl border border-slate-800">
              <h2 className="text-xl font-semibold text-white mb-2">{lesson.title}</h2>
              <p className="text-slate-400">{lesson.description}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
            {lesson.prevLessonId ? (
              <button
                onClick={() => router.push(`/employee/lms/module/${moduleNum}/lesson/${lesson.prevLessonId}`)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-teal-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>
            ) : <div />}

            {lesson.nextLessonId ? (
              <button
                onClick={() => router.push(`/employee/lms/module/${moduleNum}/lesson/${lesson.nextLessonId}`)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Next Lesson <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href={`/employee/lms/module/${moduleNum}`}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Back to Module
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
