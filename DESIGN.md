# DESIGN.md

> 「AI 陪玩搭子」视觉设计规范 —— 深夜里的一盏暖灯：黑得让人放下戒备，暖得让人想说话。

适用产品：面向 PC 战术 FPS 男玩家的 AI 语音陪玩产品（MVP）
覆盖范围：① 对外营销落地页（首页）② H5 产品页（主页 + 角色选择 + 语音通话页）
设计语言：单语言中文（按 PRD「中文用户」边界，不引入 i18n）
编写日期：2026/5/19

---

## 1. Visual Theme & Atmosphere

**Style**: 暗黑暧昧情感（Dark Intimate / After-Hours Companion）

**Keywords**: 深夜、暖光、亲密、低语、克制的撩、电竞底色、被理解、私密感

**Tone**: 暧昧而不轻浮、暖而不腻、安静里带一点心跳 —— NOT 冷硬科技风、NOT 高饱和赛博、NOT 软萌少女风、NOT 油腻擦边

**Feel**: 像凌晨一点戴上耳机，房间只剩屏幕的光。背景是深到几乎纯黑的夜，品红色的光晕从屏幕边缘渗进来，像有人在你身边轻声说话 —— 不吵，但你知道她一直在。

> 设计哲学：这是一个「情绪产品」，不是工具。视觉的任务是降低用户开口说话的心理门槛。所以全站偏暗——暗给人安全感和私密感；强调色用暖品红/紫而非电竞蓝青——蓝青是「队友/HUD」，品红紫是「陪伴/心动」。FPS 电竞元素只作为底色和细节（准星、HUD 刻度、段位徽章），不喧宾夺主：用户买的是「陪伴」，FPS 只是他们相遇的场景。

**Interaction Tier**: L3 沉浸体验
**Dependencies**: GSAP 3 + ScrollTrigger（落地页滚动叙事）+ OGL（Hero 声纹/光晕 WebGL，单页 1 处）。H5 产品页不加载 GSAP，仅用 CSS + IntersectionObserver + Web Audio 可视化，保证通话页性能。

---

## 2. Color Palette & Roles

```css
:root {
  /* ---------- Backgrounds ---------- */
  --bg: #0A0710;                              /* 页面背景 —— 近黑带一点紫调，不死黑 */
  --bg-deep: #060409;                         /* 最深处 / Hero 顶部 / 通话页 */
  --surface: #15101C;                         /* 卡片 / 容器 */
  --surface-alt: #1C1526;                     /* 交替 section / 抬起的面板 */
  --surface-hover: #241B30;                   /* 卡片悬停态 */
  --surface-glass: rgba(28, 21, 38, 0.72);    /* 玻璃态导航 / 浮层（backdrop-blur ≤ 14px）*/

  /* ---------- Borders ---------- */
  --border: rgba(255, 255, 255, 0.07);        /* 默认边框 —— 极轻 */
  --border-strong: rgba(255, 255, 255, 0.14); /* 强边框 / 分隔线 */
  --border-hover: rgba(255, 122, 184, 0.45);  /* 悬停 —— 品红描边 */
  --border-glow: rgba(255, 122, 184, 0.18);   /* 卡片内发光边 */

  /* ---------- Text ---------- */
  --text: #F4EEF6;                            /* 主文字 —— 暖白，不刺眼 */
  --text-secondary: #B7AEC2;                  /* 正文 / 描述 —— 带紫灰调 */
  --text-tertiary: #756B82;                   /* 标签 / 辅助 / 占位 */
  --text-on-accent: #1A0512;                  /* 品红按钮上的文字 —— 深色保证对比 */

  /* ---------- Accent (品红 —— 心动 / CTA / 陪伴) ---------- */
  --accent: #FF5C9E;                          /* 主强调色 —— 暖品红 */
  --accent-hover: #FF7AB8;                    /* 悬停 —— 提亮 */
  --accent-soft: rgba(255, 92, 158, 0.12);    /* 强调色淡背景 / 选中态 */
  --accent-glow: rgba(255, 92, 158, 0.38);    /* 光晕 / text-shadow */

  /* ---------- Accent 2 (暖紫 —— 暧昧 / 渐变副色 / 夜) ---------- */
  --violet: #9D6BFF;                          /* 副强调 —— 用于渐变、夜间氛围 */
  --violet-soft: rgba(157, 107, 255, 0.12);
  --violet-glow: rgba(157, 107, 255, 0.30);

  /* ---------- Game Accent (青 —— 仅 FPS/HUD 细节，严禁做主色) ---------- */
  --hud: #3DD6C4;                             /* 段位徽章 / 在线点 / HUD 刻度 */

  /* ---------- RGB variants for rgba() ---------- */
  --bg-rgb: 10, 7, 16;
  --accent-rgb: 255, 92, 158;
  --violet-rgb: 157, 107, 255;
  --text-rgb: 244, 238, 246;

  /* ---------- Semantic ---------- */
  --success: #4ED9A4;                         /* 试用额度充足 / 支付成功 */
  --error: #FF6B6B;                           /* 额度耗尽 / 麦克风未授权 */
  --warning: #FFC56B;                         /* 额度告急 / 兼容性提示 */
  --online: #4ED9A4;                          /* 「24h 在线」状态点 */

  /* ---------- Signature Gradients ---------- */
  --grad-accent: linear-gradient(135deg, #FF5C9E 0%, #9D6BFF 100%);   /* 心动渐变 —— 主 CTA / Hero 关键词 */
  --grad-night: linear-gradient(180deg, #060409 0%, #15101C 100%);    /* 夜幕渐变 —— section 背景 */
  --grad-glow: radial-gradient(circle at 50% 0%, rgba(255,92,158,0.16) 0%, transparent 60%); /* 顶部光晕 */
}
```

