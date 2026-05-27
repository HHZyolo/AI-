"""命令行 demo:验证「豆包·端到端实时语音大模型」凭证 + 协议 + 人设。

直接用官方 SDK `volcengine-audio`,避免自己手拼二进制协议踩坑。

执行:
    cd backend
    .venv/bin/python -m scripts.realtime_demo --input ../02-sister__魅力女友__zh_female_meilinvyou_moon_bigtts.mp3 --character sister

依赖:
    pip install volcengine-audio  (已加入 requirements.txt)
    ffmpeg                        (输入不是 16k wav 时用来转码)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import shutil
import struct
import subprocess
import sys
import time
import uuid
import wave
from pathlib import Path

import websockets
from volcengine_audio import (
    ChatTextQueryRequest,
    EventReceive,
    MessageType,
    RealtimeDialogueConfig,
    RealtimeDialogueFunctions,
    SayHelloRequest,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.logging_conf import setup_logging  # noqa: E402

logger = logging.getLogger("realtime_demo")


# ─── 角色人设(demo 阶段写死,真接入从 DB 读) ──────────────────────
# 注意:端到端实时语音用 _jupiter_bigtts 系列音色,不是普通 TTS 的 _moon_bigtts 系列!
# 两套音色池互不通用。
CHARACTERS = {
    "sister": {
        "system_role": (
            "你是温柔御姐,26岁的成熟女性,正在陪用户玩《无畏契约》语音连麦。"
            "沉稳、共情力强、说话慢、留白多。偶尔(每 5-6 句一次)叫『弟弟』。"
            "回复 1-2 句,不超过 30 字。"
        ),
        # 端到端音色池里没有"温柔御姐"这种,先用 xiaohe(甜美少女)凑合,后续可能要克隆
        "speaker": "zh_female_xiaohe_jupiter_bigtts",
        "speaking_style": "温柔,语速稍慢,情感丰富",
    },
    "genki": {
        "system_role": (
            "你是元气妹妹,22岁刚毕业,陪用户玩《无畏契约》。"
            "阳光、爱撒娇、短句口语,称呼对方『哥哥』(每 2-3 句一次)。"
            "回复 1-2 句,最长 30 字。"
        ),
        # vv 是端到端模型的默认音色,活力强,适合元气妹妹
        "speaker": "zh_female_vv_jupiter_bigtts",
        "speaking_style": "活泼,语速快,情绪饱满",
    },
}


# ─── 音频读取与转码 ──────────────────────────────────────────────
def _read_wav_pcm16k(path: Path) -> bytes:
    with wave.open(str(path), "rb") as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        pcm = w.readframes(w.getnframes())
    if sr != 16000 or ch != 1 or sw != 2:
        raise ValueError(f"need 16k/mono/16bit, got {sr}Hz/{ch}ch/{sw*8}bit")
    return pcm


def _ffmpeg_to_pcm16k(path: Path) -> bytes:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("PATH 里没找到 ffmpeg,请 brew install ffmpeg")
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-f", "s16le", "-ar", "16000", "-ac", "1", "-"],
        capture_output=True, check=True,
    )
    return proc.stdout


def load_audio_as_pcm16k(path: Path) -> bytes:
    if path.suffix.lower() == ".wav":
        try:
            return _read_wav_pcm16k(path)
        except ValueError as e:
            logger.info("wav 不是 16k,改走 ffmpeg:%s", e)
    return _ffmpeg_to_pcm16k(path)


def write_pcm_as_wav(pcm: bytes, path: Path, sample_rate: int = 24000) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)


# ─── 服务端帧解析(SDK 没提供,自己写一份) ────────────────────────
def parse_server_frame(raw: bytes) -> dict:
    """解析服务端下发的二进制帧(火山 v3 协议)。

    根据 flags 不同,字段顺序也不同(按文档表格顺序拼装):
      header (4B)
      [error_code 4B]    如 message_type = 0b1111(Error)
      [sequence 4B]      如 flags 有序号位
      [event 4B]         如 flags & CARRY_EVENT_ID = 0b0100
      [connect_id_len 4B][connect_id]   只有 Connect 类事件
      [session_id_len 4B][session_id]   只有 Session 类事件
      [payload_len 4B][payload]
    """
    if len(raw) < 4:
        return {"_error": "frame too short"}
    byte0, byte1, byte2, _ = raw[0], raw[1], raw[2], raw[3]
    header_size = (byte0 & 0x0F) * 4
    message_type = (byte1 >> 4) & 0x0F
    flags = byte1 & 0x0F
    serialization = (byte2 >> 4) & 0x0F

    out: dict = {"type": message_type, "flags": flags}
    cursor = header_size

    # 错误帧:header + 4B error_code + payload
    if message_type == 0b1111:
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
            out["raw_payload"] = payload
        out["event"] = None
        return out

    # 业务帧
    event = None
    if flags & 0b0100 and cursor + 4 <= len(raw):
        event = struct.unpack(">I", raw[cursor:cursor + 4])[0]
        cursor += 4

    # ConnectionStarted/Failed/Finished 携带 connect_id;Session 类事件携带 session_id
    is_connect_event = event in (
        EventReceive.ConnectionStarted,
        EventReceive.ConnectionFailed,
        EventReceive.ConnectionFinished,
    )
    if is_connect_event and cursor + 4 <= len(raw):
        cid_len = struct.unpack(">I", raw[cursor:cursor + 4])[0]
        cursor += 4
        out["connect_id"] = raw[cursor:cursor + cid_len].decode("utf-8", errors="replace")
        cursor += cid_len
    elif event is not None and cursor + 4 <= len(raw):
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

    out["event"] = event
    out["raw_payload"] = payload

    if message_type == 0b1011:  # AUDIO_ONLY_RESPONSE
        out["audio"] = payload
    elif serialization == 0b0001 and payload:
        try:
            out["json"] = json.loads(payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            out["text"] = payload.decode("utf-8", errors="replace")
    elif payload:
        out["text"] = payload.decode("utf-8", errors="replace")

    return out


def event_name(event: int | None) -> str:
    if event is None:
        return "(no-event)"
    try:
        return EventReceive(event).name
    except ValueError:
        return f"UNKNOWN({event})"


# ─── 主流程 ──────────────────────────────────────────────────────
async def run(
    input_path: Path | None,
    character_key: str,
    output_path: Path,
    hello_text: str | None = None,
    query_text: str | None = None,
    bare: bool = False,
) -> None:
    s = get_settings()
    if not s.volc_app_id or not s.volc_access_token:
        raise SystemExit("VOLC_APP_ID / VOLC_ACCESS_TOKEN 未配置")
    if character_key not in CHARACTERS:
        raise SystemExit(f"未知角色: {character_key}; 可选: {list(CHARACTERS)}")
    character = CHARACTERS[character_key]

    if hello_text:
        pcm_in = b""
        logger.info("SayHello 模式:让角色直接说『%s』", hello_text)
    elif query_text:
        pcm_in = b""
        logger.info("ChatTextQuery 模式:用户输入『%s』,让模型回应", query_text)
    else:
        if input_path is None:
            raise SystemExit("必须提供 --input 或 --hello 或 --query")
        logger.info("加载音频: %s", input_path)
        pcm_in = load_audio_as_pcm16k(input_path)
        logger.info("PCM 长度: %d 字节 (%.1f 秒)", len(pcm_in), len(pcm_in) / 2 / 16000)

    # 用 SDK 拼配置 —— 关键:asr 一定要带 audio_info 告诉服务端上行 PCM/16k
    # TTS audio_config.format 用 pcm_s16le(16bit),便于浏览器直接 AudioContext 播放
    #
    # 排查阶段:--bare 时跳过 system_role / speaking_style / 自定义 bot_name,
    # 用最素净的"豆包"缺省人设跑,排除人设触发审核的可能。
    dialog_cfg_kwargs: dict = {"extra": RealtimeDialogueConfig.DialogConfig.Extra()}
    if not bare:
        dialog_cfg_kwargs.update({
            "bot_name": character_key,
            "system_role": character["system_role"],
            "speaking_style": character["speaking_style"],
        })
    config = RealtimeDialogueConfig(
        dialog=RealtimeDialogueConfig.DialogConfig(**dialog_cfg_kwargs),
        tts=RealtimeDialogueConfig.TTSConfig(
            speaker=character["speaker"],
            audio_config=RealtimeDialogueConfig.TTSConfig.AudioConfig(
                channel=1,
                format=RealtimeDialogueConfig.TTSConfig.AudioConfig.Format.pcm_s16le,
                sample_rate=24000,
            ),
        ),
        asr=RealtimeDialogueConfig.Asr(
            audio_info=RealtimeDialogueConfig.Asr.AudioInfo(
                format=RealtimeDialogueConfig.Asr.AudioInfo.Format.pcm,
                sample_rate=16000,
                channel=1,
            ),
            extra=RealtimeDialogueConfig.Asr.Extra(),  # 必填,空对象即可
        ),
    )

    connect_id = uuid.uuid4().hex
    session_id = uuid.uuid4().hex
    # 注意:X-Api-App-Key 是火山全局固定值,不是用户的 APP_ID!
    # 文档:https://www.volcengine.com/docs/6561/1594356 §2.1
    headers = {
        "X-Api-App-ID": s.volc_app_id,             # 用户 APP_ID
        "X-Api-Access-Key": s.volc_access_token,    # 用户 Access Token
        "X-Api-Resource-Id": s.realtime_resource_id,  # volc.speech.dialog
        "X-Api-App-Key": "PlgvMymc7f3tQnJ6",         # 火山所有客户共用的固定值
        "X-Api-Connect-Id": connect_id,
    }
    logger.info("连接火山 WS %s  connect_id=%s session_id=%s",
                s.realtime_ws_url, connect_id, session_id)

    t_connect = time.perf_counter()
    try:
        ws = await websockets.connect(
            s.realtime_ws_url, additional_headers=headers, max_size=20 * 1024 * 1024
        )
    except TypeError:
        ws = await websockets.connect(
            s.realtime_ws_url, extra_headers=headers, max_size=20 * 1024 * 1024
        )

    audio_chunks_out: list[bytes] = []
    reply_text_buf: list[str] = []
    user_text_buf: list[str] = []
    first_audio_at: float | None = None
    first_text_at: float | None = None
    session_done = asyncio.Event()
    tts_ended = asyncio.Event()

    async def reader() -> None:
        nonlocal first_audio_at, first_text_at
        async for raw in ws:
            if not isinstance(raw, (bytes, bytearray)):
                continue
            raw_b = bytes(raw)
            f = parse_server_frame(raw_b)
            event = f.get("event")
            name = event_name(event)
            payload = f.get("json") or f.get("text") or ""

            # debug:每一帧的前 48 字节 hex,出问题时方便排查
            logger.debug("RAW(%dB): %s parsed=%s",
                         len(raw_b), raw_b[:48].hex(" "), f)

            # 服务端错误帧(message_type=15)
            if f.get("type") == 0b1111:
                logger.error("← ServerError code=%s payload=%s",
                             f.get("error_code"), payload)
                session_done.set()
                return

            if event == EventReceive.ConnectionStarted:
                logger.info("← %s", name)
            elif event == EventReceive.ConnectionFailed:
                logger.error("← %s payload=%s", name, payload)
                session_done.set()
                return
            elif event == EventReceive.SessionStarted:
                logger.info("← %s sid=%s payload=%s", name, f.get("session_id"), payload)
            elif event == EventReceive.ASRInfo:
                logger.info("← %s (用户开口/可触发打断) %s", name, payload)
            elif event == EventReceive.ASRResponse:
                if isinstance(payload, dict):
                    for r in payload.get("results", []):
                        txt = r.get("text", "")
                        if txt and not r.get("is_interim"):
                            user_text_buf.append(txt)
                            logger.info("← ASR final: %s", txt)
                        elif txt:
                            logger.debug("← ASR interim: %s", txt)
            elif event == EventReceive.ASREnded:
                logger.info("← %s; 用户原话: %s", name, "".join(user_text_buf))
            elif event == EventReceive.ChatResponse:
                if first_text_at is None:
                    first_text_at = time.perf_counter()
                if isinstance(payload, dict):
                    txt = payload.get("content", "")
                    if txt:
                        reply_text_buf.append(txt)
                        logger.info("← Chat: %s", txt)
            elif event == EventReceive.TTSSentenceStart:
                logger.info("← %s %s", name, payload)
            elif event == EventReceive.TTSResponse:
                if first_audio_at is None:
                    first_audio_at = time.perf_counter()
                audio_chunks_out.append(f.get("audio") or b"")
            elif event == EventReceive.TTSEnded:
                logger.info("← %s", name)
                tts_ended.set()
            elif event == EventReceive.SessionFinished:
                logger.info("← %s", name)
                session_done.set()
                return
            elif event == EventReceive.SessionFailed:
                logger.error("← %s payload=%s", name, payload)
                session_done.set()
                return
            elif event == EventReceive.USAGE:
                logger.info("← USAGE %s", payload)
            elif event in (EventReceive.DialogCommonError,
                           EventReceive.SERVER_PROCESSING_ERROR,
                           EventReceive.SERVICE_UNAVAILABLE,
                           EventReceive.AUDIO_FLOW_ERROR):
                logger.error("← %s payload=%s", name, payload)
                session_done.set()
                return
            else:
                logger.info("← %s payload=%s", name, payload)

    reader_task = asyncio.create_task(reader())

    # 1) StartConnection
    await ws.send(RealtimeDialogueFunctions.start_connection_payload())
    # 2) StartSession
    await ws.send(RealtimeDialogueFunctions.start_session_payload(session_id, config))
    t_first_send = time.perf_counter()

    # 3) 三种模式:
    #   --hello "xxx"  让角色直接朗读这段文字(纯 TTS 链路验证)
    #   --query "xxx"  把这段文字当作用户输入,让模型像收到语音一样思考+回应(LLM+TTS 链路验证)
    #   --input file   推真实音频上行(完整端到端,生产用)
    if hello_text:
        logger.info("→ SayHello: %s", hello_text)
        await ws.send(RealtimeDialogueFunctions.say_hello_payload(
            session_id, SayHelloRequest(content=hello_text)
        ))
        try:
            await asyncio.wait_for(tts_ended.wait(), timeout=30)
        except asyncio.TimeoutError:
            logger.warning("等 TTSEnded 超时 30s,强行 FinishSession")
    elif query_text:
        logger.info("→ ChatTextQuery: %s", query_text)
        await ws.send(RealtimeDialogueFunctions.chat_text_query_payload(
            session_id, ChatTextQueryRequest(content=query_text)
        ))
        try:
            await asyncio.wait_for(tts_ended.wait(), timeout=30)
        except asyncio.TimeoutError:
            logger.warning("等 TTSEnded 超时 30s,模型可能选择不回应")
    else:
        CHUNK_MS = 100
        bytes_per_chunk = int(16000 * 2 * CHUNK_MS / 1000)  # 16k * 2B * 0.1s = 3200
        # 推完真实音频后追加 2 秒静音,触发模型 VAD 端点检测
        # 真实浏览器场景麦克风一直在采,不需要这一段;只有 demo 用预录音频时才要
        pcm_padded = pcm_in + b"\x00" * (bytes_per_chunk * 20)
        total_frames = (len(pcm_padded) + bytes_per_chunk - 1) // bytes_per_chunk
        logger.info("→ 推 PCM,每帧 %dms (%d 字节),共 %d 帧(含 2s 尾静音)",
                    CHUNK_MS, bytes_per_chunk, total_frames)
        for i in range(0, len(pcm_padded), bytes_per_chunk):
            chunk = pcm_padded[i:i + bytes_per_chunk]
            await ws.send(RealtimeDialogueFunctions.task_request_payload(session_id, chunk))
            # 推音频时也要监听 TTS 是否已经开始(模型可能边听边回)
            if tts_ended.is_set():
                break
            await asyncio.sleep(CHUNK_MS / 1000)
        # 推完后再等一段时间让模型把 TTS 跑完
        try:
            await asyncio.wait_for(tts_ended.wait(), timeout=30)
        except asyncio.TimeoutError:
            logger.warning("等 TTSEnded 超时 30s,可能模型选择不回应")

    # 4) 告诉模型用户说完了,等回复
    await ws.send(RealtimeDialogueFunctions.finish_session_payload(session_id))
    logger.info("→ FinishSession,等服务器把回复音频跑完…")

    # 等 SessionFinished 或失败,最多 60s
    try:
        await asyncio.wait_for(session_done.wait(), timeout=60)
    except asyncio.TimeoutError:
        logger.warning("等 SessionFinished 超时 60s")
    reader_task.cancel()

    await ws.send(RealtimeDialogueFunctions.finish_connection_payload())
    await ws.close()

    pcm_out = b"".join(audio_chunks_out)
    t_end = time.perf_counter()
    logger.info("=" * 60)
    logger.info("用户原话: %s", "".join(user_text_buf) or "(无)")
    logger.info("角色回复: %s", "".join(reply_text_buf) or "(无)")
    logger.info("总耗时: %.2fs", t_end - t_connect)
    if first_text_at:
        logger.info("首段文本延迟(从开始推流算): %.2fs", first_text_at - t_first_send)
    if first_audio_at:
        logger.info("首段音频延迟(从开始推流算): %.2fs", first_audio_at - t_first_send)
    logger.info("输出音频: %d 字节 (%.1f 秒,24k mono PCM)",
                len(pcm_out), len(pcm_out) / 2 / 24000 if pcm_out else 0)

    if pcm_out:
        write_pcm_as_wav(pcm_out, output_path, sample_rate=24000)
        logger.info("已写入: %s", output_path)
    else:
        logger.warning("没有收到任何音频输出,检查事件日志")


def main() -> None:
    parser = argparse.ArgumentParser(description="豆包·端到端实时语音 demo")
    parser.add_argument("--input", type=Path, default=None,
                        help="输入音频(wav/mp3 等);只在完整端到端模式需要")
    parser.add_argument("--hello", default=None,
                        help="SayHello 模式:让角色直接朗读这句话(纯 TTS 链路验证)")
    parser.add_argument("--query", default=None,
                        help="ChatTextQuery 模式:把这句当用户输入,让模型回应(LLM+TTS 链路验证)")
    parser.add_argument("--bare", action="store_true",
                        help="排查:跳过自定义人设/音色,用「豆包」缺省人设,排除人设审核拦截")
    parser.add_argument("--character", default="sister", choices=list(CHARACTERS))
    parser.add_argument("--output", type=Path, default=Path("data/realtime_reply.wav"))
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if not args.hello and not args.query and args.input is None:
        parser.error("必须提供 --input 或 --hello 或 --query")

    setup_logging("DEBUG" if args.debug else "INFO")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    asyncio.run(run(
        args.input.expanduser() if args.input else None,
        args.character, args.output,
        hello_text=args.hello, query_text=args.query, bare=args.bare,
    ))


if __name__ == "__main__":
    main()
