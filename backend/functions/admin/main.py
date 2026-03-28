"""
Endevo Life — Global Admin Lambda (pure boto3, no pip needed)
Full granular control: tenants, users, create/edit/delete/lock/unlock any user
Routes:
  GET  /api/admin/dashboard
  GET  /api/admin/tenants
  POST /api/admin/tenants
  GET  /api/admin/tenants/{id}
  PUT  /api/admin/tenants/{id}
  DELETE /api/admin/tenants/{id}
  GET  /api/admin/users
  POST /api/admin/users          — create GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE
  GET  /api/admin/users/{id}
  PUT  /api/admin/users/{id}
  DELETE /api/admin/users/{id}   — hard delete
  POST /api/admin/users/{id}/lock
  POST /api/admin/users/{id}/unlock
  POST /api/admin/users/{id}/reset-password
  GET  /api/admin/audit
  GET  /api/admin/health
"""
import json, os, uuid, boto3
from datetime import datetime, timezone
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

def resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"}, "body": json.dumps(body, default=str)}

def err(status, msg): return resp(status, {"detail": msg})

def get_body(event):
    try: return json.loads(event.get("body") or "{}")
    except: return {}

def get_caller(event):
    token = (event.get("headers") or {}).get("authorization", "").replace("Bearer ", "")
    if not token: return None, None
    try:
        u = cognito.get_user(AccessToken=token)
        attrs = {a["Name"]: a["Value"] for a in u["UserAttributes"]}
        return attrs.get("custom:role"), attrs.get("email")
    except: return None, None

