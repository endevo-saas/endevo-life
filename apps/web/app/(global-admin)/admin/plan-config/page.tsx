'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  DollarSign, Loader2, AlertCircle, RefreshCw, Save, RotateCcw,
  Plus, X, GripVertical, CheckCircle, Crown, Sparkles
} from 'lucide-react'
import { api, PlanConfig, PlanConfigEntry } from '@/lib/api'

const EMPTY_PLAN: PlanConfigEntry = {
  planLabel: '',
  priceYearly: 0,
  priceMonthly: 0,
  sessionsTotal: 0,
  features: [],
}

const DEFAULTS: PlanConfig = {
  basic: {
    planLabel: 'Endevo Basic',
    priceYearly: 299,
    priceMonthly: 29,
    sessionsTotal: 2,
    features: [
      '6-module Legacy Readiness Program',
      '2 coaching sessions per employee',
      'Digital vault basics',
      'Progress tracking dashboard',
      'Completion certificate',
    ],
  },
  premium: {
    planLabel: 'Endevo Premium',
    priceYearly: 499,
    priceMonthly: 49,
    sessionsTotal: 6,
    features: [
      'Everything in Basic',
      '6 coaching sessions per employee',
      'Full digital vault suite',
      'Advanced analytics & reporting',
      'Priority support',
      'Custom branding',
    ],
  },
  premiumFeatures: [
    'Jesse AI Assistant',
    'Advanced document templates',
    'Family sharing features',
    'Dedicated account manager',
  ],
}