**Color Rules:**
- 所有颜色必须通过 CSS 变量引用，**零硬编码 hex**（含 rgba —— 用 `rgba(var(--accent-rgb), .x)`）。
- 全站基调为暗：背景层级只在 `--bg-deep → --bg → --surface → --surface-alt` 四级间走，不出现浅色大色块。
- **品红 `--accent` 是唯一 CTA 色**；暖紫 `--violet` 只做渐变副色与氛围光，不单独做按钮。
- **青色 `--hud` 严禁做主色或 CTA**，仅限：在线状态点、段位徽章、准星/HUD 刻度线、游戏术语标签——单屏出现面积 < 5%。
- 同一 section 内最多一个强调色聚焦点；渐变 `--grad-accent` 每屏最多用在一处（标题关键词或主按钮，二选一）。
- 暧昧感来自「暖光晕」而非「高饱和」：氛围用 `--accent-glow` / `--violet-glow` 的低透明度径向渐变，不用实心亮色。

---

## 3. Typography Rules

**Font Stack:**
```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@600;900&family=Sora:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
```

```css
:root {
  --font-display: 'Noto Serif SC', 'Sora', 'Songti SC', serif;          /* 大标题 —— 衬线带情绪/书卷气 */
  --font-sans: 'Noto Sans SC', 'Sora', -apple-system, 'PingFang SC', sans-serif; /* 正文 / UI */
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;                   /* 段位/数字/术语标签 */
}
```

| Role | Font | Size (Desktop / Mobile) | Weight | Line Height | Letter Spacing |
|------|------|-------------------------|--------|-------------|----------------|
| Hero H1 | `--font-display` | 80px / 40px | 900 | 1.15 | -0.01em |
| Section H2 | `--font-display` | 48px / 28px | 900 | 1.25 | 0 |
| H3 / 卡片标题 | `--font-sans` | 22px / 19px | 700 | 1.4 | 0 |
| Body | `--font-sans` | 17px / 16px | 400 | 1.75 | 0.02em |
| Body Large（Hero 副标题）| `--font-sans` | 20px / 17px | 400 | 1.7 | 0.02em |
| Label / Eyebrow | `--font-sans` | 13px / 12px | 700 | 1.4 | 0.18em（大写/全角） |
| Mono（段位/数字/术语）| `--font-mono` | 14px / 13px | 500 | 1.5 | 0.04em |
| Button | `--font-sans` | 16px / 15px | 700 | 1 | 0.04em |

