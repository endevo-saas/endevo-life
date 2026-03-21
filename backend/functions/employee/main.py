"""
Endevo Life — Employee Lambda (pure boto3, no pip needed)
Routes: dashboard, profile, training list, video progress, assessment, certificates
"""
import json, os, uuid, boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

POOL_ID  = os.environ.get("COGNITO_POOL_ID", "us-east-1_DVyEJqgFt")
REGION   = os.environ.get("AWS_REGION", "us-east-1")
dynamo   = boto3.resource("dynamodb", region_name=REGION)
cognito  = boto3.client("cognito-idp", region_name=REGION)
USERS_T  = dynamo.Table("endevo-uat-users")
TRAIN_T  = dynamo.Table("endevo-uat-training")
PROG_T   = dynamo.Table("endevo-uat-video-progress")
QUEST_T  = dynamo.Table("endevo-uat-questions")
RESP_T   = dynamo.Table("endevo-uat-responses")
CERT_T   = dynamo.Table("endevo-uat-certificates")

def resp(status, body):
    return {"statusCode": status, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"}, "body": json.dumps(body, default=str)}

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
        return attrs.get("custom:tenantId"), attrs.get("email"), attrs.get("sub", "")
    except: return None, None, None

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path   = event.get("rawPath", "")
    if method == "OPTIONS": return resp(200, {})
    body = get_body(event)
    tenant_id, email, user_sub = get_caller(event)
    if not tenant_id: return err(401, "Not authenticated")

    # GET /api/employee/dashboard
    if path.endswith("/dashboard") and method == "GET":
        certs = CERT_T.scan(FilterExpression="tenantId = :t AND userId = :u", ExpressionAttributeValues={":t": tenant_id, ":u": user_sub})
        courses = TRAIN_T.scan(FilterExpression="tenantId = :t", ExpressionAttributeValues={":t": tenant_id})
        progress = PROG_T.scan(FilterExpression="userId = :u", ExpressionAttributeValues={":u": user_sub})
        total_courses = len(courses.get("Items", []))
        completed = len([p for p in progress.get("Items", []) if p.get("completed")])
        return resp(200, {
            "total_courses":     total_courses,
            "completed_courses": completed,
            "certificates":      len(certs.get("Items", [])),
            "progress_pct":      round((completed / total_courses * 100) if total_courses > 0 else 0, 1)
        })

    # GET /api/employee/profile
    if path.endswith("/profile") and method == "GET":
        result = USERS_T.scan(FilterExpression="email = :e AND tenantId = :t", ExpressionAttributeValues={":e": email, ":t": tenant_id})
        items = result.get("Items", [])
        if not items: return err(404, "Profile not found")
        profile = {k: v for k, v in items[0].items() if k not in ["inviteToken"]}
        return resp(200, profile)

    # PUT /api/employee/profile
    if path.endswith("/profile") and method == "PUT":
        allowed = ["firstName","lastName","jobTitle","department"]
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates: return err(400, "Nothing to update")
        result = USERS_T.scan(FilterExpression="email = :e AND tenantId = :t", ExpressionAttributeValues={":e": email, ":t": tenant_id})
        items = result.get("Items", [])
        if not items: return err(404, "Profile not found")
        user_id = items[0]["userId"]
        expr  = "SET " + ", ".join([f"#{k} = :{k}" for k in updates])
        names = {f"#{k}": k for k in updates}
        vals  = {f":{k}": v for k, v in updates.items()}
        USERS_T.update_item(Key={"userId": user_id}, UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=vals)
        return resp(200, {"message": "Profile updated"})

    # GET /api/employee/training
    if path.endswith("/training") and method == "GET":
        courses = TRAIN_T.scan(FilterExpression="tenantId = :t", ExpressionAttributeValues={":t": tenant_id})
        progress = PROG_T.scan(FilterExpression="userId = :u", ExpressionAttributeValues={":u": user_sub})
        prog_map = {p["courseId"]: p for p in progress.get("Items", [])}
        result = []
        for c in courses.get("Items", []):
            cid = c.get("courseId","")
            p = prog_map.get(cid, {})
            result.append({**c, "progress_pct": p.get("progressPct", 0), "completed": p.get("completed", False)})
        return resp(200, {"courses": result, "count": len(result)})

    # POST /api/employee/progress
    if path.endswith("/progress") and method == "POST":
        course_id   = body.get("course_id") or ""
        progress_pct = body.get("progress_pct") or 0
        completed   = body.get("completed", False)
        if not course_id: return err(400, "course_id required")
        PROG_T.put_item(Item={"userId": user_sub, "videoId": course_id, "progressId": str(uuid.uuid4()), "tenantId": tenant_id, "courseId": course_id, "progressPct": progress_pct, "completed": completed, "updatedAt": datetime.now(timezone.utc).isoformat()})
        return resp(200, {"message": "Progress saved"})

    # GET /api/employee/assessment/{courseId}
    if "/assessment/" in path and method == "GET":
        course_id = path.split("/")[-1]
        questions = QUEST_T.scan(FilterExpression="courseId = :c", ExpressionAttributeValues={":c": course_id})
        qs = [{k: v for k, v in q.items() if k != "correctAnswer"} for q in questions.get("Items", [])]
        return resp(200, {"questions": qs, "count": len(qs)})

    # POST /api/employee/assessment/{courseId}/submit
    if "/assessment/" in path and path.endswith("/submit") and method == "POST":
        parts = path.split("/")
        course_id = parts[-2]
        answers = body.get("answers", {})
        questions = QUEST_T.scan(FilterExpression="courseId = :c", ExpressionAttributeValues={":c": course_id})
        qs = questions.get("Items", [])
        if not qs: return err(404, "Assessment not found")
        correct = sum(1 for q in qs if answers.get(q["questionId"]) == q.get("correctAnswer"))
        score = round(correct / len(qs) * 100)
        passed = score >= 70
        resp_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        RESP_T.put_item(Item={"responseId": resp_id, "userId": user_sub, "tenantId": tenant_id, "courseId": course_id, "score": score, "passed": passed, "answers": answers, "submittedAt": now})
        if passed:
            CERT_T.put_item(Item={"certId": str(uuid.uuid4()), "userId": user_sub, "tenantId": tenant_id, "courseId": course_id, "email": email, "score": score, "issuedAt": now})
        return resp(200, {"score": score, "passed": passed, "correct": correct, "total": len(qs), "certificate_issued": passed})

    # GET /api/employee/certificates
    if path.endswith("/certificates") and method == "GET":
        certs = CERT_T.scan(FilterExpression="userId = :u AND tenantId = :t", ExpressionAttributeValues={":u": user_sub, ":t": tenant_id})
        return resp(200, {"certificates": certs.get("Items", []), "count": len(certs.get("Items", []))})

    return err(404, f"Route not found: {method} {path}")