def audit(tenant_id, actor, action, details=""):
    try:
        now = datetime.now(timezone.utc).isoformat()
        audit_id = str(uuid.uuid4())
        AUDIT_T.put_item(Item={"tenantId": tenant_id or "SYSTEM", "sk": f"{now}#{audit_id}", "auditId": audit_id, "actor": actor, "action": action, "details": details, "createdAt": now})
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    if method == "OPTIONS": return resp(200, {})
    body = get_body(event)
    role, caller_email = get_caller(event)
    if not role: return err(401, "Not authenticated")
    if role != "GLOBAL_ADMIN": return err(403, "Global Admin access required")

    # ── GET /api/admin/dashboard ──────────────────────────────────────────
    if path.endswith("/dashboard") and method == "GET":
        tenants = TENANTS_T.scan()
        users   = USERS_T.scan()
        certs   = CERT_T.scan()
        t_items = tenants.get("Items", [])
        u_items = users.get("Items", [])
        return resp(200, {
            "total_tenants":      len(t_items),
            "active_tenants":     len([t for t in t_items if t.get("status") == "active"]),
            "total_users":        len(u_items),
            "active_users":       len([u for u in u_items if u.get("status") == "active"]),
            "locked_users":       len([u for u in u_items if u.get("status") == "locked"]),
            "pending_users":      len([u for u in u_items if u.get("status") == "pending"]),
            "total_certificates": len(certs.get("Items", [])),
            "system_status":      "healthy"
        })

    # ── GET /api/admin/tenants ────────────────────────────────────────────
    if path.endswith("/tenants") and method == "GET":
        tenants  = TENANTS_T.scan()
        t_items  = tenants.get("Items", [])
        all_users = USERS_T.scan().get("Items", [])
        for t in t_items:
            tid = t["tenantId"]
            t_users = [u for u in all_users if u.get("tenantId") == tid]
            t["user_count"]     = len(t_users)
            t["employee_count"] = len([u for u in t_users if u.get("role") == "EMPLOYEE"])
            t["hr_count"]       = len([u for u in t_users if u.get("role") == "HR_ADMIN"])
            t["active_count"]   = len([u for u in t_users if u.get("status") == "active"])
        return resp(200, {"tenants": t_items, "count": len(t_items)})

    # ── POST /api/admin/tenants ───────────────────────────────────────────
    if path.endswith("/tenants") and method == "POST":
        name       = body.get("name") or ""
        plan       = body.get("plan") or "enterprise"
        max_seats  = int(body.get("maxSeats") or 50)
        website    = body.get("website") or ""
        hr_contact = body.get("hrContact") or ""
        hr_email   = body.get("hrEmail") or ""
        if not name: return err(400, "Tenant name required")
        # Sequential tenant ID: count existing tenants → tenant-001, tenant-002, ...
        existing = TENANTS_T.scan(Select="COUNT")
        seq = existing.get("Count", 0) + 1
        tenant_id = f"tenant-{seq:03d}"
        # Ensure uniqueness (in case of concurrent creates)
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
        if not t: return err(404, "Tenant not found")
        all_users = USERS_T.scan(FilterExpression="tenantId = :t", ExpressionAttributeValues={":t": tenant_id}).get("Items", [])
        safe_users = [{k: v for k, v in u.items() if k != "inviteToken"} for u in all_users]
        hr_admins  = [u for u in safe_users if u.get("role") == "HR_ADMIN"]
        employees  = [u for u in safe_users if u.get("role") == "EMPLOYEE"]
        active     = [u for u in safe_users if u.get("status") == "active"]
        t["users"]      = safe_users
        t["hr_admins"]  = hr_admins
        t["employees"]  = employees
        t["user_count"] = len(safe_users)
        t["stats"]      = {
            "total_users":  len(safe_users),
            "active_users": len(active),
            "hr_admins":    len(hr_admins),
            "employees":    len(employees)
        }
        return resp(200, t)

    # ── PUT /api/admin/tenants/{id} ───────────────────────────────────────
    if "/tenants/" in path and method == "PUT":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t: return err(404, "Tenant not found")
        allowed = ["name", "plan", "status", "maxSeats"]
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates: return err(400, "Nothing to update")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        TENANTS_T.update_item(Key={"tenantId": tenant_id}, UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        audit(tenant_id, caller_email, "TENANT_UPDATED", f"Updated {tenant_id}: {list(updates.keys())}")
        return resp(200, {"message": "Tenant updated"})

    # ── DELETE /api/admin/tenants/{id} ────────────────────────────────────
    if "/tenants/" in path and method == "DELETE":
        tenant_id = path.split("/")[-1]
        t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
        if not t: return err(404, "Tenant not found")
        # Soft delete — set status to deleted
        TENANTS_T.update_item(Key={"tenantId": tenant_id}, UpdateExpression="SET #s = :v", ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":v": "deleted"})
        audit("SYSTEM", caller_email, "TENANT_DELETED", f"Deleted tenant: {t.get('name')} ({tenant_id})")
        return resp(200, {"message": "Tenant deleted"})

    # ── GET /api/admin/users ──────────────────────────────────────────────
    if path.endswith("/users") and method == "GET":
        qs = event.get("queryStringParameters") or {}
        filter_tenant = qs.get("tenantId") or ""
        if filter_tenant:
            users = USERS_T.scan(FilterExpression="tenantId = :t", ExpressionAttributeValues={":t": filter_tenant})
        else:
            users = USERS_T.scan()
        safe  = [{k: v for k, v in u.items() if k != "inviteToken"} for u in users.get("Items", [])]
        return resp(200, {"users": safe, "count": len(safe)})

    # ── POST /api/admin/users ─────────────────────────────────────────────
    # Create any user type: GLOBAL_ADMIN / HR_ADMIN / EMPLOYEE
    if path.endswith("/users") and method == "POST":
        email      = (body.get("email") or "").lower().strip()
        first      = body.get("firstName") or body.get("first_name") or ""
        last       = body.get("lastName") or body.get("last_name") or ""
        user_role  = body.get("role") or "EMPLOYEE"
        tenant_id  = body.get("tenantId") or body.get("tenant_id") or ""
        department = body.get("department") or ""
        job_title  = body.get("jobTitle") or body.get("job_title") or ""
        password   = body.get("password") or f"Endevo@{str(uuid.uuid4())[:8]}!"

        if not email: return err(400, "Email required")
        if user_role not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Role must be GLOBAL_ADMIN, HR_ADMIN, or EMPLOYEE")
        if user_role in ("HR_ADMIN", "EMPLOYEE") and not tenant_id:
            return err(400, "tenantId required for HR_ADMIN and EMPLOYEE")

        # Get tenant name for Cognito attribute
        tenant_name = ""
        if tenant_id:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t: return err(404, f"Tenant {tenant_id} not found")
            tenant_name = t.get("name", "")

        # Create in Cognito
        try:
            cognito.admin_create_user(
                UserPoolId=POOL_ID,
                Username=email,
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
                return err(409, f"User {email} already exists in Cognito")
            return err(400, str(e.response["Error"]["Message"]))

        # Save to DynamoDB
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
            "message": "User created",
            "user_id": user_id,
            "email": email,
            "role": user_role,
            "temporary_password": password
        })

    # ── GET /api/admin/users/{id} ─────────────────────────────────────────
    if "/users/" in path and method == "GET" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item: return err(404, "User not found")
        safe = {k: v for k, v in item.items() if k != "inviteToken"}
        return resp(200, safe)

    # ── PUT /api/admin/users/{id} ─────────────────────────────────────────
    if "/users/" in path and method == "PUT" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item: return err(404, "User not found")
        allowed = ["firstName", "lastName", "department", "jobTitle", "status", "role"]
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates: return err(400, "Nothing to update")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        # Sync role to Cognito if changed
        if "role" in updates:
            try:
                cognito.admin_update_user_attributes(UserPoolId=POOL_ID, Username=item["email"],
                    UserAttributes=[{"Name": "custom:role", "Value": updates["role"]}])
            except: pass
        audit(item.get("tenantId","SYSTEM"), caller_email, "USER_UPDATED",
              f"Updated user: {item['email']} fields: {list(updates.keys())}")
        return resp(200, {"message": "User updated"})

    # ── DELETE /api/admin/users/{id} ──────────────────────────────────────
    if "/users/" in path and method == "DELETE" and not any(x in path for x in ["/lock", "/unlock", "/reset-password"]):
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item: return err(404, "User not found")
        email = item.get("email", "")
        # Delete from Cognito
        try:
            cognito.admin_delete_user(UserPoolId=POOL_ID, Username=email)
        except ClientError as e:
            if e.response["Error"]["Code"] != "UserNotFoundException":
                return err(400, f"Cognito delete failed: {e.response['Error']['Message']}")
        # Delete from DynamoDB
        USERS_T.delete_item(Key={"userId": user_id})
        audit(item.get("tenantId","SYSTEM"), caller_email, "USER_DELETED",
              f"Permanently deleted: {email}")
        return resp(200, {"message": f"User {email} permanently deleted"})

    # ── POST /api/admin/users/{id}/lock ───────────────────────────────────
    if "/users/" in path and path.endswith("/lock") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item: return err(404, "User not found")
        email = item.get("email", "")
        try:
            cognito.admin_disable_user(UserPoolId=POOL_ID, Username=email)
        except ClientError as e:
            return err(400, f"Lock failed: {e.response['Error']['Message']}")
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":v": "locked"})
        audit(item.get("tenantId","SYSTEM"), caller_email, "USER_LOCKED",
              f"Locked user: {email}")
        return resp(200, {"message": f"User {email} locked"})

    # ── POST /api/admin/users/{id}/unlock ─────────────────────────────────
    if "/users/" in path and path.endswith("/unlock") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item: return err(404, "User not found")
        email = item.get("email", "")
        try:
            cognito.admin_enable_user(UserPoolId=POOL_ID, Username=email)
        except ClientError as e:
            return err(400, f"Unlock failed: {e.response['Error']['Message']}")
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression="SET #s = :v",
            ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":v": "active"})
        audit(item.get("tenantId","SYSTEM"), caller_email, "USER_UNLOCKED",
              f"Unlocked user: {email}")
        return resp(200, {"message": f"User {email} unlocked"})

    # ── POST /api/admin/users/{id}/reset-password ─────────────────────────
    if "/users/" in path and path.endswith("/reset-password") and method == "POST":
        user_id = path.split("/")[-2]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item: return err(404, "User not found")
        email = item.get("email", "")
        new_password = body.get("password") or f"Reset@{str(uuid.uuid4())[:8]}!"
        try:
            cognito.admin_set_user_password(UserPoolId=POOL_ID, Username=email,
                Password=new_password, Permanent=True)
        except ClientError as e:
            return err(400, f"Password reset failed: {e.response['Error']['Message']}")
        audit(item.get("tenantId","SYSTEM"), caller_email, "PASSWORD_RESET",
              f"Reset password for: {email}")
        return resp(200, {"message": f"Password reset for {email}", "new_password": new_password})

    # ── GET /api/admin/audit ──────────────────────────────────────────────
    if path.endswith("/audit") and method == "GET":
        result = AUDIT_T.scan()
        logs = sorted(result.get("Items", []), key=lambda x: x.get("createdAt",""), reverse=True)[:200]
        return resp(200, {"logs": logs})

    # ── GET /api/admin/health ─────────────────────────────────────────────
    if path.endswith("/health") and method == "GET":
        # Quick health probes
        dynamo_ok = "ok"
        cognito_ok = "ok"
        try:
            USERS_T.scan(Limit=1)
        except:
            dynamo_ok = "error"
        try:
            cognito.describe_user_pool(UserPoolId=POOL_ID)
        except:
            cognito_ok = "error"
        overall = "healthy" if dynamo_ok == "ok" and cognito_ok == "ok" else "degraded"
        return resp(200, {"status": overall, "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {"dynamodb": dynamo_ok, "cognito": cognito_ok, "lambda": "ok"}})

    # ── POST /api/admin/invite ────────────────────────────────────────────
    # Invite any email (gmail, hotmail, corporate) as any role to any tenant
    if path.endswith("/invite") and method == "POST":
        email      = (body.get("email") or "").lower().strip()
        user_role  = body.get("role") or "EMPLOYEE"
        tenant_id  = body.get("tenantId") or ""
        first      = body.get("firstName") or ""
        last       = body.get("lastName") or ""
        if not email: return err(400, "Email required")
        if user_role not in ("GLOBAL_ADMIN", "HR_ADMIN", "EMPLOYEE"):
            return err(400, "Invalid role")
        if user_role in ("HR_ADMIN", "EMPLOYEE") and not tenant_id:
            return err(400, "tenantId required for HR_ADMIN/EMPLOYEE")
        # Get tenant info
        tenant_name = ""
        if tenant_id:
            t = TENANTS_T.get_item(Key={"tenantId": tenant_id}).get("Item")
            if not t: return err(404, f"Tenant {tenant_id} not found")
            tenant_name = t.get("name", "")
        # Generate invite token
        invite_token = str(uuid.uuid4())
        temp_password = f"Invite@{str(uuid.uuid4())[:8]}!"
        # Create Cognito user
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
            cognito.admin_set_user_password(UserPoolId=POOL_ID, Username=email, Password=temp_password, Permanent=True)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "UsernameExistsException":
                return err(409, f"User {email} already exists")
            return err(400, str(e.response["Error"]["Message"]))
        # Save to DynamoDB
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.put_item(Item={
            "userId": user_id, "tenantId": tenant_id, "email": email,
            "firstName": first, "lastName": last, "role": user_role,
            "status": "pending", "inviteToken": invite_token,
            "createdBy": caller_email, "createdAt": now
        })
        # Send invite email via SES
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
                          <p>Click below to set up your account:</p>
                          <a href="{invite_url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">Accept Invitation</a>
                          <p style="color:#666;font-size:12px">Your temporary password: <code>{temp_password}</code><br>Login at: <a href="https://main.d1vgn9nzfx4cxk.amplifyapp.com/login">Endevo Life Login</a></p>
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
            "user_id": user_id,
            "email_sent": email_sent,
            "temp_password": temp_password,
            "invite_url": invite_url
        })

    return err(404, f"Route not found: {method} {path}")
