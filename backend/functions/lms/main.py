"""
Endevo Life — LMS Lambda entry point router.

Routes dispatched:
  /api/lms/assessment/*  → routes/assessment.py
  /api/lms/course/*      → routes/course.py
  /api/lms/progress/*    → routes/progress.py
  /api/lms/quiz/*        → routes/quiz.py
  /api/lms/admin/*       → routes/admin.py
"""
import logging

from utils.response import ok, err, cors, set_event
from utils.auth import get_caller
from routes import assessment, course, progress, quiz, admin, lessons, lesson_quiz

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:  # noqa: ANN001
    """Lambda entry point — route incoming HTTP events."""
    set_event(event)

    method: str = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", "GET")
        .upper()
    )
    path: str = event.get("rawPath", "")

    # Always handle pre-flight before auth
    if method == "OPTIONS":
        return cors()

    logger.info({"method": method, "path": path})

    try:
        tenant_id, email, user_id, role = get_caller(event)
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected error in get_caller: %s", exc)
        return err(500, "Internal server error")

    # Route to the correct sub-handler based on path segment.
    # Segments are checked in specificity order; /admin is last to avoid
    # accidentally matching paths that also contain "admin" as a sub-word.
    if "/lms/assessment" in path:
        return assessment.handle(event, method, path, tenant_id, email, user_id, role)
    if "/lms/course" in path:
        return course.handle(event, method, path, tenant_id, email, user_id, role)
    if "/lms/progress" in path:
        return progress.handle(event, method, path, tenant_id, email, user_id, role)
    # Lesson quiz routes must be checked before generic /lessons/ to avoid
    # the quiz sub-path being swallowed by the lessons dispatcher.
    if "/lms/lessons/" in path and "/quiz" in path:
        return lesson_quiz.handle(event, method, path, tenant_id, email, user_id, role)
    if "/lms/lessons" in path:
        return lessons.handle(event, method, path, tenant_id, email, user_id, role)
    if "/lms/quiz" in path:
        return quiz.handle(event, method, path, tenant_id, email, user_id, role)
    if "/lms/admin" in path:
        return admin.handle(event, method, path, tenant_id, email, user_id, role)

    return err(404, "Route not found")
