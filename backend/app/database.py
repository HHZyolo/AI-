"""数据库连接。

SQLAlchemy 2.0 异步引擎。当前用 SQLite，上线前把 DATABASE_URL 换成
mysql+aiomysql://... 即可，业务代码无需改动。
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# SQLite 需要 check_same_thread=False 才能在 async 下跨任务复用连接
_connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_async_engine(
    settings.database_url,
    echo=settings.log_level == "DEBUG",
    connect_args=_connect_args,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。后续功能定义的表都继承它。"""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：每个请求一个 session，结束自动关闭。"""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """启动时建表。

    MVP 早期用 create_all 直接建表；后续接入 Alembic 做迁移后改为
    由 Alembic 管理。
    """
    # 触发所有模型注册到 Base.metadata（后续功能会新增模型文件）
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库初始化完成: %s", settings.database_url)


async def close_db() -> None:
    """关闭时释放连接池。"""
    await engine.dispose()
    logger.info("数据库连接已释放")
