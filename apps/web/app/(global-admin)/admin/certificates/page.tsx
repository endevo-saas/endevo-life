'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import {
  Award, Loader2, RefreshCw, Search, AlertCircle,
  Building2, User, Download, Calendar, Star, Filter
} from 'lucide-react'
import { api } from '@/lib/api'
import { exportCsv } from '@/lib/export'

interface CertRecord {
  certId: string
  userId: string
  courseId: string
  score: number
  issuedAt: string
  email?: string
  firstName?: string
  lastName?: string
  tenantId?: string
  tenantName?: string
  courseName?: string
}

export default function AdminCertificatesPage() {
  const [certs, setCerts]       = useState<CertRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [scoreFilter, setScoreFilter]   = useState('ALL')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api.adminCertificates()
      setCerts((d as { certificates: CertRecord[] }).certificates || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load certificates')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Unique tenants for filter dropdown
  const tenants = Array.from(new Set(certs.map(c => c.tenantId || '').filter(Boolean)))
    .map(tid => ({ id: tid, name: certs.find(c => c.tenantId === tid)?.tenantName || tid }))

  const filtered = certs.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.firstName || '').toLowerCase().includes(q) ||
      (c.lastName || '').toLowerCase().includes(q) ||
      (c.courseId || '').toLowerCase().includes(q) ||
      (c.certId || '').toLowerCase().includes(q)
    const matchTenant = !tenantFilter || c.tenantId === tenantFilter
    const matchScore =
      scoreFilter === 'ALL' ? true :
      scoreFilter === '90+' ? c.score >= 90 :
      scoreFilter === '80+' ? c.score >= 80 :
      scoreFilter === '<80' ? c.score < 80 : true
    return matchSearch && matchTenant && matchScore
  })

  const avgScore = certs.length ? Math.round(certs.reduce((s, c) => s + (c.score || 0), 0) / certs.length) : 0
  const passRate = certs.length ? Math.round(certs.filter(c => c.score >= 70).length / certs.length * 100) : 0

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Certificates</h1>
            <p className="text-slate-400 text-sm mt-0.5">All certificates issued across the platform</p>
          </div>
          <button onClick={() => exportCsv('endevo_certificates', filtered as unknown as Record<string, unknown>[], [
            {key:'certId',label:'Cert ID'},{key:'email',label:'Email'},{key:'firstName',label:'First Name'},
            {key:'lastName',label:'Last Name'},{key:'tenantName',label:'Organization'},{key:'courseId',label:'Course ID'},
            {key:'score',label:'Score %'},{key:'issuedAt',label:'Issued Date'}
          ])} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/5 text-slate-300 hover:text-white border border-white/10 transition-all">
            <Download className="w-4 h-4"/>CSV
          </button>
          <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Issued',  value: certs.length,    color: 'text-brand-300',  icon: Award },
            { label: 'Avg Score',     value: `${avgScore}%`,  color: 'text-green-400',  icon: Star },
            { label: 'Pass Rate',     value: `${passRate}%`,  color: 'text-blue-400',   icon: Download },
            { label: 'Organizations', value: tenants.length,  color: 'text-purple-400', icon: Building2 },
          ].map(k => (
            <div key={k.label} className="glass p-4 rounded-2xl">
              <k.icon className={`w-5 h-5 ${k.color} mb-2`} />
              <div className={`text-3xl font-black ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="glass p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, course ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="input-field w-auto text-sm">
            <option value="">All Organizations</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)} className="input-field w-auto text-sm">
            <option value="ALL">All Scores</option>
            <option value="90+">90%+ (Distinction)</option>
            <option value="80+">80%+ (Merit)</option>
            <option value="<80">Below 80%</option>
          </select>
          <span className="text-xs text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="glass p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-brand-400" /></div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Employee', 'Organization', 'Course', 'Score', 'Grade', 'Issued', 'Cert ID'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No certificates found</td></tr>
                  ) : filtered.map(c => {
                    const grade = c.score >= 90 ? { label: 'Distinction', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
                      : c.score >= 80 ? { label: 'Merit',       color: 'text-green-400  bg-green-500/10  border-green-500/20' }
                      : c.score >= 70 ? { label: 'Pass',        color: 'text-blue-400   bg-blue-500/10   border-blue-500/20' }
                      : { label: 'Fail',        color: 'text-red-400    bg-red-500/10    border-red-500/20' }
                    return (
                      <tr key={c.certId} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0">
                              {((c.firstName?.[0] || c.email?.[0] || '?')).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm text-white font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</div>
                              <div className="text-xs text-slate-500">{c.email || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            {c.tenantName || c.tenantId || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-slate-300 bg-white/5 px-2 py-1 rounded">
                            {c.courseId || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.score >= 80 ? 'bg-green-500' : c.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${c.score}%` }} />
                            </div>
                            <span className="text-sm font-bold text-white">{c.score}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${grade.color}`}>{grade.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-600">{(c.certId || '').slice(0, 8)}…</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
