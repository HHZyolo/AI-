"""Phase 1 对话编排器:一次"按下说话→松开听回复"的完整链路。

  audio (用户说) ──► ASR ──► user_text
                                │
                  system_prompt │
                                ▼
                              LLM ──► reply_text
                                       │
                                       ▼
                                     TTS ──► audio (角色说)

设计:
- 一次性、串行,Phase 2 改成流式编排
- 历史对话不持久化(MVP 不做会话记忆);上层路由若想传 history,在 messages 里多塞几条即可
- 计时各段耗时,返回给前端便于显示"AI 思考中…"的实际感知
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from app.models.character import Character
from app.services.volc.asr import ASRResult, recognize
from app.services.volc.llm import ChatMessage, ChatResult, chat
from app.services.volc.tts import TTSRequest, TTSResult, synthesize

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TurnResult:
    """一次对话回合的完整结果。"""

    user_text: str
    reply_text: str
    audio: bytes
    audio_encoding: str
    voice_id: str

    # 计时(ms),方便前端展示延迟、排查瓶颈
    asr_ms: int
    llm_ms: int
    tts_ms: int
    total_ms: int

    # 火山侧用量(后续按用量计费时用得到)
    audio_in_duration_ms: int
    audio_out_duration_ms: int
    prompt_tokens: int
    completion_tokens: int


async def run_turn(
    character: Character,
    audio_bytes: bytes,
    audio_format: str = "wav",
    history: list[ChatMessage] | None = None,
) -> TurnResult:
    """跑一回合对话:用户音频 → 角色音频。

    history 可选,传入则在 system_prompt 之后、当前 user_text 之前插入,
    用于多轮上下文。MVP Phase 1 暂不持久化历史,可由调用方临时维护。
    """
    t_start = time.perf_counter()

    # —— 1) ASR ——
    t0 = time.perf_counter()
    asr: ASRResult = await recognize(audio_bytes, audio_format=audio_format)
    asr_ms = int((time.perf_counter() - t0) * 1000)
    if not asr.text:
        # 静音或听不清,不调 LLM,直接给一句固定的"没听清"
        # 用角色音色合成,保持人设连贯
        fallback_text = "没听清,再说一遍?"
        return await _quick_reply(
            character, asr_text="", reply_text=fallback_text,
            asr_ms=asr_ms, asr_duration=asr.audio_duration_ms, t_start=t_start,
        )

    # —— 2) LLM ——
    messages: list[ChatMessage] = [
        ChatMessage(role="system", content=character.system_prompt),
    ]
    if history:
        messages.extend(history)
    messages.append(ChatMessage(role="user", content=asr.text))

    t0 = time.perf_counter()
    llm: ChatResult = await chat(messages)
    llm_ms = int((time.perf_counter() - t0) * 1000)

    # —— 3) TTS ——
    t0 = time.perf_counter()
    tts: TTSResult = await synthesize(
        TTSRequest(
            text=llm.text,
            voice_id=character.voice_id or "zh_female_wanwanxiaohe_moon_bigtts",
            speech_rate=character.speech_rate or 1.0,
            speech_pitch=character.speech_pitch or 1.0,
        )
    )
    tts_ms = int((time.perf_counter() - t0) * 1000)

    total_ms = int((time.perf_counter() - t_start) * 1000)
    logger.info(
        "turn ok char=%s user=%r reply=%r asr=%dms llm=%dms tts=%dms total=%dms",
        character.slug, asr.text[:40], llm.text[:40],
        asr_ms, llm_ms, tts_ms, total_ms,
    )

    return TurnResult(
        user_text=asr.text,
        reply_text=llm.text,
        audio=tts.audio,
        audio_encoding=tts.encoding,
        voice_id=tts.encoding and (character.voice_id or ""),
        asr_ms=asr_ms,
        llm_ms=llm_ms,
        tts_ms=tts_ms,
        total_ms=total_ms,
        audio_in_duration_ms=asr.audio_duration_ms,
        audio_out_duration_ms=tts.duration_ms,
        prompt_tokens=llm.prompt_tokens,
        completion_tokens=llm.completion_tokens,
    )


async def _quick_reply(
    character: Character,
    asr_text: str,
    reply_text: str,
    asr_ms: int,
    asr_duration: int,
    t_start: float,
) -> TurnResult:
    """跳过 LLM,用固定文本直接合成回复(听不清/敏感词等场景)。"""
    t0 = time.perf_counter()
    tts = await synthesize(
        TTSRequest(
            text=reply_text,
            voice_id=character.voice_id or "zh_female_wanwanxiaohe_moon_bigtts",
            speech_rate=character.speech_rate or 1.0,
            speech_pitch=character.speech_pitch or 1.0,
        )
    )
    tts_ms = int((time.perf_counter() - t0) * 1000)
    total_ms = int((time.perf_counter() - t_start) * 1000)
    return TurnResult(
        user_text=asr_text,
        reply_text=reply_text,
        audio=tts.audio,
        audio_encoding=tts.encoding,
        voice_id=character.voice_id or "",
        asr_ms=asr_ms,
        llm_ms=0,
        tts_ms=tts_ms,
        total_ms=total_ms,
        audio_in_duration_ms=asr_duration,
        audio_out_duration_ms=tts.duration_ms,
        prompt_tokens=0,
        completion_tokens=0,
    )
