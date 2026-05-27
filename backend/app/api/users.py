"""用户接口：查询个人信息与余额。"""

from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.auth import UserProfile
from app.services.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """返回当前登录用户的个人信息与剩余额度。"""
    return current_user
