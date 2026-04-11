'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: 'global' } })
  }, [error])

  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm mb-3">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error?.message && (
            <p className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-6 break-all">
              {error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 text-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <a
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-300 hover:bg-brand-600/30 text-sm transition-all"
            >
              <LogIn className="w-4 h-4" /> Back to Login
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
