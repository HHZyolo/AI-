import { NavLink, Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { getCharacter } from '../data/characters';
import { useAppState } from './appContext';

/** 产品页顶部导航栏 —— 桌面全宽 */
const LINKS = [
  { to: '/app', label: '陪玩', end: true },
  { to: '/app/characters', label: '选择角色', end: false },
];

export default function AppNav() {
  const { characterId, loggedIn } = useAppState();
  const character = getCharacter(characterId);

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
          <span className="appnav__user tag">
            <Icon name="mic" size={13} />
            {loggedIn ? '已登录' : '未登录'}
          </span>
        </div>
      </div>
    </nav>
  );
}
