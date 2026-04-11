# Deployment Readiness Checklist — Employee Dashboard v1

**Status:** PRODUCTION DEPLOYMENT  
**Date:** 2026-04-11  
**Features:** 7 new employee features (Assessment, Playbook, Checklist, Master Classes, 1:1 Sessions + dashboards)

---

## 1. CODE QUALITY & TYPE SAFETY ✅ / ⚠️

### TypeScript Strictness
- [ ] No `any` types in new code (use `unknown` with type narrowing)
- [ ] All React component props have `interface` definitions
- [ ] All API responses have explicit types
- [ ] tsconfig.json has `strict: true`

**Files to verify:**
- `apps/web/app/(employee)/employee/dashboard/page.tsx` ✅ (verified)
- `apps/web/app/(employee)/employee/sessions/page.tsx` ✅ (verified)
- `apps/web/app/(employee)/employee/checklist/page.tsx` ✅ (verified)
- `apps/web/app/(employee)/employee/lms/assessment/page.tsx` (needs verification)
- `apps/web/app/(global-admin)/admin/dashboard/page.tsx` ✅ (verified)
- `apps/web/app/(hr-admin)/hr/dashboard/page.tsx` ✅ (verified)

### No Hardcoded Secrets
- [ ] No API keys in code
- [ ] No hardcoded URLs (use `process.env`)
- [ ] **⚠️ CRITICAL:** Line 659 in employee dashboard has hardcoded Calendly link
  ```typescript
  href="https://link.endevo.life/widget/booking/HUYkq6QZs0fI7AMtt6qH"
  ```
  **Action Required:** Move to environment variable `NEXT_PUBLIC_BOOKING_LINK`

### No console.log in Production
- [ ] Verify no `console.log`, `console.error`, `console.warn` left in code
- [ ] Use proper logging library (Sentry/Pino) for server-side

---

## 2. ERROR HANDLING & VALIDATION ✅ / ❌

### API Error Handling
- [ ] All `apiFetch()` calls wrapped in try-catch
- [ ] User-friendly error messages (no raw stack traces)
- [ ] Error recovery/retry logic where applicable
- [ ] Network timeout handling (>10s)

**Verification:**
```typescript
// ✅ GOOD: Try-catch with fallback
try {
  const result = await apiFetch(...)
  setData(result)
} catch (e: unknown) {
  setError(e instanceof Error ? e.message : 'Failed to load')
}

// ❌ BAD: Unhandled promise rejection
apiFetch(...).then(setData)
```

### Form Validation
- [ ] All form inputs validated before submission
- [ ] Clear validation error messages
- [ ] Required fields marked
- [ ] Email/date format validation

**Files to check:**
- Session booking form (date validation)
- Transcript submission form (required text)
- Assessment form (40 questions validation)

### Null/Undefined Safety
- [ ] Optional chaining (`?.`) used appropriately
- [ ] Null checks before accessing properties
- [ ] No forced non-null assertions (`!`)

---

## 3. FEATURE COMPLETENESS ✅ / ⚠️

### 7 Features Verified Working

#### 1️⃣ Assessment (Domain-Wise)
- [ ] 40 questions load correctly
- [ ] Domain scores calculate accurately
- [ ] Retake button works
- [ ] Results persist in DB
- [ ] Passing test case: Submit assessment → See domain breakdown

#### 2️⃣ Playbook (Interactive Guides)
- [ ] Route `/employee/playbook` exists
- [ ] Domain-specific content loads
- [ ] Responsive on mobile/desktop
- [ ] Passing test case: Open playbook → See legal/financial/physical/digital guides

#### 3️⃣ Checklist (Task Tracking)
- [ ] Tasks load per domain
- [ ] Completion toggles work
- [ ] Progress ring animates
- [ ] Milestone celebrations trigger (25%, 50%, 75%, 100%)
- [ ] Passing test case: Mark task complete → Progress updates

#### 4️⃣ Master Classes (Video Library)
- [ ] Route `/employee/master-classes` exists
- [ ] Videos load with thumbnails
- [ ] Playback works (embedded player)
- [ ] Organized by domain/category
- [ ] Passing test case: Play video → Resume on return

#### 5️⃣ 1:1 Sessions (Coach Bookings)
- [ ] Calendly widget loads (`NEXT_PUBLIC_BOOKING_LINK`)
- [ ] Sessions appear in `/employee/sessions`
- [ ] Transcript submission works
- [ ] Session status updates (scheduled → completed)
- [ ] Passing test case: Book session → Submit transcript → Mark completed

