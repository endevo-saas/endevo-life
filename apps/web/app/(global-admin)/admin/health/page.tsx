'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

interface HealthData {
  status: string
  timestamp: string
  services: Record<string, string>
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const d = await api.adminHealth() as HealthData
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Health check failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-brand-400" />
              System Health
            </h1>
            {data && <p className="text-slate-400 text-sm mt-1">Last checked: {new Date(data.timestamp).toLocaleString()}</p>}
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading && !data ? (
          <div className="glass p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          </div>
        ) : error ? (
          <div className="glass p-6 border border-red-500/30">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400" />
              <div>
                <div className="text-white font-medium">Health check failed</div>
                <div className="text-sm text-slate-400">{error}</div>
              </div>
            </div>
          </div>
        ) : data && (
          <>
            {/* Overall status */}
            <div className={`glass p-6 mb-6 border ${data.status === 'healthy' ? 'border-green-500/30' : 'border-red-500/30'}`}>
              <div className="flex items-center gap-4">
                {data.status === 'healthy'
                  ? <CheckCircle className="w-10 h-10 text-green-400" />
                  : <XCircle className="w-10 h-10 text-red-400" />}
                <div>
                  <div className="text-2xl font-bold text-white capitalize">{data.status}</div>
                  <div className="text-sm text-slate-400">All systems operational</div>
                </div>
              </div>
            </div>

            {/* Service breakdown */}
            <div className="glass p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Services</h2>
              <div className="space-y-3">
                {Object.entries(data.services).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between p-3 rounded-xl bg-white/3">
                    <div className="flex items-center gap-3">
                      {status === 'ok'
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                      <span className="text-white capitalize font-medium">{service}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      status === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
