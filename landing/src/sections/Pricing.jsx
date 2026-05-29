import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { useSpotlight } from '../hooks/useSpotlight';
import './Pricing.css';

/** 时长包定价 —— 来自《PRD 选型修订与成本测算》第三节 */
const PLANS = [
  {
    id: 'trial',
    name: '体验包',
    minutes: '60',
    price: '19.9',
    unit: '元',
    per: '约 0.33 元 / 分钟',
    desc: '先处个朋友,试试合不合得来。',
    perks: ['任选 AI 角色', '完整语音对话', '聊不来随时停'],
    featured: false,
  },
  {
    id: 'standard',
    name: '标准包',
    minutes: '300',
    price: '69',
    unit: '元',
    per: '约 0.23 元 / 分钟',
    desc: '每晚陪你开几局,刚刚好。',
    perks: ['任选 AI 角色', '基础记忆 · 记得住你', '更划算的单价'],
    featured: true,
  },
  {
    id: 'pro',
    name: '畅玩包',
    minutes: '1000',
    price: '199',
    unit: '元',
    per: '约 0.20 元 / 分钟',
    desc: '把它当成长期搭子的人选这个。',
    perks: ['任选 AI 角色', '基础记忆 · 记得住你', '最低单价 · 想聊就聊'],
    featured: false,
  },
];

export default function Pricing() {
  const spot = useSpotlight();

  return (
    <section className="section pricing" id="pricing">
      <div className="container">
        <header className="pricing__head reveal">
          <span className="eyebrow">按时长付费 · 不抽卡不订阅</span>
          <h2 className="section-h2">
            一晚真人陪玩的钱,
            <br />
            <span className="text-grad">够聊很多天</span>
          </h2>
          <p className="section-lead">
            真人陪玩一晚 100–300 元。这里按时长包买,聊多少算多少,
            不玩抽卡、不搞自动续费。先用免费的 3 分钟试试。
          </p>
        </header>

        <div className="pricing__grid">
          {PLANS.map((p, i) => (
            <article
              className={`card pricing__card ${p.featured ? 'is-featured card--pricing' : ''} reveal`}
              style={{ '--i': i }}
              key={p.id}
              {...spot}
            >
              <h3 className="pricing__name">{p.name}</h3>
              <p className="pricing__minutes">
                <span className="pricing__min-num">{p.minutes}</span>
                <span className="pricing__min-unit">分钟</span>
              </p>
              <p className="pricing__price">
                <span className="pricing__cur">¥</span>
                <span className="pricing__amount">{p.price}</span>
              </p>
              <span className="pricing__per">{p.per}</span>
              <p className="pricing__desc">{p.desc}</p>
              <ul className="pricing__perks">
                {p.perks.map((perk) => (
                  <li key={perk}>
                    <Icon name="check" size={15} />
                    {perk}
                  </li>
                ))}
              </ul>
              <Link
                className={p.featured ? 'btn-primary' : 'btn-secondary'}
                to="/app"
              >
                选这个包
              </Link>
            </article>
          ))}
        </div>

        <p className="pricing__foot reveal">
          <Icon name="clock" size={15} />
          新用户首次免费试用 <b>3 分钟</b> 语音 —— 不满意,不用付一分钱。
        </p>
      </div>
    </section>
  );
}
