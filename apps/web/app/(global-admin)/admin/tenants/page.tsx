'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Building2, Plus, Pencil, Check, X, Loader2, AlertCircle, RefreshCw, Users } from 'lucide-react'
import { api, Tenant } from '@/lib/api'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlan, setNewPlan] = useState('enterprise')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editPlan, setEditPlan] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.adminTenants()
      setTenants(d.tenants)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createTenant() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await api.adminCreateTenant({ name: newName.trim(), plan: newPlan })
      setNewName('')
      setNewPlan('enterprise')
      setCreating(false)
      showSuccess('Tenant created successfully')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create tenant')
    } finally {
      setSaving(false)
    }
  }

  async function updateTenant(id: string) {
    setEditSaving(true)
    try {
      await api.adminUpdateTenant(id, { status: editStatus, plan: editPlan })
      setEditId(null)
      showSuccess('Tenant updated')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update tenant')
    } finally {
      setEditSaving(false)
    }
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function startEdit(t: Tenant) {
    setEditId(t.tenantId)
    setEditStatus(t.status)
    setEditPlan(t.plan)
  }

  const plans = ['starter', 'professional', 'enterprise', 'enterprise-plus']
  const statuses = ['active', 'inactive', 'suspended']

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Tenants</h1>
            <p className="text-slate-400 text-sm mt-1">{tenants.length} organizations</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> New Tenant
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            ✓ {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Create Form */}
        {creating && (
          <div className="glass p-6 mb-6 border border-brand-500/30 animate-slide-up">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Tenant</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1.5">Organization Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Acme Corp Ltd"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Plan</label>
                <select
                  value={newPlan}
                  onChange={e => setNewPlan(e.target.value)}
                  className="input-field"
                >
                  {plans.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={createTenant} disabled={saving || !newName.trim()} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Creating...' : 'Create Tenant'}
              </button>
              <button onClick={() => { setCreating(false); setNewName('') }} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Users</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No tenants found</td></tr>
                ) : tenants.map(t => (
                  <tr key={t.tenantId} className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-brand-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{t.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{t.tenantId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editId === t.tenantId ? (
                        <select
                          value={editPlan}
                          onChange={e => setEditPlan(e.target.value)}
                          className="text-sm bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white"
                        >
                          {plans.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-brand-500/10 text-brand-300 text-xs font-medium">{t.plan}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editId === t.tenantId ? (
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value)}
                          className="text-sm bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white"
                        >
                          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          t.status === 'active' ? 'bg-green-500/10 text-green-400' :
                          t.status === 'suspended' ? 'bg-red-500/10 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>{t.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                        {t.user_count ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {editId === t.tenantId ? (
                        <div className="flex gap-2">
                          <button onClick={() => updateTenant(t.tenantId)} disabled={editSaving} className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                            {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
