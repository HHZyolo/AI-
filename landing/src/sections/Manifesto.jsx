import './Manifesto.css';

/** 爆点 2 —— 全屏宣言横滚带。纯 CSS translateX,品红描边空心大字 */
const PHRASES = ['输了有人哄', '赢了有人捧', '半夜有人听', '骂队友有人附和'];

export default function Manifesto() {
  // 复制两遍以实现无缝循环
  const row = [...PHRASES, ...PHRASES];

  return (
    <section className="manifesto" id="manifesto" aria-label="产品宣言">
      <div className="manifesto__marquee manifesto__marquee--a">
        {row.map((p, i) => (
          <span className="manifesto__word" key={`a${i}`}>
            {p}
            <span className="manifesto__sep" aria-hidden="true">·</span>
          </span>
        ))}
      </div>
      <div className="manifesto__marquee manifesto__marquee--b" aria-hidden="true">
        {row.map((p, i) => (
          <span className="manifesto__word manifesto__word--ghost" key={`b${i}`}>
            {p}
            <span className="manifesto__sep">·</span>
          </span>
        ))}
      </div>

      <p className="manifesto__caption reveal">
        真人陪玩有档期、要看心情、还贵。<br />
        它不会 —— 它只想陪你。
      </p>
    </section>
  );
}