**Typography Rules:**
- 中文为主：所有标题/正文中文字族在前，`Sora` 仅作英文混排 fallback。
- 正文行高 ≥ 1.75，字距 0.02em；正文字号 ≥ 16px（长段落落地页用 17px），符合中文阅读规范。
- 标题用 **Noto Serif SC 900**——衬线在暗背景下更有「情绪/亲密」气质，区别于工具类产品的无衬线。
- 数字、段位（如「黄金 III」「平均延迟 1.2s」）、游戏术语标签统一用 `--font-mono`，强化「懂游戏」的专业可信感。
- Eyebrow / Label 用全大写或全角 + 0.18em 字距，作为 section 的「呼吸节拍」。
- **NEVER use**: 任何只配英文字体让系统回退中文（必须显式中文字族）；楷体做正文（仅可做单处装饰引言）；字重 < 400 的细体（暗背景下发虚）；Emoji 当图标（本产品调性偏成人/暧昧，emoji 显廉价）。

**Text Decoration**（按 text-decoration-rules.md，本风格归类为「暗黑科技」邻近——暗背景 + 大字号）：
- **Hero H1**：关键词（如「陪你」「记得住你」）应用 `--grad-accent` 渐变文字 + subtle glow（`text-shadow: 0 0 48px var(--accent-glow)`）。非关键词部分保持 `--text` 纯色。
- **Section H2**：默认纯色 `--text`；仅当该 section 是情绪高点（如「亲密性需求」区）可对单个关键词加 `--grad-accent`。不叠加投影。
- **正文 p / 卡片描述**：禁止任何渐变与投影。
- **Label / Eyebrow**：`color: var(--accent)`，可选 `border-bottom: 1.5px solid var(--accent)` 装饰下划线。

---

## 4. Component Stylings

### Buttons

```css
/* ===== Primary —— 心动渐变按钮（「开始陪玩」「免费试用 10 分钟」）===== */
.btn-primary {
  font: 700 16px/1 var(--font-sans);
  letter-spacing: 0.04em;
  color: var(--text-on-accent);
  background: var(--grad-accent);
  border: none;
  border-radius: 14px;
  padding: 16px 36px;
  min-height: 52px;
  cursor: pointer;
  position: relative;
  box-shadow: 0 8px 32px rgba(var(--accent-rgb), 0.32);
  transition: transform .22s cubic-bezier(.22,.61,.36,1),
              box-shadow .22s ease, filter .22s ease;
}
.btn-primary:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
  box-shadow: 0 12px 44px rgba(var(--accent-rgb), 0.48);
}
.btn-primary:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 4px 18px rgba(var(--accent-rgb), 0.30);
}
.btn-primary:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 3px;
}
.btn-primary:disabled {
  background: var(--surface-alt);
  color: var(--text-tertiary);
  box-shadow: none;
  cursor: not-allowed;
  filter: none;
  transform: none;
}

/* ===== Secondary —— 描边幽灵按钮（「选择角色」「了解更多」）===== */
.btn-secondary {
  font: 700 16px/1 var(--font-sans);
  letter-spacing: 0.04em;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  padding: 15px 32px;
  min-height: 52px;
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease, color .2s ease;
}
.btn-secondary:hover {
  border-color: var(--border-hover);
  background: var(--surface-hover);
  color: var(--accent-hover);
}
.btn-secondary:active { background: var(--surface-alt); transform: scale(0.98); }
.btn-secondary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.btn-secondary:disabled { opacity: .4; cursor: not-allowed; }
```

### Cards

