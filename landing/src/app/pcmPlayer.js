/**
 * PCM 流式播放器:把从 WS 收到的 24k mono s16le PCM 块缝合起来连续播放,
 * 同时支持 clear() 立即清空 —— 这是"打断"的关键能力。
 *
 * 实现思路:
 *   - 用 AudioContext + 一系列连续调度的 AudioBufferSourceNode
 *   - 维护一个"下一段音频应当在何时开始播"的游标 nextStartTime
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
  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.ctx = null;
    this.nextStartTime = 0;
    this.epoch = 0;                  // 每次 clear+1,旧 source 据此判断要不要 stop
    this.sources = new Set();        // 正在排队的 source,clear 用
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

  /** 喂一段 Int16 PCM。零拷贝转 Float32 后塞进 AudioBuffer 排队播。 */
  feed(int16) {
    if (!this.ctx || int16.length === 0) return;
    const myEpoch = this.epoch;

    // Int16 → Float32 [-1, 1]
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }
    const buf = this.ctx.createBuffer(1, float.length, this.sampleRate);
    buf.copyToChannel(float, 0);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);

    // 调度:如果游标落后了(网络抖动 / 第一次 feed),从 now 开始
    const now = this.ctx.currentTime;
    if (this.nextStartTime < now) this.nextStartTime = now;
    src.start(this.nextStartTime);
    this.nextStartTime += buf.duration;

    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
    };

    // 如果在调度之后又触发了 clear(),把这个 source 也停掉
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
