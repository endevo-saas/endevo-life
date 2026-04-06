/**
 * WorkOS auth utility for SSO and AuthKit integration.
 *
 * Dormant until NEXT_PUBLIC_WORKOS_CLIENT_ID env var is set.
 */

const WORKOS_CLIENT_ID = process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID || ''

export function isWorkOSConfigured(): boolean {
  return !!WORKOS_CLIENT_ID
}

/**
 * Initiate SSO login by calling the backend /api/auth/workos/login endpoint
 * which returns the WorkOS authorization URL.
 */
export async function initiateWorkOSLogin(): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/callback`
    : ''

  const res = await fetch(
    `${API_URL}/api/auth/workos/login?redirect_uri=${encodeURIComponent(redirectUri)}`
  )
  const data = await res.json()

  if (data.url) {
    window.location.href = data.url
  } else {
    throw new Error('Failed to get SSO login URL')
  }
}

/**
 * Build the WorkOS authorization URL directly (client-side fallback).
 */
export function getWorkOSLoginUrl(): string {
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/callback`
    : ''

  return (
    `https://api.workos.com/sso/authorize?` +
    new URLSearchParams({
      client_id: WORKOS_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      provider: 'authkit',
    }).toString()
  )
}
