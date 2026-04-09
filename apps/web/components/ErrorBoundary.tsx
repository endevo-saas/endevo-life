'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Log to console (ready for Sentry integration)
    // TODO: Replace with Sentry.captureException(error, { extra: errorInfo })
    console.error('[ErrorBoundary] Uncaught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    const isDev = process.env.NODE_ENV === 'development'

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base, #0f172a)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            padding: '48px 32px',
            borderRadius: '20px',
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: '24px' }}>
            <img
              src="/jesse/logo.png"
              alt="Endevo Life"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                margin: '0 auto',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Icon */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary, #f1f5f9)',
              margin: '0 0 8px',
              lineHeight: 1.3,
            }}
          >
            Something went wrong
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-muted, #94a3b8)',
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. Please try refreshing the page or navigating back to the dashboard.
          </p>

          {/* Error details (dev only) */}
          {isDev && this.state.error && (
            <div
              style={{
                textAlign: 'left',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                marginBottom: '24px',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#ef4444',
                  margin: '0 0 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Error Details (dev only)
              </p>
              <pre
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary, #cbd5e1)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {'\n\nComponent Stack:'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => {
                this.resetErrorBoundary()
                window.location.reload()
              }}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--accent-1, #6366f1)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              Refresh Page
            </button>

            <a
              href="/employee/dashboard"
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                background: 'transparent',
                color: 'var(--text-secondary, #cbd5e1)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Go to Dashboard
            </a>
          </div>

          {/* Branding */}
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted, #64748b)',
              marginTop: '32px',
              marginBottom: 0,
            }}
          >
            Endevo Life &mdash; Legacy Readiness OS
          </p>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
