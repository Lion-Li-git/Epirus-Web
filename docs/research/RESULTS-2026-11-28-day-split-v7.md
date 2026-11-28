# RESULTS · 2026-11-28（`v2.1.48`）· `v7` 正式整体退役 ＆ `LE-S2`/`PH-S2` 分担替换 `MX8-TN35-KL3`/`MX8-R6B-KL`

> 完成时间：2026-11-28 12:25（UTC+8）。
> 预登记：[`PREREG-2026-11-28-day-split-v7.md`](PREREG-2026-11-28-day-split-v7.md)。
> 基线：`v2.1.47`（`678f7584`，规则指纹 `c61298e6`，池 35 枚 `hard 17 / soft 18`）。

## 1. `v7` 训练线整体退役与 `knobs` KPI 收敛（`185 → ≤40`）

1. **仓外隔离（`AGENTS.md §24`，无物理 `rmSync`）**：将 5 个纯 `v7` 训练遗留文件按原相对路径连同 SHA256 清单移至 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-28\`（`manifest.tsv`）：
   - `training/train-3p.mjs`
   - `training/server/econ-env.mjs`
   - `training/server/train-env.mjs`
   - `tools/command-checkup.mjs`
   - `champion-map/opphuman-arms.mjs`
2. **入口、生成器与文档同笔清零（`AGENTS.md §19`）**：
   - [`training/train.mjs`](../../training/train.mjs)：移除 `--mode=v7` 与 `--era` worktree 委托逻辑；
   - [`training/knobs.mjs`](../../training/knobs.mjs)：移除 `train-3p` 入口条目与遗留说明、`node training/knobs.mjs` 重生成 [`training/TRAINING-KNOBS.md`](../../training/TRAINING-KNOBS.md)；
   - [`tools/audit-lib.mjs`](../../tools/audit-lib.mjs)：`feasPlan` 改为静态属性读取 `e.EPIRUS_*`（保留完全同构行为），同步去除 [`tools/promote-champion.mjs`](../../tools/promote-champion.mjs) 显示文本中的幽灵键名。

## 2. 双载体分离训练与完整准入替换链（`AGENTS.md §20`）

| 成员 | `wid` | 配方 | `selftest3` | Stage 1 胜率 | Stage 1 关键技能 | 废珠率（花/过） | Stage 2 | `Arena B` | `promote` | 人席 `90210/90211` |
|---|---|---|---|---:|---|---:|---:|---:|---|---|
| **`LE-S2`** | `f43d1e2551a4bd7a` | `FS2-LE26` + `L1B-S1200(ring,bigT,drain)` `dagger=0` → Stage C 岭基线 PG (`2400g`) | 全绿 (`π=0.916`) | 41.25% | `laserEye=15, firestorm=33, curse=66` | **27.92%** (`boom 296/3`, `elec 6/114`) | 21 技（消融 10） | `-2.5213pt`（极差 `10.45pt`） | `pass`（0 阻断，`G_eff=7.40`, `S=2.001`） | **`seatKill = 0`** (`multi ≤0.5%`, `long ≤17.0%`) |
| **`PH-S2`** | `1fe874c317e3cf6e` | `L1B-S1200` + `MX8-TN35-KL3(proto,holo,jinshield)` `dagger=0` → Stage C 岭基线 PG (`2400g`, `klTilt`) | 全绿 (`π=0.258`) | 48.83% | `proto=8, holo=29, ring=20, drain=11, bigT=4` | **51.72%** (`elec 14/15`) | 25 技（消融 6） | `+28.998pt`（极差 `44.67pt`） | `pass`（0 阻断，`G4≤0.3%`, `G5=0%`） | **`seatKill = 0`** (`multi ≤2.0%`, `long ≤2.0%`) |

- **退池迁移**：预先备份 `MX8-TN35-KL3.json`（`seatKill=2`, 废 `90.23%`）与 `MX8-R6B-KL.json`（`seatKill=1`, 废 `91.83%`）至隔离目录后再执行 `pool-add --retire`；池维持 `35` 枚（`hard 17 / soft 18`），`soft` 全部 `27` 项技能深度仍 `≥1`（`laserEye` 由 `LE-S2 (15)` 接住，`proto/holo/ring` 由 `PH-S2` 接住并深化）。
- **难度阶梯实测（`probe-diff-ladder.mjs --pool=1`）**：
  - `2P rule`（1500g `95001`）：困难 **`30.8%`** < 普通 **`42.3%`** < 简单 **`52.1%`**（`-11.47 ±3.14pt, 7.2σ` / `+9.80 ±3.45pt, 5.6σ`）；
  - `2P legacy`（1500g `95001`）：困难 **`19.2%`** < 普通 **`24.3%`** < 简单 **`26.7%`**（`-5.07 ±2.61pt, 3.8σ` / `+2.47 ±2.86pt, 1.7σ`）；
  - `5P multi`（1500g `95001`）：困难 **`2.9%`** < 普通 **`10.4%`** < 简单 **`15.4%`**（`-7.53 ±1.71pt, 8.7σ` / `+5.00 ±2.39pt, 4.1σ`）；
  - `5P multi`（800g `95002`）：困难 **`3.4%`** < 普通 **`10.8%`** < 简单 **`17.9%`**（`-7.38 ±2.33pt, 6.2σ` / `+7.12 ±3.42pt, 4.1σ`）；
  - `5P long`（400g `95001`）：困难 **`4.5%`** < 普通 **`7.3%`** < 简单 **`14.0%`**（`-2.75 ±3.21pt, 1.7σ` / `+6.75 ±4.14pt, 3.2σ`）；
  - `seed=77000` 产品复核：`2P rule` **`31.1% < 37.0% < 50.4%`**，`5P long` **`2.3% < 8.0% < 9.5%`**，全部保序。
