"""应用配置。

从环境变量 / .env 读取，全程通过 get_settings() 访问（带缓存，单例）。
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 运行环境
    env: str = "development"
    log_level: str = "INFO"

    # 服务监听
    host: str = "0.0.0.0"
    port: int = 8000

    # 数据库
    database_url: str = "sqlite+aiosqlite:///./data/aipeiwan.db"

    # CORS：逗号分隔的来源字符串，经 cors_origins 属性解析为列表。
    # 存为 str 而非 list，避免 pydantic-settings 把 .env 值按 JSON 解析。
    cors_origins_raw: str = "http://localhost:5173"

    # 认证
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    # 新用户试用额度（秒）
    trial_seconds: int = 600  # 10 分钟

    # —— 火山引擎 · 语音技术(TTS + 流式 ASR 共用一组凭证) ——
    # 来源:控制台「语音技术 → 应用管理」中你创建的应用(default)
    volc_app_id: str = ""
    volc_access_token: str = ""
    # TTS 默认采样率,豆包 TTS 大模型支持 8000/16000/24000/48000;
    # 浏览器播放走 mp3,采样率影响不大,先用 24000 兼顾质量与体积
    tts_sample_rate: int = 24000
    # TTS 编码格式:mp3 / pcm / ogg_opus —— 浏览器直接播 mp3 最省事
    tts_encoding: str = "mp3"
    # TTS 默认音色,未在 DB 中指定 voice_id 时回落到这个(便于早期角色还没选音色时也能试听)
    tts_default_voice_id: str = "zh_female_wanwanxiaohe_moon_bigtts"

    # —— 火山 · 端到端实时语音大模型(Doubao Realtime Voice) ——
    # 沿用 VOLC_APP_ID / VOLC_ACCESS_TOKEN 鉴权,只是 Resource-Id 不同。
    # 切海外/换 region 改这两个值即可,代码不动。
    realtime_ws_url: str = "wss://openspeech.bytedance.com/api/v3/realtime/dialogue"
    realtime_resource_id: str = "volc.speech.dialog"

    # —— 火山方舟 · 文本大模型(LLM) ——
    # 来源:火山方舟控制台「API Key 管理」
    ark_api_key: str = ""
    # 新版协议直接用模型名,不需要推理接入点;ark_endpoint_id 留作老协议兼容位。
    # 若 ark_endpoint_id 非空,以它为准(老接入点 ep-xxxxxx);否则用 ark_model。
    ark_model: str = "doubao-seed-1-6-250615"
    ark_endpoint_id: str = ""
    # LLM 单轮回复字数上限。陪玩场景要短,默认 80 tokens 大约 30-40 个汉字。
    ark_max_tokens: int = 120
    # 创造性:0.0~1.5,陪玩要"活"一点,但不能跑题
    ark_temperature: float = 0.85

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    """返回全局唯一的 Settings 实例。"""
    return Settings()
