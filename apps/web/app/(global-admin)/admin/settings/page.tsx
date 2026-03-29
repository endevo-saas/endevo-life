'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  KeyRound, Loader2, Check, Eye, EyeOff, AlertCircle, User,
  Settings2, DollarSign, Shield, Bell, Save, RefreshCw,
  Building2, Globe, Mail, Lock, Unlock, Clock, Zap,
  ToggleLeft, ToggleRight, ChevronDown, Info
} from 'lucide-react'
import { api } from '@/lib/api'
import Cookies from 'js-cookie'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlatformCfg {
  company_name: string
  support_email: string
  max_tenants: number
  platform_name: string
  tagline: string
}
interface PlanCfg {
  price: number
  max_seats: number
  label: string
  custom?: boolean
  duration_days?: number
}
interface PricingCfg {
  trial: PlanCfg
  starter: PlanCfg
  professional: PlanCfg
  enterprise: PlanCfg
  'enterprise-plus': PlanCfg
}
interface SecurityCfg {
  otp_enabled: boolean
  captcha_enabled: boolean
  session_timeout_hours: number
  max_login_attempts: number
  lockout_duration_minutes: number
  mfa_required: boolean
  password_expiry_days: number
}
interface NotificationsCfg {
  from_email: string
  from_name: string
  invite_email_enabled: boolean
  welcome_email_enabled: boolean
}
interface Config {
  platform: PlatformCfg
  pricing: PricingCfg
  security: SecurityCfg
  notifications: NotificationsCfg
}

type Tab = 'account' | 'platform' | 'pricing' | 'security' | 'notifications'

