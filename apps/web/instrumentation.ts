export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs')
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.2,
      enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      beforeSend(event) {
        if (event.request) {
          const { headers, cookies, ...safeRequest } = event.request
          event.request = safeRequest
        }
        return event
      },
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@sentry/nextjs')
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    })
  }
}

// Required by @sentry/nextjs to capture errors from nested React Server Components
export async function onRequestError(
  error: unknown,
  request: unknown,
  context: unknown
): Promise<void> {
  const { captureRequestError } = await import('@sentry/nextjs')
  captureRequestError(
    error as Parameters<typeof captureRequestError>[0],
    request as Parameters<typeof captureRequestError>[1],
    context as Parameters<typeof captureRequestError>[2]
  )
}
