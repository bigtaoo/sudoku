# Sudoku

网页数独游戏，先做手机网页（PWA），以后用 Capacitor 打包成 App。

- 前端：`https://s.gamestao.com`（Cloudflare Workers 静态资源）
- 后端：`https://sudoku-api.gamestao.com`（Hetzner VPS，接入现有 Caddy）
- 只有游客模式；界面语言：中文 / English / Deutsch

## 仓库结构（pnpm monorepo）

```
packages/
  core/     纯 TS 数独引擎，不依赖任何框架；前端、后端、以后的 App 都用它
  shared/   （待建）API 类型与 zod schema
apps/
  web/      （待建）React + Vite 前端
  server/   （待建）Fastify + SQLite 后端
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
