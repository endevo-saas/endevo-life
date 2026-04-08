'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Upload, Download, Loader2, AlertCircle, CheckCircle, RefreshCw,
  FileJson, Building2, Users, ChevronDown, Copy, Eye
} from 'lucide-react'
import { api, Tenant, User, ImportTenant, ImportEmployee, BulkImportResult } from '@/lib/api'

type ActiveTab = 'import' | 'export'
type DataType = 'tenants' | 'employees'

const TENANT_TEMPLATE: ImportTenant[] = [
  { name: 'Acme Corp', plan: 'basic', maxSeats: 50, hrEmail: 'hr@acme.com' },
  { name: 'Globex Inc', plan: 'premium', maxSeats: 200, hrEmail: 'admin@globex.com' },
]

const EMPLOYEE_TEMPLATE: ImportEmployee[] = [
  { email: 'john@acme.com', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE', department: 'Engineering' },
  { email: 'jane@acme.com', firstName: 'Jane', lastName: 'Smith', role: 'HR_ADMIN', department: 'HR' },
]

export default function ImportExportPage() {
  const [tab, setTab] = useState<ActiveTab>('import')
  const [dataType, setDataType] = useState<DataType>('tenants')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Import state
  const [importJson, setImportJson] = useState('')
  const [importTenantId, setImportTenantId] = useState('')
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  // Export state
  const [exportTenantFilter, setExportTenantFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportPreview, setExportPreview] = useState<unknown[] | null>(null)
  const [exportMeta, setExportMeta] = useState<{ count: number; exportedAt: string } | null>(null)

  // Tenants list for dropdowns
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true)
    try {
      const res = await api.adminTenants()
      setTenants(res.tenants)
    } catch {
      // silent — tenants list is auxiliary
    } finally { setTenantsLoading(false) }
  }, [])

  useEffect(() => { loadTenants() }, [loadTenants])

  function showMsg(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 5000)
  }

  function loadTemplate() {
    if (dataType === 'tenants') {
      setImportJson(JSON.stringify(TENANT_TEMPLATE, null, 2))
    } else {
      setImportJson(JSON.stringify(EMPLOYEE_TEMPLATE, null, 2))
    }
  }

  async function handleImport() {
    setImporting(true); setError(''); setImportResult(null)
    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(importJson)
      } catch {
        throw new Error('Invalid JSON — check syntax and try again')
      }

      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of objects')
      }

      let result: BulkImportResult
      if (dataType === 'tenants') {
        result = await api.adminImportTenants(parsed as ImportTenant[])
      } else {
        if (!importTenantId) {
          throw new Error('Please select a tenant for employee import')
        }
        result = await api.adminImportEmployees(importTenantId, parsed as ImportEmployee[])
      }

      setImportResult(result)
      if (result.failed === 0) {
        showMsg(`Successfully imported ${result.imported} ${dataType}`)
      } else {
        showMsg(`Imported ${result.imported}, failed ${result.failed}`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally { setImporting(false) }
  }

  async function handleExport() {
    setExporting(true); setError(''); setExportPreview(null); setExportMeta(null)
    try {
      if (dataType === 'tenants') {
        const res = await api.adminExportTenants()
        setExportPreview(res.tenants)
        setExportMeta({ count: res.count, exportedAt: res.exportedAt })
      } else {
        const res = await api.adminExportEmployees(exportTenantFilter || undefined)
        setExportPreview(res.employees)
        setExportMeta({ count: res.count, exportedAt: res.exportedAt })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally { setExporting(false) }
  }

  function downloadJson() {
    if (!exportPreview) return
    const blob = new Blob([JSON.stringify(exportPreview, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `endevo-${dataType}-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showMsg('Download started')
  }

  function copyToClipboard() {
    if (!exportPreview) return
    navigator.clipboard.writeText(JSON.stringify(exportPreview, null, 2))
    showMsg('Copied to clipboard')
  }

  const tabs: Array<{ id: ActiveTab; icon: React.ElementType; label: string }> = [
    { id: 'import', icon: Upload, label: 'Import' },
    { id: 'export', icon: Download, label: 'Export' },
  ]

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Import / Export</h1>
            <p className="text-slate-400 text-sm mt-0.5">Bulk import and export tenants and employees</p>
          </div>
        </div>

        {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0" />{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 glass p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); setImportResult(null); setExportPreview(null) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Data type selector */}
        <div className="mb-4">
          <label className="block text-xs text-slate-500 mb-1.5">Data Type</label>
          <div className="relative w-64">
            <select
              value={dataType}
              onChange={e => { setDataType(e.target.value as DataType); setImportResult(null); setExportPreview(null); setImportJson('') }}
              className="input-field text-sm w-full appearance-none pr-8"
            >
              <option value="tenants">Tenants</option>
              <option value="employees">Employees</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* ── IMPORT TAB ─────────────────────────────────────────── */}
        {tab === 'import' && (
          <div className="space-y-4">
            {/* Tenant selector for employees */}
            {dataType === 'employees' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Target Tenant</label>
                <div className="relative w-80">
                  <select
                    value={importTenantId}
                    onChange={e => setImportTenantId(e.target.value)}
                    className="input-field text-sm w-full appearance-none pr-8"
                    disabled={tenantsLoading}
                  >
                    <option value="">Select tenant...</option>
                    {tenants.map(t => (
                      <option key={t.tenantId} value={t.tenantId}>{t.name} ({t.tenantId.slice(0, 8)})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* JSON input */}
            <div className="glass p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-brand-400" />
                  <h3 className="text-sm font-semibold text-white">JSON Data</h3>
                </div>
                <button onClick={loadTemplate} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Load template
                </button>
              </div>
              <textarea
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder={`Paste JSON array of ${dataType} here...\n\n${dataType === 'tenants' ? '[\n  { "name": "Company Name", "plan": "basic", "maxSeats": 50, "hrEmail": "hr@example.com" }\n]' : '[\n  { "email": "user@example.com", "firstName": "John", "lastName": "Doe", "role": "EMPLOYEE" }\n]'}`}
                className="input-field w-full h-48 font-mono text-xs resize-y"
                spellCheck={false}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-[10px] text-slate-600">
                  {importJson ? `${importJson.length} chars` : 'Paste or type JSON array'}
                </p>
                <button
                  onClick={handleImport}
                  disabled={importing || !importJson.trim()}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importing...' : `Import ${dataType}`}
                </button>
              </div>
            </div>

            {/* Import result */}
            {importResult && (
              <div className="glass p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Import Results</h3>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                    <p className="text-2xl font-bold text-green-400">{importResult.imported}</p>
                    <p className="text-xs text-slate-500">Imported</p>
                  </div>
                  <div className={`p-3 rounded-xl ${importResult.failed > 0 ? 'bg-red-500/5 border border-red-500/20' : 'bg-white/3 border border-white/10'}`}>
                    <p className={`text-2xl font-bold ${importResult.failed > 0 ? 'text-red-400' : 'text-slate-400'}`}>{importResult.failed}</p>
                    <p className="text-xs text-slate-500">Failed</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-red-400 font-medium mb-2">Errors:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-300 bg-red-500/5 px-3 py-1.5 rounded-lg">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── EXPORT TAB ─────────────────────────────────────────── */}
        {tab === 'export' && (
          <div className="space-y-4">
            {/* Tenant filter for employees */}
            {dataType === 'employees' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Filter by Tenant (optional)</label>
                <div className="relative w-80">
                  <select
                    value={exportTenantFilter}
                    onChange={e => setExportTenantFilter(e.target.value)}
                    className="input-field text-sm w-full appearance-none pr-8"
                    disabled={tenantsLoading}
                  >
                    <option value="">All tenants</option>
                    {tenants.map(t => (
                      <option key={t.tenantId} value={t.tenantId}>{t.name} ({t.tenantId.slice(0, 8)})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Export button */}
            <div className="glass p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-brand-400" />
                  <span className="text-sm text-white font-medium">Export {dataType}</span>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {exporting ? 'Loading...' : 'Preview Export'}
                </button>
              </div>
            </div>

            {/* Export preview */}
            {exportPreview && exportMeta && (
              <div className="glass p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Export Preview</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{exportMeta.count} records | {exportMeta.exportedAt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                    <button onClick={downloadJson} className="btn-primary flex items-center gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" />
                      Download JSON
                    </button>
                  </div>
                </div>

                {/* Preview table */}
                {exportPreview.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No records found</p>
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          {Object.keys(exportPreview[0] as Record<string, unknown>).slice(0, 6).map(k => (
                            <th key={k} className="text-left py-2 px-3 text-slate-500 font-medium whitespace-nowrap">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {exportPreview.slice(0, 20).map((row, i) => (
                          <tr key={i} className="hover:bg-white/3">
                            {Object.values(row as Record<string, unknown>).slice(0, 6).map((v, j) => (
                              <td key={j} className="py-2 px-3 text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '--')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {exportPreview.length > 20 && (
                      <p className="text-xs text-slate-600 text-center py-2">Showing first 20 of {exportPreview.length} records</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
