import { useCallback } from 'react';
import Icon from '../components/Icon';
import { CHARACTERS } from '../data/characters';
import './Characters.css';

function CharacterCard({ c }) {
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
        </div>
        <p className="char-card__persona">{c.persona}</p>

        <blockquote className="char-card__quote">
          <Icon name="chat" size={16} className="char-card__quote-ic" />
          {c.quote}
        </blockquote>

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
  return (
    <section className="section characters" id="characters">
      <div className="container">
        <header className="characters__head reveal">
          <span className="eyebrow">总有一个 TA · 对你的胃口</span>
          <h2 className="section-h2">
            三种性格,
            <span className="text-grad">三种被陪伴的方式</span>
          </h2>
          <p className="section-lead">
            元气、温柔、还是带点小傲娇 —— 挑一个最想听到的声音。
            每个角色都懂游戏,只是哄你的方式不一样。
          </p>
        </header>

        <div className="characters__grid">
          {CHARACTERS.map((c, i) => (
            <div
              className="reveal"
              style={{ '--i': i }}
              key={c.id}
            >
              <CharacterCard c={c} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
