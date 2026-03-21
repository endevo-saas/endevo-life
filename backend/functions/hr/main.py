"""
Endevo Life — HR Admin Lambda (pure boto3, no pip needed)
Routes: dashboard, employees list, invite, update, deactivate, audit log
"""
import json, os, uuid, boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

POOL_ID   = os.environ.get("COGNITO_POOL_ID", "us-east-1_DVyEJqgFt")
REGION    = os.environ.get("AWS_REGION", "us-east-1")
dynamo    = boto3.resource("dynamodb", region_name=REGION)
cognito   = boto3.client("cognito-idp", region_name=REGION)
ses       = boto3.client("ses", region_name=REGION)
USERS_T   = dynamo.Table("endevo-uat-users")
AUDIT_T   = dynamo.Table("endevo-uat-audit")

def resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"}, "body": json.dumps(body, default=str)}

def err(status, msg): return resp(status, {"detail": msg})
def get_body(event):
    try: return json.loads(event.get("body") or "{}")
    except: return {}

def get_caller(event):
    token = (event.get("headers") or {}).get("authorization", "").replace("Bearer ", "")
    if not token: return None, None, None
    try:
        u = cognito.get_user(AccessToken=token)
        attrs = {a["Name"]: a["Value"] for a in u["UserAttributes"]}
        return attrs.get("custom:tenantId"), attrs.get("custom:role"), attrs.get("email")
    except: return None, None, None

def audit(tenant_id, actor, action, details=""):
    try:
        now = datetime.now(timezone.utc).isoformat()
        audit_id = str(uuid.uuid4())
        AUDIT_T.put_item(Item={"tenantId": tenant_id, "sk": f"{now}#{audit_id}", "auditId": audit_id, "actor": actor, "action": action, "details": details, "createdAt": now})
    except Exception as e:
        print(f"AUDIT_WRITE_ERROR: {e}")

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    if method == "OPTIONS": return resp(200, {})
    body = get_body(event)
    tenant_id, role, caller_email = get_caller(event)
    if not tenant_id: return err(401, "Not authenticated")
    if role not in ("HR_ADMIN", "GLOBAL_ADMIN"): return err(403, "HR Admin access required")

    # GET /api/hr/dashboard
    if path.endswith("/dashboard") and method == "GET":
        result = USERS_T.scan(FilterExpression="tenantId = :t", ExpressionAttributeValues={":t": tenant_id})
        users = result.get("Items", [])
        return resp(200, {
            "total_users":      len(users),
            "active_users":     len([u for u in users if u.get("status") == "active"]),
            "pending_invites":  len([u for u in users if u.get("status") == "pending"]),
            "total_employees":  len([u for u in users if u.get("role") == "EMPLOYEE"])
        })

    # GET /api/hr/employees
    if path.endswith("/employees") and method == "GET":
        result = USERS_T.scan(
            FilterExpression="tenantId = :t AND #r = :role",
            ExpressionAttributeValues={":t": tenant_id, ":role": "EMPLOYEE"},
            ExpressionAttributeNames={"#r": "role"}
        )
        employees = [{k: v for k, v in e.items() if k != "inviteToken"} for e in result.get("Items", [])]
        return resp(200, {"employees": employees, "count": len(employees)})

    # POST /api/hr/invite
    if path.endswith("/invite") and method == "POST":
        email      = (body.get("email") or "").lower().strip()
        first_name = body.get("first_name") or ""
        last_name  = body.get("last_name") or ""
        department = body.get("department") or "General"
        job_title  = body.get("job_title") or ""
        if not email: return err(400, "Email required")
        invite_token = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        USERS_T.put_item(Item={
            "userId": user_id, "tenantId": tenant_id, "email": email,
            "firstName": first_name, "lastName": last_name,
            "role": "EMPLOYEE", "status": "pending",
            "department": department, "jobTitle": job_title,
            "inviteToken": invite_token, "invitedBy": caller_email, "createdAt": now
        })
        invite_url = f"https://main.d1vgn9nzfx4cxk.amplifyapp.com/register?token={invite_token}"
        try:
            ses.send_email(
                Source="noreply@endevo.life",
                Destination={"ToAddresses": [email]},
                Message={"Subject": {"Data": "You've been invited to Endevo Life"}, "Body": {"Text": {"Data": f"Hi {first_name},\n\nYou have been invited to Endevo Life.\n\nClick here to register:\n{invite_url}\n\nEndevo Life Team"}}}
            )
        except: pass
        audit(tenant_id, caller_email, "INVITE_SENT", f"Invited {email}")
        return resp(200, {"message": "Invitation sent", "user_id": user_id, "invite_url": invite_url})

    # PUT /api/hr/employees/{id}
    if "/employees/" in path and method == "PUT":
        user_id = path.split("/")[-1]
        allowed = ["firstName","lastName","department","jobTitle","status"]
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates: return err(400, "Nothing to update")
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        audit(tenant_id, caller_email, "USER_UPDATED", f"Updated {user_id}")
        return resp(200, {"message": "Employee updated"})

    # DELETE /api/hr/employees/{id}
    if "/employees/" in path and method == "DELETE":
        user_id = path.split("/")[-1]
        item = USERS_T.get_item(Key={"userId": user_id}).get("Item")
        if not item or item.get("tenantId") != tenant_id: return err(404, "Employee not found")
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression="SET #s = :v", ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":v": "inactive"})
        audit(tenant_id, caller_email, "USER_DEACTIVATED", f"Deactivated {item.get('email')}")
        return resp(200, {"message": "Employee deactivated"})

    # GET /api/hr/audit
    if path.endswith("/audit") and method == "GET":
        result = AUDIT_T.scan(FilterExpression="tenantId = :t", ExpressionAttributeValues={":t": tenant_id})
        logs = sorted(result.get("Items", []), key=lambda x: x.get("createdAt",""), reverse=True)[:50]
        return resp(200, {"logs": logs})

    return err(404, f"Route not found: {method} {path}")
