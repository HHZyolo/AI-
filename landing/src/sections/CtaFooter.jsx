import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import './CtaFooter.css';

/** 终 CTA + 页脚 —— 含巧思彩蛋 */
export default function CtaFooter() {
  const [eggTime, setEggTime] = useState('01:23');
  const logoClicks = useRef(0);
  const [wink, setWink] = useState(false);

  // 彩蛋:页脚显示「此刻」时间,营造「她还在线」
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setEggTime(
        `${String(d.getHours()).padStart(2, '0')}:${String(
          d.getMinutes()
        ).padStart(2, '0')}`
      );
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  // 彩蛋:连点 logo 5 次 —— 全站「眨一下眼」
  const onLogoClick = () => {
    logoClicks.current += 1;
    if (logoClicks.current >= 5) {
      logoClicks.current = 0;
      setWink(true);
      setTimeout(() => setWink(false), 600);
    }
  };

  return (
    <>
      <section className={`cta ${wink ? 'is-wink' : ''}`} id="cta">
        <div className="cta__glow" aria-hidden="true" />
        <div className="container cta__inner reveal">
          <span className="eyebrow">就差你一个了</span>
          <h2 className="cta__title">
            今晚,
            <br />
            <span className="text-grad">别再一个人开黑</span>
          </h2>
          <p className="cta__lead">
            手机号登录,免费试用 10 分钟。聊得来,再决定要不要留下她。
          </p>
          <div className="cta__actions">
            <Link className="btn-primary cta__btn" to="/app">
              <Icon name="mic" size={20} />
              免费试用 10 分钟
            </Link>
            <span className="cta__hint">
              <Icon name="bolt" size={14} />
              无需下载 · 浏览器直接开聊
            </span>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <button
              className="footer__logo"
              onClick={onLogoClick}
              aria-label="彩蛋:连续点击"
            >
              <svg viewBox="0 0 32 32" width="26" height="26">
                <g
                  stroke="url(#fg)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                >
                  <path d="M7 16h2M12 11v10M16 7v18M20 11v10M24 14v4" />
                </g>
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#FF5C9E" />
                    <stop offset="1" stopColor="#9D6BFF" />
                  </linearGradient>
                </defs>
              </svg>
              <span>AI 陪玩搭子</span>
            </button>
            <p className="footer__tagline">
              为 PC 战术 FPS 男玩家打造的 AI 语音陪玩
            </p>
          </div>

          <nav className="footer__links" aria-label="页脚导航">
            <a className="footer__link" href="#rhythm">一天节律</a>
            <a className="footer__link" href="#characters">AI 角色</a>
            <a className="footer__link" href="#pricing">时长包</a>
            <a className="footer__link" href="#trust">合规说明</a>
          </nav>
        </div>

        {/* 巧思彩蛋:滚动到底的小惊喜 */}
        <div className="footer__egg container">
          <span className="status-dot" />
          <span className="footer__egg-text">
            凌晨{' '}
            <span className="footer__egg-time">{eggTime}</span> —— 她还在线。
            你看到这里了,谢谢。
          </span>
        </div>

        <div className="footer__bar container">
          <span>© 2026 AI 陪玩搭子 · 仅面向 18 岁以上成年用户</span>
          <span className="footer__credit">
            Motion effects derived from{' '}
            <a
              className="link"
              href="https://github.com/DavidHDev/vue-bits"
              target="_blank"
              rel="noreferrer"
            >
              vue-bits
            </a>{' '}
            (MIT)
          </span>
        </div>
      </footer>
    </>
  );
}