```css
/* ===== 通用卡片（角色卡 / 功能卡 / 时长包卡）===== */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 28px;
  position: relative;
  overflow: hidden;
  transition: transform .3s cubic-bezier(.22,.61,.36,1),
              border-color .3s ease, box-shadow .3s ease;
}
/* SpotlightCard —— hover 时品红光斑跟随指针（rAF 节流，--mx/--my 由 JS 写入）*/
.card::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 0%),
              var(--accent-soft), transparent 70%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.card:hover {
  transform: translateY(-6px);
  border-color: var(--border-hover);
  box-shadow: 0 20px 50px rgba(0,0,0,0.5),
              0 0 0 1px var(--border-glow);
}
.card:hover::before { opacity: 1; }
.card:focus-within { border-color: var(--border-hover); }

/* ===== 角色卡选中态（H5 角色选择页）===== */
.card--character.is-selected {
  border-color: var(--accent);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--surface) 60%);
  box-shadow: 0 0 0 1px var(--accent), 0 16px 40px rgba(var(--accent-rgb), 0.22);
}

/* ===== 时长包推荐卡（标准包高亮）===== */
.card--pricing.is-featured {
  border-color: var(--border-hover);
  background: var(--surface-alt);
}
.card--pricing.is-featured::after {
  content: '最受欢迎';
  position: absolute; top: 16px; right: 16px;
  font: 700 11px/1 var(--font-sans); letter-spacing: 0.12em;
  color: var(--text-on-accent);
  background: var(--grad-accent);
  padding: 6px 12px; border-radius: 999px;
}
```

### Navigation

```css
/* ===== 落地页顶部导航 ===== */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px clamp(20px, 5vw, 64px);
  background: transparent;
  transition: background .3s ease, backdrop-filter .3s ease,
              border-color .3s ease, padding .3s ease;
  border-bottom: 1px solid transparent;
}
/* 滚动后玻璃态收起（backdrop-blur ≤ 14px 性能红线）*/
.nav.is-scrolled {
  background: var(--surface-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom-color: var(--border);
  padding-top: 14px; padding-bottom: 14px;
}
.nav__link {
  font: 500 15px/1 var(--font-sans);
  color: var(--text-secondary);
  text-decoration: none;
  transition: color .2s ease;
}
.nav__link:hover { color: var(--text); }
.nav__link:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
```

### Links

```css
.link {
  color: var(--accent);
  text-decoration: none;
  position: relative;
}
.link::after {
  content: ''; position: absolute; left: 0; bottom: -2px;
  width: 100%; height: 1px; background: currentColor;
  transform: scaleX(0); transform-origin: right;
  transition: transform .28s cubic-bezier(.22,.61,.36,1);
}
.link:hover { color: var(--accent-hover); }
.link:hover::after { transform: scaleX(1); transform-origin: left; }
.link:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }
```

### Tags / Badges

```css
/* ===== 游戏术语标签 / 段位徽章 —— 唯一允许出现青色的地方 ===== */
.tag {
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 13px/1 var(--font-mono); letter-spacing: 0.04em;
  color: var(--text-secondary);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
}
.tag--game {                       /* 「三角洲行动」「无畏契约」「机密」「升天」 */
  color: var(--hud);
  border-color: rgba(61, 214, 196, 0.28);
}
.tag--accent {                     /* 情感类标签：「24h 在线」「记得住你」 */
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(var(--accent-rgb), 0.25);
}

/* ===== 在线状态点 ===== */
.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--online);
  box-shadow: 0 0 0 4px rgba(78, 217, 164, 0.18);
  animation: pulse-dot 2.4s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 4px rgba(78,217,164,0.18); }
  50%      { box-shadow: 0 0 0 7px rgba(78,217,164,0.06); }
}
```

### Input（H5 手机号登录 / 验证码）

```css
.input {
  width: 100%;
  font: 400 16px/1.4 var(--font-sans);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 14px 16px;
  min-height: 50px;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.input::placeholder { color: var(--text-tertiary); }
.input:hover { border-color: var(--border-hover); }
.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input:disabled { opacity: .45; cursor: not-allowed; }
.input.is-error { border-color: var(--error); box-shadow: 0 0 0 3px rgba(255,107,107,0.12); }
```

### Voice Call Button（H5 通话页核心控件 —— 「按住说话 / 通话中」）

