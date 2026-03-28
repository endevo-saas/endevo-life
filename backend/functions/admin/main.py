"""
Endevo Life — Global Admin Lambda (pure boto3, no pip needed)
Foundation v2: pagination, server-side search, input validation, sanitization

Routes:
  GET  /api/admin/dashboard
  GET  /api/admin/tenants            ?search=&limit=50&next_token=
  POST /api/admin/tenants
  GET  /api/admin/tenants/{id}
  PUT  /api/admin/tenants/{id}
  DELETE /api/admin/tenants/{id}
  GET  /api/admin/users              ?search=&tenantId=&role=&status=&limit=50&next_token=
  POST /api/admin/users
  GET  /api/admin/users/{id}
  PUT  /api/admin/users/{id}
  DELETE /api/admin/users/{id}
  POST /api/admin/users/{id}/lock
  POST /api/admin/users/{id}/unlock
  POST /api/admin/users/{id}/reset-password
  POST /api/admin/invite
  GET  /api/admin/audit              ?limit=100&next_token=
  GET  /api/admin/health
"""
import json, os, uuid, base64, re
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

POOL_ID   = os.environ.get("COGNITO_POOL_ID", "us-east-1_DVyEJqgFt")
CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "4sbv2j6cv7jpp1oi0d16njsej1")
REGION    = os.environ.get("AWS_REGION", "us-east-1")
dynamo    = boto3.resource("dynamodb", region_name=REGION)
cognito   = boto3.client("cognito-idp", region_name=REGION)
ses       = boto3.client("ses", region_name=REGION)
USERS_T   = dynamo.Table("endevo-uat-users")
TENANTS_T = dynamo.Table("endevo-uat-tenants")
AUDIT_T   = dynamo.Table("endevo-uat-audit")
CERT_T    = dynamo.Table("endevo-uat-certificates")

# ── Helpers ───────────────────────────────────────────────────────────────────

def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, default=str)
    }

def err(status, msg):
    return resp(status, {"detail": msg})

def get_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except:
        return {}

def get_caller(event):
    token = (event.get("headers") or {}).get("authorization", "").replace("Bearer ", "")
    if not token:
        return None, None
    try:
        u = cognito.get_user(AccessToken=token)
        attrs = {a["Name"]: a["Value"] for a in u["UserAttributes"]}
        return attrs.get("custom:role"), attrs.get("email")
    except:
        return None, None

def sanitize(value, max_len=200):
    """Strip whitespace, limit length, block XSS patterns."""
    if not isinstance(value, str):
        return value
    v = value.strip()[:max_len]
    for bad in ["<script", "</script", "javascript:", "onload=", "onerror=", "eval(", "document."]:
        v = re.sub(re.escape(bad), "", v, flags=re.IGNORECASE)
    return v

def validate_email(email):
    """RFC-5322 lightweight check."""
    if not email or len(email) > 254:
        return False
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))

def encode_cursor(last_key):
    """Encode DynamoDB LastEvaluatedKey as URL-safe base64 string."""
    if not last_key:
        return None
    return base64.urlsafe_b64encode(json.dumps(last_key, default=str).encode()).decode()

def decode_cursor(token):
    """Decode cursor token back to DynamoDB ExclusiveStartKey."""
    if not token:
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(token.encode()))
    except:
        return None

def scan_page(table, limit, next_token, filter_expr=None, proj=None):
    """Single paginated scan. Returns (items, next_cursor)."""
    limit = min(max(int(limit or 50), 1), 200)
    params = {"Limit": limit}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    if proj:
        params["ProjectionExpression"] = proj
    start_key = decode_cursor(next_token)
    if start_key:
        params["ExclusiveStartKey"] = start_key
    result = table.scan(**params)
    items = result.get("Items", [])
    return items, encode_cursor(result.get("LastEvaluatedKey"))

def scan_all(table, filter_expr=None):
    """Full scan with automatic pagination (for counts/dashboard only)."""
    params = {}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    items = []
    while True:
        result = table.scan(**params)
        items.extend(result.get("Items", []))
        last = result.get("LastEvaluatedKey")
        if not last:
            break
        params["ExclusiveStartKey"] = last
    return items

