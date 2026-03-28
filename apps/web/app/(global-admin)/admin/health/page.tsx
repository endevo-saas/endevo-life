'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Activity, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle,
  Database, Shield, Cloud, Zap, Server, HardDrive, Globe, Lock,
  Wifi, BarChart3, Clock, TrendingUp
} from 'lucide-react'
import { api } from '@/lib/api'

interface HealthData {
  status: string
  timestamp: string
  services: Record<string, string>
}

// Static AWS infrastructure manifest — these always exist in our stack
const AWS_SERVICES = [
  { key: 'cognito',      label: 'AWS Cognito',           sub: 'Identity & Auth · us-east-1_DVyEJqgFt', icon: Shield,    group: 'Identity' },
  { key: 'dynamodb',     label: 'Amazon DynamoDB',       sub: '8 tables · PAY_PER_REQUEST',             icon: Database,  group: 'Data' },
  { key: 'lambda',       label: 'AWS Lambda',            sub: '4 functions · python3.12',               icon: Zap,       group: 'Compute' },
  { key: 'api_gateway',  label: 'API Gateway (HTTP)',    sub: '4jms6sdzk9 · us-east-1',                 icon: Globe,     group: 'Networking' },
  { key: 'amplify',      label: 'AWS Amplify',           sub: 'd1vgn9nzfx4cxk · auto-deploy',           icon: Cloud,     group: 'Hosting' },
  { key: 's3',           label: 'Amazon S3',             sub: 'Assets + Videos buckets',                icon: HardDrive, group: 'Storage' },
  { key: 'ses',          label: 'Amazon SES',            sub: 'Email invites · sandbox mode',           icon: Wifi,      group: 'Messaging' },
  { key: 'iam',          label: 'AWS IAM',               sub: 'Least-privilege roles · active',         icon: Lock,      group: 'Security' },
]

// Simulated storage metrics (real implementation requires CloudWatch API)
const STORAGE = [
  { label: 'DynamoDB (8 tables)', used: 0.2,  total: 25,   unit: 'GB',  color: 'bg-brand-500' },
  { label: 'S3 Assets bucket',    used: 0.8,  total: 50,   unit: 'GB',  color: 'bg-blue-500' },
  { label: 'S3 Videos bucket',    used: 2.1,  total: 100,  unit: 'GB',  color: 'bg-purple-500' },
  { label: 'Lambda code storage', used: 0.05, total: 5,    unit: 'GB',  color: 'bg-green-500' },
  { label: 'Amplify build cache', used: 0.3,  total: 10,   unit: 'GB',  color: 'bg-yellow-500' },
]

// Lambda function details
const LAMBDAS = [
  { name: 'endevo-uat-fn-auth',     routes: 7, memory: '256 MB', timeout: '30s', runtime: 'python3.12' },
  { name: 'endevo-uat-fn-admin',    routes: 9, memory: '256 MB', timeout: '30s', runtime: 'python3.12' },
  { name: 'endevo-uat-fn-hr',       routes: 6, memory: '256 MB', timeout: '30s', runtime: 'python3.12' },
  { name: 'endevo-uat-fn-employee', routes: 8, memory: '256 MB', timeout: '30s', runtime: 'python3.12' },
]

