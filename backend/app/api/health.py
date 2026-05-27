"""健康检查接口。

供负载均衡 / 部署平台探活，也方便本地确认服务与数据库连通。
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """轻量探活：不碰数据库，只确认进程存活。"""
    settings = get_settings()
    return {"status": "ok", "env": settings.env}


@router.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)) -> dict:
    """深度探活：执行一次 SELECT 1 确认数据库可达。"""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:  # noqa: BLE001 - 探活需吞掉异常返回明确状态
        logger.error("数据库探活失败: %s", exc)
        return {"status": "error", "database": "unreachable"}
