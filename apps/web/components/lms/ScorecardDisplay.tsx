'use client'

import { useRouter } from 'next/navigation'

export interface ScorecardTier {
  key: string
  label: string
  emoji: string
  color: string
  message?: string
}

export interface ScorecardUrgency {
  key: string
  label: string
  color: string
}

export interface ScorecardDomainScore {
  domain: string
  moduleNum: string
  percentage: number
  tier: ScorecardTier
  urgency: ScorecardUrgency
  gapCount: number
}

export interface ScorecardModuleRecommendation {
  moduleNum: string
  domain: string
  urgency: ScorecardUrgency
  actionMessage: string
  gapCount?: number
}

export interface ScorecardResult {
  overallScore: number
  overallTier: ScorecardTier
  domainScores: Record<string, ScorecardDomainScore>
  recommendedOrder: string[]
  moduleRecommendations: ScorecardModuleRecommendation[]
  strengths: string[]
  weaknesses: string[]
  criticalGaps: string[]
  personalisedNarrative: string
  attemptNumber: number
}

interface Props {
  scorecard: ScorecardResult
  onRetake?: () => void
  showRetake?: boolean
}

const DOMAIN_ICONS: Record<string, string> = {
  Legal: '⚖️',
  Financial: '💰',
  Physical: '🏠',
  Digital: '💻',
  'Legal Readiness': '⚖️',
  'Financial Readiness': '💰',
  'Physical Readiness': '🏠',
  'Digital Readiness': '💻',
  Foundation: '🏛️',
  'Communicate Your Wishes': '💬',
}

function UrgencyBadge({ urgency }: { urgency: ScorecardUrgency }) {
  return (
    <span
      className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
      style={{
        background: `${urgency.color}20`,
        color: urgency.color,
        border: `1px solid ${urgency.color}40`,
      }}
    >
      {urgency.label}
    </span>
  )
}

function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div className="w-full rounded-full h-2.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <div
        className="h-2.5 rounded-full"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          transition: `width 1.2s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        }}
      />
    </div>
  )
}

export default function ScorecardDisplay({ scorecard, onRetake, showRetake = true }: Props) {
  const router = useRouter()

  const totalGaps = Object.values(scorecard.domainScores).reduce(
    (sum, d) => sum + (d.gapCount ?? 0),
    0
  )

  const firstRecommended = scorecard.moduleRecommendations[0]

  return (
    <div className="w-full space-y-6">
      {/* ── Overall Score Hero ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(43,191,197,0.10), rgba(13,24,37,0.95))',
          border: '1px solid rgba(43,191,197,0.25)',
        }}
      >
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${scorecard.overallTier.color}15 0%, transparent 70%)`,
          }}
        />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: '#2BBFC5' }}>
            Your Readiness Scorecard
          </p>

          {/* Big score */}
          <div className="my-4">
            <p
              className="text-7xl font-black leading-none"
              style={{ color: scorecard.overallTier.color }}
            >
              {scorecard.overallScore}%
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-2xl">{scorecard.overallTier.emoji}</span>
              <span className="text-lg font-black text-white">{scorecard.overallTier.label}</span>
            </div>
          </div>

          {/* Overall bar */}
          <div className="max-w-xs mx-auto mb-4">
            <AnimatedBar pct={scorecard.overallScore} color={scorecard.overallTier.color} delay={200} />
          </div>

          {/* Personalised narrative */}
          {scorecard.personalisedNarrative && (
            <p
              className="text-sm leading-relaxed max-w-md mx-auto"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {scorecard.personalisedNarrative}
            </p>
          )}

          {/* Attempt badge */}
          {scorecard.attemptNumber > 1 && (
            <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Attempt #{scorecard.attemptNumber}
            </p>
          )}
        </div>
      </div>

      {/* ── Gap summary ───────────────────────────────────────────── */}
      {totalGaps > 0 && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          <span className="text-xl flex-shrink-0">⚠️</span>
          <p className="text-sm font-bold text-white">
            We found <span style={{ color: '#ef4444' }}>{totalGaps} gap{totalGaps !== 1 ? 's' : ''}</span> in your legacy plan that need attention.
          </p>
        </div>
      )}

      {/* ── Domain Scores ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-black text-white">Your Four Pillars</p>

        {Object.values(scorecard.domainScores).map((d, i) => (
          <div key={d.domain} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base flex-shrink-0">{DOMAIN_ICONS[d.domain] ?? '📌'}</span>
                <span className="text-sm font-bold text-white truncate">{d.domain} Readiness</span>
                <span className="text-xs" style={{ color: d.tier.color }}>
                  {d.tier.emoji} {d.tier.label}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-black text-white">{d.percentage}%</span>
                <UrgencyBadge urgency={d.urgency} />
              </div>
            </div>
            <AnimatedBar pct={d.percentage} color={d.tier.color} delay={i * 150 + 300} />
          </div>
        ))}
      </div>

      {/* ── Strengths & weaknesses ────────────────────────────────── */}
      {(scorecard.strengths.length > 0 || scorecard.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scorecard.strengths.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <p className="text-xs font-black text-white mb-2">Where you&apos;re strong</p>
              <ul className="space-y-1">
                {scorecard.strengths.map((s, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <span style={{ color: '#22c55e' }}>✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scorecard.weaknesses.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p className="text-xs font-black text-white mb-2">Where to focus first</p>
              <ul className="space-y-1">
                {scorecard.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <span style={{ color: '#ef4444' }}>→</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Recommended Learning Path ─────────────────────────────── */}
      {scorecard.moduleRecommendations.length > 0 && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <p className="text-sm font-black text-white">Your Personalised Learning Path</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              All 6 modules are unlocked. Start with your most urgent area.
            </p>
          </div>

          <div className="space-y-2">
            {scorecard.moduleRecommendations.map((rec, i) => (
              <div
                key={rec.moduleNum}
                className="flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{
                  background: i === 0 ? 'rgba(232,97,42,0.10)' : 'var(--bg-elevated)',
                  border: i === 0 ? '1px solid rgba(232,97,42,0.30)' : '1px solid var(--border-subtle)',
                }}
                onClick={() => router.push(`/employee/lms/module/${rec.moduleNum}`)}
              >
                {/* Step number */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                  style={{
                    background: i === 0 ? 'rgba(232,97,42,0.25)' : 'rgba(255,255,255,0.06)',
                    color: i === 0 ? '#E8612A' : 'var(--text-muted)',
                  }}
                >
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      Module {rec.moduleNum}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {DOMAIN_ICONS[rec.domain]} {rec.domain}
                    </span>
                  </div>
                  {rec.actionMessage && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {rec.actionMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <UrgencyBadge urgency={rec.urgency} />
                  <span style={{ color: i === 0 ? '#E8612A' : 'var(--text-muted)' }}>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Primary CTA ───────────────────────────────────────────── */}
      {firstRecommended && (
        <button
          onClick={() => router.push(`/employee/lms/module/${firstRecommended.moduleNum}`)}
          className="w-full py-4 rounded-2xl font-black text-base text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#E8612A,#f97316)', boxShadow: '0 8px 32px rgba(232,97,42,0.3)' }}
        >
          Start Module {firstRecommended.moduleNum} — {firstRecommended.domain} Readiness →
        </button>
      )}

      {/* ── Retake link ───────────────────────────────────────────── */}
      {showRetake && onRetake && (
        <div className="text-center">
          <button
            onClick={onRetake}
            className="text-sm underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            Retake assessment to track your progress
          </button>
        </div>
      )}
    </div>
  )
}
