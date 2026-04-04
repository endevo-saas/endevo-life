'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface VideoProgress {
  percent: number
  completed: boolean
  lastWatched?: string
}

interface Video {
  videoId: string
  title: string
  // Backend returns 'videoType', frontend also accepts 'type' for compatibility
  type?: 'main' | 'action'
  videoType?: 'main' | 'action'
  duration?: number
  durationSeconds?: number
  progressPct?: number
  completed?: boolean
  progress?: VideoProgress
  thumbnailKey?: string
  description?: string
  quizCount?: number
  inlineQuizzes?: unknown[]
}

interface ModuleDetail {
  moduleNum: string
  title: string
  description: string
  lockStatus: 'locked' | 'unlocked' | 'complete'
  videos: Video[]
  pdfKey?: string
  objectives?: string[]
}

/** Normalise a video object from the API (which uses videoType/progress/duration) to the
 *  shape the VideoCard component expects (type/progressPct/completed/durationSeconds). */
function normaliseVideo(v: Video): Video & { type: 'main' | 'action'; progressPct: number; completed: boolean; durationSeconds?: number } {
  return {
    ...v,
    type: (v.videoType ?? v.type ?? 'main') as 'main' | 'action',
    progressPct: v.progress?.percent ?? v.progressPct ?? 0,
    completed: v.progress?.completed ?? v.completed ?? false,
    durationSeconds: v.durationSeconds ?? v.duration,
    quizCount: v.inlineQuizzes?.length ?? v.quizCount ?? 0,
  }
}