export default function PlanConfigPage() {
  const [config, setConfig] = useState<PlanConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newFeature, setNewFeature] = useState<Record<string, string>>({ basic: '', premium: '', premiumFeatures: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.adminGetPlanConfig()
      setConfig(res.config)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load plan config')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function showMsg(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function handleSave() {
    if (!config) return
    setSaving(true); setError('')
    try {
      await api.adminUpdatePlanConfig(config)
      showMsg('Plan configuration saved successfully')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  function handleReset() {
    setConfig({ ...DEFAULTS, basic: { ...DEFAULTS.basic, features: [...DEFAULTS.basic.features] }, premium: { ...DEFAULTS.premium, features: [...DEFAULTS.premium.features] }, premiumFeatures: [...DEFAULTS.premiumFeatures] })
    showMsg('Reset to defaults (not saved yet)')
  }

  function updatePlan(planKey: 'basic' | 'premium', field: keyof PlanConfigEntry, value: unknown) {
    if (!config) return
    setConfig({
      ...config,
      [planKey]: { ...config[planKey], [field]: value },
    })
  }

  function addFeature(planKey: 'basic' | 'premium' | 'premiumFeatures') {
    if (!config) return
    const text = newFeature[planKey]?.trim()
    if (!text) return
    if (planKey === 'premiumFeatures') {
      setConfig({ ...config, premiumFeatures: [...config.premiumFeatures, text] })
    } else {
      const plan = config[planKey]
      setConfig({ ...config, [planKey]: { ...plan, features: [...plan.features, text] } })
    }
    setNewFeature({ ...newFeature, [planKey]: '' })
  }

  function removeFeature(planKey: 'basic' | 'premium' | 'premiumFeatures', idx: number) {
    if (!config) return
    if (planKey === 'premiumFeatures') {
      setConfig({ ...config, premiumFeatures: config.premiumFeatures.filter((_, i) => i !== idx) })
    } else {
      const plan = config[planKey]
      setConfig({ ...config, [planKey]: { ...plan, features: plan.features.filter((_, i) => i !== idx) } })
    }
  }

  function moveFeature(planKey: 'basic' | 'premium' | 'premiumFeatures', idx: number, dir: -1 | 1) {
    if (!config) return
    const target = idx + dir
    if (planKey === 'premiumFeatures') {
      if (target < 0 || target >= config.premiumFeatures.length) return
      const arr = [...config.premiumFeatures]
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      setConfig({ ...config, premiumFeatures: arr })
    } else {
      const plan = config[planKey]
      if (target < 0 || target >= plan.features.length) return
      const arr = [...plan.features]
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      setConfig({ ...config, [planKey]: { ...plan, features: arr } })
    }
  }

  const PLAN_META: Array<{ key: 'basic' | 'premium'; icon: React.ElementType; color: string; border: string }> = [
    { key: 'basic', icon: Crown, color: 'text-brand-300', border: 'border-brand-500/30' },
    { key: 'premium', icon: Sparkles, color: 'text-orange-400', border: 'border-orange-500/30' },
  ]

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Plan & Pricing</h1>
            <p className="text-slate-400 text-sm mt-0.5">Configure plans, pricing, and features for new tenants</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} disabled={loading || saving} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-white/10 disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
            <button onClick={load} disabled={loading} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0" />{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {loading ? (
          <div className="glass p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
        ) : !config ? (
          <div className="glass p-16 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Failed to load plan configuration</p>
            <button onClick={load} className="mt-3 btn-primary text-sm">Retry</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Plan cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {PLAN_META.map(({ key, icon: Icon, color, border }) => {
                const plan = config[key]
                return (
                  <div key={key} className={`glass p-5 border ${border}`}>
                    <div className="flex items-center gap-2 mb-5">
                      <Icon className={`w-5 h-5 ${color}`} />
                      <h2 className={`text-base font-semibold ${color}`}>{plan.planLabel || key}</h2>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">Plan Label</label>
                        <input
                          type="text"
                          value={plan.planLabel}
                          onChange={e => updatePlan(key, 'planLabel', e.target.value)}
                          className="input-field text-sm w-full"
                          placeholder="e.g. Endevo Basic"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">Yearly ($)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <input type="number" value={plan.priceYearly} min={0} onChange={e => updatePlan(key, 'priceYearly', Number(e.target.value))} className="input-field text-sm pl-7 w-full" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">Monthly ($)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <input type="number" value={plan.priceMonthly} min={0} onChange={e => updatePlan(key, 'priceMonthly', Number(e.target.value))} className="input-field text-sm pl-7 w-full" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">Sessions</label>
                          <input type="number" value={plan.sessionsTotal} min={0} onChange={e => updatePlan(key, 'sessionsTotal', Number(e.target.value))} className="input-field text-sm w-full" />
                        </div>
                      </div>

                      {/* Features list */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-2">Features</label>
                        <div className="space-y-1">
                          {plan.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 group">
                              <button onClick={() => moveFeature(key, i, -1)} disabled={i === 0} className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors">
                                <GripVertical className="w-3 h-3" />
                              </button>
                              <span className="text-sm text-slate-300 flex-1">{f}</span>
                              <button onClick={() => removeFeature(key, i)} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={newFeature[key] || ''}
                            onChange={e => setNewFeature({ ...newFeature, [key]: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && addFeature(key)}
                            placeholder="Add feature..."
                            className="input-field text-sm flex-1"
                          />
                          <button onClick={() => addFeature(key)} className="p-2 text-slate-400 hover:text-brand-300 hover:bg-white/5 rounded-lg transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Premium-only features */}
            <div className="glass p-5 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-orange-400" />
                <h2 className="text-base font-semibold text-orange-400">Premium-Only Features</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">These features are shown as locked/upgrade prompts for Basic plan users.</p>
              <div className="space-y-1">
                {config.premiumFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <button onClick={() => moveFeature('premiumFeatures', i, -1)} disabled={i === 0} className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors">
                      <GripVertical className="w-3 h-3" />
                    </button>
                    <span className="text-sm text-slate-300 flex-1">{f}</span>
                    <button onClick={() => removeFeature('premiumFeatures', i)} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={newFeature.premiumFeatures || ''}
                  onChange={e => setNewFeature({ ...newFeature, premiumFeatures: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && addFeature('premiumFeatures')}
                  placeholder="Add premium feature..."
                  className="input-field text-sm flex-1"
                />
                <button onClick={() => addFeature('premiumFeatures')} className="p-2 text-slate-400 hover:text-orange-400 hover:bg-white/5 rounded-lg transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Plan Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
