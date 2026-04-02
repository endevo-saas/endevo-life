'use client'
import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { Users, ClipboardList, TrendingUp, Award, Search, X, ChevronDown } from 'lucide-react'

interface ModuleStatus {
  lockStatus: string
  completedAt?: string
}

interface DomainScore {
  percentage: number
  tier: { label: string; color: string }
}

interface Scorecard {
  overallTier?: { label: string; color: string }
  domainScores?: { [domain: string]: DomainScore }
  recommendedOrder?: string[]
  personalisedNarrative?: string
}

interface UserProgressSummary {
  userId: string
  email: string
  firstName?: string
  lastName?: string
  assessmentScore?: number
  assessmentPassed?: boolean
  assessmentAttempts?: number
  modules?: { [moduleNum: string]: ModuleStatus }
  lastActivity?: string
  scorecard?: Scorecard
}

const MODULE_NUMS = ['1', '2', '3', '4', '5', '6']
const DOMAIN_LABELS: { [key: string]: string } = {
  legal: 'Legal',
  financial: 'Financial',
  physical: 'Physical',
  digital: 'Digital',
}

function scoreBadge(score: number | undefined) {
  if (score === undefined) return { label: 'N/A', cls: 'bg-slate-700 text-slate-400' }
  if (score >= 85) return { label: `${score}%`, cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' }
  if (score >= 60) return { label: `${score}%`, cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' }
  if (score >= 35) return { label: `${score}%`, cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }
  return { label: `${score}%`, cls: 'bg-red-500/20 text-red-400 border border-red-500/30' }
}

function moduleIcon(mod: ModuleStatus | undefined): string {
  if (!mod) return '🔒'
  if (mod.lockStatus === 'completed') return '✅'
  if (mod.lockStatus === 'unlocked') return '🔓'
  return '🔒'
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string
}) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color, opacity: 0.9 }}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

function DomainBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const barColor = color === 'green' ? '#10b981' : color === 'blue' ? '#06b6d4' : color === 'amber' ? '#f59e0b' : '#f43f5e'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-bold text-white">{pct}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function DetailModal({ user, onClose }: { user: UserProgressSummary; onClose: () => void }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const sc = user.scorecard
  const badge = scoreBadge(user.assessmentScore)
  const domains = sc?.domainScores ? Object.entries(sc.domainScores) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-auto max-h-[90vh]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 flex items-start justify-between"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-base font-black text-white">{name}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score + tier */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-xl text-sm font-black ${badge.cls}`}>
              {badge.label}
            </span>
            {sc?.overallTier && (
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {sc.overallTier.label}
              </span>
            )}
            {user.assessmentAttempts !== undefined && (
              <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                {user.assessmentAttempts} attempt{user.assessmentAttempts !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Narrative */}
          {sc?.personalisedNarrative && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {sc.personalisedNarrative}
            </p>
          )}

          {/* Domain scores */}
          {domains.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Domain Scores
              </p>
              {domains.map(([key, ds]) => (
                <DomainBar key={key}
                  label={DOMAIN_LABELS[key] ?? key}
                  pct={ds.percentage}
                  color={ds.tier?.color ?? 'blue'} />
              ))}
            </div>
          )}

          {/* Recommended order */}
          {sc?.recommendedOrder && sc.recommendedOrder.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Recommended Module Order
              </p>
              <div className="flex flex-wrap gap-2">
                {sc.recommendedOrder.map((m, i) => (
                  <div key={m} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <span className="text-[10px] font-black" style={{ color: 'var(--accent-1)' }}>{i + 1}</span>
                    M{m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Module completion grid */}
          {user.modules && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Module Status
              </p>
              <div className="grid grid-cols-6 gap-2">
                {MODULE_NUMS.map(n => {
                  const mod = user.modules?.[n]
                  return (
                    <div key={n} className="flex flex-col items-center gap-1 p-2 rounded-xl"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <span className="text-base">{moduleIcon(mod)}</span>
                      <span className="text-[10px] font-bold text-white">M{n}</span>
                      {mod?.completedAt && (
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(mod.completedAt)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HrLmsProgressPage() {
  const [users, setUsers] = useState<UserProgressSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserProgressSummary | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    api.lmsAdminGetUsersProgress()
      .then((data: unknown) => {
        const list = Array.isArray(data) ? data as UserProgressSummary[]
          : (data as { users?: UserProgressSummary[] })?.users ?? []
        setUsers(list)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(u => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase()
      return name.includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, search])

  const totalEmployees = users.length
  const assessmentsTaken = users.filter(u => u.assessmentScore !== undefined).length
  const avgScore = assessmentsTaken > 0
    ? Math.round(users.reduce((sum, u) => sum + (u.assessmentScore ?? 0), 0) / assessmentsTaken)
    : 0
  const modulesCompleted = users.reduce((sum, u) => {
    if (!u.modules) return sum
    return sum + Object.values(u.modules).filter(m => m.lockStatus === 'completed').length
  }, 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-black text-white">Employee LMS Progress</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Track readiness assessments and module completion across your team
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Users}        label="Total Employees"    value={totalEmployees} color="linear-gradient(135deg,#06b6d4,#0ea5e9)" />
          <SummaryCard icon={ClipboardList} label="Assessments Taken"  value={assessmentsTaken} color="linear-gradient(135deg,#8b5cf6,#a78bfa)" />
          <SummaryCard icon={TrendingUp}   label="Avg Score %"         value={assessmentsTaken ? `${avgScore}%` : '—'} color="linear-gradient(135deg,#f59e0b,#fbbf24)" />
          <SummaryCard icon={Award}        label="Modules Completed"   value={modulesCompleted} color="linear-gradient(135deg,#10b981,#34d399)" />
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-2xl text-sm"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Employee', 'Score', 'Status', ...MODULE_NUMS.map(n => `M${n}`), 'Last Activity', ''].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '120px' : '60px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      {search ? 'No employees match your search.' : 'No employee data yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(user => {
                    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—'
                    const badge = scoreBadge(user.assessmentScore)
                    return (
                      <tr key={user.userId}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => setSelected(user)}>

                        {/* Employee */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white text-sm">{name}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                        </td>

                        {/* Score badge */}
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {user.assessmentScore !== undefined
                            ? <span className="text-xs font-medium text-emerald-400">Taken</span>
                            : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not Started</span>
                          }
                        </td>

                        {/* Module columns */}
                        {MODULE_NUMS.map(n => (
                          <td key={n} className="px-4 py-3 text-center text-base">
                            {moduleIcon(user.modules?.[n])}
                          </td>
                        ))}

                        {/* Last activity */}
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(user.lastActivity)}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <button
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--accent-1)' }}
                            onClick={e => { e.stopPropagation(); setSelected(user) }}>
                            View Detail
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
            Showing {filtered.length} of {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Detail modal */}
      {selected && <DetailModal user={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
