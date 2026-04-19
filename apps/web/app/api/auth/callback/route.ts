import { NextRequest, NextResponse } from 'next/server'

// OAuth callback is no longer used — authentication is email OTP via Cognito custom auth.
// This route is retained to avoid 404s from any cached links.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/login', req.url))
}
