"""FastAPI 应用入口。

启动：cd backend && .venv/bin/uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, characters, health, users
from app.config import get_settings
from app.database import close_db, init_db
from app.logging_conf import setup_logging

settings = get_settings()
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时建表，关闭时释放连接池。"""
    logger.info("服务启动中… env=%s", settings.env)
    await init_db()
    yield
    await close_db()
    logger.info("服务已关闭")


app = FastAPI(
    title="AI 陪玩搭子 后端",
    description="面向 PC 战术 FPS 玩家的 AI 语音陪玩 · MVP",
    version="0.1.0",
    lifespan=lifespan,
    # 生产环境关闭交互式文档
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册（后续功能在此追加）
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(characters.router)
app.include_router(admin.router)


@app.get("/", tags=["root"])
async def root() -> dict:
    return {"service": "ai-peiwan-backend", "version": app.version}
