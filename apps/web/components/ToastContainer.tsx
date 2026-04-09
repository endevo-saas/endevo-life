'use client'

import React, { useEffect, useState, useCallback } from 'react'

export type ToastType = 'error' | 'warning' | 'success' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  createdAt: number
}

const TOAST_DURATION = 5000
const MAX_TOASTS = 5

// Global toast state — accessible from non-React code (e.g., apiFetch)
let globalAddToast: ((message: string, type: ToastType) => void) | null = null

export function showToast(message: string, type: ToastType = 'error'): void {
  if (globalAddToast) {
    globalAddToast(message, type)
  }
}

// Attach to window for access from anywhere
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__endevoShowToast = showToast
}

const iconsByType: Record<ToastType, string> = {
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  success: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
}

const colorsByType: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  error: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: '#ef4444',
    text: '#fca5a5',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: '#f59e0b',
    text: '#fcd34d',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.3)',
    icon: '#22c55e',
    text: '#86efac',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: '#3b82f6',
    text: '#93c5fd',
  },
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => {
      const updated = [...prev, { id, message, type, createdAt: Date.now() }]
      // Keep only the most recent toasts
      return updated.slice(-MAX_TOASTS)
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Register the global toast function
  useEffect(() => {
    globalAddToast = addToast
    return () => {
      globalAddToast = null
    }
  }, [addToast])

  // Auto-dismiss toasts after TOAST_DURATION
  useEffect(() => {
    if (toasts.length === 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => now - t.createdAt < TOAST_DURATION))
    }, 500)

    return () => clearInterval(interval)
  }, [toasts.length])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '420px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const colors = colorsByType[toast.type]
        const iconPath = iconsByType[toast.type]

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              animation: 'toastSlideIn 0.3s ease-out',
              pointerEvents: 'auto',
            }}
          >
            {/* Icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={colors.icon}
              style={{ flexShrink: 0, marginTop: '1px' }}
            >
              <path d={iconPath} />
            </svg>

            {/* Message */}
            <p
              style={{
                flex: 1,
                margin: 0,
                fontSize: '13px',
                fontWeight: 500,
                lineHeight: 1.5,
                color: colors.text,
              }}
            >
              {toast.message}
            </p>

            {/* Dismiss button */}
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: 1,
                color: colors.text,
                opacity: 0.6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6'
              }}
              aria-label="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}

      {/* Animation keyframes */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
