import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',

  environment: process.env.NODE_ENV,

  // Capture 20% of transactions for performance monitoring
  tracesSampleRate: 0.2,

  // Capture 10% of sessions for session replays
  replaysSessionSampleRate: 0.1,

  // Capture 100% of sessions where an error occurred
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all form inputs — prevents PII leakage
      maskAllInputs: true,
      blockAllMedia: false,
    }),
  ],

  // Only send events when a DSN is configured (skips dev unless DSN is set)
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Strip sensitive headers and cookies from captured requests
  beforeSend(event) {
    if (event.request) {
      const { headers, cookies, ...safeRequest } = event.request
      event.request = safeRequest
    }
    return event
  },
})

// Required by @sentry/nextjs to instrument client-side navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
