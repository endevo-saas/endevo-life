'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Users, Search, Loader2, AlertCircle, RefreshCw, Shield, User } from 'lucide-react'
import { api, User as UserType } from '@/lib/api'

export default function AllUsersPage() {
  const [users, setUsers] = useState<UserType[]>([])
  const [filtered, setFiltered] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.adminUsers()
      setUsers(d.users)
      setFiltered(d.users)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let list = users
    if (roleFilter !== 'ALL') list = list.filter(u => u.role === roleFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.email.toLowerCase().includes(q) ||
        (u.firstName + ' ' + u.lastName).toLowerCase().includes(q) ||
        u.tenantId.toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }, [users, search, roleFilter])

  const roles = ['ALL', 'GLOBAL_ADMIN', 'HR_ADMIN', 'EMPLOYEE']

  const roleIcon = (role: string) => {
    if (role === 'GLOBAL_ADMIN') return <Shield className="w-3.5 h-3.5" />
    if (role === 'HR_ADMIN') return <Users className="w-3.5 h-3.5" />
    return <User className="w-3.5 h-3.5" />
  }

  const roleColor = (role: string) => {
    if (role === 'GLOBAL_ADMIN') return 'bg-brand-500/10 text-brand-300'
    if (role === 'HR_ADMIN') return 'bg-green-500/10 text-green-400'
    return 'bg-purple-500/10 text-purple-400'
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">All Users</h1>
            <p className="text-slate-400 text-sm mt-1">{filtered.length} of {users.length} users</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

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
              placeholder="Search by name, email, or tenant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  roleFilter === r
                    ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Tenant</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No users found</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.userId} className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${roleColor(u.role)}`}>
                        {roleIcon(u.role)}
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-mono text-xs">{u.tenantId}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        u.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        u.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{u.department || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
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
