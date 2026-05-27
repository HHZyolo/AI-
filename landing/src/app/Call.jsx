import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { getCharacter } from '../data/characters';
import { useAppState } from './appContext';
import CharacterOrb from './CharacterOrb';
import PcmRecorder from './pcmRecorder';
import PcmPlayer from './pcmPlayer';
import './Call.css';

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * 后端 WS 地址。后端跑在 :8000;同源走 ws,跨域走环境变量。
 */
function buildWsUrl(slug) {
  const base = import.meta.env.VITE_WS_BASE || 'ws://127.0.0.1:8000';
  return `${base}/characters/${slug}/realtime`;
}

/**
 * 实时通话页 —— "打电话"体验。
 *
 * 进入页面:
 *   1. 自动连 WS、起麦克风、起 PCM 播放器
 *   2. WS 收 ready 后,可选地发 hello 让角色主动打招呼
 *   3. 麦克风 PCM 持续推到后端;后端流式回 PCM,前端连续播
 *   4. 模型检测到用户开口(interrupt 事件)时立即清前端播放缓冲 —— 真打断
 *
 * 退出:挂电话(发 end) 或 navigate 走 → cleanup 所有资源
 */
export default function Call() {
  const navigate = useNavigate();
  const { characterId, trialLeft, consume } = useAppState();
  const character = getCharacter(characterId);

  // 通话状态:
  //   connecting  正在建 WS / 起麦克风
  //   listening   已就绪,在听用户说(也可能 AI 正在说,看 aiSpeaking)
  //   paused      用户暂时静音了麦克风
  //   error       报错(error 文本里有原因)
  //   ended       已挂断
  const [phase, setPhase] = useState('connecting');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);

  // 字幕
  const [userText, setUserText] = useState('');
  const [replyText, setReplyText] = useState('');

  // 通话计时
  const [elapsed, setElapsed] = useState(0);
  const remain = Math.max(0, trialLeft - elapsed);

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const mutedRef = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ─── 计时器 ─────────────────────────────────
  useEffect(() => {
    if (phase === 'ended' || phase === 'error') return;
    const iv = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        if (next >= trialLeft) {
          hangupRef.current?.();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, trialLeft]);

  // 结算
  useEffect(() => {
    if ((phase === 'ended' || phase === 'error') && elapsed > 0) {
      consume(Math.min(elapsed, trialLeft));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── 启动 + 清理(挂在组件挂载/卸载) ────────────────
  // hangup 用 ref 持有,让计时器超时也能调
  const hangupRef = useRef(null);

  useEffect(() => {
    // React 18 StrictMode 在开发模式会把 useEffect 跑两次,清理函数也跑两次。
    // 把所有资源用局部变量持有,cleanup 闭包里关同一份,这样不管跑几次都干净。
    // ref 只用来"让组件其它地方访问当前活跃的那一份",不参与生命周期管理。
    let cancelled = false;

    const player = new PcmPlayer(24000);
    const ws = new WebSocket(buildWsUrl(character.id));
    ws.binaryType = 'arraybuffer';

    const recorder = new PcmRecorder({
      onFrame: (int16) => {
        if (cancelled) return;
        if (mutedRef.current) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        // 软件回声抑制:AI 说话期间把上行 PCM 替换成静音帧,
        // 防止扬声器播出的 AI 声音被自己麦克风采到形成循环。
        // 代价:此时用户无法打断 AI(VAD 收不到声音)。
        // 戴耳机的用户不会有这个问题;真正解决要靠 WebRTC + 服务端 AEC。
        if (aiSpeakingRef.current) {
          const silent = new Int16Array(int16.length);
          ws.send(silent.buffer);
        } else {
          ws.send(int16.buffer);
        }
      },
    });

    playerRef.current = player;
    wsRef.current = ws;
    recorderRef.current = recorder;

    ws.onopen = () => {
      // 浏览器自动播放策略:必须在用户手势里 resume。
      // 进通话页之前用户已经点过(/app 上的进入按钮),通常 ok;
      // 不行的话第一段音频会哑,用户再点一下 mic 也能恢复。
      player.resume().catch(() => { /* 等用户点击触发 */ });
    };

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        handleServerEvent(msg);
      } else if (e.data instanceof ArrayBuffer) {
        // 后端来的 24k mono s16le PCM
        const int16 = new Int16Array(e.data);
        player.feed(int16);
        // 一收到音频就标记 AI 在说话
        if (!aiSpeakingRef.current) {
          aiSpeakingRef.current = true;
          setAiSpeaking(true);
        }
      }
    };

    ws.onerror = (e) => {
      console.error('ws error', e);
      if (!cancelled) {
        setError('连接出错,请重试');
        setPhase('error');
      }
    };

    ws.onclose = () => {
      if (!cancelled && phaseRef.current !== 'ended' && phaseRef.current !== 'error') {
        setPhase('ended');
      }
    };

    // 启麦克风(独立 async,失败要给用户提示)
    (async () => {
      try {
        await recorder.start();
      } catch (e) {
        if (cancelled) return;
        setError(
          e.name === 'NotAllowedError'
            ? '麦克风权限被拒绝。点浏览器地址栏左侧的小锁授权后刷新。'
            : `麦克风启动失败:${e.message || e.name}`,
        );
        setPhase('error');
      }
    })();

    hangupRef.current = () => hangup();

    return () => {
      cancelled = true;
      // 用闭包里的 ws/recorder/player,不走 cleanup() —— 那个看的是当前 ref,
      // StrictMode 双跑时 ref 可能已经被第二次设置成新对象了,
      // 走 cleanup() 会关掉错的资源,留下"幽灵 WS"。
      try { recorder.stop(); } catch { /* noop */ }
      try {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'end' })); } catch { /* noop */ }
        }
        ws.close();
      } catch { /* noop */ }
      try { player.close(); } catch { /* noop */ }
      // 如果当前 ref 还指着这一份(没被第二次跑覆盖),才清 ref
      if (recorderRef.current === recorder) recorderRef.current = null;
      if (wsRef.current === ws) wsRef.current = null;
      if (playerRef.current === player) playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aiSpeakingRef = useRef(false);

  const handleServerEvent = useCallback((msg) => {
    switch (msg.type) {
      case 'ready':
        setPhase((p) => (p === 'connecting' ? 'listening' : p));
        // 让角色主动打招呼(后端读 Character.greeting)
        try {
          wsRef.current?.send(JSON.stringify({ type: 'hello' }));
        } catch { /* noop */ }
        break;
      case 'asr':
        if (msg.final) {
          // 一句话说完了,固化进 userText
          setUserText((prev) => (prev ? `${prev} ${msg.text}` : msg.text));
        } else {
          // 中间结果可以先不展示,简化体验
        }
        break;
      case 'reply':
        // 火山的 reply 是分段流式,拼起来才是完整一句
        setReplyText((prev) => prev + (msg.text || ''));
        break;
      case 'interrupt':
        // 用户开口 —— 立刻清掉本地音频缓冲(打断 AI)
        playerRef.current?.clear();
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
        // 新一轮对话:清掉上一轮回复字幕
        setReplyText('');
        break;
      case 'tts_end':
        aiSpeakingRef.current = false;
        setAiSpeaking(false);
        break;
      case 'error':
        setError(`服务端错误:${msg.code} ${msg.message || ''}`);
        setPhase('error');
        break;
      case 'closed':
        setPhase('ended');
        break;
      default:
        break;
    }
  }, []);

  const cleanup = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'end' })); } catch { /* noop */ }
        ws.close();
      }
    } catch { /* noop */ }
    try { playerRef.current?.close(); } catch { /* noop */ }
    recorderRef.current = null;
    wsRef.current = null;
    playerRef.current = null;
  }, []);

  const hangup = useCallback(() => {
    setPhase('ended');
    cleanup();
  }, [cleanup]);

  const exitToHome = useCallback(() => {
    cleanup();
    navigate('/app');
  }, [cleanup, navigate]);

  const toggleMute = useCallback(async () => {
    setMuted((m) => !m);
    // 解锁播放(首次手势)
    try { await playerRef.current?.resume(); } catch { /* noop */ }
  }, []);

  // ─── 渲染 ─────────────────────────────────────────
  const wavePhase =
    phase === 'ended' || phase === 'error' ? '' :
      aiSpeaking ? 'is-active' :
        muted ? '' : 'is-user';

  const statusText = {
    connecting: '正在接通…',
    listening: aiSpeaking ? `${character.name}正在说` : (muted ? '麦克风已关' : '我在听'),
    paused: '麦克风已关',
    error: '连接出错',
    ended: '通话已结束',
  }[phase];

  return (
    <div className="call" style={{ '--char-accent': character.accent }}>
      <div className="call__top">
        <button className="call__back" onClick={exitToHome} aria-label="返回主页">
          <Icon name="arrow" size={16} />
          返回
        </button>
        <span className="call__status">
          <span className="status-dot" />
          {(phase === 'ended' || phase === 'error') ? statusText : `通话中 · ${fmt(elapsed)}`}
        </span>
        <span className="call__trial">
          <Icon name="clock" size={13} />
          剩余 {fmt(remain)}
        </span>
      </div>

      <div className="call__stage">
        <div className="call__halo" aria-hidden="true" />
        <CharacterOrb
          character={character}
          size={150}
          live={phase !== 'ended' && phase !== 'error'}
        />
        <h1 className="call__name">{character.name}</h1>

        <div className={`call__wave ${wavePhase}`} aria-hidden="true">
          {Array.from({ length: 13 }).map((_, i) => (
            <span
              key={i}
              className="call__bar"
              style={{ '--d': `${(i % 5) * 0.12}s` }}
            />
          ))}
        </div>
      </div>

      <div className="call__subtitle">
        {error && <p className="call__error">{error}</p>}
        {!error && <p className="call__hint">{statusText}</p>}
        {userText && (
          <div className="call__line is-user">
            <span className="call__line-who">你</span>
            <p className="call__line-text">{userText}</p>
          </div>
        )}
        {replyText && (
          <div className="call__line is-ai">
            <span className="call__line-who">{character.name}</span>
            <p className="call__line-text">{replyText}</p>
          </div>
        )}
      </div>

      <div className="call__controls">
        {phase !== 'ended' && phase !== 'error' ? (
          <>
            <button
              className={`call__ctrl call__mic ${muted ? 'is-muted' : 'is-live'}`}
              onClick={toggleMute}
              aria-label={muted ? '取消静音' : '静音'}
              title={muted ? '点一下让 AI 重新听你说话' : '点一下让 AI 听不到你'}
            >
              <Icon name="mic" size={22} />
              <span>{muted ? '取消静音' : '静音'}</span>
            </button>
            <button className="call__end" onClick={hangup} aria-label="挂断">
              <Icon name="moon" size={26} />
            </button>
            <button
              className="call__ctrl"
              aria-label="字幕"
              onClick={() => { setUserText(''); setReplyText(''); }}
            >
              <Icon name="chat" size={22} />
              <span>清字幕</span>
            </button>
          </>
        ) : (
          <div className="call__after">
            <button className="btn-secondary" onClick={() => navigate('/app/characters')}>
              换个角色
            </button>
            <button className="btn-primary" onClick={() => navigate('/app')}>
              回到主页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
