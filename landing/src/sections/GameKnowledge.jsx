import Icon from '../components/Icon';
import './GameKnowledge.css';

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
      </div>
    </section>
  );
}
