"""角色接口 —— F05。

- GET  /characters             列表(只返回 is_active=True 的,按 sort_order 排)
- GET  /characters/{slug}      详情
- POST /characters/{slug}/preview-tts  用该角色音色合成一段试听音频(挑音色用)

前两个公开接口;preview-tts 当前也公开(开发/选型阶段),
上线前应改为 admin-only 或加访问限频。
"""

import asyncio
import base64
import contextlib
import json
import logging

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import SessionLocal, get_db
from app.models.character import Character
from app.schemas.character import CharacterList, CharacterPublic
from app.services.voice_turn import run_turn
from app.services.volc.asr import ASRError
from app.services.volc.llm import LLMError
from app.services.volc.realtime import (
    RealtimeCharacterCfg,
    RealtimeEvent,
    RealtimeSession,
    RealtimeSessionError,
    realtime_voice_for,
)
from app.services.volc.tts import TTSError, TTSRequest, synthesize

logger = logging.getLogger(__name__)

# 录音上限 — 单次说话最长 30 秒,够日常对话,防止刷接口
_MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_FORMATS = {"wav", "mp3", "pcm", "ogg", "m4a", "webm", "mp4"}

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("", response_model=CharacterList)
async def list_characters(db: AsyncSession = Depends(get_db)) -> CharacterList:
    """获取所有上线中的角色,按 sort_order 升序。"""
    result = await db.scalars(
        select(Character)
        .where(Character.is_active.is_(True))
        .order_by(Character.sort_order, Character.id)
    )
    return CharacterList(
        items=[CharacterPublic.model_validate(c) for c in result.all()]
    )


@router.get("/{slug}", response_model=CharacterPublic)
async def get_character(slug: str, db: AsyncSession = Depends(get_db)) -> Character:
    """按 slug 查角色详情。"""
    character = await db.scalar(
        select(Character).where(
            Character.slug == slug, Character.is_active.is_(True)
        )
    )
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在"
        )
    return character


class PreviewTTSBody(BaseModel):
    """POST /characters/{slug}/preview-tts 请求体。所有字段可选。

    都不传 → 用角色 DB 中的 greeting + voice_id + speech_*,听角色"原声"
    传 text / voice_id → 覆盖,用于挑音色或验证不同台词
    """

    text: str | None = Field(
        default=None,
        max_length=300,
        description="要合成的文本;不传则用角色的 greeting",
    )
    voice_id: str | None = Field(
        default=None,
        max_length=64,
        description="豆包音色 ID;不传则用角色 DB 中的 voice_id",
    )
    speech_rate: float | None = Field(default=None, ge=0.5, le=2.0)
    speech_pitch: float | None = Field(default=None, ge=0.5, le=2.0)


@router.post(
    "/{slug}/preview-tts",
    response_class=Response,
    responses={200: {"content": {"audio/mpeg": {}}}},
)
async def preview_tts(
    slug: str,
    body: PreviewTTSBody | None = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """试听该角色的音色。返回原始音频字节(默认 mp3),浏览器/curl 直接可播。

    选型阶段大量调用:你给三个角色挑 voice_id 候选,就靠这个接口反复试。
    """
    settings = get_settings()
    character = await db.scalar(
        select(Character).where(Character.slug == slug)
    )
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在"
        )

    body = body or PreviewTTSBody()
    text = body.text or character.greeting or character.quote
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文本为空且角色没有 greeting/quote",
        )
    voice_id = (
        body.voice_id or character.voice_id or settings.tts_default_voice_id
    )
    if not voice_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未指定 voice_id 且角色未设置音色",
        )

    req = TTSRequest(
        text=text,
        voice_id=voice_id,
        speech_rate=body.speech_rate or character.speech_rate or 1.0,
        speech_pitch=body.speech_pitch or character.speech_pitch or 1.0,
    )

    try:
        result = await synthesize(req)
    except TTSError as e:
        logger.warning("角色 %s 试听 TTS 失败: %s", slug, e)
        # 透传火山错误码,前端能直观看到是配置问题还是音色不存在
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TTS 上游错误 code={e.code}: {e.message}",
        ) from e

    media_type = {
        "mp3": "audio/mpeg",
        "pcm": "audio/L16",
        "ogg_opus": "audio/ogg",
    }.get(result.encoding, "application/octet-stream")

    return Response(
        content=result.audio,
        media_type=media_type,
        headers={
            "X-Voice-Id": voice_id,
            "X-Duration-Ms": str(result.duration_ms),
            "X-Encoding": result.encoding,
            "X-Sample-Rate": str(result.sample_rate),
            # 便于 curl -O 时落地为 .mp3
            "Content-Disposition": f'inline; filename="{slug}.{result.encoding}"',
        },
    )


