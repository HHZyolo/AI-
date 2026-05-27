"""音色试听脚本 —— 帮三个角色各挑一个豆包 TTS 音色。

做法:为每个候选音色合成"它对应档位的角色 greeting",输出到 /tmp/audition/。
文件名形如:  01-genki__zh_female_shaoergushi__湾湾小何.mp3
按文件名前缀(01/02/03)分组,听完直接告诉我每组里你选哪个 voice_id。

执行:
    cd backend && .venv/bin/python -m scripts.audition_voices

可选参数:
    --slot genki|sister|junior   只试听某一档(默认全部)
    --voice <voice_id>           只跑某个音色(用于精修)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.logging_conf import setup_logging
from app.services.volc.tts import TTSError, TTSRequest, synthesize

logger = logging.getLogger(__name__)


# ─── 三档角色台词(用 system 中的 greeting + 一句 in-character 对话拼出来,够听清音色情绪) ─────
SLOT_LINES: dict[str, str] = {
    "genki": "哥哥来啦~ 这把我陪你上分。诶,哥哥这把太强啦!那个三杀我都看呆了呀。",
    "sister": "来了。戴好耳机,这把我陪你慢慢打。别急,这局先放放。今天到底怎么了,跟我说说。",
    "junior": "来了。别又乱冲,这把听我的。就这?算了,下把我陪你,别再送了。",
}


@dataclass(frozen=True)
class Voice:
    voice_id: str
    label: str  # 中文名,便于你识别
    slot: str  # genki / sister / junior


# ─── 豆包 TTS 大模型常见女声候选清单 ─────────────────────────────────────────
# voice_id 格式遵循火山官方文档:zh_female_<拼音名>_<场景>_bigtts
# 这里挑的都是公开音色,不要你的账号额外申请。
# 如果某个 voice_id 你的账号没开通,会返回 code=4001/4003,跳过即可。
VOICES: list[Voice] = [
    # —— 元气妹妹档:甜美、活泼、年轻 ——
    Voice("zh_female_wanwanxiaohe_moon_bigtts", "湾湾小何", "genki"),
    Voice("zh_female_shaoergushi_mars_bigtts", "少儿故事", "genki"),
    Voice("zh_female_tianmeixiaoyuan_moon_bigtts", "甜美小源", "genki"),
    Voice("zh_female_kailangjiejie_moon_bigtts", "开朗姐姐", "genki"),
    Voice("zh_female_qingxinnvsheng_mars_bigtts", "清新女声", "genki"),
    # —— 温柔御姐档:成熟、磁性、稳重 ——
    Voice("zh_female_wenrouxiaoya_moon_bigtts", "温柔小雅", "sister"),
    Voice("zh_female_zhixingnvsheng_mars_bigtts", "知性女声", "sister"),
    Voice("zh_female_meilinvyou_moon_bigtts", "魅力女友", "sister"),
    Voice("zh_female_linjia_mars_bigtts", "邻家姐姐", "sister"),
    # —— 高冷学妹档:清冷、淡漠、书院风 ——
    Voice("zh_female_qingxin_mars_bigtts", "清新少女", "junior"),
    Voice("zh_female_jitang_mars_bigtts", "鸡汤妹妹", "junior"),
    Voice("zh_female_xuemei_moon_bigtts", "学妹", "junior"),
    Voice("zh_female_lengyu_moon_bigtts", "冷御", "junior"),
]


SLOT_ORDER = {"genki": 1, "sister": 2, "junior": 3}


async def run(only_slot: str | None, only_voice: str | None) -> None:
    settings = get_settings()
    if not settings.volc_app_id or not settings.volc_access_token:
        logger.error("VOLC_APP_ID / VOLC_ACCESS_TOKEN 未配置,请先填 .env")
        sys.exit(1)

    out_dir = Path("/tmp/audition")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = [
        v
        for v in VOICES
        if (only_slot is None or v.slot == only_slot)
        and (only_voice is None or v.voice_id == only_voice)
    ]
    if not targets:
        logger.error("没有符合条件的音色")
        sys.exit(1)

    ok, fail = 0, 0
    for v in targets:
        text = SLOT_LINES[v.slot]
        prefix = f"{SLOT_ORDER[v.slot]:02d}-{v.slot}"
        fname = f"{prefix}__{v.label}__{v.voice_id}.mp3"
        path = out_dir / fname
        try:
            result = await synthesize(
                TTSRequest(text=text, voice_id=v.voice_id)
            )
            path.write_bytes(result.audio)
            logger.info(
                "✅ %-8s %-10s %s (%d ms, %d KB)",
                v.slot,
                v.label,
                v.voice_id,
                result.duration_ms,
                len(result.audio) // 1024,
            )
            ok += 1
        except TTSError as e:
            logger.warning(
                "❌ %-8s %-10s %s  code=%s msg=%s",
                v.slot,
                v.label,
                v.voice_id,
                e.code,
                e.message,
            )
            fail += 1

    print()
    print("=" * 60)
    print(f"完成: 成功 {ok} / 失败 {fail}")
    print(f"输出目录: {out_dir}")
    print("按文件名前缀分组听:")
    print("  01-genki   = 元气妹妹候选")
    print("  02-sister  = 温柔御姐候选")
    print("  03-junior  = 高冷学妹候选")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--slot",
        choices=["genki", "sister", "junior"],
        help="只试听某一档",
    )
    parser.add_argument("--voice", help="只跑某个 voice_id")
    args = parser.parse_args()

    setup_logging("INFO")
    asyncio.run(run(args.slot, args.voice))


if __name__ == "__main__":
    main()
