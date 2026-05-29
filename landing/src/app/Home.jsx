import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { getCharacter } from '../data/characters';
import { useAppState } from './appContext';
import CharacterOrb from './CharacterOrb';
import LoginSheet from './LoginSheet';
import './Home.css';

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function Home() {
  const navigate = useNavigate();
  const { characterId, trialLeft, trialTotal, loggedIn } = useAppState();
  const character = getCharacter(characterId);
  const [showLogin, setShowLogin] = useState(false);

  // 未登录时进度条按"满"显示（视觉占位），已登录后才反映真实余额。
  const pct = loggedIn ? (trialLeft / trialTotal) * 100 : 100;
  const empty = loggedIn && trialLeft <= 0;
  const low = loggedIn && !empty && trialLeft <= 120;

  const startCall = () => {
    if (!loggedIn) {
      setShowLogin(true);
      return;
    }
    navigate('/app/call');
  };

  return (
    <div className="app-page home">
      <div className="home__grid">
        {/* 左:角色展示 */}
        <section className="home__showcase">
          <div className="home__halo" aria-hidden="true" />
          <CharacterOrb character={character} size={200} />
          <h1 className="home__char-name">{character.name}</h1>
          <p className="home__char-persona">
            {character.age} · {character.persona}
          </p>
          <blockquote className="home__char-quote">
            {character.quote}
          </blockquote>
        </section>

        {/* 右:开始陪玩 */}
        <section className="home__panel">
          <span className="home__online tag tag--accent">
            <span className="status-dot" />
            搭子在线 · 24h 随叫随到
          </span>

          <h2 className="home__panel-title">
            戴上耳机,
            <br />
            <span className="text-grad">现在就开聊</span>
          </h2>
          <p className="home__panel-lead">
            {loggedIn
              ? `${character.name}已经准备好陪你了 —— 点下面开始这次陪玩。`
              : '邮箱注册即可领取 3 分钟免费试用,无需下载,浏览器直接开聊。'}
          </p>

          {/* 试用额度 */}
          <div className="trial">
            <div className="trial__head">
              <span className="trial__label">
                <Icon name="clock" size={15} />
                {empty ? '试用额度已用完' : '免费试用额度'}
              </span>
              <span className="trial__value">
                <b>{fmt(loggedIn ? trialLeft : trialTotal)}</b> / {fmt(trialTotal)}
              </span>
            </div>
            <div className="trial__bar">
              <div
                className={`trial__fill ${
                  empty ? 'is-empty' : low ? 'is-low' : ''
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* 核心 CTA */}
          <button
            className="home__start btn-primary"
            onClick={startCall}
            disabled={empty}
          >
            <Icon name="mic" size={22} />
            {empty
              ? '额度用完 · 去购买时长包'
              : loggedIn
                ? '开始陪玩'
                : '登录 / 注册开始陪玩'}
          </button>

          {empty && (
            <p className="home__hint">
              首次试用的 3 分钟已用完 ——{' '}
              <Link to="/#pricing" className="link">
                查看时长包
              </Link>
            </p>
          )}
          {!loggedIn && !empty && (
            <p className="home__hint">
              <Icon name="bolt" size={13} />
              点击「开始陪玩」即可登录/注册
            </p>
          )}
        </section>
      </div>

      {showLogin && <LoginSheet onClose={() => setShowLogin(false)} />}
    </div>
  );
}
