'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Props {
  lessonId: string
  streamUrl: string
  title: string
  description: string
  lastPosition: number
  onComplete: () => void
}

export default function VideoLesson({ lessonId, streamUrl, title, description, lastPosition, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
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
      if (pct >= 95) {
        onComplete()
      }
    } catch {
      // Silent — progress save is best-effort
    }
  }, [lessonId, onComplete])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Resume from last position
    if (lastPosition > 5) {
      video.currentTime = lastPosition - 3 // rewind 3s for context
    }

    // Start progress tracker
    const handlePlay = () => {
      setPlaying(true)
      // Mark lesson as started
      api.lmsStartLesson(lessonId).catch(() => {})
      // Save progress every 15 seconds
      progressTimerRef.current = setInterval(saveProgress, 15000)
    }

    const handlePause = () => {
      setPlaying(false)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      saveProgress()
    }

    const handleEnded = () => {
      setPlaying(false)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      saveProgress()
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
  }, [lessonId, lastPosition, saveProgress])

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
          className="h-full bg-teal-500 rounded-full transition-all"
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
