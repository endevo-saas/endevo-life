'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Users, Search, Pencil, UserX, Check, X, Loader2, AlertCircle, RefreshCw, UserPlus } from 'lucide-react'
import { api, User } from '@/lib/api'
import Link from 'next/link'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<User[]>([])
  const [filtered, setFiltered] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.hrEmployees()
      setEmployees(d.employees)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let list = employees
    if (statusFilter !== 'ALL') list = list.filter(e => e.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        (e.email || '').toLowerCase().includes(q) ||
        `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }, [employees, search, statusFilter])

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function startEdit(emp: User) {
    setEditId(emp.userId)
    setEditData({
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      department: emp.department || '',
      jobTitle: emp.jobTitle || '',
    })
  }

  async function saveEdit(userId: string) {
    setEditSaving(true)
    try {
      await api.hrUpdateEmployee(userId, editData)
      setEditId(null)
      showSuccess('Employee updated')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function deactivate(userId: string, email: string) {
    if (!confirm(`Deactivate ${email}? They will lose access.`)) return
    setDeactivating(userId)
    try {
      await api.hrDeactivateEmployee(userId)
      showSuccess(`${email} deactivated`)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Deactivation failed')
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Employees</h1>
            <p className="text-slate-400 text-sm mt-1">{filtered.length} of {employees.length} employees</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/hr/invite" className="btn-primary flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4" /> Invite Employee
            </Link>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {successMsg}</div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Filters */}
        <div className="glass p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'active', 'pending', 'inactive'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-green-600/30 text-green-300 border border-green-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Job Title</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No employees found.{' '}
                      <Link href="/hr/invite" className="text-green-400 hover:underline">Invite one?</Link>
                    </td>
                  </tr>
                ) : filtered.map(emp => (
                  <tr key={emp.userId} className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4">
                      {editId === emp.userId ? (
                        <div className="flex gap-2">
                          <input
                            value={editData.firstName}
                            onChange={e => setEditData(p => ({ ...p, firstName: e.target.value }))}
                            placeholder="First"
                            className="text-sm bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white w-24"
                          />
                          <input
                            value={editData.lastName}
                            onChange={e => setEditData(p => ({ ...p, lastName: e.target.value }))}
                            placeholder="Last"
                            className="text-sm bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white w-24"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-white">{emp.firstName} {emp.lastName}</div>
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editId === emp.userId ? (
                        <input
                          value={editData.department}
                          onChange={e => setEditData(p => ({ ...p, department: e.target.value }))}
                          placeholder="Department"
                          className="text-sm bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white w-32"
                        />
                      ) : (
                        <span className="text-sm text-slate-400">{emp.department || '—'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editId === emp.userId ? (
                        <input
                          value={editData.jobTitle}
                          onChange={e => setEditData(p => ({ ...p, jobTitle: e.target.value }))}
                          placeholder="Job Title"
                          className="text-sm bg-slate-800 border border-white/20 rounded-lg px-2 py-1 text-white w-32"
                        />
                      ) : (
                        <span className="text-sm text-slate-400">{emp.jobTitle || '—'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        emp.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        emp.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>{emp.status}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {editId === emp.userId ? (
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(emp.userId)} disabled={editSaving} className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                            {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(emp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {emp.status !== 'inactive' && (
                            <button
                              onClick={() => deactivate(emp.userId, emp.email)}
                              disabled={deactivating === emp.userId}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Deactivate"
                            >
                              {deactivating === emp.userId
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <UserX className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
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
