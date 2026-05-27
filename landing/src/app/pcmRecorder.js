/**
 * 麦克风 → 16kHz mono Int16 PCM 帧。
 *
 * 用法:
 *   const rec = new PcmRecorder({ onFrame: (int16) => ws.send(int16.buffer) });
 *   await rec.start();
 *   rec.stop();
 *
 * 实现:
 *   getUserMedia → AudioContext → AudioWorklet(pcm-recorder) → port.onmessage 拿到 Int16 帧
 *   AudioWorklet 文件在 /audio/pcm-recorder-worklet.js(public 静态资源)。
 */
const WORKLET_URL = '/audio/pcm-recorder-worklet.js';

export default class PcmRecorder {
  constructor({ onFrame, sampleRate = 16000 } = {}) {
    this.onFrame = onFrame;
    this.sampleRate = sampleRate;
    this.stream = null;
    this.ctx = null;
    this.workletNode = null;
    this.source = null;
  }

  async start() {
    if (this.workletNode) return;

    // 让浏览器尽量直接出 16k(Chrome/Firefox 支持 sampleRate 提示;
    // Safari 可能仍按硬件 48k 给,Worklet 里会再次降采样)
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: this.sampleRate,
      },
    });

    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
    });
    await this.ctx.audioWorklet.addModule(WORKLET_URL);

    this.workletNode = new AudioWorkletNode(this.ctx, 'pcm-recorder', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
    });
    this.workletNode.port.onmessage = (e) => {
      // 收到的是 ArrayBuffer,包装成 Int16 视图
      const int16 = new Int16Array(e.data);
      if (this.onFrame) this.onFrame(int16);
    };

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.workletNode);
  }

  async stop() {
    try { this.workletNode?.port.postMessage('stop'); } catch { /* noop */ }
    try { this.source?.disconnect(); } catch { /* noop */ }
    try { this.workletNode?.disconnect(); } catch { /* noop */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { await this.ctx?.close(); } catch { /* noop */ }
    this.stream = null;
    this.ctx = null;
    this.workletNode = null;
    this.source = null;
  }
}
