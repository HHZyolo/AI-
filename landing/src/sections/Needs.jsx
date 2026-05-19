import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon from '../components/Icon';
import { useSpotlight } from '../hooks/useSpotlight';
import './Needs.css';

gsap.registerPlugin(ScrollTrigger);

/** 三层用户需求 —— PRD 2.3。Bento 不等大网格(爆点 3)+ 汇聚转场(scroll-story #2) */
export default function Needs() {
  const sectionRef = useRef(null);
  const spot = useSpotlight();

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      // 汇聚转场:碎片从散落飞向各自归位
      gsap.from('.needs__shard', {
        x: () => gsap.utils.random(-160, 160),
        y: () => gsap.utils.random(-90, 90),
        rotate: () => gsap.utils.random(-14, 14),
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.needs__bento',
          start: 'top 78%',
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="section needs" id="needs" ref={sectionRef}>
      <div className="container">
        <header className="needs__head reveal">
          <span className="eyebrow">用户为什么会留下来</span>
          <h2 className="section-h2">
            他买的不是陪玩,
            <br />
            是<span className="text-grad">被在乎的感觉</span>。
          </h2>
          <p className="section-lead">
            按真实需求拆成三层 —— 功能性让他进来,情绪性让他付费,
            亲密性让他留下来、一次次回来。
          </p>
        </header>

        <div className="needs__bento">
          {/* 大块 —— 亲密性需求 */}
          <article className="needs__shard card bento-lg" {...spot}>
            <span className="needs__layer tag tag--accent">第三层 · 亲密性</span>
            <span className="needs__icon needs__icon--lg">
              <Icon name="heart" size={30} />
            </span>
            <h3 className="needs__title">“想要有人,对我特别。”</h3>
            <p className="needs__desc">
              想聊骚、想要点「假恋爱」的暧昧,又不想去真人陪玩担心隐私。
              半夜脆弱时有人听 —— 它记得你的名字、段位、上次聊到一半的事。
              这是他长期复购的根本原因。
            </p>
            <ul className="needs__chips">
              <li className="tag">记得你的段位</li>
              <li className="tag">半夜树洞</li>
              <li className="tag">暧昧分寸感</li>
            </ul>
          </article>

          {/* 中块 —— 情绪性需求 */}
          <article className="needs__shard card bento-md" {...spot}>
            <span className="needs__layer tag tag--accent">第二层 · 情绪性</span>
            <span className="needs__icon">
              <Icon name="spark" size={24} />
            </span>
            <h3 className="needs__title">“想被夸、被哄、被理解。”</h3>
            <p className="needs__desc">
              赢了有人捧,输了有人哄,失误不被评价,
              想骂队友时有人附和 —— 这是他真正掏钱的核心动机。
            </p>
          </article>

          {/* 小块 1 —— 功能性需求 */}
          <article className="needs__shard card bento-sm" {...spot}>
            <span className="needs__layer tag">第一层 · 功能性</span>
            <h3 className="needs__title needs__title--sm">“不想一个人匹野队。”</h3>
            <p className="needs__desc">
              有人陪打、报点、聊战术,24h 随时可用,不用约档期。
            </p>
          </article>

          {/* 小块 2 —— 对比真人陪玩 */}
          <article className="needs__shard card bento-sm needs__compare" {...spot}>
            <span className="needs__icon needs__icon--hud">
              <Icon name="shield" size={22} />
            </span>
            <h3 className="needs__title needs__title--sm">比真人陪玩省心</h3>
            <p className="needs__desc">
              不挑档期、不闹情绪、不泄露隐私,一晚的钱够聊很多天。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
