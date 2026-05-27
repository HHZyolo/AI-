import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import { CHARACTERS } from '../data/characters';
import './GameKnowledge.css';

/**
 * 节奏控制 —— 单位 ms
 * USER_TYPE: 用户气泡也走打字感(略快,且气泡先出再字)
 * AI_THINK: 收到用户问题后"思考"时长(三点点动画的可见时长)
 * CHAR_DELAY: 每个字的间隔
 * BETWEEN_LINES: 一条消息打完到下一条开始
 */
const T = {
  USER_TYPE: 22,
  AI_THINK: 700,
  AI_CHAR: 38,
  BETWEEN: 520,
  RESTART: 4200, // 全部播完后,停留多久重播
};

/** 懂游戏 —— 专注《无畏契约》。术语分组,PRD 12.1 术语对照表 */
const GROUPS = [
  {
    icon: 'spark',
    label: '特工',
    terms: ['不死鸟', '贤者', '暮影', '蝰蛇', '钢锁', '幻棱', '夜露', '海神', 'KAY/O'],
  },
  {
    icon: 'crosshair',
    label: '地图',
    terms: ['绑定', '升天', '避世镇', '明珠', '海岸', '森寒', '裂变', '亚海悬城'],
  },
  {
    icon: 'bolt',
    label: '武器',
    terms: ['幻象', '暴徒', '卫士', '奥丁', '判官', '罪犯', '鬼魅'],
  },
  {
    icon: 'chat',
    label: '战术黑话',
    terms: ['报点', '跳投', '清点', 'eco 局', '架枪', '架烟', '残局 1v3', '上分'],
  },
];

/**
 * 四类特工定位 —— 抽象表现,不使用官方立绘(规避版权)。
 * 用几何发光徽记 + 定位名 + 该定位的代表特工。
 */
const ROLES = [
  {
    id: 'duelist',
    role: '决斗家',
    en: 'DUELIST',
    desc: '冲锋陷阵的进攻核心,负责开第一枪、撕开局面。',
    agents: ['不死鸟', '夜露', '幻棱'],
    accent: 'var(--accent)',
    shape: 'duelist',
  },
  {
    id: 'sentinel',
    role: '哨兵',
    en: 'SENTINEL',
    desc: '守家盯点的防守专家,封锁后路、看住侧翼。',
    agents: ['钢锁', '海神', '奇乐'],
    accent: 'var(--hud)',
    shape: 'sentinel',
  },
  {
    id: 'initiator',
    role: '先锋',
    en: 'INITIATOR',
    desc: '开视野、拉信息,帮队友安全切入战场。',
    agents: ['猎枭', 'KAY/O', '盖可'],
    accent: 'var(--violet)',
    shape: 'initiator',
  },
  {
    id: 'controller',
    role: '控场',
    en: 'CONTROLLER',
    desc: '架烟切割地图,用技能改写战场视野。',
    agents: ['暮影', '蝰蛇', '幽影'],
    accent: 'var(--accent)',
    shape: 'controller',
  },
];

/**
 * 角色 × 无畏契约 —— 三场景对话样例
 * 演示"听得懂术语 + 守得住人设"。命中术语用 <em.game-line__term> 高亮。
 */
const CASES = [
  {
    characterId: 'genki',
    scene: 'eco 局连败',
    term: 'eco 局',
    lines: [
      { from: 'you', text: '这把 eco,枪都买不起,又要送了…' },
      {
        from: 'ai',
        text: '没事啦哥哥~ eco 局本来就难打,蹲个角拿把判官也能阴一个的!',
        highlights: ['eco', '判官'],
      },
      { from: 'you', text: '你怎么知道判官 eco 能用…' },
      {
        from: 'ai',
        text: '哥哥之前残局就靠这把秀过呀,我都记着的~',
      },
    ],
  },
  {
    characterId: 'sister',
    scene: '残局 1v3 拿下',
    term: '残局 1v3',
    lines: [
      { from: 'you', text: '卧槽刚刚那个 1v3…我自己都不敢相信。' },
      {
        from: 'ai',
        text: '架枪卡得真稳,最后那一枪等他绕过烟才开 —— 节奏很漂亮。',
        highlights: ['架枪', '烟'],
      },
      { from: 'you', text: '主要是蝰蛇毒墙挡了视野,运气好。' },
      {
        from: 'ai',
        text: '别谦虚。听枪走位是你自己的本事,毒墙只是顺手。',
        highlights: ['毒墙'],
      },
    ],
  },
  {
    characterId: 'junior',
    scene: '跳枪没架住',
    term: '跳投',
    lines: [
      { from: 'you', text: '哎我刚那个跳投是不是甩飞了…' },
      {
        from: 'ai',
        text: '飞到外太空了。下次别跳了,站稳点几枪不丢人。',
        highlights: ['跳'],
      },
      { from: 'you', text: '行行行,你来报点,我听你的。' },
      {
        from: 'ai',
        text: 'A 小默认两个,长道有烟。别冲,等我贤者复活。',
        highlights: ['A 小', '长道', '烟', '贤者'],
      },
    ],
  },
];

