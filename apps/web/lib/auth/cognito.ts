import Cookies from 'js-cookie'

const API = process.env.NEXT_PUBLIC_API_URL || ''

export async function signIn(email: string, password: string) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.error || 'Login failed')

  if (data.access_token) {
    Cookies.set('access_token', data.access_token, { expires: 1, sameSite: 'strict' })
    Cookies.set('id_token',     data.id_token,     { expires: 1, sameSite: 'strict' })
    Cookies.set('user_role',    data.role,          { expires: 1, sameSite: 'strict' })
    Cookies.set('user_email',   data.email || '',   { expires: 1, sameSite: 'strict' })
  }
  return data
}

export function signOut() {
  Cookies.remove('access_token')
  Cookies.remove('id_token')
  Cookies.remove('user_role')
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
