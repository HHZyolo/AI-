/**
 * PCM 流式播放器:把从 WS 收到的 24k mono s16le PCM 块缝合起来连续播放,
 * 同时支持 clear() 立即清空 —— 这是"打断"的关键能力。
 *
 * 实现思路:
 *   - 用 AudioContext + 一系列连续调度的 AudioBufferSourceNode
 *   - jitter buffer:第一段音频不立即播,先攒 prebufferMs 再统一调度,
 *     用一小段延迟换抗网络抖动能力(走 Cloudflare 后这是必需品)
 *   - clear() 时记录一个 epoch,旧 epoch 排队中的 source 全部 stop()
 *   - 浏览器 autoplay 政策:首次 play 必须在用户手势回调里 resume() 一次
 *
 * 用法:
 *   const p = new PcmPlayer(24000);
 *   await p.resume();              // 用户点击麦克风时调一次
 *   p.feed(int16Array);            // 每收到一段 PCM 调一次
 *   p.clear();                     // 用户开口/挂断时立刻清空
 *   p.close();
 */
export default class PcmPlayer {
  constructor(sampleRate = 24000, prebufferMs = 150) {
    this.sampleRate = sampleRate;
    // 起播前先攒这么多毫秒的音频,抵消网络抖动;每次 clear 后重新攒。
    // 150ms 是经验值:Cloudflare Tunnel/中转链路抖动通常 < 100ms,
    // 留 50ms 余量,既扛抖又不会让用户感觉延迟。
    this.prebufferMs = prebufferMs;
    this.ctx = null;
    this.nextStartTime = 0;
    this.epoch = 0;                  // 每次 clear+1,旧 source 据此判断要不要 stop
    this.sources = new Set();        // 正在排队的 source,clear 用
    // 起播前的预缓冲队列。攒够 prebufferMs 才一次性 flush 出去开播。
    this.pendingChunks = [];
    this.pendingDurationSec = 0;
    this.playing = false;
  }

  async resume() {
    if (!this.ctx) {
      // 24kHz 上下文 —— 现代浏览器都允许指定采样率,播 24k PCM 不用再 resample
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
        latencyHint: 'interactive',
      });
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.nextStartTime = this.ctx.currentTime;
  }

  /** 喂一段 Int16 PCM。起播前先攒,起播后实时排队。 */
  feed(int16) {
    if (!this.ctx || int16.length === 0) return;

    // Int16 → Float32 [-1, 1]
    // 统一除 32768:连续,无零点跳变,代价是正向损失 1 个量化级(听不出来)。
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float[i] = int16[i] / 32768;
    }
    const buf = this.ctx.createBuffer(1, float.length, this.sampleRate);
    buf.copyToChannel(float, 0);

    if (!this.playing) {
      // 起播前:先攒着,够 prebufferMs 再 flush
      this.pendingChunks.push(buf);
      this.pendingDurationSec += buf.duration;
      if (this.pendingDurationSec * 1000 >= this.prebufferMs) {
        this._flushPrebuffer();
      }
    } else {
      // 已在播:直接排队下一段
      this._scheduleBuffer(buf, this.epoch);
    }
  }

  /** 把预缓冲队列一次性调度出去,转入"连续播放"状态。 */
  _flushPrebuffer() {
    if (this.pendingChunks.length === 0) return;
    const myEpoch = this.epoch;
    // 起播时间 = 现在 + 一点点 lead time(让 audio thread 准备好)
    this.nextStartTime = this.ctx.currentTime + 0.02;
    for (const buf of this.pendingChunks) {
      this._scheduleBuffer(buf, myEpoch);
    }
    this.pendingChunks = [];
    this.pendingDurationSec = 0;
    this.playing = true;
  }

  /** 把单段 buf 调度到 nextStartTime,然后推进游标。 */
  _scheduleBuffer(buf, myEpoch) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);

    // 调度:游标落后于 now(抖动 / 起播)时贴 now 开始,否则连缝拼接
    const now = this.ctx.currentTime;
    if (this.nextStartTime < now) this.nextStartTime = now;
    src.start(this.nextStartTime);
    this.nextStartTime += buf.duration;

    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      // 缝合点:如果所有 source 都播完了,标记非播放态,下一段 feed 重新预缓冲。
      // 这样每"轮"AI 说话都有 jitter buffer 保护。
      if (this.sources.size === 0) {
        this.playing = false;
      }
    };

    if (myEpoch !== this.epoch) {
      try { src.stop(0); } catch { /* noop */ }
    }
  }

  /** 立即清空所有排队中的音频。打断 AI 时调用。 */
  clear() {
    this.epoch += 1;
    for (const src of this.sources) {
      try { src.stop(0); } catch { /* noop */ }
    }
    this.sources.clear();
    this.pendingChunks = [];
    this.pendingDurationSec = 0;
    this.playing = false;
    if (this.ctx) this.nextStartTime = this.ctx.currentTime;
  }

  async close() {
    this.clear();
    if (this.ctx) {
      try { await this.ctx.close(); } catch { /* noop */ }
      this.ctx = null;
    }
  }
}
