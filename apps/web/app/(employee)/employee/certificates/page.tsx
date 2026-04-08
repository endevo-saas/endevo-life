'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Award, Download, Loader2, AlertCircle, RefreshCw, Trophy, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react'
import { api, Certificate, CertificateCheckResult } from '@/lib/api'
import Link from 'next/link'

interface LmsCertificate {
  certificateId: string
  userId: string
  tenantId: string
  issuedAt: string
  moduleNum: string
  type: string
}

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([])
  const [lmsCerts, setLmsCerts] = useState<LmsCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CertificateCheckResult | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    setCheckResult(null)
    try {
      // Load v1 training certs
      const d = await api.employeeCertificates()
      setCerts(d.certificates)

      // Load LMS completion certs via employee progress summary endpoint
      try {
        const summary = await api.employeeProgressSummary() as Record<string, unknown> & { certificate?: LmsCertificate }
        if (summary?.certificate && (summary.certificate as LmsCertificate).type === 'lms_completion') {
          setLmsCerts([summary.certificate as LmsCertificate])
        }
      } catch {
        // Non-fatal — LMS certs may not exist yet
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load certificates')
    } finally {
      setLoading(false)
    }
  }

  async function checkEligibility() {
    setChecking(true)
    setCheckResult(null)
    try {
      const result = await api.employeeCertificateCheck()
      setCheckResult(result)
      if (result.eligible) {
        await load()
      }
    } catch (e: unknown) {
      setCheckResult({ eligible: false, message: e instanceof Error ? e.message : 'Check failed' })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { load() }, [])

  function downloadCert(cert: Certificate) {
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

  const totalCerts = certs.length + lmsCerts.length

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Award className="w-8 h-8 text-yellow-400" />
              My Certificates
            </h1>
            <p className="text-slate-400 text-sm mt-1">{totalCerts} certificate{totalCerts !== 1 ? 's' : ''} earned</p>
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

        {/* Certificate Eligibility Check */}
        {!loading && (
          <div className="glass p-6 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-teal-400" />
              <div>
                <div className="text-white font-medium">Legacy Readiness Certificate</div>
                <div className="text-sm text-slate-400">Complete all 6 modules to earn your certificate</div>
              </div>
            </div>
            <button
              onClick={checkEligibility}
              disabled={checking}
              className="px-4 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {checking ? 'Checking...' : 'Check Eligibility'}
            </button>
          </div>
        )}

        {checkResult && (
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            checkResult.eligible
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
          }`}>
            {checkResult.eligible ? <Award className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {checkResult.message}
          </div>
        )}

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : totalCerts === 0 ? (
          <div className="glass p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <div className="text-slate-400 text-lg font-medium">No certificates yet</div>
            <div className="text-sm text-slate-500 mt-2">Complete all 6 modules to earn your Legacy Readiness Certificate</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* LMS Completion Certificates */}
            {lmsCerts.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-teal-400" />
                  LMS Completion Certificates
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lmsCerts.map(cert => (
                    <div key={cert.certificateId} className="glass p-6 animate-slide-up border border-teal-500/20 hover:border-teal-500/40 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-center">
                          <Award className="w-6 h-6 text-teal-400" />
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-medium">LMS Complete</span>
                      </div>
                      <div className="text-lg font-bold text-white mb-1">Digital Legacy Program</div>
                      <div className="text-sm text-slate-400 mb-1">6-Module Completion Certificate</div>
                      <div className="text-sm text-slate-400 mb-4">
                        Issued: {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                      </div>
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <div className="text-xs text-slate-600 font-mono">{cert.certificateId}</div>
                        <Link
                          href={`/certificates/verify/${cert.certificateId}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 transition-all text-sm w-full justify-center"
                        >
                          <ExternalLink className="w-4 h-4" /> Verify Certificate
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Legacy Training Certificates */}
            {certs.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-yellow-400" />
                  Training Certificates
                </h2>
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
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
