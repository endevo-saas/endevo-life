'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface ModuleStatus {
  moduleNum?: string
  weekNum?: string
  lockStatus: 'locked' | 'unlocked' | 'complete'
  videosComplete?: number
  videosTotal?: number
}

// Shape returned by GET /api/lms/admin/users/progress (summary list)
interface UserProgressSummary {
  userId: string
  modulesUnlocked: number
  modulesCompleted: number
  latestModuleCompleted: number | null
}

// Shape returned by GET /api/lms/admin/users/{userId}/progress (full detail)
interface UserProgressDetail {
  userId: string
  moduleProgress: ModuleStatus[]    // per-user module records from lms-user-modules
  videoProgress: { videoId: string; title?: string; percent?: number; completed?: boolean }[]
  latestAssessment: {
    overallScore?: number
    attemptNumber?: number
    submittedAt?: string
    scorecard?: { overallScore?: number }
  } | null
  certificate: { issuedAt?: string; certificateId?: string } | null
}

// Thin combined shape used in the table rows: summary + lazy-loaded detail
interface UserProgress {
  userId: string
  email?: string
  firstName?: string
  lastName?: string
  assessmentPassed?: boolean
  assessmentScore?: number
  assessmentMaxScore?: number
  overallScore?: number
  lastActivity?: string
  modules?: ModuleStatus[]
  // Merged from summary
  modulesUnlocked?: number
  modulesCompleted?: number
  latestModuleCompleted?: number | null
}

const MODULE_NUMS = ['1', '2', '3', '4', '5', '6']

function ModuleBadge({ status }: { status: ModuleStatus | undefined }) {
  if (!status) return <span className="text-base">—</span>
  if (status.lockStatus === 'complete') return <span className="text-base" title="Complete">✅</span>
  if (status.lockStatus === 'unlocked') return <span className="text-base" title="In progress">🔓</span>
  return <span className="text-base" title="Locked">🔒</span>
}

