"""DynamoDB resource and table references for the LMS Lambda."""
import os

import boto3
from boto3.dynamodb.conditions import Key, Attr  # re-exported for route modules

REGION: str = os.environ.get("REGION", "us-east-1")

_dynamo = boto3.resource("dynamodb", region_name=REGION)


def table(name: str):  # noqa: ANN201
    """Return a DynamoDB Table resource by name."""
    return _dynamo.Table(name)


# ── Named table references used across route modules ──────────────────────────
USERS_T = table("endevo-uat-users")
TRAINING_T = table("endevo-uat-training")
QUESTIONS_T = table("endevo-uat-questions")
RESPONSES_T = table("endevo-uat-responses")
VIDEO_PROG_T = table("endevo-uat-video-progress")
CERTS_T = table("endevo-uat-certificates")
MODULES_T = table("endevo-uat-lms-modules")
USER_MODULES_T = table("endevo-uat-lms-user-modules")
CONFIG_T = table("endevo-uat-config")
LESSONS_T = table("endevo-uat-lms-lessons")
LESSON_PROG_T = table("endevo-uat-lms-lesson-progress")
