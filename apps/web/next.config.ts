import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'uat.endevo.life',
        'main.d1vvfv8oltolcf.amplifyapp.com',
        'localhost:3000',
      ],
    },
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    NEXT_PUBLIC_COGNITO_REGION: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
    NEXT_PUBLIC_BOOKING_LINK: process.env.NEXT_PUBLIC_BOOKING_LINK || '',
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },
}

export default withSentryConfig(nextConfig, {
  // Do not upload source maps to Sentry servers — prevents leaking source code
  sourcemaps: {
    disable: true,
  },

  // Suppress Sentry CLI output during builds
  silent: true,

  webpack: {
    // Disable automatic instrumentation of API routes to avoid unexpected overhead
    autoInstrumentServerFunctions: false,

    // Disable automatic instrumentation of middleware
    autoInstrumentMiddleware: false,
  },
})
