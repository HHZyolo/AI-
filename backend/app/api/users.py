"""用户接口：查询个人信息与余额、通话结束后扣减额度、登录后核销兑换码。"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ConsumeRequest,
    ConsumeResponse,
    RedeemRequest,
    RedeemResponse,
    UserProfile,
)
from app.services.redeem import consume_redeem_code
from app.services.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """返回当前登录用户的个人信息与剩余额度。"""
    return current_user


@router.post("/consume", response_model=ConsumeResponse)
async def consume(
    body: ConsumeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsumeResponse:
    """通话结束时上报本次消耗的秒数，后端落库扣减。

    用前端乐观扣减替代后端落库会造成「退出重进刷新时长」的 Bug；
    此接口是真实账本，前端只负责显示。
    """
    consumed = min(body.seconds, current_user.balance_seconds)
    current_user.balance_seconds = max(0, current_user.balance_seconds - consumed)
    await db.commit()
    await db.refresh(current_user)
    logger.info(
        "用户 %s 消耗 %d 秒，剩余 %d 秒",
        current_user.email,
        consumed,
        current_user.balance_seconds,
    )
    return ConsumeResponse(
        balance_seconds=current_user.balance_seconds, consumed_seconds=consumed
    )


@router.post("/redeem", response_model=RedeemResponse)
async def redeem(
    body: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RedeemResponse:
    """登录后核销兑换码，给账号增加额度。

    业务规则：每个账号一辈子只能兑换一次（防刷号）。
    """
    if current_user.redeem_code_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账号已使用过兑换码，每个账号仅限一次",
        )

    code, bonus_seconds = await consume_redeem_code(db, body.code)
    current_user.balance_seconds += bonus_seconds
    current_user.redeem_code_used = code.code
    await db.commit()
    await db.refresh(current_user)
    logger.info(
        "用户 %s 核销兑换码 %s，+%d 秒，余额 %d 秒",
        current_user.email,
        code.code,
        bonus_seconds,
        current_user.balance_seconds,
    )
    return RedeemResponse(
        balance_seconds=current_user.balance_seconds,
        bonus_seconds=bonus_seconds,
        code=code.code,
    )