```css
.call-orb {
  width: 132px; height: 132px; border-radius: 50%;
  background: var(--grad-accent);
  border: none; cursor: pointer; position: relative;
  display: grid; place-items: center;
  box-shadow: 0 0 60px var(--accent-glow);
  transition: transform .2s ease;
}
/* 通话中 —— 呼吸光环（由 Web Audio 振幅驱动 scale，CSS 兜底）*/
.call-orb.is-live::after {
  content: ''; position: absolute; inset: -14px;
  border-radius: 50%;
  border: 2px solid rgba(var(--accent-rgb), 0.4);
  animation: breathe 1.8s ease-in-out infinite;
}
@keyframes breathe {
  0%,100% { transform: scale(1); opacity: .7; }
  50%     { transform: scale(1.14); opacity: 0; }
}
.call-orb:active { transform: scale(0.95); }
.call-orb:focus-visible { outline: 3px solid var(--accent-hover); outline-offset: 6px; }
```

---

## 5. Layout Principles

**Container:**
- Max width（落地页常规 section）：1200px
- Narrow variant（文字密集段 / 法律合规说明）：720px
- H5 产品页：max-width 480px，居中，模拟移动端壳；移动端实机为 100vw。
- Section 横向 padding：`clamp(20px, 5vw, 64px)`

**Spacing Scale**（8px 基准）:
```css
:root {
  --space-1: 8px;   --space-2: 16px;  --space-3: 24px;
  --space-4: 40px;  --space-5: 64px;  --space-6: 96px;  --space-7: 140px;
}
```
- Section 纵向 padding：Desktop `--space-7`(140px) / Mobile `--space-5`(64px)
- 卡片间 gap：`--space-3`(24px)
- 卡片内 padding：28px（移动端 20px）
- 标题与正文间距：`--space-2`(16px)

**Grid:**
```css
.container { max-width: 1200px; margin-inline: auto; padding-inline: clamp(20px,5vw,64px); }

/* 功能卡 3 列 */
.grid-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
/* 角色卡 3 列（对应 PRD 的元气妹妹/温柔御姐/高冷学妹）*/
.grid-characters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
/* Bento —— 「三层用户需求」区，不等大，制造视觉层次（首页爆点 3）*/
.grid-bento {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: 200px;
  gap: var(--space-2);
}
.grid-bento > .bento-lg { grid-column: span 4; grid-row: span 2; } /* 亲密性需求 —— 最大块 */
.grid-bento > .bento-md { grid-column: span 2; grid-row: span 2; }
.grid-bento > .bento-sm { grid-column: span 3; grid-row: span 1; }
```

---

## 6. Depth & Elevation

暗色界面靠「发光」而非「投影」建立层级——投影在黑底上几乎不可见，所以用边框亮度 + 内发光 + 微弱外发光组合。

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | 无边框无阴影，仅靠 `--surface` 与 `--bg` 色差 | 页面基础块、section 背景 |
| Subtle | `border: 1px solid var(--border)` | 默认卡片、输入框、标签 |
| Raised | `border: 1px var(--border-strong)` + `box-shadow: 0 12px 32px rgba(0,0,0,0.45)` | 玻璃态导航、浮层面板 |
| Elevated | `box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px var(--border-glow)` | 卡片 hover 态 |
| Glow（强调）| `box-shadow: 0 8px 32px rgba(var(--accent-rgb),0.32)` | 主 CTA、通话球、选中角色卡 |
| Modal | `box-shadow: 0 32px 80px rgba(0,0,0,0.7)` + 背景遮罩 `rgba(var(--bg-rgb),0.82)` | 付费墙弹窗、麦克风授权引导 |

```css
:root {
  --shadow-raised:   0 12px 32px rgba(0,0,0,0.45);
  --shadow-elevated: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px var(--border-glow);
  --shadow-glow:     0 8px 32px rgba(var(--accent-rgb), 0.32);
  --shadow-modal:    0 32px 80px rgba(0,0,0,0.7);
}
```

---

## 7. Animation & Interaction

