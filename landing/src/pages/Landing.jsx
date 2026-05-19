import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReveal } from '../hooks/useReveal';
import Nav from '../components/Nav';
import Hero from '../sections/Hero';
import Manifesto from '../sections/Manifesto';
import Rhythm from '../sections/Rhythm';
import Needs from '../sections/Needs';
import Characters from '../sections/Characters';
import GameKnowledge from '../sections/GameKnowledge';
import Pricing from '../sections/Pricing';
import Trust from '../sections/Trust';
import CtaFooter from '../sections/CtaFooter';

gsap.registerPlugin(ScrollTrigger);

/** 营销落地页 —— 路由 / */
export default function Landing() {
  useReveal();

  // 字体加载后布局会变,刷新 ScrollTrigger 让 pin 测量准确
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refresh);
    }
    window.addEventListener('load', refresh);
    return () => window.removeEventListener('load', refresh);
  }, []);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Rhythm />
        <Needs />
        <Characters />
        <GameKnowledge />
        <Pricing />
        <Trust />
        <CtaFooter />
      </main>
    </>
  );
}