def count_items(table, filter_expr=None):
    """Count items without loading data. Uses Select=COUNT for efficiency."""
    params = {"Select": "COUNT"}
    if filter_expr is not None:
        params["FilterExpression"] = filter_expr
    total = 0
    while True:
        result = table.scan(**params)
        total += result.get("Count", 0)
        last = result.get("LastEvaluatedKey")
        if not last:
            break
        params["ExclusiveStartKey"] = last
    return total

def audit(tenant_id, actor, action, details=""):
    try:
        now = datetime.now(timezone.utc).isoformat()
        audit_id = str(uuid.uuid4())
        AUDIT_T.put_item(Item={
            "tenantId": tenant_id or "SYSTEM",
            "sk": f"{now}#{audit_id}",
            "auditId": audit_id,
            "actor": actor,
            "action": action,
            "details": details[:500],  # cap details length
            "createdAt": now
        })
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

# ── Handler ───────────────────────────────────────────────────────────────────

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    qs     = event.get("queryStringParameters") or {}

    if method == "OPTIONS":
        return resp(200, {})

    body = get_body(event)
    role, caller_email = get_caller(event)
    if not role:
        return err(401, "Not authenticated")
    if role != "GLOBAL_ADMIN":
        return err(403, "Global Admin access required")

    # ── GET /api/admin/dashboard ──────────────────────────────────────────
    if path.endswith("/dashboard") and method == "GET":
        total_tenants  = count_items(TENANTS_T)
        active_tenants = count_items(TENANTS_T, Attr("status").eq("active"))
        total_users    = count_items(USERS_T)
        active_users   = count_items(USERS_T, Attr("status").eq("active"))
        total_certs    = count_items(CERT_T)
        return resp(200, {
            "total_tenants":      total_tenants,
            "active_tenants":     active_tenants,
            "total_users":        total_users,
            "active_users":       active_users,
            "locked_users":       count_items(USERS_T, Attr("status").eq("locked")),
            "pending_users":      count_items(USERS_T, Attr("status").eq("pending")),
            "total_certificates": total_certs,
            "system_status":      "healthy"
        })

    # ── GET /api/admin/tenants ────────────────────────────────────────────
    if path.endswith("/tenants") and method == "GET":
        limit       = qs.get("limit", 50)
        next_token  = qs.get("next_token")
        search      = sanitize(qs.get("search", ""), 100)
        plan_filter = qs.get("plan", "")
        status_filter = qs.get("status", "")

        # Build filter expression
        fexpr = None
        if search:
            fexpr = Attr("name").contains(search)
        if plan_filter:
            pf = Attr("plan").eq(plan_filter)
            fexpr = (fexpr & pf) if fexpr else pf
        if status_filter:
            sf = Attr("status").eq(status_filter)
            fexpr = (fexpr & sf) if fexpr else sf

        items, next_cursor = scan_page(TENANTS_T, limit, next_token, fexpr)

        # Get user counts per tenant using COUNT (no data transfer)
        for t in items:
            tid = t["tenantId"]
            t["user_count"]     = count_items(USERS_T, Attr("tenantId").eq(tid))
            t["active_count"]   = count_items(USERS_T, Attr("tenantId").eq(tid) & Attr("status").eq("active"))
            t["hr_count"]       = count_items(USERS_T, Attr("tenantId").eq(tid) & Attr("role").eq("HR_ADMIN"))
            t["employee_count"] = count_items(USERS_T, Attr("tenantId").eq(tid) & Attr("role").eq("EMPLOYEE"))

        return resp(200, {
            "tenants":    items,
            "count":      len(items),
            "next_token": next_cursor,
            "has_more":   bool(next_cursor)
        })

    # ── POST /api/admin/tenants ───────────────────────────────────────────
    if path.endswith("/tenants") and method == "POST":
        name       = sanitize(body.get("name") or "", 100)
        plan       = sanitize(body.get("plan") or "enterprise", 50)
        max_seats  = body.get("maxSeats")
        website    = sanitize(body.get("website") or "", 200)
        hr_contact = sanitize(body.get("hrContact") or "", 100)
        hr_email   = sanitize((body.get("hrEmail") or "").lower().strip(), 254)

        if not name:
            return err(400, "Tenant name required")
        if len(name) < 2:
            return err(400, "Tenant name must be at least 2 characters")
        if plan not in ("trial", "starter", "professional", "enterprise", "enterprise-plus"):
            return err(400, "Invalid plan")
        try:
            max_seats = int(max_seats or 50)
        except (TypeError, ValueError):
            return err(400, "maxSeats must be a number")
        if hr_email and not validate_email(hr_email):
            return err(400, "Invalid HR admin email format")

        # Sequential tenant ID
        seq = count_items(TENANTS_T) + 1
        tenant_id = f"tenant-{seq:03d}"
        while TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item"):
            seq += 1
            tenant_id = f"tenant-{seq:03d}"

        now = datetime.now(timezone.utc).isoformat()
        TENANTS_T.put_item(Item={
            "tenantId": tenant_id, "name": name, "plan": plan, "status": "active",
            "website": website, "hrContact": hr_contact, "hrEmail": hr_email,
            "createdAt": now, "createdBy": caller_email,
            "maxSeats": max_seats, "employeeCount": 0,
            "tenantCode": tenant_id
        })
        audit("SYSTEM", caller_email, "TENANT_CREATED", f"Created tenant: {name} ({tenant_id})")
        return resp(200, {"message": "Tenant created", "tenant_id": tenant_id, "tenant_code": tenant_id})

    # ── GET /api/admin/tenants/{id} ───────────────────────────────────────
    if "/tenants/" in path and method == "GET":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        all_users = scan_all(USERS_T, Attr("tenantId").eq(tenant_id))
        safe_users = [{k: v for k, v in u.items() if k != "inviteToken"} for u in all_users]
        hr_admins = [u for u in safe_users if u.get("role") == "HR_ADMIN"]
        employees = [u for u in safe_users if u.get("role") == "EMPLOYEE"]
        active    = [u for u in safe_users if u.get("status") == "active"]
        t["users"]     = safe_users
        t["hr_admins"] = hr_admins
        t["employees"] = employees
        t["user_count"] = len(safe_users)
        t["stats"] = {
            "total_users": len(safe_users), "active_users": len(active),
            "hr_admins": len(hr_admins), "employees": len(employees)
        }
        return resp(200, t)

    # ── PUT /api/admin/tenants/{id} ───────────────────────────────────────
    if "/tenants/" in path and method == "PUT":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        allowed = ["name", "plan", "status", "maxSeats", "website", "hrContact", "hrEmail"]
        updates = {}
        for k in allowed:
            if k in body:
                v = body[k]
                updates[k] = sanitize(str(v), 200) if isinstance(v, str) else v
        if not updates:
            return err(400, "Nothing to update")
        if "plan" in updates and updates["plan"] not in ("trial", "starter", "professional", "enterprise", "enterprise-plus"):
            return err(400, "Invalid plan")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        TENANTS_T.update_item(Key={"tenantId": tenant_id}, UpdateExpression=expr,
            ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        audit(tenant_id, caller_email, "TENANT_UPDATED", f"Updated {tenant_id}: {list(updates.keys())}")
        return resp(200, {"message": "Tenant updated"})

    # ── DELETE /api/admin/tenants/{id} ────────────────────────────────────
    if "/tenants/" in path and method == "DELETE":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t:
            return err(404, "Tenant not found")
        TENANTS_T.update_item(Key={"tenantId": tenant_id},
            UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "deleted"})
        audit("SYSTEM", caller_email, "TENANT_DELETED", f"Soft-deleted: {t.get('name')} ({tenant_id})")
        return resp(200, {"message": "Tenant deleted"})

    # ── GET /api/admin/users ──────────────────────────────────────────────
    if path.endswith("/users") and method == "GET":
        limit         = qs.get("limit", 50)
        next_token    = qs.get("next_token")
        search        = sanitize(qs.get("search", ""), 100)
        filter_tenant = qs.get("tenantId", "")
        filter_role   = qs.get("role", "")
        filter_status = qs.get("status", "")

        # Build compound filter
        fexpr = None
        if filter_tenant:
            fexpr = Attr("tenantId").eq(filter_tenant)
        if filter_role:
            rf = Attr("role").eq(filter_role)
            fexpr = (fexpr & rf) if fexpr else rf
        if filter_status:
            sf = Attr("status").eq(filter_status)
            fexpr = (fexpr & sf) if fexpr else sf
        if search:
            # Search across email, firstName, lastName
            sf = (Attr("email").contains(search) |
                  Attr("firstName").contains(search) |
                  Attr("lastName").contains(search))
            fexpr = (fexpr & sf) if fexpr else sf

        items, next_cursor = scan_page(USERS_T, limit, next_token, fexpr)
        safe = [{k: v for k, v in u.items() if k != "inviteToken"} for u in items]
        return resp(200, {
            "users":      safe,
            "count":      len(safe),
            "next_token": next_cursor,
            "has_more":   bool(next_cursor)
        })

    # ── POST /api/admin/users ─────────────────────────────────────────────
    if path.endswith("/users") and method == "POST":
        email      = sanitize((body.get("email") or "").lower().strip(), 254)
        first      = sanitize(body.get("firstName") or body.get("first_name") or "", 50)
        last       = sanitize(body.get("lastName") or body.get("last_name") or "", 50)
        user_role  = body.get("role") or "EMPLOYEE"
        tenant_id  = body.get("tenantId") or body.get("tenant_id") or ""
        department = sanitize(body.get("department") or "", 100)
        job_title  = sanitize(body.get("jobTitle") or body.get("job_title") or "", 100)
        password   = body.get("password") or f"Endevo@{str(uuid.uuid4())[:8]}!"

        if not email:
            return err(400, "Email required")
        if not validate_email(email):
            return err(400, "Invalid email format")
        if user_role not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Role must be GLOBAL_ADMIN, HR_ADMIN, or EMPLOYEE")
        if user_role in ("HR_ADMIN", "EMPLOYEE") and not tenant_id:
            return err(400, "tenantId required for HR_ADMIN and EMPLOYEE")
        if password and len(password) < 8:
            return err(400, "Password must be at least 8 characters")

        tenant_name = ""
        if tenant_id:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, f"Tenant {tenant_id} not found")
            tenant_name = t.get("name", "")

        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID, Username=email,
                TemporaryPassword=password,
                UserAttributes=[
                    {"Name": "email",             "Value": email},
                    {"Name": "email_verified",    "Value": "true"},
                    {"Name": "given_name",        "Value": first},
                    {"Name": "family_name",       "Value": last},
                    {"Name": "custom:role",       "Value": user_role},
                    {"Name": "custom:tenantId",   "Value": tenant_id},
                    {"Name": "custom:tenantName", "Value": tenant_name},
                ],
                MessageAction="SUPPRESS"
            )
            cognito.admin_set_user_password(UserPoolId=POOL_ID, Username=email, Password=password, Permanent=True)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "UsernameExistsException":
                return err(409, f"User {email} already exists")
            if code == "InvalidPasswordException":
                return err(400, "Password does not meet Cognito policy requirements")
            return err(400, str(e.response["Error"]["Message"]))

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.put_item(Item={
            "userId": user_id, "tenantId": tenant_id, "email": email,
            "firstName": first, "lastName": last, "role": user_role,
            "status": "active", "department": department, "jobTitle": job_title,
            "createdBy": caller_email, "createdAt": now
        })
        audit(tenant_id or "SYSTEM", caller_email, "USER_CREATED",
              f"Created {user_role}: {email} (tenant: {tenant_name or 'SYSTEM'})")
        return resp(200, {
            "message": "User created", "user_id": user_id,
            "email": email, "role": user_role, "temporary_password": password
        })

    # ── GET /api/admin/users/{id} ─────────────────────────────────────────
    if "/users/" in path and method == "GET" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        return resp(200, {k: v for k, v in item.items() if k != "inviteToken"})

    # ── PUT /api/admin/users/{id} ─────────────────────────────────────────
    if "/users/" in path and method == "PUT" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        allowed = ["firstName", "lastName", "department", "jobTitle", "status", "role"]
        updates = {}
        for k in allowed:
            if k in body:
                updates[k] = sanitize(str(body[k]), 100) if isinstance(body[k], str) else body[k]
        if not updates:
            return err(400, "Nothing to update")
        if "role" in updates and updates["role"] not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Invalid role")
        if "status" in updates and updates["status"] not in ("active", "inactive", "locked", "pending"):
            return err(400, "Invalid status")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr,
            ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        if "role" in updates:
            try:
                cognito.admin_update_user_attributes(UserPoolId=POOL_ID, Username=item["email"],
                    UserAttributes=[{"Name": "custom:role", "Value": updates["role"]}])
            except:
                pass
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_UPDATED",
              f"Updated user: {item['email']} fields: {list(updates.keys())}")
        return resp(200, {"message": "User updated"})

    # ── DELETE /api/admin/users/{id} ──────────────────────────────────────
    if "/users/" in path and method == "DELETE" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        try:
            cognito.admin_delete_user(UserPoolId=POOL_ID, Username=email)
        except ClientError as e:
            if e.response["Error"]["Code"] != "UserNotFoundException":
                return err(400, f"Cognito delete failed: {e.response['Error']['Message']}")
        USERS_T.delete_item(Key={"userId": user_id})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_DELETED",
              f"Permanently deleted: {email}")
        return resp(200, {"message": f"User {email} permanently deleted"})

    # ── POST /api/admin/users/{id}/lock ───────────────────────────────────
    if "/users/" in path and path.endswith("/lock") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        try:
            cognito.admin_disable_user(UserPoolId=POOL_ID, Username=email)
        except ClientError as e:
            return err(400, f"Lock failed: {e.response['Error']['Message']}")
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "locked"})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_LOCKED", f"Locked: {email}")
        return resp(200, {"message": f"User {email} locked"})

    # ── POST /api/admin/users/{id}/unlock ─────────────────────────────────
    if "/users/" in path and path.endswith("/unlock") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        try:
            cognito.admin_enable_user(UserPoolId=POOL_ID, Username=email)
        except ClientError as e:
            return err(400, f"Unlock failed: {e.response['Error']['Message']}")
        USERS_T.update_item(Key={"userId": user_id},
            UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":v": "active"})
        audit(item.get("tenantId", "SYSTEM"), caller_email, "USER_UNLOCKED", f"Unlocked: {email}")
        return resp(200, {"message": f"User {email} unlocked"})

    # ── POST /api/admin/users/{id}/reset-password ─────────────────────────
    if "/users/" in path and path.endswith("/reset-password") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item:
            return err(404, "User not found")
        email = item.get("email", "")
        new_password = body.get("password") or f"Reset@{str(uuid.uuid4())[:8]}!"
        try:
            cognito.admin_set_user_password(UserPoolId=POOL_ID, Username=email,
                Password=new_password, Permanent=True)
        except ClientError as e:
            return err(400, f"Password reset failed: {e.response['Error']['Message']}")
        audit(item.get("tenantId", "SYSTEM"), caller_email, "PASSWORD_RESET",
              f"Reset password for: {email}")
        return resp(200, {"message": f"Password reset for {email}", "new_password": new_password})

    # ── POST /api/admin/invite ────────────────────────────────────────────
    if path.endswith("/invite") and method == "POST":
        email     = sanitize((body.get("email") or "").lower().strip(), 254)
        user_role = body.get("role") or "EMPLOYEE"
        tenant_id = body.get("tenantId") or ""
        first     = sanitize(body.get("firstName") or "", 50)
        last      = sanitize(body.get("lastName") or "", 50)

        if not email:
            return err(400, "Email required")
        if not validate_email(email):
            return err(400, "Invalid email format")
        if user_role not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Invalid role")
        if user_role in ("HR_ADMIN", "EMPLOYEE") and not tenant_id:
            return err(400, "tenantId required for HR_ADMIN/EMPLOYEE")

        tenant_name = ""
        if tenant_id:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t:
                return err(404, f"Tenant {tenant_id} not found")
            tenant_name = t.get("name", "")

        invite_token  = str(uuid.uuid4())
        temp_password = f"Invite@{str(uuid.uuid4())[:8]}!"

        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID, Username=email,
                TemporaryPassword=temp_password,
                UserAttributes=[
                    {"Name": "email",             "Value": email},
                    {"Name": "email_verified",    "Value": "true"},
                    {"Name": "given_name",        "Value": first},
                    {"Name": "family_name",       "Value": last},
                    {"Name": "custom:role",       "Value": user_role},
                    {"Name": "custom:tenantId",   "Value": tenant_id},
                    {"Name": "custom:tenantName", "Value": tenant_name},
                ],
                MessageAction="SUPPRESS"
            )
            cognito.admin_set_user_password(UserPoolId=POOL_ID, Username=email,
                Password=temp_password, Permanent=True)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "UsernameExistsException":
                return err(409, f"User {email} already exists")
            return err(400, str(e.response["Error"]["Message"]))

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.put_item(Item={
            "userId": user_id, "tenantId": tenant_id, "email": email,
            "firstName": first, "lastName": last, "role": user_role,
            "status": "pending", "inviteToken": invite_token,
            "createdBy": caller_email, "createdAt": now
        })

        invite_url = f"https://main.d1vgn9nzfx4cxk.amplifyapp.com/register?token={invite_token}&email={email}"
        try:
            ses.send_email(
                Source="no-reply@endevo.life",
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"You're invited to Endevo Life — {tenant_name or 'Platform'}"},
                    "Body": {"Html": {"Data": f"""
                        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                          <h2 style="color:#6366f1">Welcome to Endevo Life</h2>
                          <p>You've been invited as <strong>{user_role.replace('_',' ')}</strong>{' at ' + tenant_name if tenant_name else ''}.</p>
                          <a href="{invite_url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">Accept Invitation</a>
                          <p style="color:#666;font-size:12px">Temporary password: <code>{temp_password}</code><br>Login at: <a href="https://main.d1vgn9nzfx4cxk.amplifyapp.com/login">Endevo Life Login</a></p>
                        </div>"""}}
                }
            )
            email_sent = True
        except Exception as e:
            print(f"SES_ERROR: {e}")
            email_sent = False

        audit(tenant_id or "SYSTEM", caller_email, "USER_INVITED",
              f"Invited {email} as {user_role}" + (f" to {tenant_name}" if tenant_name else ""))
        return resp(200, {
            "message": f"Invitation sent to {email}",
            "user_id": user_id, "email_sent": email_sent,
            "temp_password": temp_password, "invite_url": invite_url
        })

    # ── GET /api/admin/audit ──────────────────────────────────────────────
    if path.endswith("/audit") and method == "GET":
        limit      = min(int(qs.get("limit", 100)), 500)
        next_token = qs.get("next_token")
        params = {"Limit": limit, "ScanIndexForward": False}
        if next_token:
            sk = decode_cursor(next_token)
            if sk:
                params["ExclusiveStartKey"] = sk
        result = AUDIT_T.scan(Limit=limit, **({} if not next_token else {"ExclusiveStartKey": decode_cursor(next_token) or {}}))
        logs = sorted(result.get("Items", []), key=lambda x: x.get("createdAt", ""), reverse=True)
        return resp(200, {
            "logs":       logs,
            "count":      len(logs),
            "next_token": encode_cursor(result.get("LastEvaluatedKey")),
            "has_more":   bool(result.get("LastEvaluatedKey"))
        })

    # ── GET /api/admin/health ─────────────────────────────────────────────
    if path.endswith("/health") and method == "GET":
        dynamo_ok  = "ok"
        cognito_ok = "ok"
        ses_ok     = "ok"
        try:
            USERS_T.scan(Limit=1, Select="COUNT")
        except:
            dynamo_ok = "error"
        try:
            cognito.describe_user_pool(UserPoolId=POOL_ID)
        except:
            cognito_ok = "error"
        try:
            ses.get_send_quota()
        except:
            ses_ok = "error"
        overall = "healthy" if dynamo_ok == "ok" and cognito_ok == "ok" else "degraded"
        return resp(200, {
            "status": overall,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {
                "dynamodb": dynamo_ok,
                "cognito":  cognito_ok,
                "ses":      ses_ok,
                "lambda":   "ok",
                "api_gateway": "ok"
            }
        })

    return err(404, f"Route not found: {method} {path}")
