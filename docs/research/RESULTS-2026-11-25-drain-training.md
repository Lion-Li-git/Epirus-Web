# RESULTS · 2026-11-25 摄魂强包训练

## 目标与基线

目标：补 hard 带有效 `drain` 覆盖，同时不牺牲强度、2P 与珠经济。

- `drain` = 摄魂指法，3 EP、1 伤、命中自愈 1；multi 仅目标 HP≤1，long 为 HP≤2。
- hard 原有有效载体只剩 `RING-MINIT-CONT`（17 格 / 101 手），但它 `seatKill=2`、ArenaB +2.30pt；`T65-RINGBEAD` 仅 1 格 / 11 手。
- `FS2-LE26`：ArenaB +14.52pt、`seatKill=0`、2P rule/legacy 22.2%/21.4%，但 drain 为 0，适合强底座。
- `TZ2C`：标准场 drain 0.225/0.675，敌意场 1.875/0.550；`selftest3` 腿 C 红，只能作冻结教师。

## 实验总账

| 臂 | 结果 | 判定 |
|---|---|---|
| FS2 + TZ2C drain + T65 2P | drain 标签 144、留出 36；实战标准场 0/0.025、敌意场 0/0；激光眼塌 | 失败：教师标签没有转成部署 |
| RING + FS2 + TZ2C + RING 自锚 | `teacher2Groups=0`，珠过期 7.3/局，exit 14 | 失败：教师调度饥饿 |
| RING + FS2 + TZ2C + T65 | drain 标签 144、留出 67%；珠过期 6.0/局，exit 14 | 失败：强度教师洗坏珠经济 |
| RING 自锚 + TZ2C drain + T65 | drain 标签 167、留出 70%；标准场 0.225/0.375、敌意场 0.650/0.675；珠过期 1.7/局 | **成功补盲，但仍是 soft 强度** |
| 上臂锚定 PG（klW0.30 / dmgW0.005） | 各快照均保住 drain；G4 只狙击约 88%、G5 long 约 60%；seg400 ArenaB −1.89，long 纯反弹人席 43.5% | 失败：没有修复清场，强度反退 |
| FS2 + TZ2C + DAgger1 | 学生自访留出 81.1%，但实战标准场 drain 2.5%、敌意场 0；激光眼仍为 0 | 失败：DAgger 未修复部署 |

## 最佳候选

`DRAIN-SOFT-SELF.bak`（wid 与 `scratch/arms/nov25-ring-drain-self-s20261127.bak` 逐位相同）：

- 摄魂 mastery 双场过线；环与大雷保住。
- 2P standard 替身：rule 均值 24.8%，legacy 18.5%；均优于 RING 基线 35.15%/18.7%。
- ArenaB 六 seed 中位 +2.23pt，未达 hard。
- promote 被 G4 只狙击 81.7%、G5 long 61% 阻断。
- 人席 long 纯反弹 39–40%，仍是软包形状。

因此保留为 **soft 反应型摄魂研究候选**，不入池、不改现役成员。

## 结论与停线

1. 单步奖励路线早已判死；本轮再次确认不能靠加摄魂奖励解决。
2. 强底座 FS2 能采到摄魂标签，但不会自然走到部署窗口；DAgger 也没解决。
3. RING 自锚能把摄魂推过 mastery，但强度与清场是独立问题；低剂量锚定 PG 只保行为，不修 G4/G5。
4. 不再扫教师份额、seed 或 PG 剂量。下一轮要换机制：要么找“强且原生会 drain”的底座，要么做残血留 EP 的序列/状态干预。
5. `supfit-gd` 新增教师调度饥饿 fail-fast：配置的 teacher2/3/4 分到 0 组时 `exit 15`，不再静默训练。

## 午后复核与路线 A 突破（`nov22-ring3-gd6a18` + 多师分桌隔离）

