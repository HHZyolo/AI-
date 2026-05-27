"""火山引擎 · 豆包语音合成大模型(bigtts)客户端。

当前只实现 HTTP 单次合成 ——「输入文字 → 返回完整音频字节」,用于:
- POST /characters/{slug}/preview-tts 试听接口(挑音色)
- 角色 greeting 预合成(后续可加缓存)

实时对话用的双向流式 WebSocket 版本另起一个 stream_synthesize() 方法实现,
等 F05.4 做实时对话时再补。

接口文档参考:火山引擎语音合成大模型 HTTP 接入。
"""

from __future__ import annotations

import base64
import logging
import uuid
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_TTS_HTTP_URL = "https://openspeech.bytedance.com/api/v1/tts"
_TIMEOUT_SECONDS = 15.0


class TTSError(Exception):
    """TTS 调用失败。包含火山返回的 code 和 message,便于排障。"""

    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"TTS failed (code={code}): {message}")


@dataclass(frozen=True)
class TTSRequest:
    """单次 TTS 合成请求参数。

    text:        要合成的文本,UTF-8,建议 < 200 字
    voice_id:    豆包音色 ID,如 'zh_female_wanwanxiaohe_moon_bigtts'
    speech_rate: 语速 0.5~2.0,1.0 基线
    speech_pitch: 音调 0.5~2.0,1.0 基线
    encoding:    'mp3' / 'pcm' / 'ogg_opus',默认走 settings.tts_encoding
    sample_rate: 采样率,默认走 settings.tts_sample_rate
    """

    text: str
    voice_id: str
    speech_rate: float = 1.0
    speech_pitch: float = 1.0
    encoding: str | None = None
    sample_rate: int | None = None


@dataclass(frozen=True)
class TTSResult:
    """单次 TTS 合成结果。"""

    audio: bytes
    encoding: str
    sample_rate: int
    duration_ms: int  # 火山返回的合成音频时长


async def synthesize(req: TTSRequest) -> TTSResult:
    """单次合成。返回完整音频字节,可直接写文件 / 流给前端。

    抛 TTSError 表示火山侧业务错误;抛 httpx 的异常表示网络层错误。
    """
    settings = get_settings()
    if not settings.volc_app_id or not settings.volc_access_token:
        raise TTSError(-1, "VOLC_APP_ID / VOLC_ACCESS_TOKEN 未配置,请检查 .env")

    encoding = req.encoding or settings.tts_encoding
    sample_rate = req.sample_rate or settings.tts_sample_rate

    # 火山要求 reqid 全局唯一,用 uuid4
    reqid = uuid.uuid4().hex
    payload = {
        "app": {
            "appid": settings.volc_app_id,
            "token": settings.volc_access_token,  # 必填,实际鉴权走 header
            "cluster": "volcano_tts",
        },
        "user": {
            # 业务侧用户标识,鉴权不依赖此字段,但火山要求非空便于他们排查
            "uid": "ai-peiwan-backend",
        },
        "audio": {
            "voice_type": req.voice_id,
            "encoding": encoding,
            "rate": sample_rate,
            "speed_ratio": req.speech_rate,
            "pitch_ratio": req.speech_pitch,
        },
        "request": {
            "reqid": reqid,
            "text": req.text,
            "operation": "query",  # query=一次性返回完整音频;submit=异步任务
        },
    }
    headers = {
        # 火山特殊鉴权格式:Authorization: Bearer; <token>(分号+空格,不是常规 Bearer)
        "Authorization": f"Bearer; {settings.volc_access_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        resp = await client.post(_TTS_HTTP_URL, json=payload, headers=headers)
        # 4xx/5xx 也可能是火山业务错误(如 403 音色未授权),把它们统一包成 TTSError
        if resp.status_code >= 400:
            try:
                data = resp.json()
                code = data.get("code", resp.status_code)
                msg = data.get("message") or data.get("Message") or resp.text[:200]
            except ValueError:
                code, msg = resp.status_code, resp.text[:200]
            logger.warning(
                "TTS HTTP %s reqid=%s code=%s msg=%s",
                resp.status_code, reqid, code, msg,
            )
            raise TTSError(code, msg)
        data = resp.json()

    # 火山响应结构: {code: 3000, message: 'success', data: '<base64>', addition: {...}}
    code = data.get("code", -1)
    if code != 3000:
        msg = data.get("message", "unknown")
        logger.error("TTS 失败 reqid=%s code=%s msg=%s", reqid, code, msg)
        raise TTSError(code, msg)

    audio_b64 = data.get("data")
    if not audio_b64:
        raise TTSError(code, "响应无 data 字段(音频为空)")

    addition = data.get("addition") or {}
    duration_ms = int(addition.get("duration", 0))

    return TTSResult(
        audio=base64.b64decode(audio_b64),
        encoding=encoding,
        sample_rate=sample_rate,
        duration_ms=duration_ms,
    )
