import { useState } from 'react';
import { Link } from 'react-router-dom';
import VoiceCanvas from '../components/VoiceCanvas';
import Icon from '../components/Icon';
import './Hero.css';

// 移动端 / reduced-motion 不挂 WebGL,改用 CSS 渐变 fallback
function canUseWebGL() {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth <= 640) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export default function Hero() {
  const [useWebGL] = useState(canUseWebGL);

  return (
    <header className="hero" id="top">
      <div className="hero__bg" aria-hidden="true">
        {useWebGL ? <VoiceCanvas /> : <div className="hero__fallback" />}
        <div className="hero__grid" />
      </div>

      <div className="container hero__inner">
        <span className="eyebrow hero__eyebrow">PC 战术 FPS · AI 语音陪玩</span>

        <h1 className="hero__h1">
          <span className="hero__line">深夜上分,</span>
          <span className="hero__line">
            <span className="text-grad">总有人陪你</span>
          </span>
        </h1>

        <p className="hero__lead">
          一个 24 小时在线、真懂《无畏契约》、能陪打能聊天、
          <strong>记得住你</strong>的 AI 语音搭子。
          不用约档期,不用看人脸色 —— 戴上耳机,她就在。
        </p>

        <div className="hero__actions">
          <Link className="btn-primary" to="/app">
            <Icon name="mic" size={20} />
            免费试用 10 分钟
          </Link>
          <a className="btn-secondary" href="#characters">
            看看三个 TA
            <Icon name="arrow" size={18} />
          </a>
        </div>

        <ul className="hero__stats">
          <li>
            <span className="status-dot" />
            <span className="hero__stat-text">
              <b>24h</b> 随叫随到
            </span>
          </li>
          <li>
            <Icon name="bolt" size={16} className="hero__stat-ic" />
            <span className="hero__stat-text">
              <b>≤1.5s</b> 开口延迟
            </span>
          </li>
          <li>
            <Icon name="crosshair" size={16} className="hero__stat-ic" />
            <span className="hero__stat-text">
              懂 <b>无畏契约</b> 全套黑话
            </span>
          </li>
        </ul>
      </div>
    </header>
  );
}
