'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import VideoPlayer, { type QuizPopup } from '@/components/lms/VideoPlayer'

interface VideoMeta {
  title: string
  description?: string
  type?: string
}

export default function VideoPlayerPage() {
  const params = useParams()
  const moduleNum = params?.moduleNum as string
  const videoId = params?.videoId as string

  const [videoUrl, setVideoUrl] = useState('')
  const [quizPopups, setQuizPopups] = useState<QuizPopup[]>([])
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completedMsg, setCompletedMsg] = useState(false)
  const [entered, setEntered] = useState(false)

  const load = useCallback(async () => {
    if (!videoId || !moduleNum) return
    setLoading(true)
    setError('')
    try {
      const [urlRes, quizRes] = await Promise.all([
        api.lmsGetVideoUrl(videoId) as Promise<{ url: string; title?: string; description?: string; type?: string }>,
        api.lmsGetQuizQuestions(videoId) as Promise<{ quizzes: QuizPopup[] }>,
      ])
      setVideoUrl(urlRes.url)
      setVideoMeta({ title: urlRes.title || 'Video', description: urlRes.description, type: urlRes.type })
      setQuizPopups(quizRes.quizzes || [])
      setTimeout(() => setEntered(true), 80)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load video')
    } finally {
      setLoading(false)
    }
  }, [videoId, moduleNum])

  useEffect(() => {
    load()
  }, [load])

  function handleVideoComplete() {
    setCompletedMsg(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="skeleton h-6 w-40 rounded-xl" />
          <div className="skeleton w-full rounded-2xl" style={{ aspectRatio: '16/9' }} />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow" style={{ background: '#5E6AD2', opacity: 0.05 }} />
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
          <Link href={`/employee/lms/module/${moduleNum}`} className="hover:underline" style={{ color: '#2BBFC5' }}>
            Module {moduleNum}
          </Link>
          <span>›</span>
          <span className="text-white font-semibold truncate max-w-32">
            {videoMeta?.title ?? 'Video'}
          </span>
        </div>

        {error && (
          <div
            className="p-4 rounded-2xl text-sm flex items-center gap-3"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {error}
            <button onClick={load} className="ml-auto underline font-medium">Retry</button>
          </div>
        )}

        {/* Video title */}
        {videoMeta && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              {videoMeta.type === 'main' && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(43,191,197,0.15)', color: '#2BBFC5' }}
                >
                  Main Video
                </span>
              )}
              {videoMeta.type === 'action' && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(232,97,42,0.15)', color: '#E8612A' }}
                >
                  Action Step
                </span>
              )}
              {quizPopups.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}
                >
                  {quizPopups.length} quiz{quizPopups.length > 1 ? 'zes' : ''} inside
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-white">{videoMeta.title}</h1>
            {videoMeta.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {videoMeta.description}
              </p>
            )}
          </div>
        )}

        {/* Player */}
        {videoUrl ? (
          <VideoPlayer
            videoUrl={videoUrl}
            videoId={videoId}
            moduleNum={moduleNum}
            quizPopups={quizPopups}
            onComplete={handleVideoComplete}
          />
        ) : (
          !loading && !error && (
            <div
              className="w-full flex items-center justify-center rounded-2xl text-sm"
              style={{ aspectRatio: '16/9', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              No video URL available
            </div>
          )
        )}

        {/* Completion message */}
        {completedMsg && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(43,191,197,0.1)', border: '1px solid rgba(43,191,197,0.3)' }}
          >
            <span className="text-xl">🎉</span>
            <div>
              <p className="text-sm font-black text-white">Video completed!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Progress saved. Head back to continue with the next video.
              </p>
            </div>
            <Link
              href={`/employee/lms/module/${moduleNum}`}
              className="ml-auto px-4 py-2 rounded-xl font-bold text-xs text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2BBFC5,#10b981)' }}
            >
              Back to Module →
            </Link>
          </div>
        )}

        {/* Quiz info panel */}
        {quizPopups.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-xs font-black text-white mb-2">
              ⚡ {quizPopups.length} quiz question{quizPopups.length > 1 ? 's' : ''} will appear during this video
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              The video will pause automatically. Answer the question to continue watching.
            </p>
          </div>
        )}

        {/* Back link */}
        <div>
          <Link
            href={`/employee/lms/module/${moduleNum}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: '#2BBFC5' }}
          >
            ← Back to Module {moduleNum}
          </Link>
        </div>
      </div>
    </div>
  )
}
