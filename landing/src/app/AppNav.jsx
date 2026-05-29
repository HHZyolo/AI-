import { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { getCharacter } from '../data/characters';
import { useAppState } from './appContext';
import LoginSheet from './LoginSheet';
import RedeemSheet from './RedeemSheet';

/** 产品页顶部导航栏 —— 桌面全宽 */
const LINKS = [
  { to: '/app', label: '陪玩', end: true },
];

export default function AppNav() {
  const { characterId, loggedIn, email, logout } = useAppState();
  const character = getCharacter(characterId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const menuRef = useRef(null);

  // 点外部 / 按 Esc 关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // 截断邮箱在按钮里的显示（@ 前太长就省略）
  const shortEmail = (() => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    const head = name.length > 10 ? `${name.slice(0, 10)}…` : name;
    return domain ? `${head}@${domain}` : head;
  })();

  return (
    <nav className="appnav">
      <div className="appnav__inner">
        <Link className="appnav__brand" to="/">
          <span className="appnav__logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26">
              <g stroke="url(#ang)" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <path d="M7 16h2M12 11v10M16 7v18M20 11v10M24 14v4" />
              </g>
              <defs>
                <linearGradient id="ang" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FF5C9E" />
                  <stop offset="1" stopColor="#9D6BFF" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span className="appnav__name">陪玩搭子</span>
        </Link>

        <div className="appnav__links">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `appnav__link ${isActive ? 'is-active' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="appnav__right">
          <span className="appnav__char">
            <span
              className="appnav__char-dot"
              style={{ background: character.accent }}
              aria-hidden="true"
            />
            当前 · {character.name}
          </span>

          {loggedIn ? (
            <>
              <div className="usermenu" ref={menuRef}>
                <button
                  type="button"
                  className={`usermenu__trigger ${menuOpen ? 'is-open' : ''}`}
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="usermenu__avatar" aria-hidden="true">
                    {(email[0] || 'U').toUpperCase()}
                  </span>
                  <span className="usermenu__email">{shortEmail}</span>
                  <Icon name="arrow" size={12} />
                </button>

                {menuOpen && (
                  <div className="usermenu__panel" role="menu">
                    <div className="usermenu__info">
                      <div className="usermenu__info-label">当前账号</div>
                      <div className="usermenu__info-email">{email}</div>
                    </div>
                    <button
                      type="button"
                      className="usermenu__item is-danger"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      role="menuitem"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="appnav__user tag appnav__login"
                onClick={() => setShowRedeem(true)}
                title="使用兑换码增加体验时长"
              >
                <Icon name="gift" size={13} />
                兑换码
              </button>
            </>
          ) : (
            <button
              type="button"
              className="appnav__user tag appnav__login"
              onClick={() => setShowLogin(true)}
            >
              <Icon name="mic" size={13} />
              登录 / 注册
            </button>
          )}
        </div>
      </div>
      {showLogin && <LoginSheet onClose={() => setShowLogin(false)} />}
      {showRedeem && <RedeemSheet onClose={() => setShowRedeem(false)} />}
    </nav>
  );
}
