"""AI 角色 ORM 模型 —— F05。

每个角色对应一个完整的"人设 + 语音"配置:人设(system_prompt)交给 LLM 做语气,
voice_id 交给 TTS/实时语音引擎合成对应音色。voice_provider 预留多厂商扩展,
当前 MVP 固定为 'doubao'(火山引擎豆包实时语音)。
"""

from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


_PK = BigInteger().with_variant(Integer, "sqlite")


class Character(Base):
    """AI 角色。

    展示字段(name/persona/quote/...) 与落地页 landing/src/data/characters.js 字段对齐,
    后端为权威数据源,前端最终从 GET /characters 拉取。
    """

    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)

    # —— 标识与展示 ——
    slug: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(32))
    age: Mapped[str] = mapped_column(String(16))
    persona: Mapped[str] = mapped_column(String(64))
    call: Mapped[str] = mapped_column(String(32))
    quote: Mapped[str] = mapped_column(String(255))
    # CSV 形式存 3 个标签;查询时按需 split。这种轻量 ORM 不引 JSON 列,SQLite/MySQL 都好用。
    traits_csv: Mapped[str] = mapped_column(String(128))
    accent: Mapped[str] = mapped_column(String(32))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # —— LLM 人设 ——
    # 完整 system prompt,实时对话时直接塞给模型,决定语气、口头禅、边界。
    system_prompt: Mapped[str] = mapped_column(Text)
    # 接通后的第一句话,让用户点"开始陪玩"立刻有反馈,不等模型现生成。
    greeting: Mapped[str] = mapped_column(String(255), default="")

    # —— 语音(TTS / 实时语音)——
    voice_provider: Mapped[str] = mapped_column(String(16), default="doubao")
    # 平台音色 ID;选定前留空,等火山控制台试听后回填。
    voice_id: Mapped[str] = mapped_column(String(64), default="")
    # 语速,豆包/MiniMax 通常支持 0.5~2.0,1.0 为基线
    speech_rate: Mapped[float] = mapped_column(Float, default=1.0)
    # 音调微调,通常 0.5~2.0,1.0 为基线
    speech_pitch: Mapped[float] = mapped_column(Float, default=1.0)

    # —— 状态 ——
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )
