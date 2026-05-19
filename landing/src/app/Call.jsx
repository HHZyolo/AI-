import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { getCharacter } from '../data/characters';
import { getDialogue } from '../data/dialogues';
import { useAppState } from './appContext';
import CharacterOrb from './CharacterOrb';
import './Call.css';

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function Call() {
  const navigate = useNavigate();
  const { characterId, trialLeft, consume } = useAppState();
  const character = getCharacter(characterId);
  const script = getDialogue(characterId);

  const [phase, setPhase] = useState('connecting'); // connecting | live | ended
  const [elapsed, setElapsed] = useState(0); // 通话计时(秒)
  const [turn, setTurn] = useState(-1); // 当前对话句索引
  const [speaker, setSpeaker] = useState('ai'); // 谁在说 —— 决定声纹环颜色
  const timers = useRef([]);

  // 剩余试用额度 —— 派生值,不用 ref
  const remain = Math.max(0, trialLeft - elapsed);

  // 连接动画 → 进入通话
  useEffect(() => {
    const t = setTimeout(() => setPhase('live'), 1800);
    return () => clearTimeout(t);
  }, []);

  // 通话计时 —— 计时到额度耗尽时直接结束通话
  useEffect(() => {
    if (phase !== 'live') return;
    let secs = 0;
    const iv = setInterval(() => {
      secs += 1;
      setElapsed(secs);
      if (secs >= trialLeft) setPhase('ended');
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, trialLeft]);

  // 通话结束时结算消耗的额度
  useEffect(() => {
    if (phase === 'ended' && elapsed > 0) {
      consume(Math.min(elapsed, trialLeft));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 模拟对话脚本逐句推进
  useEffect(() => {
    if (phase !== 'live') return;
    let i = 0;
    const next = () => {
      if (i >= script.length) return;
      const line = script[i];
      const id = setTimeout(() => {
        setTurn(i);
        setSpeaker(line.speaker);
        i += 1;
        next();
      }, line.delay);
      timers.current.push(id);
    };
    next();
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [phase, script]);

  const endCall = () => {
    setPhase('ended');
  };

  // 返回主页 —— 通话中途退出时先结算已消耗的额度
  const exitToHome = () => {
    if (phase === 'live' && elapsed > 0) {
      consume(Math.min(elapsed, trialLeft));
    }
    navigate('/app');
  };

  const current = turn >= 0 ? script[turn] : null;

  // 声纹条 —— 12 根,CSS 动画错峰起伏
  const bars = Array.from({ length: 13 });

  return (
    <div className="call" style={{ '--char-accent': character.accent }}>
      {/* 顶部状态 */}
      <div className="call__top">
        <button
          className="call__back"
          onClick={exitToHome}
          aria-label="返回主页"
        >
          <Icon name="arrow" size={16} />
          返回
        </button>
        <span className="call__status">
          {phase === 'connecting' && '正在接通…'}
          {phase === 'live' && (
            <>
              <span className="status-dot" />
              通话中 · {fmt(elapsed)}
            </>
          )}
          {phase === 'ended' && '通话已结束'}
        </span>
        <span className="call__trial">
          <Icon name="clock" size={13} />
          剩余 {fmt(remain)}
        </span>
      </div>

      {/* 角色光球 + 声纹 */}
      <div className="call__stage">
        <div className="call__halo" aria-hidden="true" />
        <CharacterOrb
          character={character}
          size={150}
          live={phase === 'live'}
        />
        <h1 className="call__name">{character.name}</h1>

        {/* 声纹可视化 —— speaker 决定颜色:AI 品红/紫,用户青 */}
        <div
          className={`call__wave ${phase === 'live' ? 'is-active' : ''} ${
            speaker === 'user' ? 'is-user' : ''
          }`}
          aria-hidden="true"
        >
          {bars.map((_, i) => (
            <span
              key={i}
              className="call__bar"
              style={{ '--d': `${(i % 5) * 0.12}s` }}
            />
          ))}
        </div>
      </div>

      {/* 字幕 */}
      <div className="call__subtitle">
        {phase === 'connecting' && (
          <p className="call__hint">正在为你接通 {character.name}…</p>
        )}
        {phase === 'live' && current && (
          <div
            key={turn}
            className={`call__line ${
              current.speaker === 'user' ? 'is-user' : 'is-ai'
            }`}
          >
            <span className="call__line-who">
              {current.speaker === 'user' ? '你' : character.name}
            </span>
            <p className="call__line-text">{current.text}</p>
          </div>
        )}
        {phase === 'live' && !current && (
          <p className="call__hint">戴上耳机,对她说点什么吧～</p>
        )}
        {phase === 'ended' && (
          <div className="call__ended">
            <p className="call__ended-title">这次陪玩结束啦</p>
            <p className="call__ended-sub">
              本次通话 {fmt(elapsed)} · 她记住了今天聊的事,下次见
            </p>
          </div>
        )}
      </div>

      {/* 控制区 */}
      <div className="call__controls">
        {phase !== 'ended' ? (
          <>
            <button className="call__ctrl" aria-label="麦克风">
              <Icon name="mic" size={22} />
              <span>麦克风</span>
            </button>
            <button
              className="call__end"
              onClick={endCall}
              aria-label="结束通话"
            >
              <Icon name="moon" size={26} />
            </button>
            <button className="call__ctrl" aria-label="文字">
              <Icon name="chat" size={22} />
              <span>字幕</span>
            </button>
          </>
        ) : (
          <div className="call__after">
            <button
              className="btn-secondary"
              onClick={() => navigate('/app/characters')}
            >
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
