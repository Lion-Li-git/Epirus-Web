# 11-25 `transfer` 蒸馏补盲与 31 池准入记录

- 对应版本：`v2.1.30`
- 关联：`v2.1.29`（[`RESULTS-2026-11-25-2p-census.md`](RESULTS-2026-11-25-2p-census.md)）、[`ANALYSIS-2026-11-25-2p-next.md`](ANALYSIS-2026-11-25-2p-next.md)

## 一、诊断与量具修复

1. **状态可达性先验**：`oneGameN`（`long` 40 局）下，`DR-R3E`（`EP≥2` 占 `32.3%`，`tfLegal=1033/3202`）与 `ROD-DR`（`EP≥2` 占 `39.4%`，`tfLegal=1449/3674`）均高于 `AR-TK2`（`24.0%`），表明 `transfer` 稀缺非状态不可达所致。
2. **量具缺陷修复**：[`training/proto2/skill-mastery.mjs`](../../training/proto2/skill-mastery.mjs#L148-L156) 原在第 153 行 `rows.push` 中遗漏 `transfered`，使外层 `row.transfered || []` 恒读为空数组。补回后 `node training/proto2/skill-mastery.mjs --selftest` 通过（五腿全过）。

## 二、受控蒸馏实验与准入定名

六枚均落为 `v:92 / arch:S1o / params:16561`；其中 3 枚按短命名通过 `promote --dry --support=2`、`90210/90211` 人席探针、`measure-point` 全尺测绘与 `pool-add` 完整准入链：

| 正式 ID | 动作 | 亲代与教师 | Stage 1 核心覆盖 | Arena B（24 锚中位 / 图 arR） | 2P `rule / legacy`（4 粒均值） | 人席 `90210/90211` 最大格 | 备注 |
|---|---|---|---|---|---|---|---|
| **`TF-DR`** | 入 **`hard`** | `DR-R3E` + `MX6-GD-TF20` (`transfer`) | `17/30`（`transfer 29/120·408次` / `ring 30` / `bigT 20` / `drain 11` / `holo 9`） | `+27.4971pt`（`arS=+0.2869 / arL=+0.1180 / arR=+0.6819`） | `27.75% / 24.40%` | `≤3.5% / ≤7.5%`（`seatKill=0`） | `hostile` ✔ 会转移 (`10.0%/局 · 50.0%`) + ✔ 会聚能环 (`2` 段)；`okLong=1, okShort=1` |
| **`TF2-RD`** | 入 **`soft`** | `ROD-DR` + `transfer2` | `18/30`（`rod 13/120·344次` / `transfer 11/120·86次` / `ring 29`） | `+23.7784pt`（`arS=+0.0369 / arL=-0.0126 / arR=+0.0348`） | `29.75% / 22.75%` | `≤0.5% / ≤3.0%`（`seatKill=0`） | 补回 `soft rod`（原 `0`）与 `transfer`；`okLong=1, okShort=1` |
| **`TF2-DR`** | 入 **`soft`** | `DR-R3E` + `transfer2` | `16/30`（`transfer 3/120·32次` / `drain 7` / `ring 20` / `railgun 4`） | `+17.9278pt`（`arS=+0.1560 / arL=+0.0838 / arR=+0.3583`） | `37.75% / 25.75%` | `≤7.0% / ≤8.0%`（`seatKill=0`） | `promote G(long)=7.53 / S=2.054 / 7` 角色；`okLong=0, okShort=1` |
| **`TF-RDMX`** | 仅上图 | `ROD-DR` + `MX6-GD-TF20` | `17/30`（`transfer 21/120`） | `arR=+0.2733`（图测） | `17.0% / 21.25%` | `≤5.0% / ≤2.5%` | 2 跳代表对照 |
| **`TF2-RDC`** | 仅上图 | `ROD-DR` + `transfer2`（`steps=140 / lr=2.5e-4`） | `18/30`（`transfer 25/120`） | `arR=-0.4463`（图测） | — | 防席 `16%–22%` | 轻步稳 `selftest3` 但 Arena 坍缩对照 |
| **`PUR-2P`** | 仅上图 | `PUR-DR` + `2:standard@10 + 0.90` | — | `arR=+0.5229`（图测） | `20.0% / 12.5%` | `≤4.0%` | 2P 稀释修正代表对照 |

## 三、31 池状态（`hard 16 / soft 15`）

1. **审计与闭环**：`node tools/pool-add.mjs --audit` 输出 `{"members":31,"tiers":{"hard":16,"soft":15},"untracked":0,"dupWid":0,"blockedAuto":0,"untestedAuto":0,"seatKilledAuto":0,"seatUnknown":0,"bad":[]}`。
2. **Stage 1 覆盖（`≥3` 格）**：全池保持 **`28/30`**（仍仅 `dualGun, mirror` 未跨线）；`hard` 保持 **`26/30`** 且 **`transfer` 由 `0` 恢复为 `TF-DR (29/120, 408 次)`**，`hard drain` 增至 3 枚、`hard holo` 增至 3 枚；`soft` 为 **`26/30`**，由 `TF2-RD` 补回 `rod (13/120, 344 次)`（原为 0）。
3. **难度阶梯（`probe-diff-ladder.mjs --pool=1 --games=400 --seed=95001`，1 席替身 vs N−1 席同档 AI）**：
   - `5P multi`（`legacy`）：`hard 4.0%` → `regular 14.0%`（`-10.00 ±3.86pt`, `5.1σ`）→ `simple 21.5%`（`+7.50 ±5.14pt`, `2.9σ`）
   - `5P long`（`legacy`）：`hard 4.3%` → `regular 12.3%`（`-8.00 ±3.59pt`, `4.4σ`）→ `simple 19.5%`（`+7.25 ±4.88pt`, `2.9σ`）
   - `2P standard`（`rule·规则理解`, 1500 局）：`hard 46.5% < regular 48.6%`（`-2.13 ±3.37pt`, `1.2σ`）`< simple 54.7%`（`+6.07 ±3.46pt`, `3.4σ`）
   - `2P standard`（`rand/legacy`, 1500 局）：`hard 23.9% < regular 26.1%`（`-2.20 ±2.71pt`, `1.6σ`）`< simple 30.5%`（`+4.33 ±2.96pt`, `2.9σ`）
