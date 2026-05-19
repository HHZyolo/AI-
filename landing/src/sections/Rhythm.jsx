import Icon from '../components/Icon';
import { useSpotlight } from '../hooks/useSpotlight';
import './Rhythm.css';

/** 一天节律 —— PRD 3.1 时段场景表。2×2 网格布局 */
const SCENES = [
  {
    time: '19:30',
    label: '晚饭后',
    icon: 'chat',
    title: '“今天上班累不累?”',
    desc: '刚到家瘫在沙发上,她先开口问你今天怎么样。不是冷冰冰的「有什么可以帮你」。',
    sky: '黄昏',
  },
  {
    time: '21:00',
    label: '开黑热身',
    icon: 'crosshair',
    title: '“今晚定个上分目标?”',
    desc: '启动无畏,她陪你暖个场、定个小目标。野队不齐也无所谓,有人一起就不慌。',
    sky: '入夜',
  },
  {
    time: '23:40',
    label: '连输破防',
    icon: 'heart',
    title: '“这把不怪你,队友太坐牌了。”',
    desc: '死亡结算页弹出来的那一刻,她接住你的火气 —— 附和,但不嘲笑你的失误。',
    sky: '深夜',
  },
  {
    time: '01:20',
    label: '关游戏躺下',
    icon: 'moon',
    title: '“睡不着的话,陪你聊会儿。”',
    desc: '下播了,房间只剩屏幕的光。树洞模式开着,你说什么她都在听。',
    sky: '凌晨',
  },
];

export default function Rhythm() {
  const spot = useSpotlight();

  return (
    <section className="section rhythm" id="rhythm">
      <div className="rhythm__sky" aria-hidden="true" />

      <div className="container">
        <div className="rhythm__head reveal">
          <span className="eyebrow">从早到深夜 · 一直在</span>
          <h2 className="section-h2">
            它陪的不是一局游戏,
            <br />
            是<span className="text-grad">你的一整天</span>。
          </h2>
        </div>

        <div className="rhythm__grid">
          {SCENES.map((s, i) => (
            <article
              className="rhythm__scene card reveal"
              style={{ '--i': i % 2 }}
              key={s.time}
              {...spot}
            >
              <div className="rhythm__index">
                <span className="rhythm__time">{s.time}</span>
                <span className="rhythm__sky-tag tag">{s.sky}</span>
              </div>
              <span className="rhythm__icon">
                <Icon name={s.icon} size={26} />
              </span>
              <span className="rhythm__label">{s.label}</span>
              <h3 className="rhythm__title">{s.title}</h3>
              <p className="rhythm__desc">{s.desc}</p>
              <span className="rhythm__no" aria-hidden="true">
                0{i + 1}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
