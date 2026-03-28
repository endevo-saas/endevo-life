'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  Building2, Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle,
  RefreshCw, Users, Globe, Mail, Eye, ChevronDown, Tag, Crown
} from 'lucide-react'
import { api, Tenant } from '@/lib/api'

type Modal = 'create' | 'edit' | 'view' | 'delete' | null

const PLANS = [
  { id: 'trial', label: 'Trial (14 days free)', maxSeats: 10, price: '$0' },
  { id: 'starter', label: 'Starter', maxSeats: 25, price: '$249/mo' },
  { id: 'professional', label: 'Professional', maxSeats: 100, price: '$599/mo' },
  { id: 'enterprise', label: 'Enterprise', maxSeats: 500, price: '$1,499/mo' },
  { id: 'enterprise-plus', label: 'Enterprise Plus', maxSeats: 9999, price: 'Custom' },
]
const STATUSES = ['active', 'inactive', 'suspended', 'trial']

const planColor = (p: string) =>
  p==='trial' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
  p==='starter' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
  p==='professional' ? 'bg-brand-500/10 text-brand-300 border-brand-500/20' :
  p==='enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
  'bg-orange-500/10 text-orange-400 border-orange-500/20'

const statusColor = (s: string) =>
  s==='active' ? 'bg-green-500/10 text-green-400' :
  s==='trial' ? 'bg-yellow-500/10 text-yellow-400' :
  s==='suspended' ? 'bg-red-500/10 text-red-400' :
  'bg-slate-500/20 text-slate-400'