function formatDuration(secs?: number): string {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function VideoCard({ video, moduleNum }: { video: Video; moduleNum: string }) {
  const isMain = video.type === 'main'
  const watched = video.completed ?? false
  const pct = video.progressPct ?? 0

  return (
    <Link
      href={`/employee/lms/module/${moduleNum}/video/${video.videoId}`}
      className="flex items-start gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 group"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${watched ? 'rgba(43,191,197,0.3)' : 'var(--border-subtle)'}`,
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-20 h-14 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden"
        style={{ background: isMain ? 'linear-gradient(135deg,#2BBFC5,#5E6AD2)' : 'linear-gradient(135deg,#E8612A,#f97316)' }}
      >
        <span className="text-2xl group-hover:scale-110 transition-transform">▶</span>
        {pct > 0 && pct < 100 && (
          <div
            className="absolute bottom-0 left-0 h-1"
            style={{ width: `${pct}%`, background: 'rgba(255,255,255,0.8)' }}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isMain && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(43,191,197,0.15)', color: '#2BBFC5' }}
            >
              Main Video
            </span>
          )}
          {video.quizCount && video.quizCount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}
            >
              {video.quizCount} quiz{video.quizCount > 1 ? 'zes' : ''}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-white mt-1 truncate">{video.title}</p>
        {video.description && (
          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
            {video.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {video.durationSeconds && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ⏱ {formatDuration(video.durationSeconds)}
            </span>
          )}
          {watched ? (
            <span className="text-xs font-semibold" style={{ color: '#2BBFC5' }}>✅ Watched</span>
          ) : pct > 0 ? (
            <span className="text-xs font-semibold" style={{ color: '#E8612A' }}>{pct}% watched</span>
          ) : null}
        </div>
      </div>

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#2BBFC5' }}>→</div>
    </Link>
  )
}

export default function ModuleDetailPage() {
  const params = useParams()
  const moduleNum = params?.moduleNum as string
  const router = useRouter()

  const [module, setModule] = useState<ModuleDetail | null>(null)
  const [lessons, setLessons] = useState<{lessonId:string;order:number;title:string;lessonType:string;isRequired:boolean;status:string;percentWatched:number;quizPassed:boolean}[]>([])
  const [lessonsTotal, setLessonsTotal] = useState(0)
  const [lessonsCompleted, setLessonsCompleted] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [entered, setEntered] = useState(false)

  const load = useCallback(async () => {
    if (!moduleNum) return
    setLoading(true)
    setError('')
    try {
      const [moduleRes, lessonsRes] = await Promise.all([
        api.lmsGetModule(moduleNum) as Promise<ModuleDetail>,
        api.lmsGetLessons(moduleNum) as Promise<{lessons: typeof lessons; total: number; completed: number; moduleComplete: boolean}>,
      ])
      setModule(moduleRes)
      setCompleted(moduleRes.lockStatus === 'complete' || lessonsRes.moduleComplete)
      setLessons(lessonsRes.lessons || [])
      setLessonsTotal(lessonsRes.total || 0)
      setLessonsCompleted(lessonsRes.completed || 0)
      setTimeout(() => setEntered(true), 80)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load module')
    } finally {
      setLoading(false)
    }
  }, [moduleNum])

  useEffect(() => {
    load()
  }, [load])

  async function handleDownloadPDF() {
    if (!module?.pdfKey) return
    try {
      const res = await api.lmsGetAssetUrl(module.pdfKey) as { url: string }
      window.open(res.url, '_blank')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to get PDF link')
    }
  }

  async function handleMarkComplete() {
    if (!moduleNum) return
    setCompleting(true)
    try {
      await api.lmsCompleteModule(moduleNum)
      setCompleted(true)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to mark module complete')
    } finally {
      setCompleting(false)
    }
  }

  const allVideos = (module?.videos ?? []).map(normaliseVideo)
  const mainVideos = allVideos.filter(v => v.type === 'main')
  const actionVideos = allVideos.filter(v => v.type === 'action')
  const watchedCount = allVideos.filter(v => v.completed).length
  const allWatched = allVideos.length > 0 && watchedCount === allVideos.length

  if (loading) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="skeleton h-8 w-48 rounded-xl" />
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow" style={{ background: '#2BBFC5', opacity: 0.05 }} />
      </div>

      <div
        className={`relative max-w-3xl mx-auto space-y-5 transition-all duration-700 ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Link href="/employee/lms" className="hover:underline" style={{ color: '#2BBFC5' }}>
            LMS
          </Link>
          <span>›</span>
          <span className="text-white font-semibold">Module {moduleNum}</span>
        </div>

        {error && (
          <div
            className="p-4 rounded-2xl text-sm"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {module ? (
          <>
            {/* Hero card */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: completed
                  ? 'linear-gradient(135deg, rgba(43,191,197,0.12), rgba(16,185,129,0.06))'
                  : 'linear-gradient(135deg, rgba(94,106,210,0.12), rgba(139,92,246,0.06))',
                border: completed ? '1px solid rgba(43,191,197,0.3)' : '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: '#2BBFC5' }}>
                    MODULE {moduleNum}
                  </p>
                  <h1 className="text-2xl font-black text-white">{module.title}</h1>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {module.description}
                  </p>
                </div>
                {completed && <div className="text-4xl flex-shrink-0">✅</div>}
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {lessonsCompleted}/{lessonsTotal} lessons completed
                  </span>
                  <span className="font-semibold" style={{ color: '#2BBFC5' }}>
                    {lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0}%`,
                      background: 'linear-gradient(90deg,#2BBFC5,#10b981)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Objectives */}
            {module.objectives && module.objectives.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <p className="text-sm font-black text-white mb-3">Learning Objectives</p>
                <ul className="space-y-2">
                  {module.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#2BBFC5' }}>•</span> {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lessons list */}
            {lessons.length > 0 && (
              <div>
                <p className="text-sm font-black text-white mb-3">Lessons</p>
                <div className="space-y-2">
                  {lessons.map(lesson => {
                    const typeIcons: Record<string, string> = {
                      video: '\u25B6\uFE0F', quiz: '\u270F\uFE0F', pdf: '\uD83D\uDCC4', podcast: '\uD83C\uDFA7', resource: '\uD83D\uDCDA',
                    }
                    const isDone = lesson.status === 'completed'
                    const inProgress = lesson.status === 'in_progress'
                    return (
                      <Link
                        key={lesson.lessonId}
                        href={`/employee/lms/module/${moduleNum}/lesson/${lesson.lessonId}`}
                        className="flex items-center gap-3 p-4 rounded-xl transition-all hover:-translate-y-0.5 group"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: `1px solid ${isDone ? 'rgba(43,191,197,0.3)' : inProgress ? 'rgba(232,97,42,0.3)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        <span className="text-lg w-8 text-center">{typeIcons[lesson.lessonType] || '\uD83D\uDCDA'}</span>
                        <span className="text-xs font-mono w-6 text-right" style={{ color: 'var(--text-muted)' }}>{lesson.order}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{lesson.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                              background: lesson.lessonType === 'video' ? 'rgba(43,191,197,0.15)' :
                                lesson.lessonType === 'quiz' ? 'rgba(139,92,246,0.15)' :
                                lesson.lessonType === 'pdf' ? 'rgba(232,97,42,0.15)' :
                                'rgba(168,85,247,0.15)',
                              color: lesson.lessonType === 'video' ? '#2BBFC5' :
                                lesson.lessonType === 'quiz' ? '#8B5CF6' :
                                lesson.lessonType === 'pdf' ? '#E8612A' : '#A855F7',
                            }}>
                              {lesson.lessonType}
                            </span>
                            {lesson.isRequired && (
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Required</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm flex-shrink-0">
                          {isDone ? '\u2705' : inProgress ? '\uD83D\uDD36' : '\u26AA'}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Module completion status */}
            {completed ? (
              <div
                className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(43,191,197,0.12)', border: '1px solid rgba(43,191,197,0.3)', color: '#2BBFC5' }}
              >
                Module Complete — great work!
              </div>
            ) : lessonsTotal > 0 ? (
              <div
                className="flex items-center justify-center gap-2 py-4 rounded-xl text-sm"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                Complete all {lessonsTotal - lessonsCompleted} remaining required lessons to finish this module
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-bold text-white">Module not found</p>
            <Link href="/employee/lms" className="text-sm underline mt-2 block" style={{ color: '#2BBFC5' }}>
              Back to LMS
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
