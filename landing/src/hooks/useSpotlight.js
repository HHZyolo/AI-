import { useCallback } from 'react';

/**
 * SpotlightCard —— hover 时品红光斑跟随指针。
 * 对应 DESIGN.md §4 .card::before + §7 Hover & Focus。
 * pointermove 用 rAF 节流(性能红线)。仅 hover 设备启用。
 * 用法:<div className="card" {...useSpotlight()} />
 */
export function useSpotlight() {
  const hover =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover)').matches;

  const onPointerMove = useCallback(
    (e) => {
      if (!hover) return;
      const card = e.currentTarget;
      if (card._rafPending) return;
      card._rafPending = true;
      requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
        card._rafPending = false;
      });
    },
    [hover]
  );

  return hover ? { onPointerMove } : {};
}
