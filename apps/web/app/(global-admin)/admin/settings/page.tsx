'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { KeyRound, Loader2, Check, Eye, EyeOff, AlertCircle, User } from 'lucide-react'
import { api } from '@/lib/api'
import Cookies from 'js-cookie'

export default function AdminSettingsPage() {
  const [oldPw, setOldPw]   = useState('')
  const [newPw, setNewPw]   = useState('')
  const [confPw, setConfPw] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const email = Cookies.get('user_email') || ''
  const role  = Cookies.get('user_role')  || 'GLOBAL_ADMIN'

  async function changePassword() {
    setError(''); setSuccess('')
    if (!oldPw) { setError('Current password required'); return }
    if (newPw.length < 8) { setError('New password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(newPw)) { setError('New password must contain at least one uppercase letter'); return }
    if (!/[0-9]/.test(newPw)) { setError('New password must contain at least one number'); return }
    if (!/[!@#$%^&*]/.test(newPw)) { setError('New password must contain at least one special character (!@#$%^&*)'); return }
    if (newPw !== confPw) { setError('New passwords do not match'); return }
    if (oldPw === newPw) { setError('New password must be different from current password'); return }
    setSaving(true)
    try {
      await api.changePassword(oldPw, newPw)
      setSuccess('Password changed successfully')
      setOldPw(''); setNewPw(''); setConfPw('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Password change failed')
    } finally { setSaving(false) }
  }

  const strength = (pw: string) => {
    let s = 0
    if (pw.length >= 8) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[!@#$%^&*]/.test(pw)) s++
    if (pw.length >= 12) s++
    return s
  }
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-brand-500']
  const s = strength(newPw)

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Account Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your account and security</p>
        </div>

        {/* Profile info */}
        <div className="glass p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-semibold text-white">Profile</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-slate-500 mb-1">Email</p><p className="text-sm text-white">{email || '—'}</p></div>
            <div><p className="text-xs text-slate-500 mb-1">Role</p><p className="text-sm text-brand-300 font-medium">{role.replace('_',' ')}</p></div>
          </div>
        </div>

        {/* Change Password */}
        <div className="glass p-6">
          <div className="flex items-center gap-3 mb-5">
            <KeyRound className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-semibold text-white">Change Password</h2>
          </div>

          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {success}</div>}

          <div className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Current Password</label>
              <div className="relative">
                <input type={showOld?'text':'password'} value={oldPw} onChange={e=>setOldPw(e.target.value)} placeholder="Enter your current password" className="input-field pr-12" autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showOld?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input type={showNew?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Min 8 chars, uppercase, number, special char" className="input-field pr-12" autoComplete="new-password"/>
                <button type="button" onClick={()=>setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showNew?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
              {newPw && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">{[1,2,3,4,5].map(i=><div key={i} className={`h-1 flex-1 rounded-full transition-all ${i<=s?strengthColor[s]:'bg-white/10'}`}/>)}</div>
                  <p className="text-xs text-slate-500">{newPw?strengthLabel[s]:''}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Confirm New Password</label>
              <input type="password" value={confPw} onChange={e=>setConfPw(e.target.value)} placeholder="Re-enter new password" className={`input-field ${confPw&&confPw!==newPw?'border-red-500/50':''}`} autoComplete="new-password"/>
              {confPw && confPw!==newPw && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
              {confPw && confPw===newPw && <p className="mt-1 text-xs text-green-400">✓ Passwords match</p>}
            </div>

            {/* Requirements */}
            <div className="p-3 bg-white/3 rounded-xl space-y-1">
              <p className="text-xs text-slate-500 font-medium mb-2">Password Requirements:</p>
              {[['At least 8 characters', newPw.length>=8],['At least one uppercase letter (A-Z)',/[A-Z]/.test(newPw)],['At least one number (0-9)',/[0-9]/.test(newPw)],['At least one special character (!@#$%)',/[!@#$%^&*]/.test(newPw)],['Different from current password', !!newPw&&newPw!==oldPw]].map(([label,met],i)=>(
                <div key={i} className={`flex items-center gap-2 text-xs ${met?'text-green-400':'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${met?'bg-green-500/20':'bg-white/5'}`}>{met?'✓':'·'}</span>
                  {label as string}
                </div>
              ))}
            </div>

            <button onClick={changePassword} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>}
              {saving?'Changing Password...':'Change Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
