'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react'

interface Props {
  lessonId: string
  streamUrl: string
  title: string
  description: string
  lastPosition: number
  percentWatched: number
  onComplete: () => void
  nextLessonId?: string | null
  onNavigateNext?: () => void
}

export default function VideoLesson({
  lessonId, streamUrl, title, description, lastPosition, percentWatched,
  onComplete, nextLessonId, onNavigateNext
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(percentWatched || 0)
  const [finished, setFinished] = useState(percentWatched >= 95)
  const [marked, setMarked] = useState(percentWatched >= 95)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const saveProgress = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.duration) return

    const pct = Math.round((video.currentTime / video.duration) * 100)
    setProgress(pct)

    try {
      await api.lmsUpdateLessonProgress(lessonId, {
        lastPosition: Math.round(video.currentTime),
        percentWatched: pct,
      })
      if (pct >= 95 && !marked) {
        setMarked(true)
        onComplete()
      }
    } catch {
      // Silent — progress save is best-effort
    }
  }, [lessonId, onComplete, marked])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Resume from last position only if not completed
    if (lastPosition > 5 && percentWatched < 95) {
      video.currentTime = lastPosition - 3
    }

    const handlePlay = () => {
      api.lmsStartLesson(lessonId).catch(() => {})
      progressTimerRef.current = setInterval(saveProgress, 15000)
    }

    const handlePause = () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      saveProgress()
    }

    const handleEnded = () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      setFinished(true)
      setProgress(100)
      // Final save at 100%
      api.lmsUpdateLessonProgress(lessonId, {
        lastPosition: Math.round(video.duration),
        percentWatched: 100,
      }).catch(() => {})
      if (!marked) {
        setMarked(true)
        onComplete()
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [lessonId, lastPosition, percentWatched, saveProgress, marked, onComplete])

  const handleReplay = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.play()
    setFinished(false)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <video
          ref={videoRef}
          src={streamUrl}
          controls
          className="w-full rounded-xl bg-black aspect-video"
          controlsList="nodownload"
          playsInline
        />

        {/* Overlay when video finishes */}
        {finished && (
          <div className="absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            <p className="text-white font-bold text-lg">Lesson Complete</p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReplay}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Replay
              </button>
              {nextLessonId && onNavigateNext && (
                <button
                  onClick={onNavigateNext}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Next Lesson <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progress >= 95 ? 'bg-emerald-500' : 'bg-teal-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description && (
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}