interface TenantFull extends Tenant {
  website?: string
  hrContact?: string
  hrEmail?: string
  tenantCode?: string
  createdBy?: string
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<TenantFull | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name:'', website:'', hrContact:'', hrEmail:'', plan:'professional', maxSeats:'50', status:'active' })

  async function load() {
    setLoading(true); setError('')
    try { const d = await api.adminTenants(); setTenants(d.tenants as TenantFull[]) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(()=>setSuccess(''),4000) }
  const closeModal = () => { setModal(null); setSelected(null); setError('') }
  const openCreate = () => { setForm({name:'',website:'',hrContact:'',hrEmail:'',plan:'professional',maxSeats:'50',status:'active'}); setModal('create') }
  const openEdit = (t: TenantFull) => { setSelected(t); setForm({name:t.name,website:t.website||'',hrContact:t.hrContact||'',hrEmail:t.hrEmail||'',plan:t.plan,maxSeats:String(t.maxSeats||50),status:t.status}); setModal('edit') }
  const openView = (t: TenantFull) => { setSelected(t); setModal('view') }
  const openDelete = (t: TenantFull) => { setSelected(t); setModal('delete') }

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !search || t.name.toLowerCase().includes(q) || t.tenantId.toLowerCase().includes(q) || (t.website||'').toLowerCase().includes(q)
    const matchPlan = planFilter==='ALL' || t.plan===planFilter
    return matchSearch && matchPlan
  })

  async function createTenant() {
    if (!form.name.trim()) { setError('Tenant name required'); return }
    setSaving(true); setError('')
    try {
      await api.adminCreateTenant({ name:form.name.trim(), plan:form.plan, maxSeats:Number(form.maxSeats), website:form.website, hrContact:form.hrContact, hrEmail:form.hrEmail } as Record<string,unknown>)
      closeModal(); showSuccess(`Tenant "${form.name}" created`); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Create failed') }
    finally { setSaving(false) }
  }

  async function updateTenant() {
    if (!selected) return; setSaving(true); setError('')
    try {
      await api.adminUpdateTenant(selected.tenantId, { name:form.name, plan:form.plan, status:form.status, maxSeats:Number(form.maxSeats), website:form.website, hrContact:form.hrContact, hrEmail:form.hrEmail })
      closeModal(); showSuccess('Tenant updated'); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Update failed') }
    finally { setSaving(false) }
  }

  async function deleteTenant() {
    if (!selected) return; setSaving(true); setError('')
    try { await api.adminDeleteTenant(selected.tenantId); closeModal(); showSuccess(`${selected.name} deleted`); load() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Tenant Master</h1>
            <p className="text-slate-400 text-sm mt-0.5">{filtered.length} of {tenants.length} organizations</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"><RefreshCw className="w-4 h-4"/></button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm btn-primary"><Plus className="w-4 h-4"/>New Tenant</button>
          </div>
        </div>

        {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">✓ {success}</div>}
        {error && !modal && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}</div>}

        {/* Filters */}
        <div className="glass p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52"><input type="text" placeholder="Search by name, code, website..." value={search} onChange={e=>setSearch(e.target.value)} className="input-field"/></div>
          <select value={planFilter} onChange={e=>setPlanFilter(e.target.value)} className="input-field w-auto text-sm">
            <option value="ALL">All Plans</option>{PLANS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {PLANS.map(p => {
            const count = tenants.filter(t=>t.plan===p.id).length
            return (
              <button key={p.id} onClick={()=>setPlanFilter(planFilter===p.id?'ALL':p.id)} className={`glass p-3 rounded-xl text-left transition-all hover:bg-white/5 ${planFilter===p.id?'border border-white/20':''}`}>
                <div className={`text-xs font-medium px-1.5 py-0.5 rounded inline-block mb-1 border ${planColor(p.id)}`}>{p.id.toUpperCase()}</div>
                <div className="text-xl font-bold text-white">{count}</div>
                <div className="text-xs text-slate-500">{p.price}</div>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="glass p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-brand-400"/></div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  {['Tenant','Code','Plan','Status','Users','HR Contact','Created','Actions'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.length===0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No tenants found</td></tr>
                  : filtered.map(t=>(
                    <tr key={t.tenantId} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-300 text-sm font-bold flex-shrink-0">{t.name[0].toUpperCase()}</div>
                          <div>
                            <div className="text-sm font-medium text-white">{t.name}</div>
                            {t.website && <a href={t.website} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1"><Globe className="w-3 h-3"/>{t.website.replace(/^https?:\/\//,'')}</a>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">{t.tenantCode||t.tenantId}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${planColor(t.plan)}`}>{t.plan}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-slate-400"><Users className="w-3.5 h-3.5"/>
                          <span className="text-white font-medium">{t.user_count||0}</span>/{t.maxSeats}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {t.hrContact ? <div><div className="text-xs text-white">{t.hrContact}</div><div className="text-xs text-slate-500">{t.hrEmail}</div></div> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{t.createdAt?new Date(t.createdAt).toLocaleDateString():'—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>openView(t)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all" title="View"><Eye className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>openEdit(t)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all" title="Edit"><Pencil className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>openDelete(t)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
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
          <div className="glass border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* CREATE */}
            {modal==='create'&&<>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 glass z-10">
                <h2 className="text-base font-semibold text-white">New Tenant</h2>
                <button onClick={closeModal}><X className="w-5 h-5 text-slate-400 hover:text-white"/></button>
              </div>
              <div className="p-6 space-y-4">
                {error&&<ErrBox msg={error}/>}
                <section>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Organization Info</p>
                  <div className="space-y-3">
                    <F label="Company Name *" v={form.name} set={v=>setForm(f=>({...f,name:v}))} ph="Acme Corporation Ltd"/>
                    <F label="Website" v={form.website} set={v=>setForm(f=>({...f,website:v}))} ph="https://acme.com"/>
                  </div>
                </section>
                <section>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">HR Admin Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    <F label="Contact Name" v={form.hrContact} set={v=>setForm(f=>({...f,hrContact:v}))} ph="Jane Smith"/>
                    <F label="Contact Email" v={form.hrEmail} set={v=>setForm(f=>({...f,hrEmail:v}))} ph="hr@acme.com" t="email"/>
                  </div>
                </section>
                <section>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Subscription</p>
                  <div className="grid grid-cols-2 gap-3">
                    <S label="Plan" v={form.plan} set={v=>setForm(f=>({...f,plan:v}))}>{PLANS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</S>
                    <F label="Max Seats" v={form.maxSeats} set={v=>setForm(f=>({...f,maxSeats:v}))} t="number"/>
                  </div>
                  {form.plan && <div className="mt-2 p-2 bg-white/3 rounded-lg text-xs text-slate-400">Price: <span className="text-white font-medium">{PLANS.find(p=>p.id===form.plan)?.price}</span> · Up to <span className="text-white">{PLANS.find(p=>p.id===form.plan)?.maxSeats} seats</span></div>}
                </section>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-3 sticky bottom-0 glass pt-4 border-t border-white/5">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5">Cancel</button>
                <button onClick={createTenant} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm btn-primary disabled:opacity-50">
                  {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>}{saving?'Creating...':'Create Tenant'}
                </button>
              </div>
            </>}

            {/* EDIT */}
            {modal==='edit'&&selected&&<>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">Edit: {selected.name}</h2>
                <button onClick={closeModal}><X className="w-5 h-5 text-slate-400 hover:text-white"/></button>
              </div>
              <div className="p-6 space-y-4">
                {error&&<ErrBox msg={error}/>}
                <div className="p-3 bg-white/3 rounded-lg text-xs text-slate-400 font-mono">ID: {selected.tenantId}</div>
                <F label="Company Name" v={form.name} set={v=>setForm(f=>({...f,name:v}))}/>
                <F label="Website" v={form.website} set={v=>setForm(f=>({...f,website:v}))} ph="https://"/>
                <div className="grid grid-cols-2 gap-3">
                  <F label="HR Contact Name" v={form.hrContact} set={v=>setForm(f=>({...f,hrContact:v}))}/>
                  <F label="HR Contact Email" v={form.hrEmail} set={v=>setForm(f=>({...f,hrEmail:v}))} t="email"/>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <S label="Plan" v={form.plan} set={v=>setForm(f=>({...f,plan:v}))}>{PLANS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</S>
                  <S label="Status" v={form.status} set={v=>setForm(f=>({...f,status:v}))}>{STATUSES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</S>
                  <F label="Max Seats" v={form.maxSeats} set={v=>setForm(f=>({...f,maxSeats:v}))} t="number"/>
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5">Cancel</button>
                <button onClick={updateTenant} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm btn-primary disabled:opacity-50">
                  {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>}{saving?'Saving...':'Save Changes'}
                </button>
              </div>
            </>}

            {/* VIEW */}
            {modal==='view'&&selected&&<>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">{selected.name}</h2>
                <button onClick={closeModal}><X className="w-5 h-5 text-slate-400 hover:text-white"/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={<Tag className="w-4 h-4"/>} label="Tenant Code" value={<span className="font-mono text-brand-300">{selected.tenantCode||selected.tenantId}</span>}/>
                  <InfoRow icon={<Crown className="w-4 h-4"/>} label="Plan" value={<span className={`px-2 py-0.5 rounded text-xs border ${planColor(selected.plan)}`}>{selected.plan}</span>}/>
                  <InfoRow icon={<Building2 className="w-4 h-4"/>} label="Status" value={<span className={`px-2 py-0.5 rounded text-xs ${statusColor(selected.status)}`}>{selected.status}</span>}/>
                  <InfoRow icon={<Users className="w-4 h-4"/>} label="Users" value={`${selected.user_count||0} / ${selected.maxSeats} seats`}/>
                  {selected.website && <InfoRow icon={<Globe className="w-4 h-4"/>} label="Website" value={<a href={selected.website} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline text-xs">{selected.website}</a>}/>}
                  {selected.hrContact && <InfoRow icon={<Mail className="w-4 h-4"/>} label="HR Contact" value={`${selected.hrContact} — ${selected.hrEmail||''}`}/>}
                </div>
                <div className="pt-2 border-t border-white/5 text-xs text-slate-500">
                  Created {selected.createdAt?new Date(selected.createdAt).toLocaleString():'—'} {selected.createdBy?`by ${selected.createdBy}`:''}
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-2">
                <button onClick={()=>{closeModal();openEdit(selected)}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/5 text-slate-300 hover:text-white border border-white/10"><Pencil className="w-3.5 h-3.5"/>Edit</button>
                <button onClick={closeModal} className="btn-primary text-sm px-4 py-2">Close</button>
              </div>
            </>}

            {/* DELETE */}
            {modal==='delete'&&selected&&<>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-red-400">Delete Tenant</h2>
                <button onClick={closeModal}><X className="w-5 h-5 text-slate-400 hover:text-white"/></button>
              </div>
              <div className="p-6">{error&&<ErrBox msg={error}/>}<p className="text-slate-300 text-sm mt-2">Soft-delete <strong className="text-white">{selected.name}</strong> ({selected.tenantId})? Status will be set to &quot;deleted&quot;. Users remain in the system.</p></div>
              <div className="px-6 pb-6 flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5">Cancel</button>
                <button onClick={deleteTenant} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-50">
                  {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Trash2 className="w-4 h-4"/>}{saving?'Deleting...':'Delete Tenant'}
                </button>
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}

function F({label,v,set,ph='',t='text'}:{label:string;v:string;set:(v:string)=>void;ph?:string;t?:string}) {
  return <div><label className="block text-xs text-slate-400 mb-1">{label}</label><input type={t} value={v} onChange={e=>set(e.target.value)} placeholder={ph} className="input-field text-sm"/></div>
}
function S({label,v,set,children}:{label:string;v:string;set:(v:string)=>void;children:React.ReactNode}) {
  return <div><label className="block text-xs text-slate-400 mb-1">{label}</label><div className="relative"><select value={v} onChange={e=>set(e.target.value)} className="input-field text-sm appearance-none pr-8">{children}</select><ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"/></div></div>
}
function ErrBox({msg}:{msg:string}) {
  return <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{msg}</div>
}
function InfoRow({icon,label,value}:{icon:React.ReactNode;label:string;value:React.ReactNode}) {
  return <div className="flex items-start gap-2"><span className="text-slate-500 mt-0.5 flex-shrink-0">{icon}</span><div><div className="text-xs text-slate-500">{label}</div><div className="text-sm text-white mt-0.5">{value}</div></div></div>
}
