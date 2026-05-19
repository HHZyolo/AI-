import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { CHARACTERS } from '../data/characters';
import { useAppState } from './appContext';
import CharacterOrb from './CharacterOrb';
import './CharacterSelect.css';

/** 角色选择页 —— PRD F05 多 AI 角色。桌面三卡横向网格 */
export default function CharacterSelect() {
  const navigate = useNavigate();
  const { characterId, setCharacterId } = useAppState();
  const [picked, setPicked] = useState(characterId);

  const confirm = () => {
    setCharacterId(picked);
    navigate('/app');
  };

  return (
    <div className="app-page cselect">
      <div className="app-page__head">
        <span className="app-page__eyebrow">总有一个 TA 对你的胃口</span>
        <h1 className="app-page__title">挑一个陪你的 TA</h1>
        <p className="app-page__sub">
          每个角色都懂《无畏契约》,只是哄你的方式不一样。
        </p>
      </div>

      <div className="cselect__grid">
        {CHARACTERS.map((c) => {
          const active = picked === c.id;
          return (
            <button
              key={c.id}
              className={`cselect__card ${active ? 'is-selected' : ''}`}
              style={{ '--char-accent': c.accent }}
              onClick={() => setPicked(c.id)}
              aria-pressed={active}
            >
              <span className="cselect__check" aria-hidden="true">
                {active && <Icon name="check" size={16} />}
              </span>

              <CharacterOrb character={c} size={104} />

              <div className="cselect__name-row">
                <span className="cselect__name">{c.name}</span>
                <span className="cselect__age">{c.age}</span>
              </div>
              <p className="cselect__persona">{c.persona}</p>

              <blockquote className="cselect__quote">{c.quote}</blockquote>

              <div className="cselect__traits">
                {c.traits.map((t) => (
                  <span className="cselect__trait" key={t}>
                    {t}
                  </span>
                ))}
              </div>

              <p className="cselect__meta">
                <Icon name="wave" size={13} />
                {c.voice} · {c.call}
              </p>
            </button>
          );
        })}
      </div>

      <div className="cselect__foot">
        <button className="cselect__confirm btn-primary" onClick={confirm}>
          <Icon name="heart" size={20} />
          就选 {CHARACTERS.find((c) => c.id === picked).name}
        </button>
      </div>
    </div>
  );
}
