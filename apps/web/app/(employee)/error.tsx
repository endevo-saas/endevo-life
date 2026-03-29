'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Employee Error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full glass p-8 text-center rounded-2xl">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Page Error</h2>
        <p className="text-slate-400 text-sm mb-1">Something went wrong loading this page.</p>
        <p className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-6 break-all">
          {error.message || 'Unexpected error'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <a
            href="/employee/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm transition-all"
          >
            <Home className="w-4 h-4" /> Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
