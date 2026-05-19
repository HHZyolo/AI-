/**
 * 内联 SVG 图标 —— DESIGN.md §8 禁止 Emoji 当图标。
 * 统一 currentColor 描边,1.6 线宽。
 */
const PATHS = {
  mic: <><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10a7 7 0 0 1-14 0" /><path d="M12 17v5M8 22h8" /></>,
  wave: <><path d="M3 12h2M8 6v12M12 3v18M16 6v12M20 9v6M22 12h-1" /></>,
  shield: <><path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3Z" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></>,
  heart: <><path d="M12 21s-7.5-4.6-10-9.4C.7 8.3 2.3 4.5 6 4.5c2.3 0 3.8 1.5 6 4 2.2-2.5 3.7-4 6-4 3.7 0 5.3 3.8 4 7.1C19.5 16.4 12 21 12 21Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  spark: <><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" /></>,
  bolt: <><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></>,
  crosshair: <><circle cx="12" cy="12" r="9" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  ear: <><path d="M6 8a6 6 0 0 1 12 0c0 4-3 5-3 8a3 3 0 0 1-6 0M9 9a3 3 0 0 1 6 0" /></>,
  chat: <><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" /></>,
};

export default function Icon({ name, size = 22, className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
