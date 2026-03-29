import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/signup']

const ROLE_PATHS: Record<string, string[]> = {
  GLOBAL_ADMIN: ['/admin'],
  HR_ADMIN:     ['/hr'],
  EMPLOYEE:     ['/employee'],
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('access_token')?.value
  const role  = req.cookies.get('user_role')?.value

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    if (token && pathname === '/login') {
      const dest = role === 'GLOBAL_ADMIN' ? '/admin/dashboard'
                 : role === 'HR_ADMIN'     ? '/hr/dashboard'
                 :                           '/employee/dashboard'
      return NextResponse.redirect(new URL(dest, req.url))
    }
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Role-based access
  for (const [requiredRole, paths] of Object.entries(ROLE_PATHS)) {
    if (paths.some(p => pathname.startsWith(p)) && role !== requiredRole) {
      const dest = role === 'GLOBAL_ADMIN' ? '/admin/dashboard'
                 : role === 'HR_ADMIN'     ? '/hr/dashboard'
                 :                           '/employee/dashboard'
      return NextResponse.redirect(new URL(dest, req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
