import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const COOKIE_OPTS = { expires: 1, sameSite: 'strict' as const }

export function signOut() {
  const accessToken = Cookies.get('access_token')
  Cookies.remove('access_token')
  Cookies.remove('id_token')
  Cookies.remove('refresh_token')
  Cookies.remove('user_role')
  Cookies.remove('user_email')
  Cookies.remove('tenant_name')
  Cookies.remove('first_name')
  Cookies.remove('last_name')
  if (accessToken) {
    fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined)
  }
  window.location.href = '/login'
}

export function getAccessToken(): string {
  return Cookies.get('access_token') || ''
}

export function getUserRole(): string {
  return Cookies.get('user_role') || ''
}

export function isAuthenticated(): boolean {
  return !!Cookies.get('access_token')
}

export async function refreshSession(): Promise<boolean> {
  const refreshToken = Cookies.get('refresh_token')
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.access_token) {
      Cookies.set('access_token', data.access_token, COOKIE_OPTS)
      if (data.id_token) Cookies.set('id_token', data.id_token, COOKIE_OPTS)
      return true
    }
    return false
  } catch {
    return false
  }
}
