'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Archive, Search, Loader2, AlertCircle, RefreshCw, X, Check,
  RotateCcw, Download, Users, Building2, Trash2
} from 'lucide-react'
import { exportCsv } from '@/lib/export'
import { api } from '@/lib/api'

type Tab = 'users' | 'tenants'

interface ArchivedUser {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  archivedAt: string
  archivedBy: string
  reason: string
}

interface ArchivedTenant {
  tenantId: string
  name: string
  code: string
  plan: string
  archivedAt: string
  archivedBy: string
  reason: string
}

export default function AdminArchivePage() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<ArchivedUser[]>([])
  const [tenants, setTenants] = useState<ArchivedTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [confirmRestore, setConfirmRestore] = useState<{ type: Tab; id: string; name: string } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: Tab; id: string; name: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ud, td] = await Promise.all([
        api.adminArchivedUsers(),
        api.adminArchivedTenants(),
      ])
      setUsers((ud.users ?? []) as unknown as ArchivedUser[])
      setTenants((td.tenants ?? []) as unknown as ArchivedTenant[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load archived records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  const handleRestore = async () => {
    if (!confirmRestore) return
    setRestoring(true)
    setError('')
    try {
      if (confirmRestore.type === 'users') {
        await api.adminRestoreUser(confirmRestore.id)
      } else {
        await api.adminRestoreTenant(confirmRestore.id)
      }
      showSuccess(`${confirmRestore.name} restored successfully`)
      setConfirmRestore(null)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  const handleHardDelete = async () => {
    if (!confirmDelete || deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setError('')
    try {
      if (confirmDelete.type === 'users') {
        await api.adminHardDeleteUser(confirmDelete.id)
      } else {
        await api.adminHardDeleteTenant(confirmDelete.id)
      }
      showSuccess(`${confirmDelete.name} permanently deleted`)
      setConfirmDelete(null)
      setDeleteConfirmText('')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Permanent delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const filteredUsers = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (u.email || '').toLowerCase().includes(q) ||
      `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q) ||
      (u.reason || '').toLowerCase().includes(q)
    )
  })

  const filteredTenants = tenants.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.code || '').toLowerCase().includes(q) ||
      (t.reason || '').toLowerCase().includes(q)
    )
  })

  const exportArchivedUsers = () => {
    exportCsv('archived_users', filteredUsers as unknown as Record<string, unknown>[], [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'tenantId', label: 'Tenant ID' },
      { key: 'archivedAt', label: 'Archived At' },
      { key: 'archivedBy', label: 'Archived By' },
      { key: 'reason', label: 'Reason' },
    ])
  }

  const exportArchivedTenants = () => {
    exportCsv('archived_tenants', filteredTenants as unknown as Record<string, unknown>[], [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'plan', label: 'Plan' },
      { key: 'archivedAt', label: 'Archived At' },
      { key: 'archivedBy', label: 'Archived By' },
      { key: 'reason', label: 'Reason' },
    ])
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                <Archive className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Recycle Bin</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  {tab === 'users' ? `${filteredUsers.length} archived users` : `${filteredTenants.length} archived tenants`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={tab === 'users' ? exportArchivedUsers : exportArchivedTenants}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/5 text-slate-300 hover:text-white border border-white/10 transition-all"
            >
              <Download className="w-4 h-4" />CSV
            </button>
          </div>
        </div>

        {/* Notifications */}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />{success}
          </div>
        )}
        {error && !confirmRestore && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-white/5 rounded-xl w-fit">
          <button
            onClick={() => { setTab('users'); setSearch('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'users'
                ? 'bg-brand-600/80 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            Archived Users
            {users.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/10">{users.length}</span>
            )}
          </button>
          <button
            onClick={() => { setTab('tenants'); setSearch('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'tenants'
                ? 'bg-brand-600/80 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Archived Tenants
            {tenants.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/10">{tenants.length}</span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="glass p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={tab === 'users' ? 'Search by name, email, or reason...' : 'Search by name, code, or reason...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-brand-400" />
          </div>
        ) : tab === 'users' ? (
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['User', 'Email', 'Archived At', 'Archived By', 'Reason', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No archived users found
                      </td>
                    </tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.userId} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-300 text-xs font-bold flex-shrink-0">
                            {(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-slate-500">{u.role?.replace('_', ' ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {u.archivedAt ? new Date(u.archivedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{u.archivedBy || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-48 truncate" title={u.reason}>{u.reason || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => setConfirmRestore({ type: 'users', id: u.userId, name: `${u.firstName} ${u.lastName}` })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />Restore
                          </button>
                          <button
                            onClick={() => { setConfirmDelete({ type: 'users', id: u.userId, name: `${u.firstName} ${u.lastName}` }); setDeleteConfirmText('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Tenant', 'Code', 'Archived At', 'Archived By', 'Reason', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No archived tenants found
                      </td>
                    </tr>
                  ) : filteredTenants.map(t => (
                    <tr key={t.tenantId} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-300 text-xs font-bold flex-shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{t.name}</div>
                            <div className="text-xs text-slate-500">{t.plan}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{t.code || t.tenantId}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {t.archivedAt ? new Date(t.archivedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{t.archivedBy || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-48 truncate" title={t.reason}>{t.reason || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => setConfirmRestore({ type: 'tenants', id: t.tenantId, name: t.name })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />Restore
                          </button>
                          <button
                            onClick={() => { setConfirmDelete({ type: 'tenants', id: t.tenantId, name: t.name }); setDeleteConfirmText('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Permanently Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setConfirmDelete(null); setDeleteConfirmText('') } }}
        >
          <div className="glass border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <h2 className="text-base font-semibold text-white">Delete Permanently</h2>
              </div>
              <button onClick={() => { setConfirmDelete(null); setDeleteConfirmText('') }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}
              <p className="text-slate-300 text-sm">
                This will <strong className="text-red-400">permanently delete</strong> <strong className="text-white">{confirmDelete.name}</strong> and cannot be undone. All associated data will be removed from Cognito and DynamoDB.
              </p>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Type <span className="font-mono text-red-400 font-bold">DELETE</span> to confirm</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="input-field font-mono"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => { setConfirmDelete(null); setDeleteConfirmText('') }}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleHardDelete}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40 bg-red-600/80 hover:bg-red-600 text-white"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {confirmRestore && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmRestore(null) }}
        >
          <div className="glass border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-base font-semibold text-white">Confirm Restore</h2>
              <button onClick={() => setConfirmRestore(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}
              <p className="text-slate-300 text-sm">
                Are you sure you want to restore <strong className="text-white">{confirmRestore.name}</strong>?
                This will move the record out of the recycle bin and reactivate it.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 bg-green-600/80 hover:bg-green-600 text-white"
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {restoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
