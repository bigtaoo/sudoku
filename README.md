# Sudoku

网页数独游戏，先做手机网页（PWA），以后用 Capacitor 打包成 App。

- 前端：`https://s.gamestao.com`（Cloudflare Workers 静态资源）
- 后端：`https://sudoku-api.gamestao.com`（Hetzner VPS，接入现有 Caddy）
- 只有游客模式；界面语言：中文 / English / Deutsch

## 仓库结构（pnpm monorepo）

```
packages/
  core/     纯 TS 数独引擎，不依赖任何框架；前端、后端、以后的 App 都用它
  shared/   API 契约：zod schema 与类型，前后端共用
apps/
  web/      React + Vite 前端
  server/   Fastify + SQLite（node:sqlite）后端
```

## 常用命令

```bash
pnpm install
pnpm test          # 所有包的 Vitest
pnpm typecheck     # tsc（TypeScript 7）
pnpm lint          # ESLint（typescript-eslint 通过 TS 6 API 运行）
pnpm format        # Prettier
```

> TypeScript 采用官方推荐的并存方案：`@typescript/native` 是 TS 7（提供 `tsc`），
> `typescript` 指向 `@typescript/typescript6`，供暂不支持 TS 7 的 typescript-eslint 使用。
> 等 typescript-eslint 支持 TS 7 后，把两项合并回 `typescript@^7`。

## packages/core

| 模块            | 作用                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid.ts`       | 盘面模型：81 格一维数组，`0` 表示空格；行/列/宫/peers 预计算；解析与序列化                                                                   |
| `solver.ts`     | 位运算 + MRV 回溯求解；`countSolutions` / `hasUniqueSolution`（唯一解校验）                                                                  |
| `logic.ts`      | 人类解题技巧：Full House、Hidden/Naked Single、区块摒除、数对/三数组（显性/隐性）、X-Wing、XY-Wing、Swordfish。`findHint` 直接用作游戏内提示 |
| `grader.ts`     | 按“从易到难”逐步用技巧解题评定难度：所需最难技巧决定档位，步骤权重累加得分                                                                   |
| `generator.ts`  | 随机终盘 → 中心对称挖空，每一步都保证唯一解且不超过目标难度；同一 seed 生成同一题（每日一题用日期作 seed）                                   |
| `validation.ts` | 冲突检测；`isValidSolution` 让服务端不存答案也能校验提交                                                                                     |
| `rng.ts`        | 可复现的伪随机数（mulberry32）与字符串 seed 哈希                                                                                             |

难度档位（由所需最难技巧决定）：

| 档位   | 技巧                       | 最少提示数 |
| ------ | -------------------------- | ---------- |
| easy   | Full House、Hidden Single  | 36         |
| medium | Naked Single、区块摒除     | 30         |
| hard   | 显性/隐性数对、三数组      | 25         |
| expert | X-Wing、XY-Wing、Swordfish | 22         |

只用这些技巧解不出来的题目不会被生成，所以任何一题都能一步步给出提示。

用法：

```ts
import { generatePuzzle, findHint, isValidSolution } from '@sudoku/core';

const daily = generatePuzzle({ difficulty: 'hard', seed: '2026-10-24' });
const hint = findHint(currentGrid); // { technique, placements, eliminations, pattern, digits, unit }
isValidSolution(daily.puzzle, submittedGrid);
```

生成耗时（本机，中位数）：easy ≈ 2 ms，medium ≈ 25 ms，hard ≈ 75 ms，expert ≈ 40 ms；
单题最慢不到 0.5 s。前端会放在 Web Worker 里生成，避免卡界面。

## apps/web

`pnpm --filter @sudoku/web dev` 启动开发服务器（http://localhost:5173）。

- 纯规则在 `src/game/game.ts`（填数、笔记、撤销/重做、提示、计时），Zustand store 只负责调用并持久化到 localStorage（键 `sudoku:v1`）
- 出题在 Web Worker 里跑，不阻塞界面
- 键盘：1–9 填数（Shift+数字 = 笔记）、方向键移动、Backspace 擦除、N 切换笔记、H 提示、Ctrl+Z / Ctrl+Y 撤销 / 重做
- 多语言：`src/i18n/{zh,en,de}.ts`，`en.ts` 是源文件，其他语言缺键会在类型检查时报错
- 两种模式：经典（本地出题）和每日一题（从服务器取题，答案在本地用 `solve` 算出；完成后自动提交成绩，失败可重试，下次打开也会补交）
- API 客户端在 `src/api/client.ts`：首次需要时自动创建游客，token 存在 localStorage（键 `sudoku:guest`），服务器不认这个 token 时自动重建一次
- API 地址：`VITE_API_URL`，默认开发时 `http://localhost:8787`、生产 `https://sudoku-api.gamestao.com`
- 本地联调：同时启动 web 和 server（`.claude/launch.json` 里两项都有）

### PWA

- `vite-plugin-pwa`（Workbox generateSW）：预缓存整个前端（含出题 Worker 和三种语言），经典模式完全离线可玩；每日一题和排行榜需要联网，恢复网络后自动重新加载 / 补交成绩
- 更新策略是“提示”：有新版本时弹出提示，玩家点“更新”才刷新，不会打断正在玩的局；已安装的应用每小时检查一次更新
- 图标：`scripts/icons.mjs` 用 sharp 从同一个 SVG 设计生成 `public/` 下的 favicon、192/512、maskable、apple-touch-icon（改设计后跑 `pnpm --filter @sudoku/web icons`）
- Service Worker 只在生产构建里生效：`pnpm --filter @sudoku/web build && pnpm --filter @sudoku/web preview` 测试（http://localhost:4173）
- 部署时 `sw.js` 和 `index.html` 不能被长期缓存（Cloudflare 上设 `Cache-Control: no-cache`），`assets/` 带哈希可以永久缓存

## apps/server

`pnpm --filter @sudoku/server dev` 启动开发服务器（http://localhost:8787）；`pnpm --filter @sudoku/server build`打包成`dist/server.js`（`@sudoku/*` 打进包里，npm 依赖保持外部）。

数据库用 Node 内置的 `node:sqlite`（不需要编译原生模块，镜像小），手写 SQL，迁移按 `PRAGMA user_version` 递增。

| 接口                              | 说明                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `POST /v1/guests`                 | 创建游客，返回 `token`（只返回一次，库里只存 SHA-256）  |
| `GET` / `PATCH /v1/me`            | 查看 / 修改昵称（Bearer token）                         |
| `GET /v1/daily/:date`             | 每日一题（按日期确定性生成并缓存）；带 token 时开始计时 |
| `POST /v1/daily/:date/result`     | 提交答案：服务器用 `isValidSolution` 校验，每人每天一次 |
| `GET /v1/daily/:date/leaderboard` | 排行榜，按 `用时 + 提示×30s + 错误×10s` 排序            |
| `GET /healthz`                    | 健康检查                                                |

- `date` 用玩家本地日期，只接受 UTC 昨天 / 今天 / 明天（覆盖 UTC−12 到 UTC+14）
- 每日难度按星期：一 简单、二三 中等、四五 困难、六日 专家
- 防作弊（游客级别）：必须先打开题目；上报用时不能超过“打开到提交”的实际时间 + 15 秒
- 环境变量：`PORT`（8787）、`HOST`、`DB_PATH`（`./data/sudoku.sqlite`）、`CORS_ORIGINS`、`RATE_LIMIT`（每 IP 每分钟 120）、`LOG_LEVEL`
