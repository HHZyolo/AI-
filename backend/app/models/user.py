"""用户 ORM 模型。"""

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# 主键类型：MySQL 用 BIGINT，SQLite 用 INTEGER（SQLite 仅 INTEGER 主键能自增）。
_PK = BigInteger().with_variant(Integer, "sqlite")


class User(Base):
    """用户。

    账号体系：邮箱 + 密码（bcrypt 哈希存 password_hash）。
    余额采用单一秒数池 balance_seconds：注册时灌入试用额度，付费后累加，
    语音对话按秒扣减。is_trial_granted 标记试用是否已发放，防止重复领取。
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    # 剩余可用语音秒数（试用 + 付费，统一池）
    balance_seconds: Mapped[int] = mapped_column(Integer, default=0)
    # 累计付费充值的秒数（仅统计用，不参与扣费）
    total_paid_seconds: Mapped[int] = mapped_column(Integer, default=0)
    # 试用额度是否已发放
    is_trial_granted: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
