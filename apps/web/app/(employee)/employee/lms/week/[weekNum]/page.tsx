'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Video {
  videoId: string
  title: string
  type: 'main' | 'action'
  durationSeconds?: number
  progressPct?: number
  completed?: boolean
  thumbnailKey?: string
  description?: string
  quizCount?: number
}

interface WeekDetail {
  weekNum: string
  title: string
  description: string
  lockStatus: 'locked' | 'unlocked' | 'complete'
  videos: Video[]
  pdfKey?: string
  objectives?: string[]
}

function formatDuration(secs?: number): string {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function VideoCard({ video, weekNum }: { video: Video; weekNum: string }) {
  const isMain = video.type === 'main'
  const watched = video.completed ?? false
  const pct = video.progressPct ?? 0

  return (
    <Link
      href={`/employee/lms/week/${weekNum}/video/${video.videoId}`}
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

export default function WeekDetailPage() {
  const params = useParams()
  const weekNum = params?.weekNum as string
  const router = useRouter()

  const [week, setWeek] = useState<WeekDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [entered, setEntered] = useState(false)

  const load = useCallback(async () => {
    if (!weekNum) return
    setLoading(true)
    setError('')
    try {
      const res = await api.lmsGetWeek(weekNum) as { week: WeekDetail }
      setWeek(res.week)
      setCompleted(res.week.lockStatus === 'complete')
      setTimeout(() => setEntered(true), 80)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load week')
    } finally {
      setLoading(false)
    }
  }, [weekNum])

  useEffect(() => {
    load()
  }, [load])

  async function handleDownloadPDF() {
    if (!week?.pdfKey) return
    try {
      const res = await api.lmsGetAssetUrl(week.pdfKey) as { url: string }
      window.open(res.url, '_blank')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to get PDF link')
    }
  }

  async function handleMarkComplete() {
    if (!weekNum) return
    setCompleting(true)
    try {
      await api.lmsCompleteWeek(weekNum)
      setCompleted(true)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to mark week complete')
    } finally {
      setCompleting(false)
    }
  }

  const mainVideos = week?.videos.filter(v => v.type === 'main') ?? []
  const actionVideos = week?.videos.filter(v => v.type === 'action') ?? []
  const allVideos = week?.videos ?? []
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
          <span className="text-white font-semibold">Week {weekNum}</span>
        </div>

        {error && (
          <div
            className="p-4 rounded-2xl text-sm"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {week ? (
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
                    WEEK {weekNum}
                  </p>
                  <h1 className="text-2xl font-black text-white">{week.title}</h1>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {week.description}
                  </p>
                </div>
                {completed && <div className="text-4xl flex-shrink-0">✅</div>}
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {watchedCount}/{allVideos.length} videos watched
                  </span>
                  <span className="font-semibold" style={{ color: '#2BBFC5' }}>
                    {allVideos.length > 0 ? Math.round((watchedCount / allVideos.length) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${allVideos.length > 0 ? Math.round((watchedCount / allVideos.length) * 100) : 0}%`,
                      background: 'linear-gradient(90deg,#2BBFC5,#10b981)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Objectives */}
            {week.objectives && week.objectives.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <p className="text-sm font-black text-white mb-3">Learning Objectives</p>
                <ul className="space-y-2">
                  {week.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#2BBFC5' }}>•</span> {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Main videos */}
            {mainVideos.length > 0 && (
              <div>
                <p className="text-sm font-black text-white mb-3">Main Video</p>
                <div className="space-y-3">
                  {mainVideos.map(v => (
                    <VideoCard key={v.videoId} video={v} weekNum={weekNum} />
                  ))}
                </div>
              </div>
            )}

            {/* Action videos */}
            {actionVideos.length > 0 && (
              <div>
                <p className="text-sm font-black text-white mb-3">Action Steps</p>
                <div className="space-y-3">
                  {actionVideos.map(v => (
                    <VideoCard key={v.videoId} video={v} weekNum={weekNum} />
                  ))}
                </div>
              </div>
            )}

            {/* PDF + Complete row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {week.pdfKey && (
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  📄 Download Week {weekNum} PDF
                </button>
              )}
              {!completed && (
                <button
                  onClick={handleMarkComplete}
                  disabled={completing || !allWatched}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#2BBFC5,#10b981)' }}
                >
                  {completing ? 'Marking complete…' : !allWatched ? `Watch all videos to complete (${watchedCount}/${allVideos.length})` : '✅ Mark Week Complete'}
                </button>
              )}
              {completed && (
                <div
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(43,191,197,0.12)', border: '1px solid rgba(43,191,197,0.3)', color: '#2BBFC5' }}
                >
                  ✅ Week Complete — great work!
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-bold text-white">Week not found</p>
            <Link href="/employee/lms" className="text-sm underline mt-2 block" style={{ color: '#2BBFC5' }}>
              Back to LMS
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
