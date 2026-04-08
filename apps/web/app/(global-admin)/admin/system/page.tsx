'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Activity, Loader2, AlertCircle, RefreshCw, CheckCircle,
  Database, Cpu, Mail, Clock, HardDrive, Zap
} from 'lucide-react'
import { api, SystemStatus, TableStatus, LambdaStatus } from '@/lib/api'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'healthy' || s === 'enabled' || s === 'successful') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-500/15 text-green-400 border border-green-500/20"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{status}</span>
  }
  if (s === 'degraded' || s === 'warning' || s === 'updating') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />{status}</span>
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500/15 text-red-400 border border-red-500/20"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{status}</span>
}

function overallBadge(overall: string) {
  if (overall === 'healthy') {
    return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold bg-green-500/15 text-green-400 border border-green-500/20"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />All Systems Operational</span>
  }
  if (overall === 'degraded') {
    return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />Degraded Performance</span>
  }
  return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/20"><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />Outage Detected</span>
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(prev => prev); setError('')
    try {
      const res = await api.adminSystemStatus()
      setStatus(res)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load system status')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 30000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, load])

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">System Status</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Real-time infrastructure monitoring
              {lastRefresh && <span className="text-slate-600 ml-2">Last checked: {lastRefresh.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/30"
              />
              Auto-refresh (30s)
            </label>
            <button onClick={() => { setLoading(true); load() }} disabled={loading} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {loading && !status ? (
          <div className="glass p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
        ) : !status ? (
          <div className="glass p-16 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Unable to fetch system status</p>
            <button onClick={() => { setLoading(true); load() }} className="mt-3 btn-primary text-sm">Retry</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall status */}
            <div className="glass p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-400" />
                <span className="text-sm text-white font-medium">Overall Health</span>
              </div>
              {overallBadge(status.overall)}
            </div>

            {/* DynamoDB */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">DynamoDB Tables</h2>
                <span className="text-xs text-slate-500">({status.dynamodb.activeTables}/{status.dynamodb.totalTables} active)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {status.dynamodb.tables.map((t: TableStatus) => (
                  <div key={t.name} className="glass p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-white truncate flex-1 mr-2" title={t.name}>
                        {t.name.replace(/^endevo-uat-/, '')}
                      </p>
                      {statusBadge(t.status)}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{t.itemCount.toLocaleString()} items</span>
                      <span>{formatBytes(t.sizeBytes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lambda */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">Lambda Functions</h2>
                <span className="text-xs text-slate-500">({status.lambda.totalFunctions} total)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {status.lambda.functions.map((fn: LambdaStatus) => (
                  <div key={fn.name} className="glass p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-white truncate flex-1 mr-2" title={fn.name}>
                        {fn.name.replace(/^endevo-uat-/, '')}
                      </p>
                      {statusBadge(fn.status)}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                      {fn.runtime && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{fn.runtime}</span>}
                      {fn.memoryMB && <span>{fn.memoryMB} MB</span>}
                      {fn.timeoutSec && <span><Clock className="w-3 h-3 inline mr-0.5" />{fn.timeoutSec}s</span>}
                    </div>
                    {fn.lastModified && (
                      <p className="text-[10px] text-slate-600 mt-1">Modified: {formatDate(fn.lastModified)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SES */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">SES Email Service</h2>
              </div>
              <div className="glass p-4 flex items-center justify-between">
                <span className="text-sm text-slate-300">Sending Status</span>
                {statusBadge(status.ses.status)}
              </div>
            </div>

            {/* Checked at */}
            <div className="text-center">
              <p className="text-[10px] text-slate-600">
                Status checked at: {formatDate(status.checkedAt)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
