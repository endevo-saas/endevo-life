'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Award, Loader2, RefreshCw, AlertCircle, Search, Download, Star } from 'lucide-react'
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
}

export default function HrCertificatesPage() {
  const [certs, setCerts]     = useState<CertRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api.hrCertificates()
      setCerts((d as unknown as { certificates: CertRecord[] }).certificates || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load certificates')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = certs.filter(c => {
    const q = search.toLowerCase()
    return !search ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.firstName || '').toLowerCase().includes(q) ||
      (c.lastName || '').toLowerCase().includes(q) ||
      (c.courseId || '').toLowerCase().includes(q)
  })

  const avgScore = certs.length ? Math.round(certs.reduce((s, c) => s + (c.score || 0), 0) / certs.length) : 0

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Certificates</h1>
            <p className="text-slate-400 text-sm mt-0.5">All certificates earned by your employees</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportCsv('hr_certificates', filtered as unknown as Record<string, unknown>[], [
              {key:'firstName',label:'First Name'},{key:'lastName',label:'Last Name'},
              {key:'email',label:'Email'},{key:'courseId',label:'Course'},
              {key:'score',label:'Score %'},{key:'issuedAt',label:'Issued Date'}
            ])} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/5 text-slate-300 hover:text-white border border-white/10 transition-all">
              <Download className="w-4 h-4"/>CSV
            </button>
            <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <RefreshCw className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}</div>}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            {label:'Total Issued',  value: certs.length, color:'text-green-400', icon: Award},
            {label:'Avg Score',     value: `${avgScore}%`, color:'text-brand-300', icon: Star},
            {label:'Pass Rate',     value: `${certs.length ? Math.round(certs.filter(c=>c.score>=70).length/certs.length*100) : 0}%`, color:'text-blue-400', icon: Award},
          ].map(k=>(
            <div key={k.label} className="glass p-4 rounded-2xl">
              <k.icon className={`w-5 h-5 ${k.color} mb-2`}/>
              <div className={`text-3xl font-black ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="glass p-3 mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input type="text" placeholder="Search by name, email or course..." value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-9"/>
          </div>
          <span className="text-xs text-slate-500 self-center whitespace-nowrap">{filtered.length} certs</span>
        </div>

        {loading ? (
          <div className="glass p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-green-400"/></div>
        ) : filtered.length === 0 ? (
          <div className="glass p-12 text-center">
            <Award className="w-10 h-10 text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400">{search ? 'No certificates match your search.' : 'No certificates earned yet.'}</p>
            <p className="text-slate-600 text-xs mt-1">Certificates are issued automatically when employees pass assessments.</p>
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                {['Employee','Course','Score','Grade','Issued'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(c => {
                  const grade = c.score>=90?{l:'Distinction',col:'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'}
                    :c.score>=80?{l:'Merit',col:'text-green-400 bg-green-500/10 border-green-500/20'}
                    :c.score>=70?{l:'Pass',col:'text-blue-400 bg-blue-500/10 border-blue-500/20'}
                    :{l:'Fail',col:'text-red-400 bg-red-500/10 border-red-500/20'}
                  return (
                    <tr key={c.certId} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-green-600/20 flex items-center justify-center text-green-300 text-xs font-bold flex-shrink-0">
                            {(c.firstName?.[0] || c.email?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm text-white">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</div>
                            <div className="text-xs text-slate-500">{c.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">{c.courseId}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${c.score>=80?'bg-green-500':c.score>=70?'bg-yellow-500':'bg-red-500'}`} style={{width:`${c.score}%`}}/>
                          </div>
                          <span className="text-sm font-bold text-white">{c.score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${grade.col}`}>{grade.l}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'}</td>
                    </tr>
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
