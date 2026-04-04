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
  const [finished, setFinished] = useState(false)
  const completedRef = useRef(percentWatched >= 95)
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
      if (pct >= 95 && !completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    } catch {
      // Silent
    }
  }, [lessonId, onComplete])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Resume only if not previously completed
    if (lastPosition > 5 && percentWatched < 95) {
      video.currentTime = lastPosition - 3
    }

    const handlePlay = () => {
      api.lmsStartLesson(lessonId).catch(() => {})
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
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
      api.lmsUpdateLessonProgress(lessonId, {
        lastPosition: Math.round(video.duration || 0),
        percentWatched: 100,
      }).catch(() => {})
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }

    // Backup: detect near-end via timeupdate (some browsers skip 'ended')
    const handleTimeUpdate = () => {
      if (!video.duration) return
      const remaining = video.duration - video.currentTime
      if (remaining < 1 && remaining >= 0 && !finished) {
        setFinished(true)
        setProgress(100)
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const handleReplay = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.play()
    setFinished(false)
  }

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        src={streamUrl}
        controls
        className="w-full rounded-xl bg-black aspect-video"
        controlsList="nodownload"
        playsInline
      />

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progress >= 95 ? 'bg-emerald-500' : 'bg-teal-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Completion panel — shown BELOW video when finished */}
      {finished && (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="text-white font-bold">Lesson Complete</p>
              <p className="text-slate-400 text-xs">Great work! Move to the next lesson or replay.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Replay
            </button>
            {nextLessonId && onNavigateNext && (
              <button
                onClick={onNavigateNext}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Next Lesson <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description && (
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}
