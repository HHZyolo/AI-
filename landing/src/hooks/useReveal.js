import { useEffect } from 'react';

/**
 * 全站滚动 reveal —— 给所有 .reveal 元素挂 IntersectionObserver。
 * 对应 DESIGN.md §7 Scroll Behavior。挂在 App 根组件一次即可。
 */
export function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
