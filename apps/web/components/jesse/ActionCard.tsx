'use client'

import { useState } from 'react'

/**
 * Jesse HITL (Human-in-the-Loop) Action Card
 *
 * When Jesse proposes an action (e.g., "Create employee", "Send campaign"),
 * it renders this card with Approve/Reject buttons. The action does NOT
 * execute until the human clicks Approve.
 *
 * This is the core differentiator: 99% AI, 1% human approval.
 */

export interface JesseAction {
  actionId: string
  type: string
  label: string
  description: string
  params: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'
  result?: string
}

const ACTION_ICONS: Record<string, string> = {
  create_employee: '\u{1F464}',
  send_campaign: '\u{1F4E7}',
  generate_report: '\u{1F4CA}',
  unlock_module: '\u{1F513}',
  book_session: '\u{1F4C5}',
  change_plan: '\u{1F4B3}',
  send_nudge: '\u{1F514}',
  default: '\u{26A1}',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(251,191,36,0.12)', text: 'var(--gold)',    label: 'Awaiting Approval' },
  approved:  { bg: 'rgba(52,211,153,0.12)', text: 'var(--success)', label: 'Approved' },
  rejected:  { bg: 'rgba(248,113,113,0.12)', text: 'var(--danger)', label: 'Rejected' },
  executing: { bg: 'rgba(94,106,210,0.12)', text: 'var(--accent-1)', label: 'Executing...' },
  completed: { bg: 'rgba(52,211,153,0.12)', text: 'var(--success)', label: 'Completed' },
  failed:    { bg: 'rgba(248,113,113,0.12)', text: 'var(--danger)', label: 'Failed' },
}

interface ActionCardProps {
  action: JesseAction
  onApprove: (actionId: string) => void
  onReject: (actionId: string) => void
}

export default function ActionCard({ action, onApprove, onReject }: ActionCardProps) {
  const [processing, setProcessing] = useState(false)
  const icon = ACTION_ICONS[action.type] || ACTION_ICONS.default
  const status = STATUS_STYLES[action.status] || STATUS_STYLES.pending

  const handleApprove = async () => {
    setProcessing(true)
    onApprove(action.actionId)
  }

  const handleReject = async () => {
    setProcessing(true)
    onReject(action.actionId)
  }

  return (
    <div className="my-2 rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: status.bg }}>
        <span className="text-base">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {action.label}
          </span>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.text, border: `1px solid ${status.text}` }}>
          {status.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {action.description}
        </p>

        {/* Parameters preview */}
        {Object.keys(action.params).length > 0 && (
          <div className="mt-2 p-2 rounded-lg text-[11px] font-mono space-y-0.5"
            style={{ background: 'var(--bg-card)' }}>
            {Object.entries(action.params).slice(0, 5).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                <span style={{ color: 'var(--accent-1)' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Result message */}
        {action.result && (
          <div className="mt-2 p-2 rounded-lg text-xs"
            style={{
              background: action.status === 'completed' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
              color: action.status === 'completed' ? 'var(--success)' : 'var(--danger)',
            }}>
            {action.result}
          </div>
        )}
      </div>

      {/* Action Buttons — ONLY shown when pending */}
      {action.status === 'pending' && (
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={handleApprove}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: 'var(--success)',
              color: '#000',
              boxShadow: '0 2px 8px var(--success-glow)',
            }}>
            {processing ? (
              <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : '✓'} Approve
          </button>
          <button
            onClick={handleReject}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
            }}>
            {processing ? (
              <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
            ) : '✕'} Reject
          </button>
        </div>
      )}
    </div>
  )
}
