'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  ToggleLeft, ToggleRight, Loader2, AlertCircle, RefreshCw,
  Save, CheckCircle, Flag
} from 'lucide-react'
import { api } from '@/lib/api'

const FLAG_LABELS: Record<string, string> = {
  jesse_ai: 'Jesse AI',
  mfa_required: 'MFA Required',
  lms_enabled: 'LMS Module',
  coaching_sessions: 'Coaching Sessions',
  digital_vault: 'Digital Vault',
  certificates: 'Certificates',
  advanced_analytics: 'Advanced Analytics',
  custom_branding: 'Custom Branding',
  family_sharing: 'Family Sharing',
  priority_support: 'Priority Support',
  bulk_import: 'Bulk Import',
  api_access: 'API Access',
  audit_log: 'Audit Log',
  email_notifications: 'Email Notifications',
  sso_enabled: 'SSO Login',
  captcha_enabled: 'CAPTCHA on Login',
  otp_enabled: 'Email OTP',
  maintenance_mode: 'Maintenance Mode',
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  jesse_ai: 'Enable the Jesse AI coaching assistant for premium users',
  mfa_required: 'Require multi-factor authentication for all users',
  lms_enabled: 'Enable the Learning Management System module',
  coaching_sessions: 'Allow booking of coaching sessions',
  digital_vault: 'Enable digital vault document storage',
  certificates: 'Enable completion certificates',
  advanced_analytics: 'Show advanced analytics dashboards',
  custom_branding: 'Allow tenants to customize branding',
  family_sharing: 'Enable family sharing features',
  priority_support: 'Enable priority support queue',
  bulk_import: 'Allow bulk import of employees',
  api_access: 'Enable external API access',
  audit_log: 'Enable audit logging',
  email_notifications: 'Send email notifications for events',
  sso_enabled: 'Enable Single Sign-On via SAML/OIDC',
  captcha_enabled: 'Require CAPTCHA challenge on login',
  otp_enabled: 'Send one-time password to email on login',
  maintenance_mode: 'Put the platform into maintenance mode',
}

function humanLabel(key: string): string {
  if (FLAG_LABELS[key]) return FLAG_LABELS[key]
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function flagDescription(key: string): string {
  return FLAG_DESCRIPTIONS[key] || ''
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [originalFlags, setOriginalFlags] = useState<Record<string, boolean>>({})
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.adminGetFeatures()
      setFlags({ ...res.flags })
      setOriginalFlags({ ...res.flags })
      setSource(res.source || '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feature flags')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function showMsg(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  function toggleFlag(key: string) {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const hasChanges = JSON.stringify(flags) !== JSON.stringify(originalFlags)

  async function handleSave() {
    setSaving(true); setError('')
    try {
      await api.adminUpdateFeatures(flags)
      setOriginalFlags({ ...flags })
      showMsg('Feature flags updated successfully')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const sortedKeys = Object.keys(flags).sort((a, b) => humanLabel(a).localeCompare(humanLabel(b)))
  const enabledCount = Object.values(flags).filter(Boolean).length
  const totalCount = Object.keys(flags).length

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Toggle platform features on or off
              {source && <span className="text-slate-600 ml-2">({source})</span>}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0" />{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {loading ? (
          <div className="glass p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
        ) : totalCount === 0 ? (
          <div className="glass p-16 text-center">
            <Flag className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No feature flags configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="glass p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flag className="w-4 h-4 text-brand-400" />
                <span className="text-sm text-slate-300">
                  <span className="text-white font-semibold">{enabledCount}</span> of {totalCount} flags enabled
                </span>
              </div>
              {hasChanges && (
                <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                  Unsaved changes
                </span>
              )}
            </div>

            {/* Flag list */}
            <div className="glass divide-y divide-white/5">
              {sortedKeys.map(key => {
                const on = flags[key]
                const changed = originalFlags[key] !== flags[key]
                return (
                  <div key={key} className={`flex items-center justify-between px-5 py-4 transition-colors ${changed ? 'bg-orange-500/5' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{humanLabel(key)}</p>
                        {changed && <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">modified</span>}
                      </div>
                      {flagDescription(key) && <p className="text-xs text-slate-500 mt-0.5">{flagDescription(key)}</p>}
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5">{key}</p>
                    </div>
                    <button
                      onClick={() => toggleFlag(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        on
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-white/5 text-slate-500 border border-white/10'
                      }`}
                    >
                      {on ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {on ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving || !hasChanges} className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Feature Flags'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
