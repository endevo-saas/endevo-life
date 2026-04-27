# HEAL CHECK 3 — All login / OTP files

## All page.tsx under apps/ (auth routes)

- `apps/web/app/(auth)/login/page.tsx`  ← the one we edit
- `apps/web/app/(auth)/register/page.tsx`
- `apps/web/app/(auth)/status/page.tsx`
- `apps/web/app/signup/page.tsx`

Only **one** `(auth)/login/page.tsx` exists in the app route tree.

## Duplicate login page — but OUTSIDE the build

```
./apps/web/app/(auth)/login/page.tsx              ← current, correct (session)
./push-temp/endevo-life/apps/web/app/(auth)/login/page.tsx  ← stale copy (otp_ref)
```

`push-temp/` is a scratch clone from 2026-04-18, untracked (`?? push-temp/` in git status).
Not on the Amplify build path, not indexed by Next.js — irrelevant to the prod bundle.

## grep otp_ref / otpSession / verify-otp in live source

```
apps/web/app/(auth)/login/page.tsx:14:  session: string
apps/web/app/(auth)/login/page.tsx:154:  const [otpSession, setOtpSession] = useState('')
apps/web/app/(auth)/login/page.tsx:221:  body: JSON.stringify({ email, session: otpSession, code: otpCode }),
apps/web/app/(auth)/login/page.tsx:248:  }, [email, otpCode, otpSession, expiryCountdown, router])
apps/web/lib/api.ts:99:  verifyOtp: (email: string, session: string, code: string) =>
apps/web/lib/api.ts:100:  apiFetch('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, session, code }) }),
```

**Zero occurrences of `otp_ref`** anywhere under `apps/` — the fix is clean in the working tree.

## Hypothesis: two login pages → Next.js routes to stale

**REJECTED.** No duplicate login page in the route tree. The stale copy sits in
`push-temp/` which is outside the Next.js `app/` root and excluded from builds.
