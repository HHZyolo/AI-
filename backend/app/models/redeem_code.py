"""兑换码 ORM 模型。

运营方在后台创建，发给用户在注册时使用，给账号增加额度。
"""

from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# 主键类型：MySQL/PG 用 BIGINT，SQLite 仅 INTEGER 主键能自增。
_PK = BigInteger().with_variant(Integer, "sqlite")


class RedeemCode(Base):
    """兑换码。

    一个码可以被多人使用，但有总次数上限（max_uses）。
    使用次数到达上限或过期后自动失效。
    业务规则：同一个用户一辈子只能用一次兑换码（在 users.redeem_code_used 上拦截）。
    """

    __tablename__ = "redeem_codes"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    # 兑换码字符串，全局唯一，大小写不敏感（统一存大写）
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # 单次核销奖励秒数（默认走 settings.redeem_code_bonus_seconds，但允许后台覆盖）
    bonus_seconds: Mapped[int] = mapped_column(Integer)
    # 总可使用次数；NULL 表示不限制
    max_uses: Mapped[int | None] = mapped_column(Integer, default=None)
    # 已使用次数
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    # 过期时间；NULL 表示永不过期
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    # 备注（运营自用，记录这批码的用途）
    note: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
