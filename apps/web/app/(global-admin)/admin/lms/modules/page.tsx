'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, Edit2, Save, X, ChevronDown, ChevronUp,
  Loader2, RefreshCw, AlertTriangle, Check, FileText,
  ToggleLeft, ToggleRight
} from 'lucide-react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface LmsModule {
  moduleNum: string
  title: string
  description: string
  domain?: string
  objectives: string[]
  videoIds: string[]
  pdfKey?: string
  isActive: boolean
}

interface EditState {
  title: string
  description: string
  objectivesText: string
  isActive: boolean
  domain: string
}

const DOMAIN_COLORS: Record<string, string> = {
  Legal:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Financial:   'bg-green-500/20 text-green-300 border-green-500/30',
  Physical:    'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Digital:     'bg-teal-500/20 text-teal-300 border-teal-500/30',
  Foundation:  'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Communicate: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

function DomainBadge({ domain }: { domain?: string }) {
  if (!domain) return null
  const cls = DOMAIN_COLORS[domain] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cls}`}>
      {domain}
    </span>
  )
}

function ModuleCard({
  mod,
  onSave,
  onToggleActive,
}: {
  mod: LmsModule
  onSave: (moduleNum: string, data: Partial<LmsModule>) => Promise<void>
  onToggleActive: (moduleNum: string, isActive: boolean) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editState, setEditState] = useState<EditState>({
    title: mod.title,
    description: mod.description,
    objectivesText: mod.objectives.join('\n'),
    isActive: mod.isActive,
    domain: mod.domain ?? '',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(mod.moduleNum, {
        title: editState.title,
        description: editState.description,
        objectives: editState.objectivesText.split('\n').map(s => s.trim()).filter(Boolean),
        isActive: editState.isActive,
        domain: editState.domain || undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditState({
      title: mod.title,
      description: mod.description,
      objectivesText: mod.objectives.join('\n'),
      isActive: mod.isActive,
      domain: mod.domain ?? '',
    })
    setEditing(false)
  }

  return (
    <div className={`rounded-2xl border transition-all duration-200 ${mod.isActive ? 'border-white/10 bg-white/3' : 'border-white/5 bg-white/1 opacity-60'}`}>
      {/* Card header */}
      <div className="flex items-start gap-4 p-5">
        {/* Module number badge */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center">
          <span className="text-lg font-black text-teal-300">{mod.moduleNum}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Title</label>
                  <input
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
                    value={editState.title}
                    onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Domain</label>
                  <select
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                    value={editState.domain}
                    onChange={e => setEditState(s => ({ ...s, domain: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {Object.keys(DOMAIN_COLORS).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
                  value={editState.description}
                  onChange={e => setEditState(s => ({ ...s, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Objectives (one per line)</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none font-mono text-xs"
                  value={editState.objectivesText}
                  onChange={e => setEditState(s => ({ ...s, objectivesText: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditState(s => ({ ...s, isActive: !s.isActive }))}
                  className="flex items-center gap-2 text-sm"
                >
                  {editState.isActive
                    ? <ToggleRight className="w-5 h-5 text-teal-400" />
                    : <ToggleLeft className="w-5 h-5 text-slate-500" />
                  }
                  <span className={editState.isActive ? 'text-teal-300' : 'text-slate-500'}>
                    {editState.isActive ? 'Active' : 'Inactive'}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600/30 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-base font-bold text-white leading-tight">{mod.title}</h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <DomainBadge domain={mod.domain} />
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mod.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                    {mod.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">{mod.description}</p>

              {/* Videos + objectives toggle */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <Link
                  href="/admin/lms/questions"
                  className="flex items-center gap-1.5 hover:text-teal-400 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {mod.videoIds.length} video{mod.videoIds.length !== 1 ? 's' : ''} assigned
                </Link>
                {mod.objectives.length > 0 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                  >
                    {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {mod.objectives.length} objective{mod.objectives.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {expanded && mod.objectives.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {mod.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check className="w-3 h-3 text-teal-400 mt-0.5 flex-shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Actions (only when not editing) */}
        {!editing && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggleActive(mod.moduleNum, !mod.isActive)}
              title={mod.isActive ? 'Deactivate' : 'Activate'}
              className="p-2 rounded-xl border border-white/8 bg-white/3 hover:bg-white/8 text-slate-400 hover:text-white transition-all"
            >
              {mod.isActive
                ? <ToggleRight className="w-4 h-4 text-teal-400" />
                : <ToggleLeft className="w-4 h-4" />
              }
            </button>
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-xl border border-white/8 bg-white/3 hover:bg-teal-600/20 hover:border-teal-500/30 text-slate-400 hover:text-teal-300 transition-all"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AddModuleForm({
  onAdd,
  onClose,
  nextModuleNum,
}: {
  onAdd: (data: Partial<LmsModule>) => Promise<void>
  onClose: () => void
  nextModuleNum: string
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EditState & { moduleNum: string }>({
    moduleNum: nextModuleNum,
    title: '',
    description: '',
    objectivesText: '',
    isActive: true,
    domain: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onAdd({
        moduleNum: form.moduleNum,
        title: form.title,
        description: form.description,
        objectives: form.objectivesText.split('\n').map(s => s.trim()).filter(Boolean),
        isActive: form.isActive,
        domain: form.domain || undefined,
        videoIds: [],
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-teal-500/20 bg-teal-900/10 p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Module
        </h3>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Module #</label>
          <input
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.moduleNum}
            onChange={e => setForm(s => ({ ...s, moduleNum: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Title *</label>
          <input
            required
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.title}
            onChange={e => setForm(s => ({ ...s, title: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Domain</label>
          <select
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            value={form.domain}
            onChange={e => setForm(s => ({ ...s, domain: e.target.value }))}
          >
            <option value="">— None —</option>
            {Object.keys(DOMAIN_COLORS).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => setForm(s => ({ ...s, isActive: !s.isActive }))}
            className="flex items-center gap-2 text-sm"
          >
            {form.isActive
              ? <ToggleRight className="w-5 h-5 text-teal-400" />
              : <ToggleLeft className="w-5 h-5 text-slate-500" />
            }
            <span className={form.isActive ? 'text-teal-300 text-sm' : 'text-slate-500 text-sm'}>
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Description</label>
        <textarea
          rows={3}
          className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
          value={form.description}
          onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Objectives (one per line)</label>
        <textarea
          rows={4}
          className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none font-mono text-xs"
          value={form.objectivesText}
          onChange={e => setForm(s => ({ ...s, objectivesText: e.target.value }))}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600/30 text-sm font-semibold transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Module
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function LmsModulesPage() {
  const [modules, setModules] = useState<LmsModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/api/lms/admin/modules') as LmsModule[]
      setModules(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load modules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (moduleNum: string, updates: Partial<LmsModule>) => {
    await api.post('/api/lms/admin/modules', { moduleNum, ...updates })
    setModules(prev =>
      prev.map(m => m.moduleNum === moduleNum ? { ...m, ...updates } : m)
    )
  }

  const handleToggleActive = async (moduleNum: string, isActive: boolean) => {
    await api.post('/api/lms/admin/modules', { moduleNum, isActive })
    setModules(prev =>
      prev.map(m => m.moduleNum === moduleNum ? { ...m, isActive } : m)
    )
  }

  const handleAdd = async (data: Partial<LmsModule>) => {
    await api.post('/api/lms/admin/modules', data)
    await load()
  }

  const nextModuleNum = String(
    modules.reduce((max, m) => Math.max(max, parseInt(m.moduleNum) || 0), 0) + 1
  )

  const activeCount = modules.filter(m => m.isActive).length

  return (
    <div className="min-h-screen p-6">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-teal-400" />
              LMS Modules
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {loading ? 'Loading…' : `${modules.length} modules · ${activeCount} active`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 text-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:bg-teal-600/30 text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Module
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
            <button onClick={load} className="ml-auto text-red-300 hover:text-white font-medium">Retry</button>
          </div>
        )}

        {/* Add module form */}
        {showAddForm && (
          <AddModuleForm
            onAdd={handleAdd}
            onClose={() => setShowAddForm(false)}
            nextModuleNum={nextModuleNum}
          />
        )}

        {/* Module list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-white/5 rounded" />
                    <div className="h-3 w-64 bg-white/5 rounded" />
                    <div className="h-3 w-32 bg-white/3 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : modules.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No modules found</p>
            <p className="text-slate-600 text-sm mt-1">Add the first module to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map(mod => (
              <ModuleCard
                key={mod.moduleNum}
                mod={mod}
                onSave={handleSave}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-slate-600 pb-2 text-right">
          Endevo Life · LMS Admin · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}
