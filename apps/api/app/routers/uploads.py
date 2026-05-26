from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel

from app.deps import get_current_user
from app.models import User
from app.services.media import save_post_image

router = APIRouter(prefix="/uploads", tags=["uploads"])


class ImageUploadOut(BaseModel):
    url: str


@router.post("/image", response_model=ImageUploadOut)
async def upload_image(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> ImageUploadOut:
    url = await save_post_image(file)
    return ImageUploadOut(url=url)
