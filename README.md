# 何切道场 · Heqie Dojo

立直麻将「何切」练习站：每题一手牌，选出最好的一张打出，马上看到每种打法的进张和理由。免费、无广告、不用注册，打开即用，也可以装到手机桌面离线使用。

**在线使用：<https://heqie.qshlab.com>**

A free riichi-mahjong *what-to-discard* (何切) trainer: each problem is a hand, you pick the best discard,
and you immediately see the tile acceptance (ukeire) of every option and why the best one wins. No ads,
no sign-up, works offline as an installable web app. The interface is in Chinese.

## 功能 Features

- **何切练习**：按向听数（一、二、三向听）出题，题目随机生成，答完即看全部打法的进张数、剩余枚数和一句话理由。
- **每日一题**：每天全站同一题，答完可生成分享图。
- **算分**：符数练习和点数练习（含亲 / 子、自摸 / 荣和）。
- **计算器**：输入任意手牌，算向听数、每种打法的进张和有效牌。
- **统计**：正确率、各向听数表现，记录只保存在本机浏览器（localStorage）。
- **离线 / 安装**：PWA，加到主屏幕后断网也能练。
- 反馈表单（可选）和赞赏码（微信）。网站本身不收集任何数据。

In English: practice by shanten (1–3); a daily problem shared by everyone (with a share image); fu and points
drills; a hand calculator (shanten, ukeire for every discard); local stats; offline PWA.

## 原理 How it works

全部在浏览器里运行，没有后端。The whole site is static TypeScript; everything runs in the browser.

- `src/engine/shanten.ts`：标准形、七对子、国士无双的向听数。Shanten for standard hands, seven pairs and
  thirteen orphans.
- `src/engine/analyze.ts`：每种打法的进张（ukeire）与剩余枚数（计入可见牌）。Ukeire per discard, counting
  the copies you can see.
- `src/engine/generator.ts`：按目标向听数生成题目，用固定种子保证每日一题全站一致。Problem generator;
  seeded so the daily problem is the same for everyone.
- `src/engine/explain.ts`：把手牌拆成搭子，只有在对这手牌验证成立时才说出原则，否则退回到具体数字。
  Explanations: a principle is stated only when it is verified for that hand; otherwise plain numbers.
- `src/engine/fu.ts`, `points.ts`：符数与点数计算。Fu and points.
- `src/ui/`：页面（无框架，原生 DOM）。The pages (plain DOM, no framework).
- `sw/sw.template.js`：离线缓存的 service worker。

## 开发 Development

```bash
cd heqie-dojo
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests (vitest)
npm run build      # dist/
```

Node version: see `heqie-dojo/.node-version`.

## 部署 Deployment

托管在 Cloudflare Workers（静态资源，无 Worker 脚本）。推送到 `main` 后由 Workers Builds 自动构建并发布，
配置以 `heqie-dojo/wrangler.jsonc` 为准。Hosted as Cloudflare Workers static assets; every push to
`main` is built and deployed by Workers Builds. `heqie-dojo/wrangler.jsonc` is the source of truth.

反馈表单的消息由 [WickReader](https://github.com/qingshanlanshan/WickReader) 网站的 Worker 转发邮件，
本站不保存。Feedback messages are emailed on by the Worker of the WickReader site; this site keeps nothing.

---

qshlab 的其他作品 · More from qshlab: <https://qshlab.com>
