'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { User, Pencil, Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { api, User as UserType } from '@/lib/api'
import PersonalContactSection from '@/components/ui/PersonalContactSection'

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', jobTitle: '', department: '' })
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.employeeProfile() as UserType
      setProfile(d)
      setForm({
        firstName: d.firstName || '',
        lastName: d.lastName || '',
        jobTitle: d.jobTitle || '',
        department: d.department || '',
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.employeeUpdateProfile(form)
      setEditing(false)
      setSuccessMsg('Profile updated successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <User className="w-8 h-8 text-purple-400" />
              My Profile
            </h1>
            <p className="text-slate-400 text-sm mt-1">Manage your personal information</p>
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            ✓ {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {profile && (
          <div className="glass p-8 animate-slide-up">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
              <div className="w-16 h-16 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center">
                <span className="text-2xl font-bold text-purple-400">
                  {(profile.firstName?.[0] || '?').toUpperCase()}
                </span>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{profile.firstName} {profile.lastName}</div>
                <div className="text-sm text-slate-400">{profile.email}</div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                  profile.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/20 text-slate-400'
                }`}>{profile.status}</span>
              </div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-sm"
                >
                  <Pencil className="w-4 h-4" /> Edit Profile
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Job Title</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
                    className="input-field"
                    placeholder="Software Engineer..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    className="input-field"
                    placeholder="Engineering, Finance..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Email',      value: profile.email },
                  { label: 'First Name', value: profile.firstName },
                  { label: 'Last Name',  value: profile.lastName },
                  { label: 'Job Title',  value: profile.jobTitle },
                  { label: 'Department', value: profile.department },
                  { label: 'Role',       value: profile.role?.replace('_', ' ') },
                ].map(f => (
                  <div key={f.label} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                    <span className="text-sm text-slate-400">{f.label}</span>
                    <span className="text-sm text-white font-medium">{f.value || '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Personal contact — always visible regardless of edit state */}
            <PersonalContactSection profile={profile} onUpdate={load} />
          </div>
        )}
      </div>
    </div>
  )
}
