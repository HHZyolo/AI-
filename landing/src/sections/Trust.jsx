import Icon from '../components/Icon';
import './Trust.css';

/** 合规与安心 —— PRD 10.2 / 10.3 */
const ITEMS = [
  {
    icon: 'shield',
    title: '实名认证 · 仅限成年人',
    desc: '强制实名 + 年龄校验,未成年人不可注册。我们主打「游戏搭子」,不是虚拟伴侣。',
  },
  {
    icon: 'moon',
    title: '内容有底线',
    desc: 'AI 对话设敏感词过滤,不输出露骨色情、自伤、违法内容。暧昧靠氛围,有分寸。',
  },
  {
    icon: 'ear',
    title: '聊天只属于你',
    desc: '对话全程加密传输,不存敏感个人信息,历史记录你能随时删,绝不分享给第三方。',
  },
  {
    icon: 'crosshair',
    title: '不碰反作弊红线',
    desc: '不读游戏内存、不注入、不抓包。AI 完全靠语音对话理解战况,像真人陪玩一样工作。',
  },
];

export default function Trust() {
  return (
    <section className="section trust" id="trust">
      <div className="container">
        <header className="trust__head reveal">
          <span className="eyebrow">玩得开心 · 也要玩得安心</span>
          <h2 className="section-h2">
            想陪你,
            <span className="text-grad">但不越界</span>
          </h2>
          <p className="section-lead">
            《人工智能拟人化互动服务管理暂行办法》2026 年 7 月施行 ——
            我们从第一天就按规矩来。
          </p>
        </header>

        <div className="trust__grid">
          {ITEMS.map((it, i) => (
            <article
              className="trust__card reveal"
              style={{ '--i': i }}
              key={it.title}
            >
              <span className="trust__ic">
                <Icon name={it.icon} size={22} />
              </span>
              <h3 className="trust__title">{it.title}</h3>
              <p className="trust__desc">{it.desc}</p>
            </article>
          ))}
        </div>

        <p className="trust__notice reveal">
          <Icon name="shield" size={16} />
          <span>
            <b>未成年人提示:</b>
            本服务仅面向 18 岁及以上成年用户,未满 14 周岁须经监护人同意,
            平台已设未成年人模式。请理性使用,注意休息。
          </span>
        </p>
      </div>
    </section>
  );
}
