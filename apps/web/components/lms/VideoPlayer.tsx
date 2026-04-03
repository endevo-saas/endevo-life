'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'

export interface QuizPopup {
  questionId: string
  timestamp: number
  text: string
  answers: { label: string; text: string }[]
  correctLabel: string
  explanation: string
}

export interface VideoPlayerProps {
  videoUrl: string
  videoId: string
  moduleNum: string
  quizPopups: QuizPopup[]
  onComplete: () => void
  lastPosition?: number
}

interface QuizState {
  popup: QuizPopup
  selectedLabel: string | null
  submitted: boolean
  correct: boolean | null
}

const PROGRESS_INTERVAL_MS = 5000
const COMPLETION_THRESHOLD = 0.95

export default function VideoPlayer({ videoUrl, videoId, moduleNum: _moduleNum, quizPopups, onComplete, lastPosition }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const triggeredPopupsRef = useRef<Set<string>>(new Set())
  const completedRef = useRef(false)

  const [quizState, setQuizState] = useState<QuizState | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [playerError, setPlayerError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoCompleted, setVideoCompleted] = useState(false)

  // Post progress to API (includes lastPosition for resume support)
  const postProgress = useCallback(
    async (percent: number, completed: boolean) => {
      try {
        const currentPos = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0
        await api.lmsUpdateVideoProgress({ videoId, percent, completed, lastPosition: currentPos })
      } catch {
        // Non-critical: silently swallow progress errors
      }
    },
    [videoId]
  )

  // Check quiz popup triggers on timeupdate
  function checkQuizTriggers(time: number) {
    if (quizState) return // already showing a popup
    for (const popup of quizPopups) {
      if (triggeredPopupsRef.current.has(popup.questionId)) continue
      if (time >= popup.timestamp) {
        videoRef.current?.pause()
        triggeredPopupsRef.current.add(popup.questionId)
        setQuizState({ popup, selectedLabel: null, submitted: false, correct: null })
        return
      }
    }
  }

  function handleTimeUpdate() {
    const vid = videoRef.current
    if (!vid) return
    const t = vid.currentTime
    setCurrentTime(t)
    checkQuizTriggers(t)

    // Mark complete at threshold
    if (!completedRef.current && vid.duration > 0 && t / vid.duration >= COMPLETION_THRESHOLD) {
      completedRef.current = true
      setVideoCompleted(true)
      postProgress(100, true)
      onComplete()
    }
  }

  function handleLoadedMetadata() {
    const vid = videoRef.current
    if (!vid) return
    setDuration(vid.duration)
    // Resume from saved position if provided and valid
    if (lastPosition && lastPosition > 0 && lastPosition < vid.duration) {
      vid.currentTime = lastPosition
    }
  }

  // Periodic progress posting
  useEffect(() => {
    progressTimerRef.current = setInterval(() => {
      const vid = videoRef.current
      if (!vid || vid.paused || vid.duration === 0) return
      const pct = Math.round((vid.currentTime / vid.duration) * 100)
      postProgress(pct, false)
    }, PROGRESS_INTERVAL_MS)

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [postProgress])

  // Quiz submit
  async function submitQuizAnswer() {
    if (!quizState || !quizState.selectedLabel) return
    const { popup, selectedLabel } = quizState
    const isCorrect = selectedLabel === popup.correctLabel

    setQuizState(prev => prev ? { ...prev, submitted: true, correct: isCorrect } : null)
    setShowFeedback(true)

    try {
      await api.lmsSubmitQuizAnswer({ videoId, questionId: popup.questionId, selectedLabel })
    } catch {
      // Non-critical
    }

    setTimeout(() => {
      setShowFeedback(false)
      setQuizState(null)
      videoRef.current?.play()
    }, 2500)
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="w-full flex flex-col gap-0 rounded-2xl overflow-hidden relative" style={{ background: '#000' }}>
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full aspect-video"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setPlayerError('Failed to load video. The link may have expired.')}
        style={{ display: 'block' }}
      />

      {/* Custom progress bar below video */}
      <div className="px-4 py-2" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', minWidth: '36px' }}>
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 rounded-full h-1.5 cursor-pointer" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg,#2BBFC5,#5E6AD2)' }}
            />
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
            {formatTime(duration)}
          </span>
        </div>
        {videoCompleted && (
          <p className="text-xs font-semibold mt-1 text-center" style={{ color: '#2BBFC5' }}>
            ✅ Video completed
          </p>
        )}
      </div>

      {playerError && (
        <div className="px-4 py-3 text-sm" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
          {playerError}
        </div>
      )}

      {/* Quiz popup overlay */}
      {quizState && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 10 }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(94,106,210,0.4)' }}
          >
            {/* Quiz header */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }}
              >
                ⚡ Quick Quiz
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Video paused</span>
            </div>

            <p className="text-base font-bold text-white leading-relaxed">
              {quizState.popup.text}
            </p>

            <div className="space-y-2">
              {quizState.popup.answers.map(opt => {
                const isSelected = quizState.selectedLabel === opt.label
                const isSubmitted = quizState.submitted
                const isCorrect = opt.label === quizState.popup.correctLabel
                let borderColor = isSelected ? '#5E6AD2' : 'transparent'
                let bg = isSelected ? 'rgba(94,106,210,0.15)' : 'var(--bg-elevated)'
                if (isSubmitted) {
                  if (isCorrect) { bg = 'rgba(52,211,153,0.15)'; borderColor = '#34D399' }
                  else if (isSelected && !isCorrect) { bg = 'rgba(248,113,113,0.15)'; borderColor = '#f87171' }
                }

                return (
                  <button
                    key={opt.label}
                    onClick={() => !isSubmitted && setQuizState(prev => prev ? { ...prev, selectedLabel: opt.label } : null)}
                    disabled={isSubmitted}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all"
                    style={{ background: bg, border: `2px solid ${borderColor}`, cursor: isSubmitted ? 'default' : 'pointer' }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: isSelected && !isSubmitted ? '#5E6AD2' : isSubmitted && isCorrect ? '#34D399' : 'var(--bg-base)',
                        color: (isSelected && !isSubmitted) || (isSubmitted && isCorrect) ? 'white' : 'var(--text-muted)',
                      }}
                    >
                      {opt.label}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: isSelected ? 'white' : 'var(--text-secondary)' }}>
                      {opt.text}
                    </p>
                    {isSubmitted && isCorrect && <span className="ml-auto text-green-400">✓</span>}
                  </button>
                )
              })}
            </div>

            {/* Feedback */}
            {showFeedback && quizState.submitted && (
              <div
                className="rounded-xl p-3 text-sm"
                style={{
                  background: quizState.correct ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  border: `1px solid ${quizState.correct ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  color: quizState.correct ? '#34D399' : '#f87171',
                }}
              >
                <p className="font-bold">{quizState.correct ? '✅ Correct!' : '❌ Not quite.'}</p>
                <p className="mt-0.5 text-xs opacity-80">{quizState.popup.explanation}</p>
                <p className="text-xs mt-1 opacity-60">Video resuming in a moment…</p>
              </div>
            )}

            {!quizState.submitted && (
              <button
                onClick={submitQuizAnswer}
                disabled={!quizState.selectedLabel}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#5E6AD2,#8B5CF6)' }}
              >
                Submit Answer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