@router.post(
    "/{slug}/talk",
    response_class=Response,
    responses={200: {"content": {"audio/mpeg": {}}}},
    summary="Phase1 一回合对话:上传录音,返回角色回复音频",
)
async def talk(
    slug: str,
    audio: UploadFile = File(..., description="用户录音文件,支持 wav/mp3/webm/m4a 等"),
    audio_format: str = Form(
        default="webm",
        description="音频格式,浏览器 MediaRecorder 默认 webm",
    ),
    history: str | None = Form(
        default=None,
        description='可选,JSON 字符串,形如 [{"role":"user","content":"..."},...]',
    ),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """ASR + LLM + TTS 串行跑完一回合。

    响应主体是 mp3,角色回复的文字、用户原话、耗时全在 header 里:
    - X-User-Text       (URL-encoded UTF-8) 识别出的用户话
    - X-Reply-Text      (URL-encoded UTF-8) 角色回复
    - X-Voice-Id        合成用的音色
    - X-Asr-Ms / X-Llm-Ms / X-Tts-Ms / X-Total-Ms 各段耗时
    """
    fmt = audio_format.lower().strip()
    if fmt not in _ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的音频格式: {fmt}",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="音频为空"
        )
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"音频超过 {_MAX_AUDIO_BYTES // 1024 // 1024} MB 上限",
        )

    character = await db.scalar(
        select(Character).where(
            Character.slug == slug, Character.is_active.is_(True)
        )
    )
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在"
        )

    # 解析可选历史
    history_msgs = None
    if history:
        try:
            from app.services.volc.llm import ChatMessage

            raw = json.loads(history)
            history_msgs = [ChatMessage(role=m["role"], content=m["content"]) for m in raw]
        except (ValueError, KeyError, TypeError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"history 解析失败: {e}",
            ) from e

    try:
        turn = await run_turn(
            character, audio_bytes, audio_format=fmt, history=history_msgs
        )
    except ASRError as e:
        logger.warning("角色 %s ASR 失败: %s", slug, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ASR 上游错误 code={e.code}: {e.message}",
        ) from e
    except LLMError as e:
        logger.warning("角色 %s LLM 失败: %s", slug, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM 上游错误 code={e.code}: {e.message}",
        ) from e
    except TTSError as e:
        logger.warning("角色 %s TTS 失败: %s", slug, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TTS 上游错误 code={e.code}: {e.message}",
        ) from e

    media_type = {
        "mp3": "audio/mpeg",
        "pcm": "audio/L16",
        "ogg_opus": "audio/ogg",
    }.get(turn.audio_encoding, "application/octet-stream")

    # 中文文本不能直接放 HTTP header,要 base64,前端取出再 decode
    def _b64(s: str) -> str:
        return base64.b64encode(s.encode("utf-8")).decode("ascii")

    return Response(
        content=turn.audio,
        media_type=media_type,
        headers={
            "X-User-Text-B64": _b64(turn.user_text),
            "X-Reply-Text-B64": _b64(turn.reply_text),
            "X-Voice-Id": character.voice_id or "",
            "X-Encoding": turn.audio_encoding,
            "X-Asr-Ms": str(turn.asr_ms),
            "X-Llm-Ms": str(turn.llm_ms),
            "X-Tts-Ms": str(turn.tts_ms),
            "X-Total-Ms": str(turn.total_ms),
            "X-Audio-In-Ms": str(turn.audio_in_duration_ms),
            "X-Audio-Out-Ms": str(turn.audio_out_duration_ms),
            "X-Prompt-Tokens": str(turn.prompt_tokens),
            "X-Completion-Tokens": str(turn.completion_tokens),
            # CORS 默认会过滤掉自定义 header,显式 expose
            "Access-Control-Expose-Headers": (
                "X-User-Text-B64, X-Reply-Text-B64, X-Voice-Id, X-Encoding, "
                "X-Asr-Ms, X-Llm-Ms, X-Tts-Ms, X-Total-Ms, X-Audio-In-Ms, "
                "X-Audio-Out-Ms, X-Prompt-Tokens, X-Completion-Tokens"
            ),
        },
    )


