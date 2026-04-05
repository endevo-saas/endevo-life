/**
 * WorkOS auth utility — runs parallel to Cognito.
 * When WorkOS is fully configured, this becomes the primary auth.
 *
 * Dormant until NEXT_PUBLIC_WORKOS_CLIENT_ID env var is set.
 */

const WORKOS_CLIENT_ID = process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID || ''
const WORKOS_REDIRECT_URI =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/callback`
    : ''

export function getWorkOSLoginUrl(): string {
  return (
    `https://api.workos.com/sso/authorize?` +
    new URLSearchParams({
      client_id: WORKOS_CLIENT_ID,
      redirect_uri: WORKOS_REDIRECT_URI,
      response_type: 'code',
      provider: 'authkit',
    }).toString()
  )
}

export function isWorkOSConfigured(): boolean {
  return !!WORKOS_CLIENT_ID
}