1. **根因量化（`long` 40 局镜）**：`FS2-LE26` 仅 **`0.3%`** 决策点处于 `EP≥3`（`ring/40g=0`、`drainLegal=2`、`drainTaken=0`），故 `--teacher2keys=drain` 因状态不可达与 `--rareOnly=drain` 饿死 `laserEye` 失败；`nov22-ring3-gd6a18.bak` 经 `selftest3` 全绿（`6/6, 0.00e+0`），具 `ArenaB +20.4pt` 与原生 `ring`（`EP≥3 = 1.4%`），2P `standard vs rule` 偏弱（`39.5%`）。
2. **路线 A 两臂受控实验（`up=nov22-ring3-gd6a18` · `T4=T65-RINGBEAD@0.25@2:standard` · `--rareOnly=drain,ring --rareFrac=0.35` · `2000组/240步/lr=4e-4`）**：
   - **A1（`scratch/arms/nov25-r3-ringdrain-s25.bak`）**：`T2=TZ2C@0.35 (ring,drain)`；`long mastery` 三项过线（`ring` 24 段 / `bigT` `42.5%–50.0%` / `drain` **`70.0%/60.0%`**）、2P `rule` `23.5%`、`Arena B(6粒) +17.45pt`、`90210/90211 seatKill=0`（最坏 `6.5%/6.0%`）、Stage1 `drain` `9/120`（`>=3`），但 `selftest3` 腿 C 红（`exit 8`）且反退化栏 `long gun 63.2%`。历史摘要另称 hostile 双过 `60.0%`，但原始回执未落盘；当前池复跑为 `n3 12.5% / n5 0%`，**未复现双过**，该读数降级为待复核。
   - **A2（`scratch/arms/nov25-r3-econdrain-s25.bak` → 正式入 `hard`：`docs/artifacts/DR-R3E.bak`）**：`T2=drain@0.35 (drain)` + `T3=ringEcon@0.17 (ring)`；
     - `selftest3` **6/6 全绿（`0.00e+0`）**；
     - `promote --dry --support=2` **全过（`exit=0`）**：`G(multi)=4.97 / G(long)=5.23`（`S=1.700`）、**珠闭环 ✓（`33.3%`，过期 `0.1/局`）**、反退化 `ok`（`41.4%`）、G4 `multi 0% / long 12.3%`、G5 `0%`；**这里的场B `1.16/局` 是 `multi` 口径**。地图 `allLong` 复核另登记 `场B 清场 0.03/局 < 0.3`（`okLong=0`，见 `champion-map/data/feasibility.tsv`），因此“五道全过”不能读成双桌形全过，long 无压清场仍是短板；
     - `long mastery` 历史摘要：聚能环 `23` 段、大雷 `25.0%`、**摄魂 `17.5%/局`（`n=3 17.5%, n=5 30.0%`）**；当时另称 hostile 双过，但原始回执未落盘。当前池复跑 hostile 摄魂为 **`n3 7.5% / n5 27.5%`**，`n3 < 10%` 线，**“hostile 双过”未复现，降级为待复核**；
     - `Arena B(6粒) +27.5039pt`（`arS=+0.1789 / arL=+0.1616 / arR=+0.5229`），`mixedfix MxC=+0.2593 / MxCL=+0.2346`、`H=56.8, S=1.59`；
     - `Stage 1` 120 格：**并集 `17/30`（`realWin 36.3%`）**、`drain` `7/120`（`>=3`；非零 `29/120`、`73` 次出手、实池 `14/40` 格 `24` 次），`Stage 2` 24 技、`drain rich Δ=+10.42% ±4.46%`；
     - 人席 `90210/90211` **`seatKill=0`**（`90210` 最坏 `3.5%/1.5%`，`90211` 最坏 `0.5%/6.0%`，`规则理解·自适应` 全 `0.0%`）；2P `standard` `rule 22.3% / legacy 20.5%`。
3. **两粒种子复现（`nov25-r3-econdrain-s26`, `seed=20261126`）**：同一配方复现 `long mastery` 三项过线（`ring` 13 段 / `bigT` `20.0%` / `drain` **`20.0%/35.0%`**）、2P `rule 22.5%` 及 `promote exit=0`（`G4 long 9.7% / multi 0.7% / G5 0%`），但 `Arena B -18.78pt`、`selftest3 exit 8`；故择优将 `s25`（`DR-R3E`）正式合入 `hard` 带，全池增至 `27` 枚（`hard 14 / soft 13`），填补 `RING-MINIT-CONT` 下放后 `hard` 带缺失的 `drain ≥3 格` 覆盖。
