'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Loader2, AlertCircle, RefreshCw, Search,
  Shield, Monitor, Wifi, Filter, Download,
  XCircle, AlertTriangle, Info
} from 'lucide-react'
import { api, AuditLog } from '@/lib/api'

const ACTION_COLOR: Record<string, string> = {
  LOGIN_SUCCESS:        'bg-green-500/10 text-green-400 border-green-500/20',
  LOGIN_FAILED:         'bg-red-500/10 text-red-400 border-red-500/20',
  LOGIN_BLOCKED:        'bg-red-600/20 text-red-300 border-red-500/30',
  PASSWORD_CHANGED:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PASSWORD_RESET:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  REGISTER_SUCCESS:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  USER_CREATED:         'bg-green-500/10 text-green-400 border-green-500/20',
  USER_UPDATED:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  USER_DELETED:         'bg-red-500/10 text-red-400 border-red-500/20',
  USER_LOCKED:          'bg-red-500/10 text-red-400 border-red-500/20',
  USER_UNLOCKED:        'bg-green-500/10 text-green-400 border-green-500/20',
  USER_INVITED:         'bg-purple-500/10 text-purple-400 border-purple-500/20',
  INVITE_SENT:          'bg-purple-500/10 text-purple-400 border-purple-500/20',
  EMPLOYEE_UPDATED:     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  EMPLOYEE_DEACTIVATED: 'bg-red-500/10 text-red-400 border-red-500/20',
  PASSWORD_RESET_ADMIN: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  INFO:  <Info className="w-3 h-3 text-slate-400" />,
  WARN:  <AlertTriangle className="w-3 h-3 text-yellow-400" />,
  ERROR: <XCircle className="w-3 h-3 text-red-400" />,
}

function actionColor(action = '') {
  return ACTION_COLOR[action] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
}

export default function HrAuditPage() {
  const [logs, setLogs]         = useState<AuditLog[]>([])
  const [filtered, setFiltered] = useState<AuditLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.hrAudit()
      setLogs(d.logs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let out = logs
    if (search) {
      const q = search.toLowerCase()
      out = out.filter(l =>
        l.actor?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        l.ip_address?.includes(q)
      )
    }
    if (actionFilter) out = out.filter(l => l.action?.startsWith(actionFilter))
    setFiltered(out)
  }, [logs, search, actionFilter])

  const categories = ['ALL', 'LOGIN', 'PASSWORD', 'USER', 'EMPLOYEE', 'INVITE']

  const exportCSV = () => {
    const rows = [
      ['Time', 'Actor', 'Action', 'Severity', 'Details', 'IP Address', 'User Agent'].join(','),
      ...filtered.map(l => [
        new Date(l.createdAt || '').toISOString(),
        l.actor || '',
        l.action || '',
        l.severity || 'INFO',
        `"${(l.details || '').replace(/"/g, '""')}"`,
        l.ip_address || '',
        `"${(l.user_agent || '').replace(/"/g, '""')}"`
      ].join(','))
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `hr-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const securityEvents = logs.filter(l => l.severity === 'WARN' || l.severity === 'ERROR').length
  const loginFails     = logs.filter(l => l.action === 'LOGIN_FAILED').length
  const invitesSent    = logs.filter(l => l.action === 'INVITE_SENT').length

  return (
    <div className="min-h-screen p-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-green-600/6 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8 text-green-400" />
              HR Audit Log
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{filtered.length} of {logs.length} events · Tenant-scoped IP + device tracking</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Events',      value: logs.length,    color: 'text-slate-300',  bg: 'from-slate-600/20 to-slate-800/10 border-slate-500/30' },
            { label: 'Security Warnings', value: securityEvents, color: 'text-yellow-400', bg: 'from-yellow-600/20 to-yellow-800/10 border-yellow-500/30' },
            { label: 'Failed Logins',     value: loginFails,     color: 'text-red-400',    bg: 'from-red-600/20 to-red-800/10 border-red-500/30' },
            { label: 'Invites Sent',      value: invitesSent,    color: 'text-green-400',  bg: 'from-green-600/20 to-green-800/10 border-green-500/30' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-4 border bg-gradient-to-br ${s.bg}`}>
              <div className={`text-2xl font-black ${s.color}`}>{loading ? '—' : s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />{error}
            <button onClick={load} className="ml-auto underline">Retry</button>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search actor, action, details, IP address..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500/50" />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-500" />
              {categories.map(c => (
                <button key={c}
                  onClick={() => setActionFilter(c === 'ALL' ? '' : c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    (c === 'ALL' && !actionFilter) || actionFilter === c
                      ? 'bg-green-600/30 text-green-300 border border-green-500/40'
                      : 'bg-white/3 text-slate-500 border border-white/8 hover:text-white'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-32">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-8"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Details</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <Wifi className="w-3.5 h-3.5 inline mr-1 text-green-400" />IP Address
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <Monitor className="w-3.5 h-3.5 inline mr-1 text-purple-400" />Device
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm">
                      No events found. Actions will appear here in real-time.
                    </td>
                  </tr>
                ) : filtered.map(log => {
                  const isExpanded = expandedId === log.auditId
                  const ua = log.user_agent || ''
                  const browser = ua.includes('Edg/') ? 'Edge' : ua.includes('Chrome/') ? 'Chrome' : ua.includes('Firefox/') ? 'Firefox' : ua.includes('Safari/') ? 'Safari' : ua ? 'Browser' : '—'
                  const os = ua.includes('Windows') ? 'Win' : ua.includes('Mac') ? 'Mac' : ua.includes('iPhone') ? 'iOS' : ua.includes('Android') ? 'Android' : ua.includes('Linux') ? 'Linux' : '—'
                  return (
                    <React.Fragment key={log.auditId}>
                      <tr className="hover:bg-white/3 transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : log.auditId)}>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
                          }) : '—'}
                        </td>
                        <td className="px-2 py-3">
                          {SEVERITY_ICON[log.severity || 'INFO']}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300 max-w-32 truncate">{log.actor}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${actionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{log.details || '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-300">
                          {log.ip_address ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                              {log.ip_address}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {log.user_agent ? <span>{browser} · {os}</span> : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-white/3">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="text-slate-500 mb-1">Full Details</p>
                                <p className="text-slate-300">{log.details || 'No details'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-1">Full IP Address</p>
                                <p className="font-mono text-green-300">{log.ip_address || '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-1">User Agent</p>
                                <p className="text-slate-300 break-all">{log.user_agent || '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
