'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { UserPlus, Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

export default function InvitePage() {
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    department: '',
    job_title: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ invite_url: string; user_id: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function update(field: string, val: string) {
    setForm(p => ({ ...p, [field]: val }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim()) { setError('Email is required'); return }
    setSaving(true)
    setError('')
    try {
      const r = await api.hrInvite(form) as { invite_url: string; user_id: string; message: string }
      setResult(r)
      setForm({ email: '', first_name: '', last_name: '', department: '', job_title: '' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send invite')
    } finally {
      setSaving(false)
    }
  }

  function copyLink() {
    if (!result) return
    navigator.clipboard.writeText(result.invite_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-green-400" />
            Invite Employee
          </h1>
          <p className="text-slate-400 text-sm mt-1">Send an invitation link to a new team member</p>
        </div>

        {result ? (
          <div className="glass p-8 border border-green-500/30 animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-xl font-bold text-white">Invitation Sent!</div>
                <div className="text-sm text-slate-400">An email has been sent to the employee</div>
              </div>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-xl mb-6">
              <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Registration Link</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-sm text-green-400 font-mono break-all">{result.invite_url}</div>
                <button
                  onClick={copyLink}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    copied ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setResult(null)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Invite Another
              </button>
              <Link href="/hr/employees" className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-white/10">
                View Employees
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="glass p-8 space-y-5 animate-slide-up">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="employee@company.com"
                className="input-field"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={e => update('first_name', e.target.value)}
                  placeholder="John"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={e => update('last_name', e.target.value)}
                  placeholder="Smith"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={e => update('department', e.target.value)}
                placeholder="Engineering, HR, Finance..."
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Job Title</label>
              <input
                type="text"
                value={form.job_title}
                onChange={e => update('job_title', e.target.value)}
                placeholder="Software Engineer, Analyst..."
                className="input-field"
              />
            </div>

            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending Invite...</>
                : <><UserPlus className="w-4 h-4" /> Send Invitation</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
