"""兑换码相关请求/响应模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RedeemCodeCreate(BaseModel):
    """运营创建兑换码：可手动指定 code，也可留空让后端生成。"""

    code: str | None = Field(
        default=None,
        max_length=64,
        description="自定义码（留空则随机生成 8 位大写）",
    )
    bonus_seconds: int | None = Field(
        default=None,
        gt=0,
        le=86400 * 365,
        description="单次核销奖励秒数，留空走配置默认 1800（30 分钟）",
    )
    max_uses: int | None = Field(
        default=None, gt=0, description="总可使用次数，留空表示不限制"
    )
    expires_at: datetime | None = Field(
        default=None, description="过期时间（UTC），留空表示永不过期"
    )
    note: str | None = Field(default=None, max_length=255, description="备注")


class RedeemCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    bonus_seconds: int
    max_uses: int | None
    used_count: int
    expires_at: datetime | None
    note: str | None
    created_at: datetime
