# 证据索引 · 2026-11-25 下午训练与入池验收

对应提交：`12332e5e`（v2.1.27，DR-R3E 入 hard）、`dd01fd06`（v2.1.28，ROD-DR / PUR-DR 入池）。

## 正式包与候选臂

| 正式 id | 候选臂 | wid | 去向 |
|---|---|---|---|
| DR-R3E | `nov25-r3-econdrain-s25` | `eae4b0ad4013c202` | hard |
| ROD-DR | `nov25-rod-dr-s26` | `c5f68b29031ab56c` | hard |
| PUR-DR | `nov25-purify-dr-s25` | `7fd8b3c1d487dcdd` | soft |
| — | `nov25-r3-ringdrain-s25` | — | A1 对照 |
| — | `nov25-r3-econdrain-s26` | — | DR 第二 seed |
| — | `nov25-rod-dr-s25` | — | ROD 第二 seed |
| — | `nov25-purify-fs2-s25` | — | FS2 底座失败对照 |
| — | `nov25-purify-dr-s26` | — | PUR 第二 seed |
| — | `nov25-purify-2p-s27/s28` | — | 2P 回合占比实验 |
| — | `nov25-taunt-2p-s25` | — | 2P 升级试测 |
| — | `nov25-fsg2-2p-s25` | — | 2P 升级试测 |

## 目录

- `packs/`：12 枚候选包与 `.bak.meta.json`。正式包与 `docs/artifacts/` 逐字节相同；sidecar 保留配方、seed、教师配额、标签统计与训练轮次。
- `promote/`：12 份 `promote --dry` 原始 stdout。
- `stage1/`：原始 Stage 1/2 JSON；正式包的权威副本同时在 `champion-map/data/skill-report/`。
- `map/`：六 seed Arena 条件行、Arena 汇总、90210/90211 人席逐格、`allLong/allMulti` feas 与 measure-point 的 ruler/readings/mx/bp 回执。
- `selftest3/`：2026-11-25 晚按当前代码重跑的 12 份原始 stdout；红项保留，不删。
- `mastery/`：2026-11-25 晚按当前池重跑的 `long` 与 `hostile` JSON/stdout；`hostile` 使用 `--table=long --arena=hostile`。
- `2p/`：2026-11-25 晚重跑的 2P standard 替身 JSON，`rule/legacy × seed 77000/90210 × 1000 局`。
- 三个重跑目录各附 `summary.tsv`，分别列出 12 条 selftest3、48 个 mastery 格与 48 条 2P 读数。
- `rerun-manifest.tsv`：84 条重跑的开始/结束时间、退出码、文件路径与 SHA-256。
- `sha256-manifest.tsv`：本目录除自身与索引外所有文件的 SHA-256。

## 恢复件与重跑件的边界

- **恢复到的原始件**：候选包、sidecar、promote stdout、Stage 1/2、Arena 条件行、人席表、feas/measure-point staging。
- **原始件未落盘，因此晚班重跑补证**：selftest3、mastery、2P 替身。重跑值用于当前代码/当前池复核，不冒充历史 stdout，也不回写历史摘要。
- **无法恢复**：12 臂训练过程的完整 stdout；sidecar 已保留可复算的配方与训练统计，但不能还原终端逐字日志。

## 复跑命令

```bash
node training/proto2/selftest3.mjs <pack>
node training/proto2/skill-mastery.mjs --pack=<pack> --table=long --n=3,5 --games=40 --temp=0.15 --out=<json>
node training/proto2/skill-mastery.mjs --pack=<pack> --table=long --arena=hostile --n=3,5 --games=40 --temp=0.15 --out=<json>
node tools/probe-diff-ladder.mjs --pack=<pack> --pool=0 --tiers=lv:hard --n=2 --mode=standard --surrogate=rule|legacy --games=1000 --seed=77000|90210 --quiet
```

## 复核结论与降级项

1. **DR-R3E 的场B 必须分桌形读**：promote 的 `1.16/局` 是 `multi`；地图 `allLong` 为 `0.03/局 < 0.3`，`okLong=0`。long 无压清场未过，不能称“双桌形五道全过”。
2. **DR-R3E 的 hostile 双过未复现**：历史摘要缺少原始回执；当前池复跑摄魂为 `n3 7.5% / n5 27.5%`，`n3 < 10%` 线。已在结果文档与 CHANGELOG 降级为“历史摘要、待复核”。
3. **A1 的 hostile 双过也未复现**：当前池复跑 `n3 12.5% / n5 0%`。
4. **2P 复跑方向大体一致，但绝对值有 1–3pt 条件/seed 差**：例如 DR s25 rule 复跑均值 `20.5%`（历史摘要 `22.3%`），PUR s28 legacy 复跑均值 `15.7%`（历史摘要 `12.5%`）。历史值保留为历史摘要，当前复核值以本目录 JSON 为准。