**Motion Philosophy**: 动效服务「亲密叙事」——慢、柔、有呼吸感，像深夜对话的节奏，不要弹跳/急促。落地页用 scroll-story 把「孤独 → 相遇 → 被理解」讲成一条线；H5 产品页动效极简，把性能全留给实时语音。

**Tier**: L3 沉浸体验（仅落地页）。H5 产品页降为 L1（CSS only）。

### Dependencies
```html
<!-- 仅落地页加载 -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
<!-- Hero WebGL 声纹光晕（单页唯一 WebGL，不可见时暂停）-->
<script type="module" src="https://cdn.jsdelivr.net/npm/ogl@1/dist/ogl.mjs"></script>
```
> H5 产品页（主页/角色页/通话页）**不加载** GSAP/OGL —— 通话页用原生 Web Audio + CSS 动画即可。

### Base Setup
```js
gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hover  = matchMedia('(hover: hover)').matches;
```

### Entrance Animation
```css
/* 通用入场 —— fadeInUp，柔和缓动 */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity .8s cubic-bezier(.22,.61,.36,1),
              transform .8s cubic-bezier(.22,.61,.36,1);
}
.reveal.in-view { opacity: 1; transform: translateY(0); }
/* stagger：同组元素用 --i 递增延迟 */
.reveal[style*="--i"] { transition-delay: calc(var(--i) * 90ms); }

/* Hero 大标题 mask reveal（爆点 1 —— 一次性 clip-path 动画）*/
@keyframes mask-up {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
.hero-h1 .line { animation: mask-up 1s cubic-bezier(.22,.61,.36,1) both; }
.hero-h1 .line:nth-child(2) { animation-delay: .12s; }

/* 心动渐变关键词流动 */
@keyframes grad-flow { to { background-position: 200% 0; } }
.text-grad {
  background: var(--grad-accent);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 48px var(--accent-glow);
  animation: grad-flow 6s linear infinite alternate;
}
```

### Scroll Behavior（L3 scroll-story —— 落地页 4 大签名时刻）
```js
/* 1. 通用滚动 reveal */
const io = new IntersectionObserver((es) => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
}, { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* 2. Pin-Scrub「一天节律」时间线：section 钉住，滚动驱动早→深夜场景切换 */
if (!reduce) {
  gsap.timeline({
    scrollTrigger: { trigger: '.daily-rhythm', start: 'top top', end: '+=300%', pin: true, scrub: 1 }
  })
  .to('.rhythm-track', { xPercent: -75, ease: 'none' })       // 横向推进 4 个时段
  .to('.rhythm-sky',   { backgroundPosition: '0 100%', ease: 'none' }, 0); // 天色由亮转暗

  /* 3. 汇聚转场：Hero 散落的「孤独碎片」滚动时飞向中心合并成角色卡 */
  gsap.to('.lonely-shard', {
    scrollTrigger: { trigger: '.meet-section', start: 'top bottom', end: 'top center', scrub: 1 },
    x: 0, y: 0, rotate: 0, opacity: 1, stagger: 0.04
  });

  /* 4. 视差：背景光晕层与内容层差速 */
  gsap.utils.toArray('.parallax-glow').forEach(el => {
    gsap.to(el, { yPercent: -22, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}
```

### Hover & Focus States
```css
/* 卡片光斑跟随 —— rAF 节流写入 --mx/--my */
.card { /* ::before 见 §4，此处仅 JS 绑定 */ }
```
```js
if (hover) {
  document.querySelectorAll('.card').forEach(card => {
    let raf;
    card.addEventListener('pointermove', e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
        raf = null;
      });
    });
  });
}
```
- 所有按钮：见 §4，hover 提亮 + 上移 2px，active 回落 scale 0.98。
- 所有链接：下划线从右至左展开。
- 所有可聚焦元素：`:focus-visible` 必须有 2px 品红描边 + offset。