#### 6️⃣ Dashboard (Employee)
- [ ] Learning Tools section displays all 5 features
- [ ] Animations smooth (no janky transitions)
- [ ] Quick actions respond correctly
- [ ] Assessment banner shows correctly (pre/post-attempt)
- [ ] Premium card shows for premium users
- [ ] Passing test case: Load dashboard → See all 7 features

#### 7️⃣ Admin Dashboards
- [ ] Super Admin dashboard shows feature metrics
- [ ] HR Admin dashboard shows team adoption rates
- [ ] Links to `/admin/lms/progress` work
- [ ] Passing test case: Login as admin → See new features section

---

## 4. CROSS-FEATURE INTEGRATION ✅ / ❌

### Feature Dependencies
- [ ] Assessment → Checklist sync
  - [ ] After assessment, checklist shows domain-specific tasks
  - [ ] Test: Complete assessment → Open checklist → Domain tasks appear
  
- [ ] Assessment → Playbook recommendations
  - [ ] Low-scoring domains get recommended playbook sections
  - [ ] Test: Score <50% in Financial → Playbook highlights Financial guides

- [ ] Session booking → Session list
  - [ ] Booked session appears in session list immediately
  - [ ] Test: Book session → Refresh → Session visible in `/employee/sessions`

- [ ] Dashboard → Feature pages
  - [ ] All Learning Tools links navigate correctly
  - [ ] Test: Click Assessment card → Load `/employee/lms/assessment`

---

## 5. PERFORMANCE & LOAD TIMES ✅ / ❌

### Dashboard Load Targets
- [ ] Employee dashboard: <2s First Contentful Paint (FCP)
- [ ] Admin dashboard: <2s FCP
- [ ] Assessment page: <3s (40 questions)
- [ ] No layout shift (CLS < 0.1)

### Optimization Checklist
- [ ] Lazy loading on images
- [ ] Code splitting for routes
- [ ] No N+1 API calls
- [ ] Memoization on expensive components
- [ ] Database queries optimized

---

## 6. DATA INTEGRITY & DATABASE ✅ / ⚠️

### DynamoDB Schema Validation
- [ ] Assessment results stored correctly
  - [ ] PK: `userId#assessment`, SK: `attemptNumber`
  - [ ] Data: `overallScore`, `domainScores`, `submittedAt`

- [ ] Session records created properly
  - [ ] PK: `userId#session`, SK: `sessionId`
  - [ ] Status transitions valid: `scheduled` → `in_progress` → `completed`
  - [ ] Transcript stored and retrievable

- [ ] User preferences/progress tracked
  - [ ] Checklist completion persists
  - [ ] Session count increments correctly

### Data Consistency
- [ ] No duplicate records on retry
- [ ] Transactions atomic (assessment save + checklist update)
- [ ] Soft deletes where applicable (no hard deletes)

---

## 7. SECURITY & AUTHORIZATION ⚠️

### Authentication
- [ ] Cognito tokens validated on all API calls
- [ ] Token expiry handled (refresh flow)
- [ ] User ID verified before returning personal data

### Authorization
- [ ] Employees can only view/edit own assessments
- [ ] Employees cannot access other users' sessions
- [ ] Admins have separate permission scope
- [ ] Test: Login as User A → Try to access User B's data → Denied

### Secrets & Environment Variables
- [ ] `NEXT_PUBLIC_BOOKING_LINK` in `.env.local`
- [ ] API endpoints use environment variables
- [ ] No secrets in GitHub (check `.gitignore`)
- [ ] AWS credentials in AWS SSM, not `.env`

### Input Validation
- [ ] Date inputs validated (not future dates for past sessions)
- [ ] Transcript input sanitized (no XSS)
- [ ] Assessment answers validated (1-5 scale, not invalid values)

---

## 8. MONITORING & OBSERVABILITY ❌

### Error Tracking (Sentry)
- [ ] Sentry initialized in Next.js app
- [ ] Frontend errors reported
- [ ] Backend Lambda errors reported
- [ ] **Action Required:** Add Sentry to deployment

### Logging Strategy
- [ ] API request/response logging
- [ ] Error logging with context
- [ ] User action logging (assessments taken, sessions booked)
- [ ] CloudWatch Logs configured

### Metrics to Track
- [ ] Dashboard load time
- [ ] Assessment completion rate
- [ ] Session booking success rate
- [ ] API error rate (target: <0.5%)
- [ ] Feature adoption (% of users using each feature)

### Alerts
- [ ] Alert if assessment completion rate drops >10%
- [ ] Alert if session booking fails >1%
- [ ] Alert if dashboard load time >3s
- [ ] Alert if any API endpoint returns 5xx

---

## 9. TESTING COVERAGE ⚠️