const PLAN_KEYS: Array<keyof PricingCfg> = ['trial', 'starter', 'professional', 'enterprise', 'enterprise-plus']
const PLAN_COLORS: Record<string, string> = {
  trial: 'text-yellow-400', starter: 'text-blue-400',
  professional: 'text-brand-300', enterprise: 'text-purple-400', 'enterprise-plus': 'text-orange-400'
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Tog({ on, set }: { on: boolean; set: () => void }) {
  return (
    <button onClick={set} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${on ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
      {on ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
      {on ? 'Enabled' : 'Disabled'}
    </button>
  )
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}
function NumInput({ value, set, min, max, suffix }: { value: number; set: (v: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => set(Number(e.target.value))}
        className="input-field w-24 text-sm text-right"
      />
      {suffix && <span className="text-xs text-slate-500 whitespace-nowrap">{suffix}</span>}
    </div>
  )
}
function TextInput({ value, set, placeholder, type = 'text' }: { value: string; set: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} className="input-field text-sm w-64" />
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [tab, setTab]         = useState<Tab>('account')
  const [cfg, setCfg]         = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  // Account (password change)
  const [oldPw, setOldPw]       = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confPw, setConfPw]     = useState('')
  const [showOld, setShowOld]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const email = Cookies.get('user_email') || ''
  const role  = Cookies.get('user_role')  || 'GLOBAL_ADMIN'

  const loadConfig = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.adminGetConfig()
      setCfg(d as Config)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load config')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  function showMsg(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }

  async function saveSection(section: string, values: Record<string, unknown>) {
    setSaving(section); setError('')
    try {
      await api.adminUpdateConfig(section, values)
      showMsg(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved`)
      loadConfig()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(null) }
  }

  async function changePassword() {
    setError(''); setSuccess('')
    if (!oldPw) { setError('Current password required'); return }
    if (newPw.length < 8) { setError('New password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(newPw)) { setError('Must contain uppercase letter'); return }
    if (!/[0-9]/.test(newPw)) { setError('Must contain a number'); return }
    if (!/[!@#$%^&*]/.test(newPw)) { setError('Must contain a special character'); return }
    if (newPw !== confPw) { setError('Passwords do not match'); return }
    if (oldPw === newPw) { setError('New password must differ from current'); return }
    setPwSaving(true)
    try {
      await api.changePassword(oldPw, newPw)
      showMsg('Password changed successfully')
      setOldPw(''); setNewPw(''); setConfPw('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Password change failed')
    } finally { setPwSaving(false) }
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
  const sLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const sColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-brand-500']
  const s = strength(newPw)

  const tabs: Array<{ id: Tab; icon: React.ElementType; label: string }> = [
    { id: 'account',       icon: User,       label: 'Account' },
    { id: 'platform',      icon: Building2,  label: 'Platform' },
    { id: 'pricing',       icon: DollarSign, label: 'Pricing' },
    { id: 'security',      icon: Shield,     label: 'Security' },
    { id: 'notifications', icon: Bell,       label: 'Notifications' },
  ]

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
            <p className="text-slate-400 text-sm mt-0.5">Full control over all platform configuration</p>
          </div>
          <button onClick={loadConfig} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {success}</div>}
        {error   && <div className="mb-4 p-3 bg-red-500/10  border border-red-500/30  rounded-xl text-red-400   text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{error}</div>}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 glass p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError('') }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30' : 'text-slate-400 hover:text-white'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ACCOUNT TAB ─────────────────────────────────────────────── */}
        {tab === 'account' && (
          <div className="space-y-4">
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-slate-400" />
                <h2 className="text-base font-semibold text-white">Profile</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-500 mb-1">Email</p><p className="text-sm text-white">{email || '—'}</p></div>
                <div><p className="text-xs text-slate-500 mb-1">Role</p><p className="text-sm text-brand-300 font-medium">{role.replace(/_/g, ' ')}</p></div>
              </div>
            </div>

            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-5">
                <KeyRound className="w-5 h-5 text-slate-400" />
                <h2 className="text-base font-semibold text-white">Change Password</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input type={showOld ? 'text' : 'password'} value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Enter current password" className="input-field pr-12" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 chars, uppercase, number, special" className="input-field pr-12" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPw && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">{[1,2,3,4,5].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= s ? sColor[s] : 'bg-white/10'}`} />)}</div>
                      <p className="text-xs text-slate-500">{sLabel[s]}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Confirm New Password</label>
                  <input type="password" value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="Re-enter new password" className={`input-field ${confPw && confPw !== newPw ? 'border-red-500/50' : ''}`} autoComplete="new-password" />
                  {confPw && confPw !== newPw && <p className="mt-1 text-xs text-red-400">Passwords do not match</p>}
                  {confPw && confPw === newPw  && <p className="mt-1 text-xs text-green-400">✓ Passwords match</p>}
                </div>
                <div className="p-3 bg-white/3 rounded-xl space-y-1">
                  <p className="text-xs text-slate-500 font-medium mb-2">Requirements:</p>
                  {[
                    ['At least 8 characters',             newPw.length >= 8],
                    ['One uppercase letter (A-Z)',         /[A-Z]/.test(newPw)],
                    ['One number (0-9)',                   /[0-9]/.test(newPw)],
                    ['One special character (!@#$%^&*)',   /[!@#$%^&*]/.test(newPw)],
                    ['Different from current',             !!newPw && newPw !== oldPw],
                  ].map(([label, met], i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs ${met ? 'text-green-400' : 'text-slate-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${met ? 'bg-green-500/20' : 'bg-white/5'}`}>{met ? '✓' : '·'}</span>
                      {label as string}
                    </div>
                  ))}
                </div>
                <button onClick={changePassword} disabled={pwSaving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {pwSaving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PLATFORM TAB ────────────────────────────────────────────── */}
        {tab === 'platform' && (
          <div className="glass p-6 space-y-1">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div> : cfg ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <h2 className="text-base font-semibold text-white">Platform Identity</h2>
                </div>
                <Row label="Platform Name" hint="Shown in emails and UI">
                  <TextInput value={cfg.platform.platform_name} set={v => setCfg(c => c ? { ...c, platform: { ...c.platform, platform_name: v } } : c)} placeholder="Endevo Life" />
                </Row>
                <Row label="Company Name" hint="Legal entity name">
                  <TextInput value={cfg.platform.company_name} set={v => setCfg(c => c ? { ...c, platform: { ...c.platform, company_name: v } } : c)} placeholder="Endevo Life Ltd" />
                </Row>
                <Row label="Tagline" hint="Short description shown on login page">
                  <TextInput value={cfg.platform.tagline} set={v => setCfg(c => c ? { ...c, platform: { ...c.platform, tagline: v } } : c)} placeholder="Digital Legacy & Estate Planning" />
                </Row>
                <Row label="Support Email" hint="Where users contact for help">
                  <TextInput value={cfg.platform.support_email} set={v => setCfg(c => c ? { ...c, platform: { ...c.platform, support_email: v } } : c)} type="email" placeholder="support@endevo.life" />
                </Row>
                <Row label="Max Tenants Capacity" hint="Maximum organizations platform can onboard">
                  <NumInput value={cfg.platform.max_tenants} set={v => setCfg(c => c ? { ...c, platform: { ...c.platform, max_tenants: v } } : c)} min={1} max={999999} suffix="tenants" />
                </Row>
                <div className="pt-4">
                  <button onClick={() => saveSection('platform', cfg.platform)} disabled={saving === 'platform'} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                    {saving === 'platform' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving === 'platform' ? 'Saving...' : 'Save Platform Settings'}
                  </button>
                </div>
              </>
            ) : <p className="text-slate-500 text-sm">Failed to load config</p>}
          </div>
        )}

        {/* ── PRICING TAB ─────────────────────────────────────────────── */}
        {tab === 'pricing' && (
          <div className="space-y-4">
            {loading ? <div className="glass p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div> : cfg ? (
              <>
                <div className="glass p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400">Changes apply to NEW tenants immediately. Existing tenants keep their current plan pricing until manually updated in Subscriptions.</p>
                </div>
                {PLAN_KEYS.map(planKey => {
                  const plan = cfg.pricing[planKey]
                  return (
                    <div key={planKey} className="glass p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className={`w-4 h-4 ${PLAN_COLORS[planKey]}`} />
                        <h3 className={`text-sm font-semibold ${PLAN_COLORS[planKey]}`}>{plan.label}</h3>
                        {plan.custom && <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded">Custom Pricing</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">Monthly Price (USD)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <input
                              type="number"
                              value={plan.price}
                              min={0}
                              onChange={e => setCfg(c => c ? { ...c, pricing: { ...c.pricing, [planKey]: { ...plan, price: Number(e.target.value) } } } : c)}
                              className="input-field text-sm pl-7"
                              disabled={plan.custom}
                            />
                          </div>
                          {plan.custom && <p className="text-xs text-slate-600 mt-1">Set per-tenant in Subscriptions</p>}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">Max Seats</label>
                          <input
                            type="number"
                            value={plan.max_seats}
                            min={1}
                            onChange={e => setCfg(c => c ? { ...c, pricing: { ...c.pricing, [planKey]: { ...plan, max_seats: Number(e.target.value) } } } : c)}
                            className="input-field text-sm"
                          />
                        </div>
                        {planKey === 'trial' && (
                          <div>
                            <label className="block text-xs text-slate-500 mb-1.5">Trial Duration (days)</label>
                            <input
                              type="number"
                              value={plan.duration_days || 14}
                              min={1}
                              onChange={e => setCfg(c => c ? { ...c, pricing: { ...c.pricing, trial: { ...c.pricing.trial, duration_days: Number(e.target.value) } } } : c)}
                              className="input-field text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => saveSection('pricing', cfg.pricing)} disabled={saving === 'pricing'} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving === 'pricing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving === 'pricing' ? 'Saving...' : 'Save Pricing Configuration'}
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* ── SECURITY TAB ────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="glass p-6 space-y-1">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div> : cfg ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <Shield className="w-5 h-5 text-slate-400" />
                  <h2 className="text-base font-semibold text-white">Security Policy</h2>
                </div>

                <div className="mb-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                  <p className="text-xs text-yellow-400 flex items-center gap-2"><Zap className="w-3.5 h-3.5" />Changes take effect on next login. Active sessions are not affected.</p>
                </div>

                <Row label="Email OTP on Login" hint="Send one-time password to email on every login">
                  <Tog on={cfg.security.otp_enabled} set={() => setCfg(c => c ? { ...c, security: { ...c.security, otp_enabled: !c.security.otp_enabled } } : c)} />
                </Row>
                <Row label="CAPTCHA on Login" hint="Require CAPTCHA challenge on login screen">
                  <Tog on={cfg.security.captcha_enabled} set={() => setCfg(c => c ? { ...c, security: { ...c.security, captcha_enabled: !c.security.captcha_enabled } } : c)} />
                </Row>
                <Row label="MFA Required" hint="Enforce TOTP authenticator for all users">
                  <Tog on={cfg.security.mfa_required} set={() => setCfg(c => c ? { ...c, security: { ...c.security, mfa_required: !c.security.mfa_required } } : c)} />
                </Row>
                <Row label="Session Timeout" hint="Auto-logout after inactivity">
                  <NumInput value={cfg.security.session_timeout_hours} set={v => setCfg(c => c ? { ...c, security: { ...c.security, session_timeout_hours: v } } : c)} min={1} max={72} suffix="hours" />
                </Row>
                <Row label="Max Login Attempts" hint="Failed attempts before account lock">
                  <NumInput value={cfg.security.max_login_attempts} set={v => setCfg(c => c ? { ...c, security: { ...c.security, max_login_attempts: v } } : c)} min={1} max={20} suffix="attempts" />
                </Row>
                <Row label="Lockout Duration" hint="How long account stays locked after too many failures">
                  <NumInput value={cfg.security.lockout_duration_minutes} set={v => setCfg(c => c ? { ...c, security: { ...c.security, lockout_duration_minutes: v } } : c)} min={5} max={1440} suffix="minutes" />
                </Row>
                <Row label="Password Expiry" hint="Force password change after this many days (0 = never)">
                  <NumInput value={cfg.security.password_expiry_days} set={v => setCfg(c => c ? { ...c, security: { ...c.security, password_expiry_days: v } } : c)} min={0} max={365} suffix="days" />
                </Row>

                <div className="pt-4">
                  <button onClick={() => saveSection('security', cfg.security)} disabled={saving === 'security'} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                    {saving === 'security' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    {saving === 'security' ? 'Saving...' : 'Save Security Policy'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── NOTIFICATIONS TAB ───────────────────────────────────────── */}
        {tab === 'notifications' && (
          <div className="glass p-6 space-y-1">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div> : cfg ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <Bell className="w-5 h-5 text-slate-400" />
                  <h2 className="text-base font-semibold text-white">Email & Notifications</h2>
                </div>
                <Row label="From Email Address" hint="Sender address for all platform emails">
                  <TextInput value={cfg.notifications.from_email} set={v => setCfg(c => c ? { ...c, notifications: { ...c.notifications, from_email: v } } : c)} type="email" placeholder="noreply@endevo.life" />
                </Row>
                <Row label="From Name" hint="Display name shown in recipient's inbox">
                  <TextInput value={cfg.notifications.from_name} set={v => setCfg(c => c ? { ...c, notifications: { ...c.notifications, from_name: v } } : c)} placeholder="Endevo Life" />
                </Row>
                <Row label="Invitation Emails" hint="Send email when inviting a new HR admin or employee">
                  <Tog on={cfg.notifications.invite_email_enabled} set={() => setCfg(c => c ? { ...c, notifications: { ...c.notifications, invite_email_enabled: !c.notifications.invite_email_enabled } } : c)} />
                </Row>
                <Row label="Welcome Emails" hint="Send welcome email when user completes registration">
                  <Tog on={cfg.notifications.welcome_email_enabled} set={() => setCfg(c => c ? { ...c, notifications: { ...c.notifications, welcome_email_enabled: !c.notifications.welcome_email_enabled } } : c)} />
                </Row>

                <div className="mt-4 p-3 bg-white/3 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium mb-2">SES Sender Status</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                    SES sandbox mode — verify email addresses before sending. Production: request SES production access via AWS console.
                  </div>
                </div>

                <div className="pt-4">
                  <button onClick={() => saveSection('notifications', cfg.notifications)} disabled={saving === 'notifications'} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                    {saving === 'notifications' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    {saving === 'notifications' ? 'Saving...' : 'Save Notification Settings'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
