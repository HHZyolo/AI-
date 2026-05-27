"""认证与用户相关的请求/响应模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="邮箱，作为账号")
    password: str = Field(..., min_length=8, max_length=128, description="密码，最少 8 位")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=8, max_length=128, description="密码")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool = Field(..., description="本次响应是否对应一次新注册")


class UserProfile(BaseModel):
    """用户个人信息，对应 GET /users/me。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    balance_seconds: int = Field(..., description="剩余可用语音秒数")
    total_paid_seconds: int = Field(..., description="累计付费秒数")
    is_trial_granted: bool
    created_at: datetime