### Unit Tests
- [ ] Assessment scoring logic (all domains)
- [ ] Checklist progress calculations
- [ ] Date/time formatting
- [ ] **Status:** Need 80%+ coverage

### Integration Tests
- [ ] Assessment → API save → DB retrieve
- [ ] Session booking → Calendly webhook → Status update
- [ ] Dashboard data fetch → Display
- [ ] **Status:** Need E2E flow tests

### E2E Tests (Playwright)
- [ ] Complete assessment flow (40 questions)
- [ ] Book 1:1 session and submit transcript
- [ ] View checklist progress
- [ ] Admin dashboard metrics update
- [ ] **Status:** See `EMPLOYEE-DASHBOARD-QA.md` for test cases

---

## 10. DEPLOYMENT CHECKLIST ⚠️

### Pre-Deployment
- [ ] All code merged to `main` branch
- [ ] All tests passing (unit + integration + E2E)
- [ ] Code review approved (no critical/high issues)
- [ ] Environment variables set in AWS SSM
- [ ] Database migrations run (none needed for this release)
- [ ] API endpoints health-checked
- [ ] Staging deployment verified

### Deployment Steps
```bash
# 1. Create git tag
git tag -a v1.0.0-employee-dashboard -m "Release: Employee Dashboard v1"
git push origin v1.0.0-employee-dashboard

# 2. CI/CD pipeline runs automatically
# - Build Next.js app
# - Run tests
# - Deploy to AWS Amplify
# - Run smoke tests

# 3. Monitor deployment
# - Check error rate (should be 0%)
# - Check dashboard load times
# - Check Sentry for errors
# - Monitor CloudWatch logs
```

### Post-Deployment (24h Monitoring)
- [ ] Error rate stays <0.5%
- [ ] No critical Sentry alerts
- [ ] Dashboard load times stable
- [ ] Session bookings completing
- [ ] User feedback monitored (Slack #qa)

---

## 11. ROLLBACK PLAN ❌

### If Critical Issue Found
```bash
# 1. Identify issue (error in Sentry, user report, metrics spike)
# 2. Revert to previous tag
git revert HEAD~1 && git push

# 3. Redeploy via Amplify
# 4. Notify team in Slack #prod

# 5. Root cause analysis
# 6. Fix in new PR
# 7. Redeploy
```

**Rollback criteria:**
- Error rate >5%
- Dashboard unavailable (>10s load)
- Data corruption detected
- Security breach

---

## 12. SIGN-OFF CHECKLIST ✅ / ⚠️

### QA Sign-Off
- [ ] All 7 features tested per `EMPLOYEE-DASHBOARD-QA.md`
- [ ] Cross-feature integration verified
- [ ] No blocking bugs found
- [ ] Performance acceptable
- **QA Person:** ________ **Date:** ________

### Security Sign-Off
- [ ] No hardcoded secrets
- [ ] Authorization checks in place
- [ ] Input validation working
- [ ] OWASP Top 10 reviewed
- **Security Reviewer:** ________ **Date:** ________

### Product Sign-Off
- [ ] All 7 features match requirements
- [ ] UI/UX acceptable
- [ ] Admin dashboards useful
- [ ] Ready for customer test
- **Product Owner (Niki):** ________ **Date:** ________

### DevOps Sign-Off
- [ ] Infrastructure ready (Amplify, Lambda, DynamoDB)
- [ ] Monitoring configured (Sentry, CloudWatch)
- [ ] Backups verified
- [ ] Disaster recovery plan in place
- **DevOps/Architect:** ________ **Date:** ________

---

## CRITICAL BLOCKING ISSUES 🚨

| Issue | Status | Owner | Due |
|-------|--------|-------|-----|
| Hardcoded Calendly link (line 659) | ⚠️ BLOCKING | Dev | NOW |
| Sentry error tracking | ❌ MISSING | DevOps | Before prod |
| E2E tests for all 7 features | ⚠️ PARTIAL | QA | Before prod |
| Rollback procedure documented | ❌ MISSING | DevOps | Before prod |
| 24h post-deploy monitoring plan | ⚠️ DRAFT | Ops | Before prod |

---

## NEXT STEPS

1. **Fix hardcoded Calendly link** → Move to env var
2. **Add Sentry integration** → Error tracking
3. **Run full E2E test suite** → Verify all features
4. **Deploy to staging** → Final validation
5. **Execute 24h monitoring** → Watch metrics
6. **Production deployment** → Release to live

**Estimated Timeline:**
- Hardcoded link fix: 10 min
- Sentry setup: 30 min
- E2E tests: 2 hours
- Staging deploy: 15 min
- Monitoring period: 24 hours
- **Total: ~4 hours until prod release**
