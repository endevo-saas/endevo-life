'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import {
  Users, Search, Loader2, AlertCircle, RefreshCw, Shield, User,
  Plus, Pencil, Lock, Unlock, KeyRound, Mail, X, Check,
  ChevronDown, Building2, Eye, EyeOff, ToggleLeft, ToggleRight
} from 'lucide-react'
import { api, User as UserType, Tenant } from '@/lib/api'

type Modal = 'create' | 'edit' | 'confirm-toggle' | 'resetpw' | 'invite' | null

const ROLES = ['GLOBAL_ADMIN', 'HR_ADMIN', 'EMPLOYEE']
const DEPARTMENTS = ['Engineering','HR','Finance','Legal','Operations','Sales','Marketing','Executive','Other']

export default function AllUsersPage() {
  const [users, setUsers] = useState<UserType[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filtered, setFiltered] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [tenantFilter, setTenantFilter] = useState('ALL')
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<UserType | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetPw, setResetPw] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [form, setForm] = useState({ email:'', firstName:'', lastName:'', role:'EMPLOYEE', tenantId:'', department:'', jobTitle:'', password:'' })
  const [inviteForm, setInviteForm] = useState({ email:'', role:'EMPLOYEE', tenantId:'', firstName:'', lastName:'' })

  async function load() {
    setLoading(true); setError('')
    try {
      const [ud, td] = await Promise.all([api.adminUsers(), api.adminTenants()])
      setUsers(ud.users); setTenants(td.tenants)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    let list = users
    if (roleFilter !== 'ALL') list = list.filter(u => u.role === roleFilter)
    if (statusFilter !== 'ALL') list = list.filter(u => u.status === statusFilter)
    if (tenantFilter !== 'ALL') list = list.filter(u => u.tenantId === tenantFilter)
    if (search) { const q = search.toLowerCase(); list = list.filter(u => (u.email||'').toLowerCase().includes(q) || `${u.firstName||''} ${u.lastName||''}`.toLowerCase().includes(q) || (u.tenantId||'').toLowerCase().includes(q)) }
    setFiltered(list)
  }, [users, search, roleFilter, statusFilter, tenantFilter])

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  const closeModal = () => { setModal(null); setSelected(null); setResetPw(''); setShowPw(false); setError('') }
  const openCreate = () => { setForm({ email:'',firstName:'',lastName:'',role:'EMPLOYEE',tenantId:'',department:'',jobTitle:'',password:'' }); setModal('create') }
  const openEdit = (u: UserType) => { setSelected(u); setForm({ email:u.email,firstName:u.firstName,lastName:u.lastName,role:u.role,tenantId:u.tenantId,department:u.department||'',jobTitle:u.jobTitle||'',password:'' }); setModal('edit') }
  const openToggle = (u: UserType) => { setSelected(u); setModal('confirm-toggle') }
  const openInvite = () => { setInviteForm({ email:'',role:'EMPLOYEE',tenantId:'',firstName:'',lastName:'' }); setModal('invite') }

  async function createUser() {
    setSaving(true); setError('')
    try { await api.adminCreateUser({ ...form }); closeModal(); showSuccess(`User ${form.email} created`); load() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Create failed') }
    finally { setSaving(false) }
  }

  async function updateUser() {
    if (!selected) return; setSaving(true); setError('')
    try {
      await api.adminUpdateUser(selected.userId, { firstName:form.firstName, lastName:form.lastName, department:form.department, jobTitle:form.jobTitle, role:form.role })
      closeModal(); showSuccess('User updated'); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Update failed') }
    finally { setSaving(false) }
  }

  async function toggleUser() {
    if (!selected) return; setSaving(true); setError('')
    const deactivating = selected.status === 'active'
    try {
      if (deactivating) {
        await api.adminDeactivateUser(selected.userId)
        showSuccess(`${selected.email} deactivated`)
      } else {
        await api.adminReactivateUser(selected.userId)
        showSuccess(`${selected.email} reactivated`)
      }
      closeModal(); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Action failed') }
    finally { setSaving(false) }
  }

  async function toggleLock(u: UserType) {
    try {
      if (u.status === 'locked') { await api.adminUnlockUser(u.userId); showSuccess(`${u.email} unlocked`) }
      else { await api.adminLockUser(u.userId); showSuccess(`${u.email} locked`) }
      load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  async function resetPassword(u: UserType) {
    setSelected(u); setSaving(true); setError('')
    try { const r = await api.adminResetPassword(u.userId) as { temporary_password: string }; setResetPw(r.temporary_password); setModal('resetpw') }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Reset failed') }
    finally { setSaving(false) }
  }

  async function sendInvite() {
    setSaving(true); setError('')
    try {
      const r = await api.adminInvite(inviteForm)
      closeModal(); showSuccess(`Invite sent to ${inviteForm.email}${r.email_sent ? '' : ' (check spam — SES sandbox)'}`); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Invite failed') }
    finally { setSaving(false) }
  }

  const roleColor = (r: string) => r==='GLOBAL_ADMIN' ? 'bg-brand-500/15 text-brand-300 border-brand-500/30' : r==='HR_ADMIN' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
  const statusColor = (s: string) => s==='active' ? 'bg-green-500/10 text-green-400' : s==='locked' ? 'bg-red-500/10 text-red-400' : s==='pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-slate-500/20 text-slate-400'
  const tenantName = (id: string) => tenants.find(t => t.tenantId === id)?.name || id

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Users Master</h1>
            <p className="text-slate-400 text-sm mt-0.5">{filtered.length} of {users.length} users</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={openInvite} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all"><Mail className="w-4 h-4" />Invite by Email</button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm btn-primary"><Plus className="w-4 h-4" />Create User</button>
          </div>
        </div>

        {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {success}</div>}
        {error && !modal && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}

        <div className="glass p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input type="text" placeholder="Search name, email, tenant..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" /></div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field w-auto text-sm"><option value="ALL">All Roles</option>{ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto text-sm"><option value="ALL">All Status</option>{['active','pending','locked','inactive'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select>
          <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="input-field w-auto text-sm"><option value="ALL">All Tenants</option>{tenants.map(t=><option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}</select>
        </div>

        {loading ? (
          <div className="glass p-12 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-brand-400" /></div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  {['User','Role','Tenant','Status','Department','Joined','Actions'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.length===0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No users found</td></tr>
                  : filtered.map(u=>(
                    <tr key={u.userId} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0">{(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}</div>
                          <div><div className="text-sm font-medium text-white">{u.firstName} {u.lastName}</div><div className="text-xs text-slate-500">{u.email}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${roleColor(u.role)}`}>{u.role==='GLOBAL_ADMIN'?<Shield className="w-3 h-3"/>:u.role==='HR_ADMIN'?<Users className="w-3 h-3"/>:<User className="w-3 h-3"/>}{u.role.replace('_',' ')}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0"/><div><div className="text-xs text-white">{tenantName(u.tenantId)}</div><div className="text-xs text-slate-600 font-mono">{u.tenantId}</div></div></div></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusColor(u.status)}`}>{u.status}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-400">{u.department||'—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{u.createdAt?new Date(u.createdAt).toLocaleDateString():'—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionBtn onClick={()=>openEdit(u)} title="Edit"><Pencil className="w-3.5 h-3.5"/></ActionBtn>
                          <ActionBtn onClick={()=>toggleLock(u)} title={u.status==='locked'?'Unlock':'Lock'} color={u.status==='locked'?'hover:text-green-400':'hover:text-yellow-400'}>{u.status==='locked'?<Unlock className="w-3.5 h-3.5"/>:<Lock className="w-3.5 h-3.5"/>}</ActionBtn>
                          <ActionBtn onClick={()=>resetPassword(u)} title="Reset Password" color="hover:text-blue-400"><KeyRound className="w-3.5 h-3.5"/></ActionBtn>
                          <ActionBtn onClick={()=>openToggle(u)} title={u.status==='active'?'Deactivate user':'Reactivate user'} color={u.status==='active'?'hover:text-orange-400 hover:bg-orange-500/10':'hover:text-green-400 hover:bg-green-500/10'}>{u.status==='active'?<ToggleRight className="w-3.5 h-3.5"/>:<ToggleLeft className="w-3.5 h-3.5"/>}</ActionBtn>
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

      {/* MODALS */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)closeModal()}}>
          <div className="glass border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">

            {modal==='create' && <>
              <MHdr title="Create User" onClose={closeModal}/>
              <div className="p-6 space-y-3">
                {error&&<Err msg={error}/>}
                <div className="grid grid-cols-2 gap-3"><Fld label="First Name" v={form.firstName} set={v=>setForm(f=>({...f,firstName:v}))} ph="John"/><Fld label="Last Name" v={form.lastName} set={v=>setForm(f=>({...f,lastName:v}))} ph="Doe"/></div>
                <Fld label="Email *" v={form.email} set={v=>setForm(f=>({...f,email:v}))} ph="john@company.com" t="email"/>
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Role *" v={form.role} set={v=>setForm(f=>({...f,role:v}))}>{ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</Sel>
                  <Sel label="Tenant" v={form.tenantId} set={v=>setForm(f=>({...f,tenantId:v}))}><option value="">— Global Admin —</option>{tenants.map(t=><option key={t.tenantId} value={t.tenantId}>{t.name} ({t.tenantId})</option>)}</Sel>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Job Title" v={form.jobTitle} set={v=>setForm(f=>({...f,jobTitle:v}))} ph="HR Manager"/>
                  <Sel label="Department" v={form.department} set={v=>setForm(f=>({...f,department:v}))}><option value="">Select...</option>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</Sel>
                </div>
                <Fld label="Password (blank = auto)" v={form.password} set={v=>setForm(f=>({...f,password:v}))} ph="Auto-generated if blank" t="password"/>
              </div>
              <MFtr onCancel={closeModal} onOk={createUser} saving={saving} label="Create User"/>
            </>}

            {modal==='edit'&&selected&&<>
              <MHdr title={`Edit: ${selected.email}`} onClose={closeModal}/>
              <div className="p-6 space-y-3">
                {error&&<Err msg={error}/>}
                <div className="grid grid-cols-2 gap-3"><Fld label="First Name" v={form.firstName} set={v=>setForm(f=>({...f,firstName:v}))}/><Fld label="Last Name" v={form.lastName} set={v=>setForm(f=>({...f,lastName:v}))}/></div>
                <div className="p-3 bg-white/3 rounded-lg text-xs text-slate-400">Email: <span className="text-white">{selected.email}</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Role" v={form.role} set={v=>setForm(f=>({...f,role:v}))}>{ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</Sel>
                  <Fld label="Job Title" v={form.jobTitle} set={v=>setForm(f=>({...f,jobTitle:v}))}/>
                </div>
                <Sel label="Department" v={form.department} set={v=>setForm(f=>({...f,department:v}))}><option value="">Select...</option>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</Sel>
              </div>
              <MFtr onCancel={closeModal} onOk={updateUser} saving={saving} label="Save Changes"/>
            </>}

            {modal==='confirm-toggle'&&selected&&(()=>{
              const deactivating = selected.status === 'active'
              return <>
                <MHdr title={deactivating ? 'Deactivate User' : 'Reactivate User'} onClose={closeModal} danger={deactivating}/>
                <div className="p-6 space-y-3">
                  {error&&<Err msg={error}/>}
                  <p className="text-slate-300 text-sm">
                    {deactivating
                      ? <>Deactivating <strong className="text-white">{selected.email}</strong> will block their login immediately. Their data and records are preserved. You can reactivate at any time.</>
                      : <>Reactivating <strong className="text-white">{selected.email}</strong> will restore their access immediately.</>
                    }
                  </p>
                </div>
                <MFtr onCancel={closeModal} onOk={toggleUser} saving={saving} label={deactivating ? 'Deactivate User' : 'Reactivate User'} danger={deactivating}/>
              </>
            })()}

            {modal==='resetpw'&&selected&&<>
              <MHdr title="Password Reset" onClose={closeModal}/>
              <div className="p-6 space-y-3">
                <p className="text-slate-400 text-sm">New password for <strong className="text-white">{selected.email}</strong>:</p>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  <code className="flex-1 text-brand-300 text-sm font-mono">{showPw?resetPw:'●'.repeat(Math.min(resetPw.length,20))}</code>
                  <button onClick={()=>setShowPw(!showPw)} className="text-slate-400 hover:text-white">{showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
                  <button onClick={()=>{navigator.clipboard.writeText(resetPw);showSuccess('Copied!')}} className="text-xs px-2 py-1 bg-white/5 rounded text-slate-400 hover:text-white">Copy</button>
                </div>
                <p className="text-yellow-400/80 text-xs">Share this securely with the user.</p>
              </div>
              <div className="px-6 pb-6 flex justify-end"><button onClick={closeModal} className="btn-primary text-sm">Done</button></div>
            </>}

            {modal==='invite'&&<>
              <MHdr title="Invite by Email" onClose={closeModal}/>
              <div className="p-6 space-y-3">
                {error&&<Err msg={error}/>}
                <p className="text-slate-400 text-xs">Works with Gmail, Hotmail, corporate, or any email provider.</p>
                <Fld label="Email Address *" v={inviteForm.email} set={v=>setInviteForm(f=>({...f,email:v}))} ph="anyone@gmail.com" t="email"/>
                <div className="grid grid-cols-2 gap-3"><Fld label="First Name" v={inviteForm.firstName} set={v=>setInviteForm(f=>({...f,firstName:v}))} ph="Optional"/><Fld label="Last Name" v={inviteForm.lastName} set={v=>setInviteForm(f=>({...f,lastName:v}))} ph="Optional"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Role *" v={inviteForm.role} set={v=>setInviteForm(f=>({...f,role:v}))}>{ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</Sel>
                  <Sel label="Tenant" v={inviteForm.tenantId} set={v=>setInviteForm(f=>({...f,tenantId:v}))}><option value="">— None —</option>{tenants.map(t=><option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}</Sel>
                </div>
              </div>
              <MFtr onCancel={closeModal} onOk={sendInvite} saving={saving} label="Send Invitation" icon={<Mail className="w-4 h-4"/>}/>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, title, color='', children }: { onClick:()=>void; title:string; color?:string; children:React.ReactNode }) {
  return <button onClick={onClick} title={title} className={`p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-all ${color}`}>{children}</button>
}
function MHdr({ title, onClose, danger }: { title:string; onClose:()=>void; danger?:boolean }) {
  return <div className={`flex items-center justify-between px-6 py-4 border-b border-white/10 ${danger?'text-red-400':'text-white'}`}><h2 className="text-base font-semibold">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button></div>
}
function MFtr({ onCancel, onOk, saving, label, danger, icon }: { onCancel:()=>void; onOk:()=>void; saving:boolean; label:string; danger?:boolean; icon?:React.ReactNode }) {
  return <div className="px-6 pb-6 flex justify-end gap-3"><button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button><button onClick={onOk} disabled={saving} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${danger?'bg-red-600/80 hover:bg-red-600 text-white':'btn-primary'}`}>{saving?<Loader2 className="w-4 h-4 animate-spin"/>:(icon||<Check className="w-4 h-4"/>)}{saving?'Working...':label}</button></div>
}
function Fld({ label, v, set, ph='', t='text' }: { label:string; v:string; set:(v:string)=>void; ph?:string; t?:string }) {
  return <div><label className="block text-xs text-slate-400 mb-1">{label}</label><input type={t} value={v} onChange={e=>set(e.target.value)} placeholder={ph} className="input-field text-sm"/></div>
}
function Sel({ label, v, set, children }: { label:string; v:string; set:(v:string)=>void; children:React.ReactNode }) {
  return <div><label className="block text-xs text-slate-400 mb-1">{label}</label><div className="relative"><select value={v} onChange={e=>set(e.target.value)} className="input-field text-sm appearance-none pr-8">{children}</select><ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"/></div></div>
}
function Err({ msg }: { msg:string }) {
  return <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{msg}</div>
}
