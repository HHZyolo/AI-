# AI 陪玩搭子 · 前端

为 PC 战术 FPS 男玩家打造的 AI 语音陪玩产品(专注《无畏契约》)。
纯前端,不含后端 —— 严格按项目根目录 `../DESIGN.md` 设计规范实现(暗黑暧昧情感风)。

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物输出到 dist/
npm run preview  # 本地预览生产构建
```

## 技术栈

- Vite + React + react-router-dom
- GSAP + ScrollTrigger —— 落地页 scroll-story(汇聚转场)
- 原生 WebGL —— 落地页 Hero 声纹光晕(单页唯一,离屏暂停)

## 路由结构

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | 营销落地页 | 对外获客,9 个 section |
| `/app` | H5 产品主页 | 当前角色 + 试用额度 + 开始陪玩 |
| `/app/characters` | 角色选择页 | 三角色卡选择,带选中态 |
| `/app/call` | 语音通话页 | 通话球 + 声纹环 + 模拟对话字幕 |

## 落地页 section(src/sections)

| 文件 | 内容 | PRD 来源 |
|---|---|---|
| Hero | WebGL 声纹光晕 + H1 mask reveal | 1.1 产品定位 |
| Manifesto | 宣言横滚带 | 2.3 三层需求 |
| Rhythm | 一天节律 2×2 网格 | 3.1 时段场景 |
| Needs | 三层需求 Bento 网格 + 汇聚转场 | 2.3 需求分层 |
| Characters | 三个 AI 角色(3D 倾斜卡) | 7.1–7.3 |
| GameKnowledge | 无畏契约术语墙 | 6 / 12.1 |
| Pricing | 时长包定价 | 选型修订文档 第三节 |
| Trust | 合规与安心 | 10.2 / 10.3 |
| CtaFooter | 终 CTA + 页脚彩蛋 | — |

## H5 产品页(src/app)

- 纯前端演示:角色选择、试用额度、登录、通话交互全部走内存状态(刷新即重置)。
- 通话页用内置模拟对话脚本(`src/data/dialogues.js`)演示,不接后端 AI。
- `AppState` 通过 React Context 管理全局状态。

## 部署

`npm run build` 产物为纯静态文件,可托管到任意静态平台。
已含 SPA fallback 配置:`public/_redirects`(Netlify)、`vercel.json`(Vercel)。

## 致谢

Motion effects derived from [vue-bits](https://github.com/DavidHDev/vue-bits) by DavidHDev (MIT).
