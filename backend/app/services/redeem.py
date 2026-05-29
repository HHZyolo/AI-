"""兑换码核销公共逻辑。

被两个地方调用：
  - /auth/register（注册时可选填）
  - /users/redeem  （登录后任意时间兑换）
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.redeem_code import RedeemCode


def normalize_code(code: str) -> str:
    """兑换码统一存大写，比较时同。"""
    return code.strip().upper()


async def consume_redeem_code(
    db: AsyncSession, raw_code: str
) -> tuple[RedeemCode, int]:
    """校验并核销兑换码，返回 (code 实例, 奖励秒数)。

    成功时已自增 code.used_count。调用方负责 db.commit() —— 这样
    可以与「给 user 加余额」放在同一个 transaction 里，保证原子性。
    """
    code_str = normalize_code(raw_code)
    code = await db.scalar(
        select(RedeemCode).where(RedeemCode.code == code_str).with_for_update()
    )
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="兑换码无效"
        )
    if code.expires_at is not None and code.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="兑换码已过期"
        )
    if code.max_uses is not None and code.used_count >= code.max_uses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="兑换码已被领完"
        )
    code.used_count += 1
    return code, code.bonus_seconds
