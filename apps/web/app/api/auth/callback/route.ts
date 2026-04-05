import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', req.url))
  }

  try {
    // Exchange code with our auth Lambda
    const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
    const res = await fetch(`${API_URL}/api/auth/workos/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    const data = await res.json()

    if (!res.ok || !data.access_token) {
      return NextResponse.redirect(new URL('/login?error=auth_failed', req.url))
    }

    // Set cookies and redirect to appropriate dashboard
    const response = NextResponse.redirect(new URL(getRedirectPath(data.role), req.url))

    response.cookies.set('access_token', data.access_token, {
      httpOnly: false, // For now — matches existing Cognito pattern
      secure: true,
      sameSite: 'strict',
      maxAge: 3600, // 1 hour
    })
    response.cookies.set('user_role', data.role, { secure: true, sameSite: 'strict', maxAge: 3600 })
    response.cookies.set('user_email', data.email, { secure: true, sameSite: 'strict', maxAge: 3600 })
    response.cookies.set('tenant_name', data.tenant_name || '', { secure: true, sameSite: 'strict', maxAge: 3600 })
    response.cookies.set('first_name', data.first_name || '', { secure: true, sameSite: 'strict', maxAge: 3600 })
    response.cookies.set('auth_provider', 'workos', { secure: true, sameSite: 'strict', maxAge: 3600 })

    return response
  } catch {
    return NextResponse.redirect(new URL('/login?error=server_error', req.url))
  }
}

function getRedirectPath(role: string): string {
  switch (role) {
    case 'GLOBAL_ADMIN': return '/admin/dashboard'
    case 'HR_ADMIN': return '/hr/dashboard'
    default: return '/employee/dashboard'
  }
}
