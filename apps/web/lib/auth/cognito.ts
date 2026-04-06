import Cookies from 'js-cookie'

export function signOut() {
  Cookies.remove('access_token')
  Cookies.remove('id_token')
  Cookies.remove('user_role')
  Cookies.remove('tenant_name')
  Cookies.remove('first_name')
  Cookies.remove('last_name')
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
