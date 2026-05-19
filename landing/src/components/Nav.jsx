import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Nav.css';

const LINKS = [
  { href: '#rhythm', label: '一天节律' },
  { href: '#needs', label: '为什么是它' },
  { href: '#characters', label: 'AI 角色' },
  { href: '#pricing', label: '时长包' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <a className="nav__brand" href="#top" aria-label="AI 陪玩搭子 首页">
        <span className="nav__logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <g stroke="url(#navg)" strokeWidth="2.4" strokeLinecap="round" fill="none">
              <path d="M7 16h2M12 11v10M16 7v18M20 11v10M24 14v4" />
            </g>
            <defs>
              <linearGradient id="navg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FF5C9E" />
                <stop offset="1" stopColor="#9D6BFF" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span className="nav__name">陪玩搭子</span>
      </a>

      <div className={`nav__links ${menuOpen ? 'is-open' : ''}`}>
        {LINKS.map((l) => (
          <a
            key={l.href}
            className="nav__link"
            href={l.href}
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </a>
        ))}
        <Link className="btn-primary nav__cta" to="/app">
          免费试用 10 分钟
        </Link>
      </div>

      <button
        className="nav__burger"
        aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className={menuOpen ? 'is-x' : ''} />
        <span className={menuOpen ? 'is-x' : ''} />
      </button>
    </nav>
  );
}
