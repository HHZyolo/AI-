"""认证接口：邮箱+密码注册、登录。

注册不做邮箱验证，账号唯一性由数据库 unique 约束保证。
注册成功直接签发 JWT 并发放试用额度，不再要求登录一次。
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.services.password import hash_password, verify_password
from app.services.redeem import consume_redeem_code
from app.services.security import create_access_token

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    """邮箱大小写不敏感，统一存小写。"""
    return email.strip().lower()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """邮箱+密码注册。新用户发放试用额度，可选用兑换码额外加时长。"""
    email = _normalize_email(body.email)

    exists = await db.scalar(select(User.id).where(User.email == email))
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册"
        )

    bonus_seconds = 0
    code_used: str | None = None
    if body.redeem_code and body.redeem_code.strip():
        code, bonus_seconds = await consume_redeem_code(db, body.redeem_code)
        code_used = code.code

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        balance_seconds=settings.trial_seconds + bonus_seconds,
        is_trial_granted=True,
        redeem_code_used=code_used,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(
        "新用户注册：%s，试用 %d 秒，兑换码 %s 额外 %d 秒",
        email,
        settings.trial_seconds,
        code_used or "（未使用）",
        bonus_seconds,
    )

    token = create_access_token(user.id)
    return AuthResponse(
        access_token=token, is_new_user=True, redeem_bonus_seconds=bonus_seconds
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """邮箱+密码登录。"""
    email = _normalize_email(body.email)

    user = await db.scalar(select(User).where(User.email == email))
    # 邮箱不存在 / 密码错误统一返回同一错误，避免暴露账号是否存在
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误"
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, is_new_user=False)
