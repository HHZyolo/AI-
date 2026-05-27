"""火山引擎 · 豆包录音文件识别大模型 2.0 客户端。

Phase 1 用法:浏览器录一段(wav/webm/mp3),整段送 ASR,返回纯文本。

API 设计为异步任务模型:
  1) POST  /api/v3/auc/bigmodel/submit   提交任务,拿 task_id
  2) POST  /api/v3/auc/bigmodel/query    轮询 task_id 直到 status == 'success'

短语音通常 < 2 秒就完成,这里用短间隔轮询(200ms × 最多 50 次 = 10s 上限)。
后续 Phase 2 实时对话改用流式 WebSocket。
"""

from __future__ import annotations

import asyncio
import base64
import logging
import uuid
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
_QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
# 火山 ASR 大模型 2.0 的固定资源 ID
_RESOURCE_ID = "volc.bigasr.auc"
_SUBMIT_TIMEOUT = 15.0
_QUERY_TIMEOUT = 10.0
_POLL_INTERVAL = 0.2  # 200ms
_POLL_MAX_ATTEMPTS = 50  # 200ms × 50 = 10s 上限


class ASRError(Exception):
    def __init__(self, code: int | str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"ASR failed (code={code}): {message}")


@dataclass(frozen=True)
class ASRResult:
    text: str
    audio_duration_ms: int  # 火山识别出的音频实际时长


def _headers(request_id: str) -> dict[str, str]:
    """火山 ASR 大模型 2.0 的鉴权 header 组合。

    注意命名:App-Key 是 APP_ID,Access-Key 是 ACCESS_TOKEN —— 跟 TTS 1.0 的
    `Authorization: Bearer; <token>` 格式完全不同。
    """
    s = get_settings()
    return {
        "X-Api-App-Key": s.volc_app_id,
        "X-Api-Access-Key": s.volc_access_token,
        "X-Api-Resource-Id": _RESOURCE_ID,
        "X-Api-Request-Id": request_id,
        "Content-Type": "application/json",
    }


async def recognize(audio: bytes, audio_format: str = "wav") -> ASRResult:
    """对一段完整音频做识别,返回文本。

    audio_format: 'wav' | 'mp3' | 'pcm' | 'ogg' | 'm4a' | 'webm'
                  浏览器 MediaRecorder 默认 webm/opus,Safari 可能是 mp4。
    """
    settings = get_settings()
    if not settings.volc_app_id or not settings.volc_access_token:
        raise ASRError(-1, "VOLC_APP_ID / VOLC_ACCESS_TOKEN 未配置,请检查 .env")
    if not audio:
        raise ASRError(-1, "音频字节为空")

    task_id = uuid.uuid4().hex
    submit_payload = {
        "user": {"uid": "ai-peiwan-backend"},
        "audio": {
            # 用 base64 直接传音频内容(< 10MB)。大文件应改成 url 模式,这里不需要。
            "data": base64.b64encode(audio).decode("ascii"),
            "format": audio_format,
        },
        "request": {
            # 不开标点(我们后面塞 LLM,标点不重要);开 disable_itn 避免数字转换乱
            "model_name": "bigmodel",
            "enable_itn": False,
            "enable_punc": True,
            "show_utterances": False,
        },
    }

    async with httpx.AsyncClient(timeout=_SUBMIT_TIMEOUT) as client:
        resp = await client.post(
            _SUBMIT_URL, json=submit_payload, headers=_headers(task_id)
        )
        if resp.status_code >= 400:
            logger.warning(
                "ASR submit HTTP %s body=%s", resp.status_code, resp.text[:300]
            )
            raise ASRError(resp.status_code, resp.text[:300])
        # 火山 ASR 2.0 用 header 返回业务码:X-Api-Status-Code / X-Api-Message
        status_code = resp.headers.get("X-Api-Status-Code", "")
        if status_code and status_code != "20000000":
            msg = resp.headers.get("X-Api-Message", "submit failed")
            raise ASRError(status_code, msg)

    # 轮询结果
    for attempt in range(_POLL_MAX_ATTEMPTS):
        await asyncio.sleep(_POLL_INTERVAL)
        async with httpx.AsyncClient(timeout=_QUERY_TIMEOUT) as client:
            resp = await client.post(
                _QUERY_URL, json={}, headers=_headers(task_id)
            )
        status_code = resp.headers.get("X-Api-Status-Code", "")
        # 20000000 = 成功;20000001/20000002 = 处理中;其它 = 失败
        if status_code == "20000000":
            data = resp.json()
            result = data.get("result", {})
            text = result.get("text", "").strip()
            duration = int(result.get("audio_info", {}).get("duration", 0))
            logger.info(
                "ASR ok task=%s attempts=%d text=%r duration=%dms",
                task_id, attempt + 1, text[:80], duration,
            )
            return ASRResult(text=text, audio_duration_ms=duration)
        if status_code in ("20000001", "20000002"):
            continue
        # 失败
        msg = resp.headers.get("X-Api-Message", "query failed")
        logger.warning(
            "ASR query 失败 task=%s status=%s msg=%s",
            task_id, status_code, msg,
        )
        raise ASRError(status_code or -1, msg)

    raise ASRError(-1, f"ASR 超时:轮询 {_POLL_MAX_ATTEMPTS} 次仍未完成")