### Special Effects
- **爆点 1 / Hero**：OGL WebGL 声纹光晕——品红/紫粒子随一条声波曲线起伏，鼠标移动时声波轻微跟随（pointermove rAF 节流）。IntersectionObserver 监测，Hero 离开视口立即 `cancelAnimationFrame` 暂停渲染。移动端降级为静态 `--grad-glow` 径向渐变 + CSS 声波 SVG。
- **爆点 2 / 首次滑动**：全屏「宣言横滚带」——大字 marquee「输了有人哄 · 赢了有人捧 · 半夜有人听」纯 CSS `translateX` 无限滚动，品红描边空心字。
- **爆点 3 / 用户需求区**：Bento 不等大网格 + SpotlightCard 光斑跟随（见 §4 `.card::before`），最大块「亲密性需求」带缓慢流动的 `--grad-glow`。
- **巧思**：页脚彩蛋——滚动到底出现一行 mono 小字「凌晨 1 点 23 分，她还在线。」配一个缓慢呼吸的 `.status-dot`；Konami 或连点 logo 5 次，角色卡集体眨一下眼（CSS scaleY 瞬变）。
- **页面转场**：落地页锚点跳转用 `scroll-behavior: smooth`，不引入 Lenis（性能红线：本产品只有 1 处 pin-scrub，不需要 scroll-jacking）。

