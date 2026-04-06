# Endevo Life — Troubleshooting Guide

> Practical solutions to real problems encountered during development.
> Every issue here was actually hit — no hypotheticals.
> Last updated: 2026-04-03

---

## Table of Contents

1. [Authentication Issues](#1-authentication-issues)
2. [LMS Issues](#2-lms-issues)
3. [Deployment Issues](#3-deployment-issues)
4. [Infrastructure Issues](#4-infrastructure-issues)
5. [DNS Issues](#5-dns-issues)
6. [Multi-Region Issues](#6-multi-region-issues)
7. [Common AWS CLI Issues on Windows](#7-common-aws-cli-issues-on-windows)
8. [Quick Diagnostic Commands](#8-quick-diagnostic-commands)

---

## 1. Authentication Issues

### "Authentication required" error on any API call

**Symptom:** Frontend shows "Authentication required" toast. API returns 401.

**Root Cause:** JWT access token expired (Cognito tokens expire after 1 hour by default).

**Fix:**
1. Clear cookies: `access_token`, `id_token`, `user_role` from browser DevTools > Application > Cookies
2. Re-login at `/login`
3. If persistent, check that the Lambda is reading the token from the correct header:
   ```bash
   # Check what the Lambda receives
   aws logs tail /aws/lambda/endevo-uat-fn-auth --since 5m --format short
   ```

**Prevention:** Frontend `api.ts` should detect 401 and redirect to `/login` automatically. If it does not, check the fetch wrapper in `apps/web/lib/api.ts`.

---

### "Admin access required" — role mismatch

**Symptom:** Logged-in user gets 403 "Admin access required" on admin pages.

**Root Cause:** The user's `custom:role` in Cognito does not match what the Lambda expects. This happens when:
- User was created in DynamoDB but Cognito attribute was not set
- Role was updated in DynamoDB but not synced to Cognito
- The JWT was cached and still has the old role

**Fix:**
1. Verify the user's Cognito attributes:
   ```bash
   export MSYS_NO_PATHCONV=1
   aws cognito-idp admin-get-user \
     --user-pool-id us-east-1_DVyEJqgFt \
     --username USER_ID_HERE \
     --query "UserAttributes[?Name=='custom:role'].Value" \
     --output text
   ```
2. If the role is wrong, update it:
   ```bash
   aws cognito-idp admin-update-user-attributes \
     --user-pool-id us-east-1_DVyEJqgFt \
     --username USER_ID_HERE \
     --user-attributes Name=custom:role,Value=GLOBAL_ADMIN
   ```
3. Have the user log out and log back in to get a fresh JWT.

---

### GLOBAL_ADMIN tenantId mapping (endevo-global vs SYSTEM)

**Symptom:** GLOBAL_ADMIN user gets empty results or "tenant not found" errors.

**Root Cause:** There is a mismatch between the tenantId stored in Cognito/DynamoDB for global admins. Some code paths expect `endevo-global`, others expect `SYSTEM`. The Lambda auth decorator extracts `custom:tenantId` from the JWT and passes it downstream. If the tenant lookup table does not have a matching entry, operations that require tenant context will fail.

**Fix:**
1. Check what tenantId the GLOBAL_ADMIN has:
   ```bash
   aws cognito-idp admin-get-user \
     --user-pool-id us-east-1_DVyEJqgFt \
     --username ADMIN_USER_ID \
     --query "UserAttributes[?Name=='custom:tenantId'].Value" \
     --output text
   ```
2. Ensure the admin Lambda bypasses tenant filtering for GLOBAL_ADMIN role — the admin Lambda should not filter by tenantId at all (it reads all tenants).
3. If a specific admin operation fails, check the Lambda code for hardcoded tenant checks and ensure GLOBAL_ADMIN is excluded from tenant-scoping logic.

---

### WorkOS token not recognized

**Symptom:** After WorkOS migration, login returns 401 or "invalid token" even though WorkOS auth succeeds.

**Root Cause:** The `WORKOS_CLIENT_ID` environment variable is missing or incorrect on the Lambda function. WorkOS tokens are validated differently from Cognito tokens.

**Fix:**
1. Check the Lambda environment variables:
   ```bash
   aws lambda get-function-configuration \
     --function-name endevo-uat-fn-auth \
     --query "Environment.Variables.WORKOS_CLIENT_ID" \
     --output text
   ```
2. If missing or wrong, update it:
   ```bash
   aws lambda update-function-configuration \
     --function-name endevo-uat-fn-auth \
     --environment "Variables={WORKOS_CLIENT_ID=client_XXXXX,WORKOS_API_KEY=sk_live_XXXXX,...}" \
     --no-cli-pager
   ```
   **Warning:** The `--environment` flag replaces ALL environment variables. Always include all existing vars. Use `get-function-configuration` first to capture current values.

3. Verify the auth flow on the frontend includes the WorkOS callback route (`/auth/callback`).

---

### Cognito auth flows wiped after UpdateUserPoolClient

**Symptom:** After updating the Cognito User Pool Client (e.g., adding a callback URL), users can no longer log in. Error: `InvalidParameterException: USER_PASSWORD_AUTH flow not enabled`.

**Root Cause:** When you call `update-user-pool-client`, you must include ALL `ExplicitAuthFlows` — not just the new ones. Cognito replaces the entire list, it does not merge. If you omit `USER_PASSWORD_AUTH`, it gets removed.

**Fix:**
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_DVyEJqgFt \
  --client-id 4sbv2j6cv7jpp1oi0d16njsej1 \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH ALLOW_ADMIN_USER_PASSWORD_AUTH
```

**Prevention:** Always capture the current client config before updating:
```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_DVyEJqgFt \
  --client-id 4sbv2j6cv7jpp1oi0d16njsej1 \
  --query "UserPoolClient.ExplicitAuthFlows"
```

---

### OTP / password reset email not arriving

**Symptom:** User clicks "Forgot Password" but never receives the email.

**Root Cause (in order of likelihood):**
1. Email went to spam/junk folder (SES sandbox reputation)
2. SES sending rate exceeded (sandbox: 1 email/second, 200/day)
3. Email address has a bounce/complaint on SES suppression list
4. Cognito is configured to use SES but the "from" address is not verified

**Fix:**
1. Check spam folder first.
2. Check SES sending statistics:
   ```bash
   aws ses get-send-statistics --query "SendDataPoints[-5:]"
   ```
3. Check if the email is on the SES suppression list:
   ```bash
   aws sesv2 get-suppressed-destination --email-address user@example.com
   ```
4. Check Cognito email configuration:
   ```bash
   aws cognito-idp describe-user-pool \
     --user-pool-id us-east-1_DVyEJqgFt \
     --query "UserPool.EmailConfiguration"
   ```
5. If using SES sandbox, verify the recipient email address:
   ```bash
   aws ses verify-email-identity --email-address user@example.com
   ```

---

## 2. LMS Issues

### Modules showing empty for a tenant

**Symptom:** Employee logs in, LMS dashboard shows 0 modules or "No modules available."

**Root Cause:** LMS modules are stored in `endevo-uat-lms-modules` with a `tenantId` attribute. If the tenant has no modules seeded, the Lambda falls back to `SYSTEM` tenant modules. If SYSTEM modules also do not exist, the list is empty.

**Fix:**
1. Check what modules exist for the tenant:
   ```bash
   export MSYS_NO_PATHCONV=1
   aws dynamodb query \
     --table-name endevo-uat-lms-modules \
     --key-condition-expression "tenantId = :t" \
     --expression-attribute-values '{":t": {"S": "TENANT_ID_HERE"}}' \
     --query "Count"
   ```
2. Check SYSTEM fallback modules:
   ```bash
   aws dynamodb query \
     --table-name endevo-uat-lms-modules \
     --key-condition-expression "tenantId = :t" \
     --expression-attribute-values '{":t": {"S": "SYSTEM"}}' \
     --query "Count"
   ```
3. If both return 0, run the seed script:
   ```bash
   cd endevo-life/scripts
   python seed_lms_modules.py
   ```

---

### Video not playing — S3 presigned URL expiration

**Symptom:** Video player shows loading spinner indefinitely or returns 403 from S3.

**Root Cause:** LMS videos are served via S3 presigned URLs generated by `course.py`. These URLs expire after **4 hours**. If the user leaves the page open overnight or bookmarks the direct URL, it will expire.

**Fix:**
1. Refresh the page — the frontend re-fetches the presigned URL from the Lambda on each page load.
2. If the video still fails, check the S3 bucket and object exist:
   ```bash
   aws s3 ls s3://endevo-uat-lms-videos/MODULE_NUM/VIDEO_ID.mp4
   ```
3. Check the Lambda can generate presigned URLs (needs `s3:GetObject` permission):
   ```bash
   aws lambda get-policy --function-name endevo-uat-fn-lms 2>/dev/null || echo "No resource policy"
   ```
4. Test presigned URL generation manually:
   ```bash
   aws s3 presign s3://endevo-uat-lms-videos/1/intro.mp4 --expires-in 3600
   ```

---

### Video progress not saving

**Symptom:** User watches a video, navigates away, comes back — progress resets to 0%.

**Root Cause:** The `POST /api/lms/progress/video` endpoint uses DynamoDB `UpdateItem` with expression attribute names. If the expression has a syntax error (e.g., missing `#` prefix for reserved words), DynamoDB silently fails or throws `ValidationException`. The Lambda may be catching and swallowing the error.

**Fix:**
1. Check CloudWatch logs for the LMS Lambda:
   ```bash
   export MSYS_NO_PATHCONV=1
   aws logs filter-log-events \
     --log-group-name /aws/lambda/endevo-uat-fn-lms \
     --start-time $(date -d '30 minutes ago' +%s)000 \
     --filter-pattern "ERROR" \
     --query "events[].message" \
     --output text
   ```
2. Common DynamoDB expression errors to look for:
   - `ValidationException: Invalid UpdateExpression` — reserved word used without `#` prefix
   - `ValidationException: Value provided in ExpressionAttributeValues unused` — typo in expression variable name
   - `ConditionalCheckFailedException` — record does not exist yet and the update has a condition
3. Check that `progress.py` uses `Decimal` for numeric values (DynamoDB rejects Python `float`):
   ```python
   # WRONG: lastPosition = 45.5
   # RIGHT: lastPosition = Decimal("45.5")
   ```

---

### Quiz not loading

**Symptom:** Employee clicks "Start Quiz" but the quiz page is blank or shows "No questions found."

**Root Cause:** The quiz engine differentiates between `assessment` and `inline` question types. If the page sends `quizMode: 'quiz'` but the backend expects `'inline'`, zero questions are returned. This was BUG-004 from the LMS QA audit.

**Fix:**
1. Verify the question type in DynamoDB:
   ```bash
   aws dynamodb scan \
     --table-name endevo-uat-questions \
     --filter-expression "tenantId = :t" \
     --expression-attribute-values '{":t": {"S": "SYSTEM"}}' \
     --projection-expression "questionId, #t" \
     --expression-attribute-names '{"#t": "type"}' \
     --query "Items[0:3]"
   ```
2. The valid types are `assessment` (for the Readiness Assessment) and `inline` (for in-video quiz popups). If the frontend is sending `quiz` instead of `inline`, update the frontend type definition in the questions page.

---

### PDF not loading in lesson viewer

**Symptom:** PDF lesson shows a blank white iframe or browser blocks it with a console error about `sandbox`.

**Root Cause:** The `<iframe>` had a `sandbox` attribute that blocked cross-origin S3 URLs. S3 presigned URLs are cross-origin by default.

**Fix:** This was fixed in commit `5946e64` — the `sandbox` attribute was removed from the PDF iframe. If the issue recurs:
1. Check that the iframe does NOT have `sandbox` attribute (or if it does, include `allow-same-origin allow-scripts`).
2. Check the S3 bucket CORS configuration:
   ```bash
   aws s3api get-bucket-cors --bucket endevo-uat-lms-assets
   ```
3. If CORS is missing:
   ```bash
   aws s3api put-bucket-cors --bucket endevo-uat-lms-assets --cors-configuration '{
     "CORSRules": [{
       "AllowedOrigins": ["https://uat.endevo.life", "http://localhost:3000"],
       "AllowedMethods": ["GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }]
   }'
   ```

---

### Sidebar showing fewer than 15 lessons

**Symptom:** Module sidebar only shows 5-6 lessons even though the module has 15.

**Root Cause:** CSS `max-height` on the sidebar container clips the content. The sidebar was designed for shorter module lists and the scrollbar is not visible.

**Fix:**
1. In the module detail page component, find the sidebar container div.
2. Ensure it has `overflow-y-auto` and a sufficient `max-height` (or `h-full` with a scrollable parent).
3. Example fix:
   ```tsx
   {/* WRONG: max-h-64 clips at ~256px */}
   <div className="max-h-64 overflow-hidden">

   {/* RIGHT: full height with scroll */}
   <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
   ```

---

## 3. Deployment Issues

### Amplify build failed

**Symptom:** Push to `main` triggers Amplify build, build fails with red status.

**Root Cause (in order of frequency):**
1. TypeScript compilation error (most common)
2. Missing environment variable in Amplify
3. `pnpm` lockfile out of sync
4. Next.js 15 breaking change (e.g., `useSearchParams` without `<Suspense>`)

**Fix:**
1. Check the Amplify build log:
   ```bash
   aws amplify list-jobs --app-id d1vvfv8oltolcf --branch-name main --max-items 1
   ```
2. Get the job details:
   ```bash
   aws amplify get-job --app-id d1vvfv8oltolcf --branch-name main --job-id JOB_ID
   ```
3. For TypeScript errors: fix the type error locally, run `pnpm build` in `apps/web/` to verify, then push.
4. For missing env vars: check Amplify environment variables:
   ```bash
   aws amplify get-app --app-id d1vvfv8oltolcf --query "app.environmentVariables"
   ```

**Known Amplify build gotchas:**
- `useSearchParams()` must be wrapped in `<Suspense>` — see ERRORS-LOG Issue #007
- `useForm()` must have generic type: `useForm<z.infer<typeof schema>>()` — see ERRORS-LOG Issue #005
- pnpm workspace: build command must run from monorepo root, not `apps/web/`

---

### Lambda deploy not reflecting changes

**Symptom:** You updated Lambda code and deployed, but the API still returns old behavior.

**Root Cause:**
1. You deployed via CLI but the GitHub Actions pipeline re-deployed the old code from `main`
2. You updated the wrong Lambda function (there are 5: fn-auth, fn-admin, fn-hr, fn-employee, fn-lms)
3. Lambda is running a cached warm instance with old code

**Fix:**
1. Verify which version is deployed:
   ```bash
   aws lambda get-function --function-name endevo-uat-fn-lms \
     --query "Configuration.{LastModified:LastModified,CodeSha256:CodeSha256}" \
     --output table
   ```
2. Compare with your local code:
   ```bash
   cd backend/functions/lms
   sha256sum main.py
   ```
3. Force a cold start by updating a dummy env var:
   ```bash
   aws lambda update-function-configuration \
     --function-name endevo-uat-fn-lms \
     --environment "Variables={FORCE_RELOAD=$(date +%s)}" \
     --no-cli-pager
   ```
   **Warning:** This replaces all env vars. Capture existing ones first.
4. Best practice: always deploy via GitHub push to `main` so Git and Lambda stay in sync.

---

### CORS errors

**Symptom:** Browser console shows `Access-Control-Allow-Origin` errors. API calls fail from the frontend.

**Root Cause:** CORS must be configured in multiple places and ALL must agree:
1. **API Gateway** — default CORS configuration
2. **Each Lambda function** — response headers in Python code
3. **S3 buckets** — for direct asset/video access
4. **CloudFront** — must forward `Origin` header

**Fix:**
1. Check API Gateway CORS:
   ```bash
   aws apigatewayv2 get-api --api-id 4jms6sdzk9 --query "CorsConfiguration"
   ```
2. Check each Lambda returns CORS headers. Every Lambda response must include:
   ```python
   headers = {
       "Access-Control-Allow-Origin": "https://uat.endevo.life",
       "Access-Control-Allow-Headers": "Content-Type,Authorization",
       "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
   }
   ```
3. Check all 5 Lambda functions — a single missing CORS header in one Lambda will break calls to that function:
   ```bash
   for fn in fn-auth fn-admin fn-hr fn-employee fn-lms; do
     echo "=== endevo-uat-$fn ==="
     aws lambda invoke --function-name endevo-uat-$fn \
       --cli-binary-format raw-in-base64-out \
       --payload '{"httpMethod":"OPTIONS","path":"/api/health"}' \
       /dev/null 2>&1
   done
   ```
4. For S3 CORS, see the PDF fix in section 2 above.

---

### Old Amplify URLs still appearing in emails or UI

**Symptom:** Users receive invite emails with `https://main.d1vgn9nzfx4cxk.amplifyapp.com` instead of `https://uat.endevo.life`.

**Root Cause:** The old Amplify auto-generated URL was hardcoded in multiple places. Commit `61b286e` did a search-and-replace but some may have been missed.

**Fix:**
1. Search the entire codebase:
   ```bash
   grep -r "d1vgn9nzfx4cxk" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.json"
   ```
2. Replace every occurrence with `uat.endevo.life`.
3. Check Lambda environment variables:
   ```bash
   for fn in fn-auth fn-admin fn-hr fn-employee fn-lms; do
     echo "=== endevo-uat-$fn ==="
     aws lambda get-function-configuration --function-name endevo-uat-$fn \
       --query "Environment.Variables" --output json | grep -i amplify
   done
   ```
4. Check Amplify redirect rules:
   ```bash
   aws amplify get-app --app-id d1vvfv8oltolcf --query "app.customRules"
   ```

---

## 4. Infrastructure Issues

### DynamoDB throttling

**Symptom:** API returns 500 errors intermittently. CloudWatch shows `ThrottledRequests` metric > 0.

**Root Cause:** All tables use `PAY_PER_REQUEST` (on-demand) mode, which auto-scales but has burst limits. If a single partition key receives too many requests (hot partition), DynamoDB throttles that partition even if overall capacity is available.

**Fix:**
1. Check for throttling:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/DynamoDB \
     --metric-name ThrottledRequests \
     --dimensions Name=TableName,Value=endevo-uat-users \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```
2. Check partition key distribution — if all queries hit the same `tenantId`, that is a hot partition.
3. Short-term fix: add application-level caching (in-memory or ElastiCache).
4. Long-term fix: implement the sharding design from `docs/DYNAMODB-SHARDING-DESIGN.md` — uses write-sharded GSIs to distribute load.

---

### Lambda cold starts causing timeouts

**Symptom:** First API call after idle period takes 5-10 seconds. Subsequent calls are fast.

**Root Cause:** Lambda spins down after ~15 minutes of inactivity. Cold start includes: downloading code, initializing Python runtime, importing modules, and establishing DynamoDB/Cognito connections.

**Fix:**
1. Check cold start duration in CloudWatch:
   ```bash
   export MSYS_NO_PATHCONV=1
   aws logs filter-log-events \
     --log-group-name /aws/lambda/endevo-uat-fn-lms \
     --start-time $(date -d '1 hour ago' +%s)000 \
     --filter-pattern "REPORT" \
     --query "events[].message" \
     --output text | grep "Init Duration"
   ```
2. Reduce cold start time:
   - Minimize Lambda package size (remove unused dependencies)
   - Move imports inside handler function if they are heavy and rarely used
   - Use Lambda layers for shared dependencies
3. For critical functions, enable provisioned concurrency (costs money but eliminates cold starts):
   ```bash
   aws lambda put-provisioned-concurrency-config \
     --function-name endevo-uat-fn-auth \
     --qualifier $LATEST \
     --provisioned-concurrent-executions 2
   ```
   **Note:** Provisioned concurrency does not work with `$LATEST` — you must publish a version first.

---

### S3 access denied

**Symptom:** API returns 403 when trying to access S3 objects (videos, PDFs, assets).

**Root Cause (in order of likelihood):**
1. Presigned URL expired (4 hours for video, 1 hour for assets)
2. S3 bucket policy blocks the request
3. Lambda IAM role missing `s3:GetObject` permission
4. S3 Block Public Access settings blocking presigned URLs (should not, but check)

**Fix:**
1. Test direct access with your IAM credentials:
   ```bash
   aws s3 ls s3://endevo-uat-lms-videos/ --recursive --human-readable
   ```
2. Check the Lambda role has S3 permissions:
   ```bash
   aws iam list-attached-role-policies --role-name endevo-uat-lambda-role
   ```
3. Check bucket policy:
   ```bash
   aws s3api get-bucket-policy --bucket endevo-uat-lms-videos 2>/dev/null || echo "No bucket policy"
   ```
4. Regenerate a presigned URL and test in browser:
   ```bash
   aws s3 presign s3://endevo-uat-lms-videos/1/intro.mp4 --expires-in 300
   ```

---

### CloudWatch alarms firing

**Symptom:** SNS email notifications about Lambda errors or DynamoDB throttling.

**Root Cause:** The platform has 32 CloudWatch alarms monitoring Lambda errors, latency, DynamoDB throttling, and more.

**Fix:**
1. List all alarms in ALARM state:
   ```bash
   aws cloudwatch describe-alarms --state-value ALARM \
     --query "MetricAlarms[].{Name:AlarmName,Metric:MetricName,Reason:StateReason}" \
     --output table
   ```
2. Check if the SNS subscription is confirmed (you must click the confirmation link in the first email):
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn arn:aws:sns:us-east-1:383423735462:endevo-uat-alerts \
     --query "Subscriptions[].{Endpoint:Endpoint,Status:SubscriptionArn}"
   ```
3. If `SubscriptionArn` shows `PendingConfirmation`, check the subscriber's inbox for the confirmation email.

---

### Route 53 failover not working

**Symptom:** Primary region is down but traffic is not routing to the secondary region.

**Root Cause:** Route 53 health checks must be configured and passing in both regions. Common issues:
- Health check endpoint returns non-200 status
- Health check was created but not associated with the DNS record
- Failover record type is wrong (must be `FAILOVER` routing policy, not `SIMPLE`)

**Fix:**
1. List health checks:
   ```bash
   aws route53 list-health-checks \
     --query "HealthChecks[].{Id:Id,Config:HealthCheckConfig.FullyQualifiedDomainName,Status:HealthCheckConfig.Type}"
   ```
2. Get health check status:
   ```bash
   aws route53 get-health-check-status --health-check-id HEALTH_CHECK_ID \
     --query "HealthCheckObservations[].StatusReport.Status"
   ```
3. Verify the DNS record uses FAILOVER routing:
   ```bash
   aws route53 list-resource-record-sets \
     --hosted-zone-id Z00556611RY5GCMKE4K5H \
     --query "ResourceRecordSets[?Name=='uat.endevo.life.']"
   ```

---

## 5. DNS Issues

### uat.endevo.life not resolving

**Symptom:** Browser shows DNS_PROBE_FINISHED_NXDOMAIN or ERR_NAME_NOT_RESOLVED.

**Root Cause:**
1. GoDaddy CNAME record not pointing to CloudFront distribution
2. DNS propagation still in progress (can take up to 48 hours)
3. CloudFront distribution does not have `uat.endevo.life` as an alternate domain name

**Fix:**
1. Check DNS resolution:
   ```bash
   nslookup uat.endevo.life
   dig uat.endevo.life CNAME +short
   ```
2. Verify the CNAME in GoDaddy points to the CloudFront distribution domain (e.g., `d1234abcdef.cloudfront.net`).
3. Verify CloudFront has the alternate domain configured:
   ```bash
   aws cloudfront get-distribution --id E2CH9N3L4W6WV \
     --query "Distribution.DistributionConfig.Aliases"
   ```
4. If the CNAME was just added, wait for DNS propagation. Use `dig` from multiple locations to verify.

---

### Amplify domain association failed

**Symptom:** Amplify console shows "Domain association failed" when trying to add `uat.endevo.life`.

**Root Cause:** A CloudFront distribution already has `uat.endevo.life` as an alternate domain name. AWS does not allow two services to claim the same domain. This happens when you set up CloudFront first, then try to add the same domain to Amplify.

**Fix:**
1. Decide which service should serve the domain:
   - **CloudFront** (recommended for production — more control over caching, WAF, custom headers)
   - **Amplify** (simpler, auto-managed)
2. If using CloudFront: skip Amplify domain association. Point GoDaddy CNAME to CloudFront, and configure CloudFront origin to point to the Amplify app URL.
3. If using Amplify: remove the alternate domain from CloudFront first:
   ```bash
   # Get current config, remove the alias, update the distribution
   aws cloudfront get-distribution-config --id DISTRIBUTION_ID
   # Edit the config to remove uat.endevo.life from Aliases
   # Then update with the modified config
   ```

---

### SSL certificate pending validation

**Symptom:** ACM certificate status shows "Pending validation." HTTPS does not work.

**Root Cause:** ACM DNS validation requires a CNAME record to be added in the domain registrar (GoDaddy). If the validation CNAME was not added (or was added incorrectly), the certificate will stay in "Pending validation" indefinitely.

**Fix:**
1. Get the validation CNAME details:
   ```bash
   aws acm describe-certificate \
     --certificate-arn arn:aws:acm:us-east-1:383423735462:certificate/CERT_ID \
     --query "Certificate.DomainValidationOptions[].{Domain:DomainName,Name:ResourceRecord.Name,Value:ResourceRecord.Value}"
   ```
2. Add the CNAME record in GoDaddy:
   - **Host:** the `Name` value (remove the trailing dot and the domain suffix — GoDaddy adds it automatically)
   - **Points to:** the `Value` value
   - **TTL:** 600 seconds
3. Wait up to 30 minutes for ACM to validate. Check status:
   ```bash
   aws acm describe-certificate \
     --certificate-arn arn:aws:acm:us-east-1:383423735462:certificate/CERT_ID \
     --query "Certificate.Status"
   ```

---

## 6. Multi-Region Issues

### DynamoDB Global Tables replication lag

**Symptom:** Data written in us-east-1 is not immediately visible in us-west-2 (or vice versa).

**Root Cause:** DynamoDB Global Tables replicate asynchronously with ~1 second propagation delay under normal conditions. Under heavy write load, lag can increase.

**Fix:**
1. Check replica status:
   ```bash
   aws dynamodb describe-table --table-name endevo-uat-users \
     --query "Table.Replicas[].{Region:RegionName,Status:ReplicaStatus}"
   ```
2. Check replication latency metric:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/DynamoDB \
     --metric-name ReplicationLatency \
     --dimensions Name=TableName,Value=endevo-uat-users Name=ReceivingRegion,Value=us-west-2 \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Average
   ```
3. If `ReplicaStatus` is not `ACTIVE`, the replica may be initializing (takes minutes for small tables, hours for large ones).
4. For critical reads that must be strongly consistent, always read from the same region that wrote the data.

---

### S3 Cross-Region Replication not replicating existing objects

**Symptom:** New objects appear in both regions, but objects that existed before CRR was enabled are only in us-east-1.

**Root Cause:** S3 CRR only replicates objects created AFTER the replication rule was enabled. Pre-existing objects are not automatically replicated.

**Fix:**
1. Sync existing objects manually:
   ```bash
   aws s3 sync s3://endevo-uat-lms-videos s3://endevo-uat-lms-videos-west --source-region us-east-1 --region us-west-2
   ```
2. Verify replication status on new objects:
   ```bash
   aws s3api head-object --bucket endevo-uat-lms-videos --key 1/intro.mp4 \
     --query "ReplicationStatus"
   ```
3. Status values: `COMPLETED` (replicated), `PENDING` (in progress), `FAILED` (check IAM role), `REPLICA` (this IS the replica).

---

### Lambda not deployed in us-west-2

**Symptom:** API calls to the west region return 404 or "function not found."

**Root Cause:** Lambda functions are regional. Deploying in us-east-1 does not automatically create the function in us-west-2. Each region needs its own deployment.

**Fix:**
1. Check if the function exists in us-west-2:
   ```bash
   aws lambda get-function --function-name endevo-uat-fn-lms --region us-west-2 2>&1 || echo "NOT FOUND"
   ```
2. If missing, deploy the function in us-west-2 using the same code package:
   ```bash
   # Get the code from east
   aws lambda get-function --function-name endevo-uat-fn-lms --region us-east-1 \
     --query "Code.Location" --output text > /tmp/lambda_url.txt
   # Download and deploy to west (or better: use the CI/CD pipeline for both regions)
   ```
3. Best practice: the GitHub Actions pipeline should deploy to both regions. Check `.github/workflows/` for multi-region deploy steps.

---

### API Gateway routes missing in us-west-2

**Symptom:** Some API routes work in us-east-1 but return 404 in us-west-2.

**Root Cause:** API Gateway is regional. Each region has its own API with its own route configuration. Routes added manually in one region are not automatically replicated.

**Fix:**
1. Compare routes between regions:
   ```bash
   echo "=== US-EAST-1 ==="
   aws apigatewayv2 get-routes --api-id 4jms6sdzk9 --region us-east-1 \
     --query "Items[].RouteKey" --output text | tr '\t' '\n' | sort

   echo "=== US-WEST-2 ==="
   aws apigatewayv2 get-routes --api-id WEST_API_ID --region us-west-2 \
     --query "Items[].RouteKey" --output text | tr '\t' '\n' | sort
   ```
2. Use `diff` to find missing routes and add them in the west region.
3. Best practice: manage all API Gateway configuration via CDK so both regions are deployed identically.

---

## 7. Common AWS CLI Issues on Windows

### MSYS path conversion mangles AWS paths

**Symptom:** Commands that include `/aws/lambda/...` fail because Git Bash converts the forward-slash path to a Windows path like `C:/Program Files/Git/aws/lambda/...`.

**Root Cause:** MSYS (the Unix compatibility layer in Git Bash on Windows) automatically converts paths starting with `/` to Windows paths. AWS resource paths like `/aws/lambda/endevo-uat-fn-lms` and DynamoDB expressions like `:t` trigger this conversion.

**Fix:** Set the `MSYS_NO_PATHCONV` environment variable before running AWS commands:
```bash
export MSYS_NO_PATHCONV=1
```

Add it to your `~/.bashrc` to make it permanent:
```bash
echo 'export MSYS_NO_PATHCONV=1' >> ~/.bashrc
```

**Affected commands (examples):**
```bash
# WITHOUT MSYS_NO_PATHCONV — BROKEN:
aws logs filter-log-events --log-group-name /aws/lambda/endevo-uat-fn-lms
# Error: Log group "C:/Program Files/Git/aws/lambda/endevo-uat-fn-lms" does not exist

# WITH MSYS_NO_PATHCONV=1 — WORKS:
export MSYS_NO_PATHCONV=1
aws logs filter-log-events --log-group-name /aws/lambda/endevo-uat-fn-lms
```

---

### JSON payloads to Lambda invoke fail

**Symptom:** `aws lambda invoke` with `--payload` returns garbled results or "InvalidRequestContentException."

**Root Cause:** AWS CLI v2 defaults to base64-encoded payloads. You must explicitly tell it to accept raw JSON.

**Fix:** Add `--cli-binary-format raw-in-base64-out`:
```bash
aws lambda invoke \
  --function-name endevo-uat-fn-lms \
  --cli-binary-format raw-in-base64-out \
  --payload '{"httpMethod":"GET","path":"/api/lms/modules","headers":{"Authorization":"Bearer TOKEN"}}' \
  /tmp/response.json

cat /tmp/response.json | python -m json.tool
```

---

### Long JSON arguments broken by shell quoting

**Symptom:** AWS CLI commands with JSON arguments fail with parse errors.

**Root Cause:** Bash on Windows (Git Bash / MSYS) handles quotes differently from Linux. Nested JSON with double quotes inside single quotes can break.

**Fix:** Use a file for complex JSON payloads:
```bash
# Write the payload to a file
cat > /tmp/payload.json << 'EOF'
{
  "httpMethod": "GET",
  "path": "/api/lms/modules",
  "headers": {
    "Authorization": "Bearer eyJhbGciOi..."
  }
}
EOF

# Reference the file with file:// prefix
aws lambda invoke \
  --function-name endevo-uat-fn-lms \
  --cli-binary-format raw-in-base64-out \
  --payload file:///tmp/payload.json \
  /tmp/response.json
```

---

## 8. Quick Diagnostic Commands

### Health Check — Run All at Once

```bash
export MSYS_NO_PATHCONV=1

echo "=== 1. API Gateway Status ==="
curl -s https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com/api/admin/health | python -m json.tool

echo "=== 2. Lambda Functions ==="
for fn in fn-auth fn-admin fn-hr fn-employee fn-lms; do
  echo -n "endevo-uat-$fn: "
  aws lambda get-function --function-name endevo-uat-$fn \
    --query "Configuration.{State:State,LastModified:LastModified}" \
    --output text 2>&1
done

echo "=== 3. DynamoDB Tables ==="
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'endevo-uat')]" --output table

echo "=== 4. Cognito User Pool ==="
aws cognito-idp describe-user-pool --user-pool-id us-east-1_DVyEJqgFt \
  --query "UserPool.{Status:Status,Users:EstimatedNumberOfUsers}" --output table

echo "=== 5. Recent Errors (last 30 min) ==="
for fn in fn-auth fn-admin fn-hr fn-employee fn-lms; do
  COUNT=$(aws logs filter-log-events \
    --log-group-name /aws/lambda/endevo-uat-$fn \
    --start-time $(date -d '30 minutes ago' +%s)000 \
    --filter-pattern "ERROR" \
    --query "length(events)" 2>/dev/null)
  echo "endevo-uat-$fn errors: ${COUNT:-N/A}"
done

echo "=== 6. CloudWatch Alarms in ALARM State ==="
aws cloudwatch describe-alarms --state-value ALARM \
  --query "MetricAlarms[].AlarmName" --output table

echo "=== 7. Amplify Last Build ==="
aws amplify list-jobs --app-id d1vvfv8oltolcf --branch-name main --max-items 1 \
  --query "jobSummaries[0].{Status:status,StartTime:startTime,EndTime:endTime}" --output table

echo "=== 8. S3 Buckets ==="
aws s3 ls | grep endevo-uat

echo "=== 9. DNS Resolution ==="
nslookup uat.endevo.life 2>/dev/null || dig uat.endevo.life +short

echo "=== 10. SSL Certificate Status ==="
aws acm list-certificates --query "CertificateSummaryList[?contains(DomainName, 'endevo')].{Domain:DomainName,Status:Status}" --output table
```

### Specific Diagnostic Commands

**Check a specific user's auth state:**
```bash
export MSYS_NO_PATHCONV=1
USER_ID="user-id-here"
aws cognito-idp admin-get-user \
  --user-pool-id us-east-1_DVyEJqgFt \
  --username $USER_ID \
  --query "UserAttributes[].{Name:Name,Value:Value}" \
  --output table
```

**Check a specific tenant's LMS modules:**
```bash
export MSYS_NO_PATHCONV=1
TENANT_ID="tenant-id-here"
aws dynamodb query \
  --table-name endevo-uat-lms-modules \
  --key-condition-expression "tenantId = :t" \
  --expression-attribute-values "{\":t\": {\"S\": \"$TENANT_ID\"}}" \
  --projection-expression "moduleNum, title, #s" \
  --expression-attribute-names '{"#s": "status"}' \
  --output table
```

**Check Lambda invocation errors in the last hour:**
```bash
export MSYS_NO_PATHCONV=1
FN="endevo-uat-fn-lms"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=$FN \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --output table
```

**Check DynamoDB read/write capacity consumed:**
```bash
TABLE="endevo-uat-users"
for METRIC in ConsumedReadCapacityUnits ConsumedWriteCapacityUnits; do
  echo "=== $METRIC ==="
  aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name $METRIC \
    --dimensions Name=TableName,Value=$TABLE \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Sum \
    --output table
done
```

**Tail Lambda logs in real-time:**
```bash
export MSYS_NO_PATHCONV=1
aws logs tail /aws/lambda/endevo-uat-fn-lms --follow --since 5m --format short
```

**Check API Gateway access logs:**
```bash
export MSYS_NO_PATHCONV=1
aws logs filter-log-events \
  --log-group-name /aws/apigateway/endevo-uat-api \
  --start-time $(date -d '15 minutes ago' +%s)000 \
  --filter-pattern "{ $.status >= 400 }" \
  --query "events[].message" \
  --output text
```

---

*This guide is maintained by the engineering team. Add new issues as they are discovered.*
*See also: [ERRORS-LOG.md](ERRORS-LOG.md) for the full chronological error history.*
*See also: [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture details.*
*See also: [AWS-SERVICES-INVENTORY.md](AWS-SERVICES-INVENTORY.md) for complete service inventory.*
