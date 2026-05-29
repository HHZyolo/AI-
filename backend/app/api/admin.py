"""管理接口：兑换码创建/查询。

简单 X-Admin-Token 鉴权。生产环境务必把 ADMIN_TOKEN 改成长随机串。
后期接入运营后台时可替换成完整 RBAC。
"""

import logging
import secrets
import string

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.redeem_code import RedeemCode
from app.schemas.redeem import RedeemCodeCreate, RedeemCodeOut

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/admin", tags=["admin"])

_CODE_ALPHABET = string.ascii_uppercase + string.digits


async def _require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """简单 header 鉴权：X-Admin-Token 与 settings.admin_token 一致才放行。"""
    if not x_admin_token or not secrets.compare_digest(
        x_admin_token, settings.admin_token
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="管理员凭证无效"
        )


def _gen_code(length: int = 8) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


@router.post(
    "/redeem-codes",
    response_model=RedeemCodeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_require_admin)],
)
async def create_redeem_code(
    body: RedeemCodeCreate, db: AsyncSession = Depends(get_db)
) -> RedeemCode:
    """创建一个兑换码。code 留空则自动生成（重码自动重试 5 次）。"""
    bonus = body.bonus_seconds or settings.redeem_code_bonus_seconds

    if body.code:
        code_str = body.code.strip().upper()
        if await db.scalar(select(RedeemCode.id).where(RedeemCode.code == code_str)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="该兑换码已存在"
            )
    else:
        code_str = None
        for _ in range(5):
            candidate = _gen_code()
            if not await db.scalar(
                select(RedeemCode.id).where(RedeemCode.code == candidate)
            ):
                code_str = candidate
                break
        if code_str is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="生成兑换码失败，请重试",
            )

    code = RedeemCode(
        code=code_str,
        bonus_seconds=bonus,
        max_uses=body.max_uses,
        expires_at=body.expires_at,
        note=body.note,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)
    logger.info(
        "管理员创建兑换码 %s：奖励 %d 秒，上限 %s",
        code.code,
        code.bonus_seconds,
        code.max_uses if code.max_uses is not None else "∞",
    )
    return code


@router.get(
    "/redeem-codes",
    response_model=list[RedeemCodeOut],
    dependencies=[Depends(_require_admin)],
)
async def list_redeem_codes(db: AsyncSession = Depends(get_db)) -> list[RedeemCode]:
    """列出全部兑换码（按创建时间倒序）。"""
    result = await db.scalars(
        select(RedeemCode).order_by(RedeemCode.created_at.desc())
    )
    return list(result)


@router.delete(
    "/redeem-codes/{code_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_require_admin)],
)
async def delete_redeem_code(
    code_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """删除一个兑换码。已被使用的码也允许删除（仅影响后续核销）。"""
    code = await db.get(RedeemCode, code_id)
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="兑换码不存在"
        )
    await db.delete(code)
    await db.commit()
    logger.info("管理员删除兑换码 %s（id=%d）", code.code, code_id)