### H5 通话页专属动效（CSS + Web Audio，无 GSAP）
- 通话球 `.call-orb` 的 `is-live` 呼吸光环（§4）。
- AI 说话时：球周围声纹环按 Web Audio `AnalyserNode` 振幅实时 `scale`（rAF 驱动，CSS keyframes 兜底）。
- 用户说话时（VAD 触发）：球边缘泛起一圈 `--hud` 青色细环，与 AI 的品红区分。
- 文字字幕：AI 回复逐句 `fadeInUp` 出现（CSS，不用打字机效果——保证低延迟感）。

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .reveal { opacity: 1 !important; transform: none !important; }
  .text-grad { animation: none !important; }
}
```
```js
// JS 侧：reduce 为真时跳过所有 ScrollTrigger pin/scrub，WebGL 渲染单帧后停止
```

---

## 8. Do's and Don'ts

### Do
- 全站保持暗：背景只在四级暗色间走，让品红/紫的暖光成为视觉焦点。
- 用「暖光晕」表达暧昧——低透明度径向渐变，不是高饱和实色。
- 标题用 Noto Serif SC 衬线体，强化情绪与亲密感，区隔于工具类产品。
- 数字、段位、游戏术语统一 mono 字体——这是「懂游戏」可信度的视觉证据。
- 落地页讲一条情绪线：孤独 → 相遇 → 被理解 → 行动，每 1-2 屏一个签名时刻。
- CTA 文案聚焦情绪价值（「免费试用 10 分钟」「找个搭子陪你」），不写技术参数。
- 合规元素显性化：年龄校验提示、未成年人模式说明用 `--warning` 色清晰呈现，不藏。
- H5 通话页把性能放第一位：极简动效、无 WebGL、无第三方动画库。

### Don't
- ❌ 不用蓝/青做主色或 CTA——青色仅限段位徽章、在线点、HUD 刻度，面积 < 5%。
- ❌ 不出现浅色/白色大色块背景，破坏深夜私密氛围。
- ❌ 不用 Emoji 当图标——本产品调性偏成人暧昧，emoji 显廉价幼稚。
- ❌ 不做露骨/擦边的视觉表达（半裸插画、性暗示构图）——违反 PRD 10.2 合规，且「暧昧」靠氛围不靠裸露。
- ❌ 不在移动端或通话页加载 WebGL / GSAP——单页 WebGL ≤ 1 处且仅落地页 Hero。
- ❌ 不对滚动中的元素用 `filter: blur()`，不用 Lenis scroll-jacking——用 opacity + scale 做景深。
- ❌ `backdrop-filter: blur()` 值不超过 14px，不覆盖大面积滚动区。
- ❌ 不用细体（weight < 400）——暗背景上发虚不可读。
- ❌ 渐变文字不滥用——每屏最多一处关键词，正文 p 永不加渐变/投影。
- ❌ 不堆砌弹跳/急促动效——动效节奏要慢要柔，匹配「深夜对话」气质。

---

## 9. Responsive Behavior

**Breakpoints:**
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | > 1024px | 落地页全量布局，3 列网格，Bento 6 列，L3 全部 scroll-story |
| Tablet | 640–1024px | 网格降 2 列，Bento 重排为 2 列堆叠，section padding 收窄 |
| Mobile | < 640px | 单列；Hero H1 降至 40px；WebGL → 静态渐变；pin-scrub 关闭，改为普通 reveal |

**Touch Targets:** 所有可点击元素最小 44×44px；H5 主按钮、通话球远大于此（通话球 132px）。
**H5 产品页:** 始终按移动端单列设计，桌面访问时居中 480px 壳；通话页全屏沉浸，无导航。

**Collapsing Strategy:**
- 落地页导航 → 移动端收为汉堡菜单（抽屉从右滑入，深色 `--surface` 背景）。
- 角色卡 3 列 → 移动端单列纵向，或横向 swipe 滑动卡组。
- Bento 不等大网格 → 移动端全部 `grid-column: 1 / -1` 单列堆叠，保留高度差节奏。
- 时长包 3 卡 → 移动端纵向堆叠，「最受欢迎」卡置顶。

```css
@media (max-width: 1024px) {
  .grid-features, .grid-characters { grid-template-columns: repeat(2, 1fr); }
  .grid-bento { grid-template-columns: repeat(2, 1fr); }
  .grid-bento > * { grid-column: auto !important; grid-row: auto !important; }
  :root { --space-7: 96px; }
}
@media (max-width: 640px) {
  .grid-features, .grid-characters, .grid-bento { grid-template-columns: 1fr; }
  .hero-h1 { font-size: 40px; }
  .section-h2 { font-size: 28px; }
  .container { padding-inline: 20px; }
  :root { --space-7: 64px; --space-6: 56px; }
  /* WebGL Hero 降级为静态渐变 */
  .hero-webgl { display: none; }
  .hero-fallback { display: block; background: var(--grad-glow); }
}
```

---

## 附录：落地页结构与首页爆点映射

| 屏次 | Section | 内容来源（PRD）| 爆点 / 签名时刻 |
|------|---------|----------------|-----------------|
| 1 | Hero | 1.1 产品定位「24h 在线、懂游戏、能聊骚、记得住他」| **爆点 1**：WebGL 声纹光晕 + H1 mask reveal + 渐变关键词 |
| 2 | 宣言横滚带 | 2.3 三层需求凝练 | **爆点 2**：全屏大字 marquee 横滚 |
| 3 | 一天节律 | 3.1 时段场景表 | scroll-story #1：Pin-Scrub 时间线，天色由亮转暗 |
| 4 | 「不再一个人」相遇区 | 2.3 第一层功能需求 | scroll-story #2：孤独碎片汇聚成角色卡 |
| 5 | 三层用户需求 Bento | 2.3 功能/情绪/亲密三层 | **爆点 3**：Bento 不等大 + SpotlightCard |
| 6 | 三个 AI 角色 | 7.1–7.3 元气妹妹/温柔御姐/高冷学妹 | 角色卡 3D 倾斜 hover |
| 7 | 懂游戏 | 6 / 12.1 三角洲 + 无畏术语 | mono 术语标签墙，青色 HUD 细节 |
| 8 | 时长包定价 | 修订文档第三节定价表（19.9/69/199）| 「最受欢迎」高亮卡 |
| 9 | 合规与安心 | 10.2 / 10.3 实名、未成年人模式、隐私 | `--warning` 提示，建立信任 |
| 10 | 终 CTA + 页脚 | 「免费试用 10 分钟」| **巧思彩蛋**：「凌晨 1:23,她还在线」+ 呼吸点 |

> H5 产品页（F07）按同一套 token 实现：① 主页——巨大「开始陪玩」按钮 + 当前角色 + 剩余试用额度；② 角色选择页——`.card--character` 选中态；③ 通话页——`.call-orb` + 声纹环 + 字幕，全屏沉浸无导航。
