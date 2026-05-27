"""火山方舟 · 文本大模型(Doubao-Seed-1.6)客户端。

Phase 1 用一次性 chat()(非流式):给定 system_prompt + user_text,返回完整回复。
Phase 2 实时对话再扩展 chat_stream()(SSE 流式)。

方舟 API 是 OpenAI 兼容协议:
- 端点: https://ark.cn-beijing.volces.com/api/v3/chat/completions
- 鉴权: Authorization: Bearer <ARK_API_KEY>
- 模型字段: 新协议直接用模型名(doubao-seed-1-6-250615);
            老接入点 ep-xxxxx 也能用,留作兼容。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
_TIMEOUT_SECONDS = 30.0


class LLMError(Exception):
    """LLM 调用失败。包含上游 HTTP 状态码和原始 message。"""

    def __init__(self, code: int | str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"LLM failed (code={code}): {message}")


@dataclass(frozen=True)
class ChatMessage:
    """单条对话消息。role: system / user / assistant。"""

    role: str
    content: str


@dataclass(frozen=True)
class ChatResult:
    text: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


def _resolve_model() -> str:
    """决定用模型名还是 endpoint_id 调用。endpoint_id 非空时优先(兼容老账号)。"""
    s = get_settings()
    return s.ark_endpoint_id or s.ark_model


async def chat(
    messages: list[ChatMessage],
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> ChatResult:
    """单次对话补全。

    messages 至少要有一条 system + 一条 user。返回完整 assistant 文本。
    """
    settings = get_settings()
    if not settings.ark_api_key:
        raise LLMError(-1, "ARK_API_KEY 未配置,请检查 .env")
    if not messages:
        raise LLMError(-1, "messages 不能为空")

    payload = {
        "model": _resolve_model(),
        "messages": [{"role": m.role, "content": m.content} for m in messages],
        "max_tokens": max_tokens or settings.ark_max_tokens,
        "temperature": (
            temperature if temperature is not None else settings.ark_temperature
        ),
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {settings.ark_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        resp = await client.post(_ARK_URL, json=payload, headers=headers)

    if resp.status_code >= 400:
        try:
            data = resp.json()
            err = data.get("error") or {}
            code = err.get("code") or resp.status_code
            msg = err.get("message") or resp.text[:300]
        except ValueError:
            code, msg = resp.status_code, resp.text[:300]
        logger.warning("LLM HTTP %s code=%s msg=%s", resp.status_code, code, msg)
        raise LLMError(code, msg)

    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise LLMError(-1, "响应无 choices 字段")

    text = choices[0].get("message", {}).get("content", "")
    if not text:
        raise LLMError(-1, "响应文本为空")

    usage = data.get("usage") or {}
    return ChatResult(
        text=text.strip(),
        prompt_tokens=int(usage.get("prompt_tokens", 0)),
        completion_tokens=int(usage.get("completion_tokens", 0)),
        total_tokens=int(usage.get("total_tokens", 0)),
    )