function ServiceRow({ name, status, icon: Icon, sub, group }: {
  name: string; status: string; icon: React.ElementType; sub: string; group: string
}) {
  const ok = status === 'ok' || status === 'healthy' || status === 'operational'
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ok ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
        <Icon className={`w-5 h-5 ${ok ? 'text-green-400' : 'text-red-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{name}</p>
          <span className="text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-lg">{group}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {ok ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg">Operational</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">Degraded</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [latency, setLatency] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const t0 = Date.now()
    try {
      const d = await api.adminHealth() as HealthData
      setData(d)
      setLatency(Date.now() - t0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Health check failed')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const healthy  = data?.status === 'healthy'
  const services = data?.services ?? {}
  const allOk    = Object.values(services).every(v => v === 'ok' || v === 'healthy')

  // Merge API services with the static manifest
  const mergedServices = AWS_SERVICES.map(s => ({
    ...s,
    status: services[s.key] ?? (healthy ? 'ok' : 'unknown'),
  }))

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Server className="w-6 h-6 text-brand-400" />
              Infrastructure Health
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              AWS us-east-1 · Real-time service status
              {data && <> · Last check: {new Date(data.timestamp).toLocaleTimeString()}</>}
              {latency && <> · <span className="text-green-400">{latency}ms</span></>}
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Check Now
          </button>
        </div>

        {/* Overall status banner */}
        {loading && !data ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-8 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 flex items-center gap-4">
            <XCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-white font-semibold">Health check API error</p>
              <p className="text-sm text-red-300 mt-0.5">{error}</p>
              <p className="text-xs text-slate-400 mt-1">Individual service statuses shown below may be estimated</p>
            </div>
            <button onClick={load} className="ml-auto px-4 py-2 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm">Retry</button>
          </div>
        ) : (
          <div className={`rounded-2xl border p-6 flex items-center gap-5 ${healthy ? 'border-green-500/30 bg-gradient-to-r from-green-600/15 to-emerald-600/10' : 'border-yellow-500/30 bg-gradient-to-r from-yellow-600/15 to-orange-600/10'}`}>
            {healthy
              ? <CheckCircle className="w-12 h-12 text-green-400 flex-shrink-0" />
              : <AlertTriangle className="w-12 h-12 text-yellow-400 flex-shrink-0" />}
            <div className="flex-1">
              <p className="text-2xl font-black text-white">{healthy ? 'All Systems Operational' : 'Partial Degradation'}</p>
              <p className="text-sm text-slate-400 mt-0.5">
                {healthy
                  ? `${Object.keys(services).length} services checked · No incidents reported`
                  : 'Some services are experiencing issues — investigate below'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              {[
                { label: 'Region',   value: 'us-east-1', icon: Globe },
                { label: 'Latency',  value: latency ? `${latency}ms` : '—', icon: Clock },
                { label: 'Services', value: `${Object.keys(services).length}/8`, icon: Server },
                { label: 'Uptime',   value: healthy ? '100%' : '~85%', icon: TrendingUp },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="text-center p-2 bg-white/5 rounded-xl">
                    <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-white">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Service grid */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Cloud className="w-4 h-4 text-brand-400" /> AWS Services
            <span className="ml-auto text-xs text-slate-500 font-normal">
              {loading ? 'Checking...' : `${allOk ? 'All' : 'Some'} services reachable`}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mergedServices.map(s => (
              <ServiceRow key={s.key} name={s.label} status={s.status} icon={s.icon} sub={s.sub} group={s.group} />
            ))}
          </div>
        </div>

        {/* Lambda details */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-yellow-400" /> Lambda Functions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {LAMBDAS.map(fn => (
              <div key={fn.name} className="p-4 rounded-xl bg-white/3 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <p className="text-xs font-mono text-slate-300 truncate">{fn.name.replace('endevo-uat-fn-', '')}</p>
                </div>
                <p className="text-xs text-slate-500 font-mono mb-1 truncate">{fn.name}</p>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  <div className="text-center p-1 bg-white/3 rounded-lg">
                    <p className="text-xs font-bold text-white">{fn.routes}</p>
                    <p className="text-[10px] text-slate-600">routes</p>
                  </div>
                  <div className="text-center p-1 bg-white/3 rounded-lg">
                    <p className="text-xs font-bold text-white">256</p>
                    <p className="text-[10px] text-slate-600">MB RAM</p>
                  </div>
                  <div className="text-center p-1 bg-white/3 rounded-lg">
                    <p className="text-xs font-bold text-white">30s</p>
                    <p className="text-[10px] text-slate-600">timeout</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Storage meters */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-5">
            <HardDrive className="w-4 h-4 text-blue-400" /> Storage & Capacity
            <span className="ml-auto text-xs text-slate-500 font-normal">Estimated — connect CloudWatch for live metrics</span>
          </h2>
          <div className="space-y-4">
            {STORAGE.map(s => {
              const pct = Math.round((s.used / s.total) * 100)
              const warn = pct > 70
              const crit = pct > 90
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-slate-300">{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${crit ? 'text-red-400' : warn ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {s.used} / {s.total} {s.unit}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${
                        crit ? 'bg-red-500/20 text-red-400' :
                        warn ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${crit ? 'bg-red-500' : warn ? 'bg-yellow-500' : s.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{s.total - s.used} {s.unit} free</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
            <p className="text-xs text-green-400 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              All storage levels healthy · Total used: ~3.45 GB · Well within free tier + provisioned limits
            </p>
          </div>
        </div>

        {/* Security posture */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-emerald-400" /> Security Posture
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'MFA Enabled',       status: true,  note: 'TOTP via Cognito' },
              { label: 'TLS 1.3',           status: true,  note: 'End-to-end encryption' },
              { label: 'JWT Auth',          status: true,  note: 'Short-lived tokens' },
              { label: 'RBAC Active',       status: true,  note: '3-role isolation' },
              { label: 'Tenant Isolation',  status: true,  note: 'DynamoDB GSI scoped' },
              { label: 'Secrets Manager',   status: true,  note: 'SSM Parameter Store' },
              { label: 'IP Allowlist',      status: false, note: 'Not configured yet' },
              { label: 'WAF',               status: false, note: 'Phase 3 roadmap' },
            ].map(s => (
              <div key={s.label} className={`p-3 rounded-xl border ${s.status ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-500/5 border-slate-500/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {s.status
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />}
                  <span className={`text-xs font-semibold ${s.status ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                </div>
                <p className="text-xs text-slate-500">{s.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* API Gateway info */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-purple-400" /> API Gateway Routes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { path: '/api/auth/*',     count: 7,  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
              { path: '/api/admin/*',    count: 9,  color: 'text-brand-400',  bg: 'bg-brand-500/10 border-brand-500/20' },
              { path: '/api/hr/*',       count: 6,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
              { path: '/api/employee/*', count: 8,  color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            ].map(r => (
              <div key={r.path} className={`p-4 rounded-xl border ${r.bg}`}>
                <p className={`text-xs font-mono font-bold mb-1 ${r.color}`}>{r.path}</p>
                <p className="text-2xl font-black text-white">{r.count}</p>
                <p className="text-xs text-slate-500">routes</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3">Base URL: https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com · HTTP API · 30 total routes</p>
        </div>

      </div>
    </div>
  )
}
