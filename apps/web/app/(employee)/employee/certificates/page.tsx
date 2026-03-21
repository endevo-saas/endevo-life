'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Award, Download, Loader2, AlertCircle, RefreshCw, Trophy } from 'lucide-react'
import { api, Certificate } from '@/lib/api'

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.employeeCertificates()
      setCerts(d.certificates)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load certificates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function downloadCert(cert: Certificate) {
    // Generate simple text certificate for download
    const content = [
      '══════════════════════════════════════════════',
      '           ENDEVO LIFE — CERTIFICATE           ',
      '══════════════════════════════════════════════',
      '',
      `Certificate ID: ${cert.certId}`,
      `Course ID:      ${cert.courseId}`,
      `Score:          ${cert.score}%`,
      `Issued:         ${new Date(cert.issuedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      'This certifies successful completion of the',
      'digital legacy training programme.',
      '',
      '══════════════════════════════════════════════',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certificate-${cert.certId.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Award className="w-8 h-8 text-yellow-400" />
              My Certificates
            </h1>
            <p className="text-slate-400 text-sm mt-1">{certs.length} certificates earned</p>
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : certs.length === 0 ? (
          <div className="glass p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <div className="text-slate-400 text-lg font-medium">No certificates yet</div>
            <div className="text-sm text-slate-500 mt-2">Complete a training assessment with 70%+ to earn certificates</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certs.map(cert => (
              <div key={cert.certId} className="glass p-6 animate-slide-up border border-yellow-500/10 hover:border-yellow-500/30 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-yellow-400" />
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium">Verified</span>
                </div>
                <div className="mb-1 text-xs text-slate-500 font-mono">{cert.courseId}</div>
                <div className="text-lg font-bold text-white mb-1">Score: {cert.score}%</div>
                <div className="text-sm text-slate-400 mb-4">
                  Issued: {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div>
                <div className="pt-3 border-t border-white/5">
                  <div className="text-xs text-slate-600 font-mono mb-3">{cert.certId}</div>
                  <button
                    onClick={() => downloadCert(cert)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all text-sm w-full justify-center"
                  >
                    <Download className="w-4 h-4" /> Download Certificate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