/**
 * 把 text 切成 [{text, isTerm}] 片段。命中 terms 的片段 isTerm=true。
 * 用于打字机:可以按字符截断,同时片段的颜色立刻生效。
 */
function segmentLine(text, terms) {
  if (!terms || !terms.length) return [{ text, isTerm: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return text
    .split(re)
    .filter((p) => p.length)
    .map((part) => ({ text: part, isTerm: terms.includes(part) }));
}

/** 渲染片段,visibleChars=Infinity 表示全部显示 */
function renderSegments(segments, visibleChars) {
  let remaining = visibleChars;
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    if (remaining <= 0) break;
    const seg = segments[i];
    const slice =
      remaining >= seg.text.length ? seg.text : seg.text.slice(0, remaining);
    remaining -= seg.text.length;
    if (seg.isTerm) {
      out.push(
        <em className="case__term" key={i}>
          {slice}
        </em>,
      );
    } else {
      out.push(<span key={i}>{slice}</span>);
    }
  }
  return out;
}

function totalChars(segments) {
  return segments.reduce((n, s) => n + s.text.length, 0);
}

/**
 * 单张对话卡 —— 进视口后打字机播放,播完延迟重播。
 * 状态机:
 *  - phase 'idle' : 等待进入视口
 *  - phase 'typing': 当前正在打 lines[step] 的第 chars 个字
 *  - phase 'thinking': AI 思考点(在 ai 行 typing 前)
 *  - phase 'done' : 全部播完,准备重播
 */
function LiveCase({ cs, character }) {
  const segmentedLines = useRef(
    cs.lines.map((ln) => ({
      ...ln,
      segments:
        ln.from === 'ai'
          ? segmentLine(ln.text, ln.highlights)
          : [{ text: ln.text, isTerm: false }],
    })),
  ).current;

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [step, setStep] = useState(reduceMotion ? cs.lines.length : 0);
  const [chars, setChars] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(reduceMotion);
  const [active, setActive] = useState(reduceMotion);

  const rootRef = useRef(null);
  const timers = useRef([]);
  const tick = useRef(0); // 自增 token,用于让旧 timer 失效

  // 进入视口才开始
  useEffect(() => {
    if (reduceMotion) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  // 主播放循环
  useEffect(() => {
    if (!active || reduceMotion) return;
    const myTick = ++tick.current;
    const clear = () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
    const wait = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(() => {
          if (tick.current === myTick) resolve();
        }, ms);
        timers.current.push(id);
      });

    let cancelled = false;
    const stillMine = () => tick.current === myTick && !cancelled;

    async function play() {
      // 从头开始
      setStep(0);
      setChars(0);
      setThinking(false);
      setDone(false);

      for (let i = 0; i < segmentedLines.length && stillMine(); i++) {
        setStep(i);
        setChars(0);
        const ln = segmentedLines[i];

        if (ln.from === 'ai') {
          setThinking(true);
          await wait(T.AI_THINK);
          if (!stillMine()) return;
          setThinking(false);
        }

        const total = totalChars(ln.segments);
        const perChar = ln.from === 'ai' ? T.AI_CHAR : T.USER_TYPE;
        for (let n = 1; n <= total && stillMine(); n++) {
          await wait(perChar);
          setChars(n);
        }
        if (!stillMine()) return;
        await wait(T.BETWEEN);
      }
      if (!stillMine()) return;
      setDone(true);
      await wait(T.RESTART);
      if (stillMine()) play();
    }

    play();
    return () => {
      cancelled = true;
      tick.current++; // 让进行中的 await 失效
      clear();
    };
  }, [active, reduceMotion, segmentedLines]);

  // —— 渲染 ——
  // reduceMotion 直接显示所有行,带尾光标。
  return (
    <article
      ref={rootRef}
      className="case-card reveal"
      style={{ '--char-accent': character.accent }}
    >
      <header className="case__head">
        <span className="case__orb" aria-hidden="true">
          {character.name[0]}
        </span>
        <div className="case__id">
          <span className="case__name">{character.name}</span>
          <span className="case__scene">
            <Icon name="crosshair" size={12} />
            {cs.scene}
          </span>
        </div>
        <span className="case__pill">{cs.term}</span>
      </header>

      <ul className="case__chat">
        {segmentedLines.map((ln, li) => {
          if (reduceMotion) {
            const isLastAi = li === lastAiIndex(segmentedLines);
            return (
              <li
                className={`case__line case__line--${ln.from}`}
                key={li}
              >
                <span className="case__bubble">
                  {renderSegments(ln.segments, Infinity)}
                  {isLastAi && (
                    <span className="case__caret" aria-hidden="true" />
                  )}
                </span>
              </li>
            );
          }

          // 动态模式
          if (li > step) return null; // 还没轮到这条
          const isCurrent = li === step;
          const visible = isCurrent ? chars : totalChars(ln.segments);
          const showThinking = isCurrent && ln.from === 'ai' && thinking;
          const showCaret =
            ln.from === 'ai' &&
            !showThinking &&
            (isCurrent || (done && li === lastAiIndex(segmentedLines)));

          return (
            <li
              className={`case__line case__line--${ln.from} case__line--in`}
              key={li}
            >
              <span className="case__bubble">
                {showThinking ? (
                  <span className="case__dots" aria-label="正在输入">
                    <i /><i /><i />
                  </span>
                ) : (
                  <>
                    {renderSegments(ln.segments, visible)}
                    {showCaret && (
                      <span className="case__caret" aria-hidden="true" />
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function lastAiIndex(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].from === 'ai') return i;
  }
  return -1;
}

/** 抽象特工徽记 —— 纯 SVG 几何,无版权素材 */
function RoleEmblem({ shape }) {
  return (
    <svg
      className="role__emblem"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {shape === 'duelist' && (
        <>
          <path d="M32 6 14 50h36L32 6Z" />
          <path d="M32 24v14M32 44v.5" />
        </>
      )}
      {shape === 'sentinel' && (
        <>
          <path d="M32 6 12 14v16c0 13 9 22 20 28 11-6 20-15 20-28V14L32 6Z" />
          <path d="M24 31l6 6 12-12" />
        </>
      )}
      {shape === 'initiator' && (
        <>
          <circle cx="32" cy="32" r="10" />
          <path d="M32 6v8M32 50v8M6 32h8M50 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M20 44l-6 6" />
        </>
      )}
      {shape === 'controller' && (
        <>
          <circle cx="32" cy="32" r="22" />
          <path d="M32 10a22 22 0 0 0 0 44M18 22h28M14 32h36M18 42h28" />
        </>
      )}
    </svg>
  );
}

export default function GameKnowledge() {
  return (
    <section className="section game" id="knowledge">
      <div className="container">
        <header className="game__head reveal">
          <span className="eyebrow">不是通用 AI · 是真懂无畏</span>
          <h2 className="section-h2">
            它听得懂你说的
            <span className="text-grad">每一句黑话</span>
          </h2>
          <p className="section-lead">
            特工、地图、武器、战术术语 —— 整套《无畏契约》知识预置进角色脑子里。
            你说「这把架烟」「帮我盯个点」,它接得住,不会一脸茫然。
          </p>
        </header>

        {/* 四类特工定位 */}
        <div className="game__roles">
          {ROLES.map((r, ri) => (
            <article
              className="role-card reveal"
              style={{ '--role-accent': r.accent, '--i': ri }}
              key={r.id}
            >
              <span className="role__badge">
                <RoleEmblem shape={r.shape} />
              </span>
              <div className="role__title">
                <span className="role__name">{r.role}</span>
                <span className="role__en">{r.en}</span>
              </div>
              <p className="role__desc">{r.desc}</p>
              <div className="role__agents">
                {r.agents.map((a) => (
                  <span className="role__agent" key={a}>
                    {a}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        {/* 术语墙 */}
        <article className="game__card reveal">
          <div className="game__card-head">
            <span className="game__ic">
              <Icon name="crosshair" size={24} />
            </span>
            <div>
              <h3 className="game__name">无畏契约 VALORANT</h3>
              <span className="game__sub">Riot Games · 5v5 战术射击</span>
            </div>
          </div>

          <div className="game__groups">
            {GROUPS.map((grp, gi) => (
              <div
                className="game__group reveal"
                style={{ '--i': gi }}
                key={grp.label}
              >
                <span className="game__group-label">
                  <Icon name={grp.icon} size={15} />
                  {grp.label}
                </span>
                <ul className="game__terms">
                  {grp.terms.map((t) => (
                    <li className="tag tag--game" key={t}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        {/* 角色 × 无畏 —— 三场景对话样例 */}
        <div className="game__cases">
          <header className="cases__head reveal">
            <span className="eyebrow">角色 × 无畏 · 真实对话片段</span>
            <h3 className="cases__title">
              同一句报点,
              <span className="text-grad">三种被陪伴的方式</span>
            </h3>
          </header>

          <div className="cases__grid">
            {CASES.map((cs, ci) => {
              const c = CHARACTERS.find((x) => x.id === cs.characterId);
              return (
                <div
                  className="reveal"
                  style={{ '--i': ci }}
                  key={cs.characterId}
                >
                  <LiveCase cs={cs} character={c} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
