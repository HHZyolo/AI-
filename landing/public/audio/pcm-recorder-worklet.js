/**
 * AudioWorklet:把麦克风采集的 Float32 帧重采样到 16 kHz / Int16,
 * 通过 port 发回主线程,主线程再走 WebSocket 推给后端。
 *
 * 浏览器 AudioContext 通常采样率是 48 kHz 或 44.1 kHz,
 * 火山实时语音要求 16 kHz mono s16le。所以这里同时做:
 *   - 单声道(只取第 0 通道)
 *   - 线性插值降采样
 *   - Float32 [-1,1] → Int16 [-32768, 32767]
 *
 * 输出节奏:每攒够 ~100 ms (1600 个 16k 样本) 就 postMessage 一次,
 * 跟后端推流节奏对齐。
 *
 * 注意:必须用 AudioWorkletProcessor(在专门的 audio-rendering 线程跑),
 * 老的 ScriptProcessorNode 已经 deprecated 而且会卡 UI 线程。
 */
const TARGET_SR = 16000;
const FRAME_MS = 100;
const SAMPLES_PER_FRAME = Math.round((TARGET_SR * FRAME_MS) / 1000); // 1600

class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // currentTime/sampleRate 是 AudioWorkletGlobalScope 全局,这里抓一次输入采样率
    this.inputSampleRate = sampleRate;
    this.downsampleStep = this.inputSampleRate / TARGET_SR;

    // 累积一帧的 Int16
    this.outBuf = new Int16Array(SAMPLES_PER_FRAME);
    this.outOffset = 0;

    // 余数累积(连续帧之间不丢样本)
    this.fracIndex = 0;

    // 主线程可以发 stop 消息让处理器停下
    this.running = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') this.running = false;
    };
  }

  /**
   * 每个 quantum(通常 128 样本)调一次。inputs[0][0] 是单声道 Float32。
   */
  process(inputs) {
    if (!this.running) return false;
    const ch = inputs[0]?.[0];
    if (!ch || ch.length === 0) return true;

    // 线性插值降采样
    const step = this.downsampleStep;
    let i = this.fracIndex;
    while (i < ch.length) {
      // 取最近的 Float32 样本(保留 quality 的话可以再做 anti-alias,先 KISS)
      const idx = i | 0;
      const sample = ch[idx];
      // Float → Int16,加 clamp 防越界
      const s = Math.max(-1, Math.min(1, sample));
      this.outBuf[this.outOffset++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this.outOffset >= SAMPLES_PER_FRAME) {
        // 一帧攒满,发回主线程(transferable 零拷贝)
        const out = this.outBuf.buffer;
        this.port.postMessage(out, [out]);
        this.outBuf = new Int16Array(SAMPLES_PER_FRAME);
        this.outOffset = 0;
      }
      i += step;
    }
    // 余数留给下一个 quantum
    this.fracIndex = i - ch.length;
    return true;
  }
}

registerProcessor('pcm-recorder', PCMRecorderProcessor);
