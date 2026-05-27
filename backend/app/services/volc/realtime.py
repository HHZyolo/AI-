"""火山·端到端实时语音大模型(豆包 Realtime Voice)封装。

Phase 2 实时对话核心:浏览器麦克风 PCM → 火山 WS → 模型边听边想边说 → 浏览器播。
本模块是后端到火山的客户端,FastAPI WS 路由调它。

抽自 scripts/realtime_demo.py,核心改造:
  - demo 是"一次完整对话后结束",这里是"长连接,持续推流、持续播放"
  - 接收端把火山事件翻译成简洁的回调,WS 路由层负责转发给浏览器

凭证 / 协议踩坑见 ~/.claude/.../realtime-voice-traps.md
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import struct
import uuid
from dataclasses import dataclass
from typing import AsyncIterator, Callable, Awaitable

import websockets
from volcengine_audio import (
    EventReceive,
    RealtimeDialogueConfig,
    RealtimeDialogueFunctions,
    SayHelloRequest,
)

from app.config import get_settings

logger = logging.getLogger(__name__)

# 火山要求的全局固定值,不是用户的 APP_ID。踩坑详见 memory/realtime-voice-traps.md
_VOLC_FIXED_APP_KEY = "PlgvMymc7f3tQnJ6"

# 上行音频参数(浏览器 AudioWorklet 输出与这一组对齐)
UPSTREAM_SAMPLE_RATE = 16000
UPSTREAM_CHANNELS = 1
# 下行音频参数(浏览器 AudioContext 输入按这一组解码)
DOWNSTREAM_SAMPLE_RATE = 24000
DOWNSTREAM_CHANNELS = 1


@dataclass
class RealtimeCharacterCfg:
    """一个 AI 角色的实时语音配置。"""
    slug: str
    system_role: str
    speaker: str           # _jupiter_bigtts 系列;端到端不支持 _moon_bigtts
    speaking_style: str = ""
    greeting: str = ""     # 进入会话时让 AI 主动说的开场白(可空)


# 端到端音色池(_jupiter_bigtts 系列)是一套独立的池,跟普通 TTS(_moon_bigtts)互不通用。
# Character.voice_id 存的是普通 TTS 音色,这里按 slug 做端到端音色映射。
# 后续真要上线再加 DB 列 realtime_voice_id;现在写死先把链路跑通。
REALTIME_VOICE_MAP: dict[str, str] = {
    "sister": "zh_female_xiaohe_jupiter_bigtts",   # 甜美少女,凑合温柔御姐
    "genki": "zh_female_vv_jupiter_bigtts",         # 活泼默认,适合元气妹妹
    "junior": "zh_female_xiaohe_jupiter_bigtts",    # 高冷学妹也先用 xiaohe,后续看克隆
}
DEFAULT_REALTIME_VOICE = "zh_female_vv_jupiter_bigtts"


def realtime_voice_for(slug: str) -> str:
    """按角色 slug 查端到端音色;未匹配时回落默认。"""
    return REALTIME_VOICE_MAP.get(slug, DEFAULT_REALTIME_VOICE)


class RealtimeSessionError(Exception):
    def __init__(self, code: str | int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"realtime error code={code}: {message}")


# ─── 协议帧解析 ─────────────────────────────────────────────────
def _parse_frame(raw: bytes) -> dict:
    """解析火山下行帧。详见 memory/realtime-voice-traps.md §3。

    返回 dict 至少含 `type` 和 `event`(可能 None),其它字段按 type 不同:
      - 业务帧(type=9): event, session_id?, json/text/raw_payload
      - 音频帧(type=11): event, audio
      - 错误帧(type=15): error_code, json/text
    """
    if len(raw) < 4:
        return {"_error": "frame too short"}
    byte0, byte1, byte2, _ = raw[0], raw[1], raw[2], raw[3]
    header_size = (byte0 & 0x0F) * 4
    message_type = (byte1 >> 4) & 0x0F
    flags = byte1 & 0x0F
    serialization = (byte2 >> 4) & 0x0F

    out: dict = {"type": message_type, "flags": flags, "event": None}
    cursor = header_size

    if message_type == 0b1111:  # ERROR
        if cursor + 4 <= len(raw):
            out["error_code"] = struct.unpack(">I", raw[cursor:cursor + 4])[0]
            cursor += 4
        if cursor + 4 <= len(raw):
            payload_len = struct.unpack(">I", raw[cursor:cursor + 4])[0]
            cursor += 4
            payload = raw[cursor:cursor + payload_len]
            try:
                out["json"] = json.loads(payload.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                out["text"] = payload.decode("utf-8", errors="replace")
        return out

    if flags & 0b0100 and cursor + 4 <= len(raw):
        out["event"] = struct.unpack(">I", raw[cursor:cursor + 4])[0]
        cursor += 4

    is_connect = out["event"] in (
        EventReceive.ConnectionStarted,
        EventReceive.ConnectionFailed,
        EventReceive.ConnectionFinished,
    )
    if is_connect and cursor + 4 <= len(raw):
        cid_len = struct.unpack(">I", raw[cursor:cursor + 4])[0]
        cursor += 4
        out["connect_id"] = raw[cursor:cursor + cid_len].decode("utf-8", errors="replace")
        cursor += cid_len
    elif out["event"] is not None and cursor + 4 <= len(raw):
        sid_len = struct.unpack(">I", raw[cursor:cursor + 4])[0]
        cursor += 4
        if 0 < sid_len <= len(raw) - cursor:
            out["session_id"] = raw[cursor:cursor + sid_len].decode("utf-8", errors="replace")
            cursor += sid_len

    payload = b""
    if cursor + 4 <= len(raw):
        payload_len = struct.unpack(">I", raw[cursor:cursor + 4])[0]
        if 0 < payload_len <= len(raw) - cursor - 4:
            payload = raw[cursor + 4:cursor + 4 + payload_len]

    if message_type == 0b1011:  # AUDIO_ONLY_RESPONSE
        out["audio"] = payload
    elif serialization == 0b0001 and payload:  # JSON
        try:
            out["json"] = json.loads(payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            out["text"] = payload.decode("utf-8", errors="replace")
    elif payload:
        out["text"] = payload.decode("utf-8", errors="replace")

    return out


def _build_config(character: RealtimeCharacterCfg) -> RealtimeDialogueConfig:
    """根据角色拼端到端会话配置。"""
    return RealtimeDialogueConfig(
        dialog=RealtimeDialogueConfig.DialogConfig(
            bot_name=character.slug,
            system_role=character.system_role,
            speaking_style=character.speaking_style or None,
            # 即使为空也必填,否则服务端报 42000020
            extra=RealtimeDialogueConfig.DialogConfig.Extra(),
        ),
        tts=RealtimeDialogueConfig.TTSConfig(
            speaker=character.speaker,
            audio_config=RealtimeDialogueConfig.TTSConfig.AudioConfig(
                channel=DOWNSTREAM_CHANNELS,
                format=RealtimeDialogueConfig.TTSConfig.AudioConfig.Format.pcm_s16le,
                sample_rate=DOWNSTREAM_SAMPLE_RATE,
            ),
        ),
        asr=RealtimeDialogueConfig.Asr(
            audio_info=RealtimeDialogueConfig.Asr.AudioInfo(
                format=RealtimeDialogueConfig.Asr.AudioInfo.Format.pcm,
                sample_rate=UPSTREAM_SAMPLE_RATE,
                channel=UPSTREAM_CHANNELS,
            ),
            extra=RealtimeDialogueConfig.Asr.Extra(),
        ),
    )


# ─── 会话编排器 ─────────────────────────────────────────────────
@dataclass
class RealtimeEvent:
    """翻译给上层的简化事件。"""
    kind: str    # ready | asr | reply | interrupt | tts_audio | tts_end | error | closed
    text: str = ""
    final: bool = False
    audio: bytes = b""
    error_code: str = ""


class RealtimeSession:
    """一次浏览器 ↔ 火山的会话。

    用法(上层 WS 路由):
        session = RealtimeSession(character, send_event_cb)
        await session.start()
        # 主循环:
        #   收到浏览器 PCM 帧 -> await session.send_audio(pcm)
        #   收到浏览器 hello -> await session.say_hello(text)
        # 关闭:
        #   await session.close()
    """

    def __init__(
        self,
        character: RealtimeCharacterCfg,
        emit: Callable[[RealtimeEvent], Awaitable[None]],
    ):
        self.character = character
        self.emit = emit
        self.session_id = uuid.uuid4().hex
        self.connect_id = uuid.uuid4().hex
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._reader_task: asyncio.Task | None = None
        self._closed = False

    async def start(self) -> None:
        s = get_settings()
        if not s.volc_app_id or not s.volc_access_token:
            raise RealtimeSessionError(-1, "VOLC_APP_ID / VOLC_ACCESS_TOKEN 未配置")

        headers = {
            "X-Api-App-ID": s.volc_app_id,
            "X-Api-Access-Key": s.volc_access_token,
            "X-Api-Resource-Id": s.realtime_resource_id,
            "X-Api-App-Key": _VOLC_FIXED_APP_KEY,
            "X-Api-Connect-Id": self.connect_id,
        }
        logger.info(
            "realtime connect char=%s connect_id=%s session_id=%s",
            self.character.slug, self.connect_id, self.session_id,
        )

        try:
            self._ws = await websockets.connect(
                s.realtime_ws_url,
                additional_headers=headers,
                max_size=20 * 1024 * 1024,
                ping_interval=20,
                ping_timeout=30,
            )
        except TypeError:
            self._ws = await websockets.connect(
                s.realtime_ws_url,
                extra_headers=headers,
                max_size=20 * 1024 * 1024,
                ping_interval=20,
                ping_timeout=30,
            )

        self._reader_task = asyncio.create_task(self._reader_loop())

        await self._ws.send(RealtimeDialogueFunctions.start_connection_payload())
        config = _build_config(self.character)
        await self._ws.send(
            RealtimeDialogueFunctions.start_session_payload(self.session_id, config)
        )

    async def say_hello(self, text: str) -> None:
        """让 AI 直接朗读一段话,通常用于会话开场白(greeting)。"""
        if not self._ws:
            raise RealtimeSessionError(-1, "session not started")
        await self._ws.send(
            RealtimeDialogueFunctions.say_hello_payload(
                self.session_id, SayHelloRequest(content=text)
            )
        )

    async def send_audio(self, pcm: bytes) -> None:
        """推一帧上行 PCM(16k mono s16le)。"""
        if not self._ws or self._closed:
            return
        await self._ws.send(
            RealtimeDialogueFunctions.task_request_payload(self.session_id, pcm)
        )

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._ws:
            with contextlib.suppress(Exception):
                await self._ws.send(
                    RealtimeDialogueFunctions.finish_session_payload(self.session_id)
                )
            with contextlib.suppress(Exception):
                await self._ws.send(
                    RealtimeDialogueFunctions.finish_connection_payload()
                )
            with contextlib.suppress(Exception):
                await self._ws.close()
        if self._reader_task:
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._reader_task

    # ─── 内部 ─────────────────────────────────────────
    async def _reader_loop(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                if not isinstance(raw, (bytes, bytearray)):
                    continue
                await self._handle_frame(bytes(raw))
        except websockets.ConnectionClosed as e:
            logger.info("realtime ws closed: code=%s reason=%s", e.code, e.reason)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("realtime reader loop crashed")
        finally:
            if not self._closed:
                await self.emit(RealtimeEvent(kind="closed"))

    async def _handle_frame(self, raw: bytes) -> None:
        f = _parse_frame(raw)
        if f.get("type") == 0b1111:
            payload = f.get("json") or f.get("text") or ""
            msg = payload.get("error") if isinstance(payload, dict) else str(payload)
            code = str(f.get("error_code", "")) or "server_error"
            logger.error("realtime server error code=%s msg=%s", code, msg)
            await self.emit(RealtimeEvent(kind="error", error_code=code, text=msg or ""))
            return

        event = f.get("event")
        payload = f.get("json") or {}
        message_type = f.get("type")

        # 音频帧:直接吐给上层
        if message_type == 0b1011:
            audio = f.get("audio") or b""
            if audio:
                await self.emit(RealtimeEvent(kind="tts_audio", audio=audio))
            return

        if event == EventReceive.ConnectionStarted:
            logger.info("← ConnectionStarted")
        elif event == EventReceive.ConnectionFailed:
            await self.emit(RealtimeEvent(
                kind="error", error_code="connection_failed",
                text=str(payload),
            ))
        elif event == EventReceive.SessionStarted:
            logger.info("← SessionStarted dialog_id=%s",
                        payload.get("dialog_id") if isinstance(payload, dict) else None)
            await self.emit(RealtimeEvent(kind="ready"))
        elif event == EventReceive.SessionFailed:
            await self.emit(RealtimeEvent(
                kind="error", error_code="session_failed",
                text=(payload.get("error") if isinstance(payload, dict) else str(payload)) or "",
            ))
        elif event == EventReceive.ASRInfo:
            # 用户开口 —— 立刻通知前端清掉本地播放缓冲(打断 AI)
            await self.emit(RealtimeEvent(kind="interrupt"))
        elif event == EventReceive.ASRResponse:
            if isinstance(payload, dict):
                for r in payload.get("results", []):
                    txt = r.get("text", "")
                    is_interim = r.get("is_interim", False)
                    if txt:
                        await self.emit(RealtimeEvent(
                            kind="asr", text=txt, final=not is_interim,
                        ))
        elif event == EventReceive.ChatResponse:
            if isinstance(payload, dict):
                txt = payload.get("content", "")
                if txt:
                    await self.emit(RealtimeEvent(kind="reply", text=txt))
        elif event == EventReceive.TTSEnded:
            await self.emit(RealtimeEvent(kind="tts_end"))
        elif event == EventReceive.SessionFinished:
            logger.info("← SessionFinished")
            await self.emit(RealtimeEvent(kind="closed"))
        elif event in (
            EventReceive.DialogCommonError,
            EventReceive.SERVER_PROCESSING_ERROR,
            EventReceive.SERVICE_UNAVAILABLE,
            EventReceive.AUDIO_FLOW_ERROR,
        ):
            msg = payload.get("message") if isinstance(payload, dict) else str(payload)
            code = (payload.get("status_code") if isinstance(payload, dict) else "") or str(event)
            await self.emit(RealtimeEvent(
                kind="error", error_code=str(code), text=msg or "",
            ))
        # 其它事件(USAGE / TTSSentenceStart/End / ChatEnded / ChatTextQueryConfirmed)忽略