# ─── Phase 2 实时语音 WebSocket ─────────────────────────────────
# 浏览器 ↔ 这个 WS ↔ 火山·端到端实时语音
#
# 协议(浏览器视角):
#   上行二进制:16k mono s16le PCM,每帧 ~100ms
#   上行 JSON:  {"type":"hello"}  让 AI 主动说 greeting
#               {"type":"end"}    主动关会话
#   下行二进制:24k mono s16le PCM(AI 回复音频帧)
#   下行 JSON:  {"type":"ready"}                       Session 就绪
#               {"type":"asr","text":"..","final":bool} ASR 实时字幕
#               {"type":"reply","text":".."}            AI 文本回复(累积)
#               {"type":"interrupt"}                    用户开口,前端立刻清音频缓冲
#               {"type":"tts_end"}                      一句回复说完
#               {"type":"error","code":"..","message":".."}
#               {"type":"closed"}
#
# 注意:目前不带鉴权,MVP 验证体验后再加 token 与扣费(下一轮)
@router.websocket("/{slug}/realtime")
async def realtime_session(websocket: WebSocket, slug: str) -> None:
    await websocket.accept()

    # 自己开 DB 会话:WebSocket 不能用 Depends(get_db) 那个请求作用域的 session
    async with SessionLocal() as db:
        character = await db.scalar(
            select(Character).where(
                Character.slug == slug, Character.is_active.is_(True)
            )
        )

    if character is None:
        await websocket.send_json({
            "type": "error", "code": "character_not_found",
            "message": f"角色 {slug} 不存在或已下线",
        })
        await websocket.close(code=1008)
        return

    cfg = RealtimeCharacterCfg(
        slug=character.slug,
        system_role=character.system_prompt,
        speaker=realtime_voice_for(character.slug),
        # 端到端不支持 _moon_bigtts 的 speech_rate/pitch,这里不传
        greeting=character.greeting or "",
    )
    logger.info("WS realtime accept slug=%s speaker=%s", slug, cfg.speaker)

    # 用队列把火山事件串到 WS 发送协程,避免 reader_task 直接调 ws.send 引起并发
    out_queue: asyncio.Queue[RealtimeEvent | None] = asyncio.Queue(maxsize=128)

    async def on_event(ev: RealtimeEvent) -> None:
        try:
            out_queue.put_nowait(ev)
        except asyncio.QueueFull:
            logger.warning("realtime out_queue full,丢弃事件 kind=%s", ev.kind)

    session = RealtimeSession(cfg, emit=on_event)

    async def sender_loop() -> None:
        """从 out_queue 出事件,序列化后写到浏览器 WS。"""
        while True:
            ev = await out_queue.get()
            if ev is None:
                return
            try:
                if ev.kind == "tts_audio":
                    await websocket.send_bytes(ev.audio)
                elif ev.kind == "asr":
                    await websocket.send_json({
                        "type": "asr", "text": ev.text, "final": ev.final,
                    })
                elif ev.kind == "reply":
                    await websocket.send_json({"type": "reply", "text": ev.text})
                elif ev.kind in ("ready", "interrupt", "tts_end", "closed"):
                    await websocket.send_json({"type": ev.kind})
                elif ev.kind == "error":
                    await websocket.send_json({
                        "type": "error", "code": ev.error_code, "message": ev.text,
                    })
            except (WebSocketDisconnect, RuntimeError):
                # 浏览器侧已关
                return

    sender_task = asyncio.create_task(sender_loop())

    try:
        await session.start()
    except RealtimeSessionError as e:
        await websocket.send_json({
            "type": "error", "code": str(e.code), "message": e.message,
        })
        await websocket.close(code=1011)
        sender_task.cancel()
        return
    except Exception as e:
        logger.exception("realtime start failed")
        await websocket.send_json({
            "type": "error", "code": "start_failed", "message": str(e),
        })
        await websocket.close(code=1011)
        sender_task.cancel()
        return

    # 浏览器收发主循环
    try:
        while True:
            msg = await websocket.receive()
            # disconnect
            if msg.get("type") == "websocket.disconnect":
                break
            # 二进制 PCM
            if (data := msg.get("bytes")) is not None:
                await session.send_audio(data)
                continue
            # JSON 控制帧
            if (text := msg.get("text")) is not None:
                try:
                    obj = json.loads(text)
                except json.JSONDecodeError:
                    continue
                t = obj.get("type")
                if t == "hello":
                    greeting = obj.get("text") or cfg.greeting
                    if greeting:
                        await session.say_hello(greeting)
                elif t == "end":
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("realtime ws main loop crashed")
    finally:
        await session.close()
        await out_queue.put(None)
        with contextlib.suppress(Exception):
            await asyncio.wait_for(sender_task, timeout=2)
        with contextlib.suppress(Exception):
            await websocket.close()
        logger.info("WS realtime closed slug=%s", slug)