function DetailModal({
  user,
  onClose,
  onUnlock,
}: {
  user: UserProgressDetail
  onClose: () => void
  onUnlock: (userId: string, moduleNum: string) => void
}) {
  const [unlocking, setUnlocking] = useState<string | null>(null)

  async function handleUnlock(moduleNum: string) {
    setUnlocking(moduleNum)
    await onUnlock(user.userId, moduleNum)
    setUnlocking(null)
  }

  // Backend returns moduleProgress (list of user-module records from lms-user-modules)
  const userModules: ModuleStatus[] = user.moduleProgress ?? []

  const overallScore = user.latestAssessment?.overallScore ?? user.latestAssessment?.scorecard?.overallScore ?? null
  const scorePct = overallScore !== null ? overallScore : null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-base font-black text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Assessment status */}
          <div
            className="rounded-xl p-4"
            style={{
              background: user.latestAssessment
                ? 'rgba(43,191,197,0.08)'
                : 'rgba(232,97,42,0.08)',
              border: `1px solid ${user.latestAssessment ? 'rgba(43,191,197,0.25)' : 'rgba(232,97,42,0.25)'}`,
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Readiness Assessment</p>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: user.latestAssessment ? 'rgba(43,191,197,0.2)' : 'rgba(232,97,42,0.2)',
                  color: user.latestAssessment ? '#2BBFC5' : '#E8612A',
                }}
              >
                {user.latestAssessment ? `✅ Attempt #${user.latestAssessment.attemptNumber ?? 1}` : '❌ Not taken'}
              </span>
            </div>
            {scorePct !== null && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Score</span>
                  <span className="font-semibold text-white">{scorePct}%</span>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${scorePct}%`,
                      background: user.assessmentPassed ? 'linear-gradient(90deg,#2BBFC5,#10b981)' : 'linear-gradient(90deg,#E8612A,#f97316)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Module progress */}
          <div>
            <p className="text-sm font-black text-white mb-3">Module-by-Module Progress</p>
            <div className="space-y-2">
              {MODULE_NUMS.map(mn => {
                const mod = userModules.find(m => (m.moduleNum ?? (m as ModuleStatus & { weekNum?: string }).weekNum) === mn)
                const isLocked = !mod || mod.lockStatus === 'locked'
                const isComplete = mod?.lockStatus === 'complete'
                const pct = mod && mod.videosTotal > 0
                  ? Math.round((mod.videosComplete / mod.videosTotal) * 100)
                  : 0

                return (
                  <div
                    key={mn}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <ModuleBadge status={mod} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-white">Module {mn}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {mod ? `${mod.videosComplete}/${mod.videosTotal} videos` : 'No data'}
                        </p>
                      </div>
                      <div className="w-full rounded-full h-1" style={{ background: 'var(--bg-base)' }}>
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: isComplete
                              ? 'linear-gradient(90deg,#2BBFC5,#10b981)'
                              : 'linear-gradient(90deg,#5E6AD2,#8B5CF6)',
                          }}
                        />
                      </div>
                    </div>
                    {isLocked && (
                      <button
                        onClick={() => handleUnlock(mn)}
                        disabled={unlocking === mn}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold text-white flex-shrink-0 transition-all hover:scale-105 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)' }}
                      >
                        {unlocking === mn ? '…' : '🔓 Unlock'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Video detail if available */}
          {user.videoProgress && user.videoProgress.length > 0 && (
            <div>
              <p className="text-sm font-black text-white mb-3">Video Progress</p>
              <div className="space-y-2">
                {user.videoProgress.map(v => (
                  <div
                    key={v.videoId}
                    className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <span className="text-sm">{v.completed ? '✅' : '▶️'}</span>
                    <p className="text-xs text-white flex-1 truncate">{v.title ?? v.videoId}</p>
                    <p className="text-xs font-semibold flex-shrink-0" style={{ color: v.completed ? '#2BBFC5' : 'var(--text-muted)' }}>
                      {v.percent ?? 0}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminLmsProgressPage() {
  const [users, setUsers] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProgressDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [entered, setEntered] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Backend returns { users: [{ userId, modulesUnlocked, modulesCompleted, latestModuleCompleted }] }
      const res = await api.lmsAdminGetUsersProgress() as { users: UserProgressSummary[] }
      // Map summary records into UserProgress shape for table display
      const mapped: UserProgress[] = (res.users || []).map(s => ({
        userId: s.userId,
        modulesUnlocked: s.modulesUnlocked,
        modulesCompleted: s.modulesCompleted,
        latestModuleCompleted: s.latestModuleCompleted,
      }))
      setUsers(mapped)
      setTimeout(() => setEntered(true), 80)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleOpenUser(userId: string) {
    setLoadingDetail(true)
    try {
      // Backend returns flat object: { userId, moduleProgress, videoProgress, latestAssessment, certificate }
      const res = await api.lmsAdminGetUserProgress(userId) as UserProgressDetail
      setSelectedUser(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load user progress')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleUnlock(userId: string, moduleNum: string) {
    try {
      await api.lmsAdminUnlockModule(userId, moduleNum)
      // Refresh both detail and list
      const res = await api.lmsAdminGetUserProgress(userId) as UserProgressDetail
      setSelectedUser(res)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to unlock module')
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.userId.toLowerCase().includes(q)
  })

  const passedCount = 0  // summary endpoint does not include assessment data
  const completedAllCount = users.filter(u => (u.modulesCompleted ?? 0) >= 6).length

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blur-orb w-96 h-96 -top-20 -left-20 animate-pulse-slow" style={{ background: '#2BBFC5', opacity: 0.05 }} />
      </div>

      <div
        className={`relative max-w-6xl mx-auto space-y-5 transition-all duration-700 ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">LMS Progress Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Track all users through the 6-module digital legacy program
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            {loading ? '⟳ Loading…' : '⟳ Refresh'}
          </button>
        </div>

        {/* Summary stats */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: users.length, color: '#5E6AD2' },
              { label: 'Assessment Passed', value: passedCount, color: '#2BBFC5' },
              { label: 'Program Complete', value: completedAllCount, color: '#10b981' },
              { label: 'In Progress', value: users.length - completedAllCount - (users.length - passedCount), color: '#E8612A' },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl p-4 text-center"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            className="p-4 rounded-2xl text-sm flex items-center gap-3"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {error}
            <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-base font-bold text-white">No users found</p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Table header */}
            <div
              className="grid px-5 py-3 text-xs font-black uppercase tracking-wider"
              style={{
                gridTemplateColumns: '2fr 1fr repeat(6, 1fr) 1fr',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span>User</span>
              <span>Assessment</span>
              {MODULE_NUMS.map(mn => <span key={mn} className="text-center">M{mn}</span>)}
              <span>Activity</span>
            </div>

            {/* Table rows */}
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {filtered.map(u => {
                const lastDate = u.lastActivity
                  ? new Date(u.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'

                return (
                  <div
                    key={u.userId}
                    className="grid items-center px-5 py-3 transition-colors cursor-pointer hover:bg-white/[0.02]"
                    style={{ gridTemplateColumns: '2fr 1fr repeat(6, 1fr) 1fr' }}
                    onClick={() => handleOpenUser(u.userId)}
                  >
                    {/* User */}
                    <div>
                      <p className="text-sm font-bold text-white truncate">
                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.userId}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email ?? u.userId}</p>
                    </div>

                    {/* Assessment — summary only has modules completed count */}
                    <div className="space-y-0.5">
                      {(u.modulesCompleted ?? 0) > 0 ? (
                        <span className="text-xs font-bold block" style={{ color: '#2BBFC5' }}>
                          ✅ {u.modulesCompleted}/6 done
                        </span>
                      ) : (u.modulesUnlocked ?? 0) > 0 ? (
                        <span className="text-xs font-bold block" style={{ color: '#E8612A' }}>
                          🔓 {u.modulesUnlocked} unlocked
                        </span>
                      ) : (
                        <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Not started</span>
                      )}
                    </div>

                    {/* Module statuses — not available in summary; show placeholder */}
                    {MODULE_NUMS.map(mn => {
                      const completed = (u.latestModuleCompleted ?? 0) >= parseInt(mn)
                      return (
                        <div key={mn} className="flex justify-center">
                          <span title={completed ? 'Complete' : 'Unknown'}>
                            {completed ? '✅' : '—'}
                          </span>
                        </div>
                      )
                    })}

                    {/* Last activity */}
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lastDate}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Showing {filtered.length} of {users.length} users — click any row for details
          </p>
        )}
      </div>

      {/* Loading detail spinner */}
      {loadingDetail && (
        <div className="fixed inset-0 flex items-center justify-center z-40" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="text-center">
            <div className="text-3xl animate-spin mb-2">⟳</div>
            <p className="text-sm text-white">Loading user details…</p>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedUser && (
        <DetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUnlock={handleUnlock}
        />
      )}
    </div>
  )
}
