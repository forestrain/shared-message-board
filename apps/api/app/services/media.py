from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

UPLOAD_URL_PREFIX = "/uploads/"
_EXT_BY_KIND = {
    "jpeg": ".jpg",
    "png": ".png",
    "gif": ".gif",
    "webp": ".webp",
}


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def sniff_image_kind(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


async def save_post_image(file: UploadFile) -> str:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="仅支持图片文件")

    raw = await file.read()
    max_bytes = settings.upload_max_bytes
    if len(raw) > max_bytes:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"图片不能超过 {max_bytes // 1024 // 1024}MB",
        )
    if len(raw) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="图片文件为空")

    kind = sniff_image_kind(raw)
    if kind is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="不支持的图片格式（仅 JPG/PNG/GIF/WebP）")

    name = f"{uuid.uuid4().hex}{_EXT_BY_KIND[kind]}"
    path = upload_root() / name
    path.write_bytes(raw)
    return f"{UPLOAD_URL_PREFIX}{name}"


_UPLOAD_PATH_RE = re.compile(r"^/uploads/[0-9a-f]{32}\.(jpg|jpeg|png|gif|webp)$", re.IGNORECASE)


def normalize_image_url(url: str | None) -> str | None:
    if url is None:
        return None
    trimmed = url.strip()
    if not trimmed:
        return None
    if not _UPLOAD_PATH_RE.match(trimmed):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="无效的图片地址")
    filename = trimmed.removeprefix(UPLOAD_URL_PREFIX)
    path = upload_root() / filename
    if not path.is_file():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="图片不存在或已失效，请重新上传")
    return trimmed
