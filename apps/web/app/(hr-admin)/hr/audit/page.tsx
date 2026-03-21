'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { FileText, Loader2, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { api, AuditLog } from '@/lib/api'

export default function HrAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filtered, setFiltered] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.hrAudit()
      setLogs(d.logs)
      setFiltered(d.logs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!search) { setFiltered(logs); return }
    const q = search.toLowerCase()
    setFiltered(logs.filter(l =>
      l.actor?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q)
    ))
  }, [logs, search])

  const actionColor = (action: string) => {
    if (action?.includes('INVITE')) return 'bg-blue-500/10 text-blue-400'
    if (action?.includes('DEACTIVAT')) return 'bg-red-500/10 text-red-400'
    if (action?.includes('UPDATE')) return 'bg-yellow-500/10 text-yellow-400'
    return 'bg-slate-500/10 text-slate-400'
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FileText className="w-8 h-8 text-green-400" />
              Audit Log
            </h1>
            <p className="text-slate-400 text-sm mt-1">{filtered.length} entries (last 50)</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="glass p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search audit entries..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Actor</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No audit logs yet. Actions like inviting employees will appear here.
                    </td>
                  </tr>
                ) : filtered.map(log => (
                  <tr key={log.auditId} className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{log.actor}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
