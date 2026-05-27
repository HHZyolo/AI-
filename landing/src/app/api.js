/**
 * 后端 API 封装 —— FastAPI 后端 http://127.0.0.1:8000
 *
 * 设计要点：
 *  - 接口失败时抛 ApiError(message, status, detail)，调用方按需展示 message。
 *  - 422（pydantic 校验错）会把第一条字段错误转成中文友好提示。
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function extractMessage(payload, status) {
  if (!payload) return `请求失败（${status}）`;
  // FastAPI 业务异常：{ detail: "中文消息" }
  if (typeof payload.detail === 'string') return payload.detail;
  // FastAPI 校验异常：{ detail: [{ loc, msg, type, ... }] }
  if (Array.isArray(payload.detail) && payload.detail[0]) {
    const item = payload.detail[0];
    const field = item.loc?.[item.loc.length - 1];
    if (field === 'email') return '邮箱格式不正确';
    if (field === 'password') return '密码至少 8 位';
    return item.msg || '提交内容不合法';
  }
  return `请求失败（${status}）`;
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(extractMessage(payload, res.status), res.status, payload?.detail);
  }
  return payload;
}

/**
 * 一回合对话:上传录音,返回 { audioBlob, userText, replyText, timing }
 * audioBlob 是角色回复的 mp3,前端拿 <audio> 直接播。
 */
async function talk({ slug, audioBlob, audioFormat = 'webm', history }) {
  const form = new FormData();
  form.append('audio', audioBlob, `mic.${audioFormat}`);
  form.append('audio_format', audioFormat);
  if (history) form.append('history', JSON.stringify(history));

  const res = await fetch(`${API_BASE}/characters/${slug}/talk`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let payload = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    throw new ApiError(extractMessage(payload, res.status), res.status, payload?.detail);
  }

  // 中文 header 是 base64,前端 decode 回 UTF-8
  const b64 = (k) => {
    const v = res.headers.get(k);
    if (!v) return '';
    try {
      const bin = atob(v);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return '';
    }
  };

  return {
    audioBlob: await res.blob(),
    userText: b64('X-User-Text-B64'),
    replyText: b64('X-Reply-Text-B64'),
    voiceId: res.headers.get('X-Voice-Id') || '',
    timing: {
      asr: Number(res.headers.get('X-Asr-Ms') || 0),
      llm: Number(res.headers.get('X-Llm-Ms') || 0),
      tts: Number(res.headers.get('X-Tts-Ms') || 0),
      total: Number(res.headers.get('X-Total-Ms') || 0),
    },
  };
}

export const api = {
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: { email, password } }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/users/me', { token }),
  talk,
};
