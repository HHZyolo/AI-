"""认证与用户相关的请求/响应模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="邮箱，作为账号")
    password: str = Field(..., min_length=8, max_length=128, description="密码，最少 8 位")
    redeem_code: str | None = Field(
        default=None,
        max_length=64,
        description="可选兑换码，注册时核销可获得额外体验时长",
    )


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=8, max_length=128, description="密码")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool = Field(..., description="本次响应是否对应一次新注册")
    redeem_bonus_seconds: int = Field(
        default=0, description="本次注册因兑换码额外发放的秒数（0 表示未使用或无效）"
    )


class UserProfile(BaseModel):
    """用户个人信息，对应 GET /users/me。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    balance_seconds: int = Field(..., description="剩余可用语音秒数")
    total_paid_seconds: int = Field(..., description="累计付费秒数")
    is_trial_granted: bool
    redeem_code_used: str | None = Field(
        default=None, description="该账号已使用过的兑换码（一辈子只能用一次）"
    )
    created_at: datetime


class ConsumeRequest(BaseModel):
    seconds: int = Field(..., gt=0, le=86400, description="本次通话消耗的秒数")


class ConsumeResponse(BaseModel):
    balance_seconds: int = Field(..., description="扣减后的剩余秒数")
    consumed_seconds: int = Field(..., description="本次实际扣减的秒数（不超过剩余）")


class RedeemRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=64, description="兑换码")


class RedeemResponse(BaseModel):
    balance_seconds: int = Field(..., description="兑换后的余额秒数")
    bonus_seconds: int = Field(..., description="本次兑换获得的秒数")
    code: str = Field(..., description="实际核销的兑换码（已规范化为大写）")
