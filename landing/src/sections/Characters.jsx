import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import { CHARACTERS } from '../data/characters';
import './Characters.css';

// 全局单例 audio，整页同时只能播一段
let CURRENT_CHAR_AUDIO = null;

function CharacterCard({ c, audio }) {
  // 3D 倾斜 hover —— pointermove rAF 节流
  const onMove = useCallback((e) => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const card = e.currentTarget;
    if (card._raf) return;
    card._raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', `${-py * 8}deg`);
      card.style.setProperty('--ry', `${px * 10}deg`);
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      card._raf = null;
    });
  }, []);
  const onLeave = useCallback((e) => {
    const card = e.currentTarget;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }, []);

  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggleAudio = (e) => {
    e.stopPropagation();
    if (!audio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audio);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
      audioRef.current.addEventListener('pause', () => setPlaying(false));
    }
    const a = audioRef.current;
    if (playing) {
      a.pause();
      return;
    }
    if (CURRENT_CHAR_AUDIO && CURRENT_CHAR_AUDIO !== a) {
      CURRENT_CHAR_AUDIO.pause();
    }
    CURRENT_CHAR_AUDIO = a;
    a.currentTime = 0;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (CURRENT_CHAR_AUDIO === audioRef.current) CURRENT_CHAR_AUDIO = null;
      }
    };
  }, []);

  return (
    <article
      className="char-card card"
      style={{ '--char-accent': c.accent }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      tabIndex={0}
    >
      <div className="char-card__inner">
        <div className="char-card__avatar" aria-hidden="true">
          <span className="char-card__orb" />
          <span className="char-card__initial">{c.name[0]}</span>
        </div>

        <div className="char-card__id">
          <h3 className="char-card__name">{c.name}</h3>
          <span className="char-card__age tag">{c.age}</span>
          {audio && (
            <button
              type="button"
              className={`char-card__audiobtn ${playing ? 'is-playing' : ''}`}
              onClick={toggleAudio}
              aria-label={playing ? '暂停试听' : '试听她的声音'}
            >
              {playing ? (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  <span>试听中</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                  <span>试听声音</span>
                </>
              )}
            </button>
          )}
        </div>
        <p className="char-card__persona">{c.persona}</p>

        <ul className="char-card__traits">
          {c.traits.map((t) => (
            <li className="tag" key={t}>
              {t}
            </li>
          ))}
        </ul>

        <span className="char-card__call">
          <Icon name="heart" size={14} />
          {c.call}
        </span>
      </div>
    </article>
  );
}

export default function Characters() {
  // MVP 单角色:只展示温柔御姐
  const sister = CHARACTERS.find((c) => c.id === 'sister') || CHARACTERS[0];
  return (
    <section className="section characters" id="characters">
      <div className="container">
        <header className="characters__head reveal">
          <span className="eyebrow">陪你的人 · 是温柔御姐</span>
          <h2 className="section-h2">
            一个懂你的人,
            <span className="text-grad">比一群陪玩更稳</span>
          </h2>
          <p className="section-lead">
            26 岁,声音磁性、说话慢。
            打游戏她陪着,情绪不对她先停下来,听你说。
          </p>
        </header>

        <div className="characters__grid characters__grid--single">
          <div className="reveal" style={{ '--i': 0 }}>
            <CharacterCard c={sister} audio="/audition/sister_2.mp3" />
          </div>
        </div>
      </div>
    </section>
  );
}
