"""测试 FastAPI /characters/{slug}/realtime WS 代理。

模拟浏览器:连后端 WS,推一段录音 PCM,收角色回复音频写到 wav。
不打开浏览器就能验证 FastAPI ↔ 火山 整条链路。

执行(后端已 uvicorn 启动):
    cd backend
    .venv/bin/python -m scripts.realtime_ws_client --slug sister --input ../02-sister__魅力女友__zh_female_meilinvyou_moon_bigtts.mp3
    .venv/bin/python -m scripts.realtime_ws_client --slug sister --hello   # 让 AI 主动说 greeting
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import shutil
import subprocess
import sys
import time
import wave
from pathlib import Path

import websockets

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.logging_conf import setup_logging  # noqa: E402

logger = logging.getLogger("realtime_ws_client")


def load_pcm16k(path: Path) -> bytes:
    if path.suffix.lower() == ".wav":
        with wave.open(str(path), "rb") as w:
            if w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2:
                return w.readframes(w.getnframes())
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg 没装,brew install ffmpeg")
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-f", "s16le", "-ar", "16000", "-ac", "1", "-"],
        capture_output=True, check=True,
    )
    return proc.stdout


async def run(slug: str, input_path: Path | None, hello: bool, output: Path,
              base_url: str = "ws://127.0.0.1:8000") -> None:
    url = f"{base_url}/characters/{slug}/realtime"
    logger.info("连接 %s", url)

    pcm_in = b""
    if input_path:
        pcm_in = load_pcm16k(input_path)
        # 末尾追加 2 秒静音(本地预录场景才需要,真实麦克风不需要)
        pcm_in += b"\x00" * (16000 * 2 * 2)
        logger.info("PCM 长度 %d 字节 (%.1fs)", len(pcm_in), len(pcm_in) / 2 / 16000)

    audio_chunks: list[bytes] = []
    user_text: list[str] = []
    reply_text: list[str] = []
    first_audio_at: float | None = None
    closed = asyncio.Event()
    ready = asyncio.Event()

    async with websockets.connect(url, max_size=20 * 1024 * 1024) as ws:
        async def reader() -> None:
            nonlocal first_audio_at
            async for msg in ws:
                if isinstance(msg, (bytes, bytearray)):
                    if first_audio_at is None:
                        first_audio_at = time.perf_counter()
                    audio_chunks.append(bytes(msg))
                else:
                    try:
                        ev = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                    t = ev.get("type")
                    if t == "ready":
                        logger.info("← ready")
                        ready.set()
                    elif t == "asr":
                        if ev.get("final"):
                            user_text.append(ev.get("text", ""))
                            logger.info("← ASR(final): %s", ev.get("text"))
                        else:
                            logger.debug("← ASR(interim): %s", ev.get("text"))
                    elif t == "reply":
                        reply_text.append(ev.get("text", ""))
                        logger.info("← reply: %s", ev.get("text"))
                    elif t == "interrupt":
                        logger.info("← interrupt (用户开口,前端应清缓冲)")
                    elif t == "tts_end":
                        logger.info("← tts_end")
                    elif t == "error":
                        logger.error("← error code=%s msg=%s",
                                     ev.get("code"), ev.get("message"))
                    elif t == "closed":
                        logger.info("← closed")
                        closed.set()
                        return

        reader_task = asyncio.create_task(reader())

        await asyncio.wait_for(ready.wait(), timeout=10)
        t_first_send = time.perf_counter()

        if hello:
            await ws.send(json.dumps({"type": "hello"}))
            logger.info("→ hello")
            try:
                await asyncio.wait_for(closed.wait(), timeout=20)
            except asyncio.TimeoutError:
                logger.info("等 closed 超时,主动 end")
        elif pcm_in:
            CHUNK_MS = 100
            bytes_per_chunk = int(16000 * 2 * CHUNK_MS / 1000)
            n = (len(pcm_in) + bytes_per_chunk - 1) // bytes_per_chunk
            logger.info("→ 推 PCM %d 帧", n)
            for i in range(0, len(pcm_in), bytes_per_chunk):
                await ws.send(pcm_in[i:i + bytes_per_chunk])
                await asyncio.sleep(CHUNK_MS / 1000)
            try:
                await asyncio.wait_for(closed.wait(), timeout=30)
            except asyncio.TimeoutError:
                logger.info("等 closed 超时,主动 end")

        # 主动 end + 优雅关闭
        try:
            await ws.send(json.dumps({"type": "end"}))
        except Exception:
            pass
        await asyncio.sleep(0.5)
        reader_task.cancel()

    t_end = time.perf_counter()
    pcm_out = b"".join(audio_chunks)
    logger.info("=" * 60)
    logger.info("用户原话: %s", "".join(user_text) or "(无)")
    logger.info("角色回复: %s", "".join(reply_text) or "(无)")
    if first_audio_at:
        logger.info("首段音频延迟: %.2fs", first_audio_at - t_first_send)
    logger.info("总耗时: %.2fs", t_end - t_first_send)
    logger.info("输出音频: %d 字节 (%.1fs, 24k mono PCM)",
                len(pcm_out), len(pcm_out) / 2 / 24000 if pcm_out else 0)

    if pcm_out:
        with wave.open(str(output), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(pcm_out)
        logger.info("已写入 %s", output)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--slug", default="sister")
    p.add_argument("--input", type=Path, default=None)
    p.add_argument("--hello", action="store_true",
                   help="让 AI 主动说 greeting,不推音频")
    p.add_argument("--output", type=Path, default=Path("data/realtime_ws_reply.wav"))
    p.add_argument("--base-url", default="ws://127.0.0.1:8000")
    p.add_argument("--debug", action="store_true")
    args = p.parse_args()
    if not args.input and not args.hello:
        p.error("--input 或 --hello 至少给一个")
    setup_logging("DEBUG" if args.debug else "INFO")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    asyncio.run(run(args.slug, args.input, args.hello, args.output, args.base_url))


if __name__ == "__main__":
    main()
