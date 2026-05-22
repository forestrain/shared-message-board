from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models import User
from app.schemas.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def read_me(user: User = Depends(get_current_user)) -> User:
    return user
