"""S3 presigned URL helpers for video and asset delivery."""
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

REGION: str = os.environ.get("REGION", "us-east-1")
CF_DOMAIN: str = os.environ.get("CF_DOMAIN", "")  # CloudFront domain (optional)
VIDEOS_BUCKET: str = os.environ.get("VIDEOS_BUCKET", "endevo-uat-videos")
ASSETS_BUCKET: str = os.environ.get("ASSETS_BUCKET", "endevo-uat-assets")

_s3 = boto3.client("s3", region_name=REGION)

_VIDEO_EXPIRY = 14400   # 4 hours
_ASSET_EXPIRY = 3600    # 1 hour
_UPLOAD_EXPIRY = 900    # 15 minutes


def get_video_presigned_url(key: str, expires: int = _VIDEO_EXPIRY) -> str:
    """Generate an S3 presigned GET URL for a video object (default 4 h)."""
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": VIDEOS_BUCKET, "Key": key},
        ExpiresIn=expires,
    )


def get_asset_presigned_url(key: str, expires: int = _ASSET_EXPIRY) -> str:
    """Generate an S3 presigned GET URL for a PDF/asset object (default 1 h)."""
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": ASSETS_BUCKET, "Key": key},
        ExpiresIn=expires,
    )


def get_upload_presigned_url(
    bucket: str, key: str, content_type: str, expires: int = _UPLOAD_EXPIRY
) -> str:
    """Generate an S3 presigned PUT URL for admin video/asset uploads (default 15 min)."""
    return _s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )
