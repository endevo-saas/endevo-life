# HEAL CHECK 5 — Hidden Next.js / Amplify configs

## Files found (excluding node_modules, .next)

```
./amplify.yml
./apps/web/next.config.ts
./push-temp/endevo-life/amplify.yml          (scratch clone, not in build)
./push-temp/endevo-life/apps/web/next.config.ts  (scratch clone, not in build)
```

No `.amplifyrc`, no alternative `next.config.js/mjs`.

## `apps/web/next.config.ts` (full)

```ts
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
    NEXT_PUBLIC_API_URL: ...,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: ...,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: ...,
    NEXT_PUBLIC_COGNITO_REGION: ...,
    NEXT_PUBLIC_BOOKING_LINK: ...,
    NEXT_PUBLIC_SENTRY_DSN: ...,
  },
}

export default withSentryConfig(nextConfig, {
  sourcemaps: { disable: true },
  silent: true,
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
  },
})
```

## Analysis

- No custom webpack `alias` — cannot be re-routing `(auth)/login/page` to another file.
- No `outputFileTracingRoot` / `outputFileTracingIncludes` — not pulling extra sources.
- `output: 'standalone'` is standard for Amplify WEB_COMPUTE, no side effect here.
- Sentry wrapper is innocuous (only source-map and instrumentation toggles).

**No config-based re-route, alias, or include that would explain the stale bundle.**
