# 训练参数固定台账（Training Run Log）

> **用途**：本文件作为**固定长期台账**，自 `2026-11-21` 起每次新开训练臂、蒸馏、融合或入池候选实验均须在此登记一笔真实参数与读数。  
> **旋钮真源红线（`AGENTS.md §11`）**：环境变量旋钮的权威清单与定义仅维护于 [`training/TRAINING-KNOBS.md`](../training/TRAINING-KNOBS.md)（全集与在用状态以该表为唯一来源，**本文禁止第二处复抄**）；本文只登记**当次实验实际传入的非默认 CLI `--flag`、非默认环境变量覆写、上游教师与输出读数**。

---

## 一、记录规矩（开工前 & 落盘后必填）

1. **防重复实验（`AGENTS.md §15`）**：开跑前先查 [`docs/METHODOLOGY.md`](METHODOLOGY.md) 与 `docs/research/`（`FINDING-*` / `PROPOSAL-*`），在「假设与单变量说明」列明**是否已证结论**与唯一受控变量。
2. **第一枚产物即时验尸（`AGENTS.md §16`）**：新臂第一枚 `.bak` 落盘后立即运行 `training/README.md` §六验尸或 `node training/train.mjs --selftest`，确认 `v:92 / arch:S1o / params=16411`（`obs6`）。
3. **同 seed 不动路径与 RNG 核对（`AGENTS.md §17–§18` / `METHODOLOGY §150`）**：
   - `supfit-gd.mjs` 的 `--seed` **只写 `META`，不进入训练 LCG RNG**——不要设计「同配方换 `--seed` 平抑双峰」的无效对比臂；
   - 凡声称「默认路径逐位不变」必须附同一 `seed` 改动前/后 `wid` 全等记录；方向性机制新旋钮须配正/反镜像臂。
4. **三列同看与完整入池链（`AGENTS.md §7, §20`）**：评测必须并列 **A（考卷）/ B（24 锚 `arenaB` 与极差）/ C（`(A+B)/2`）** 及 `champ=` 夹具，不得单看一轴下结论；入池固定走 `promote --dry --support=2` → `measure-point --bake` → `pool-add` → `gate-all --auto`。

---

## 二、常用 2.0 产线 `--flag` 速查边界（以源码 `rejectUnknownFlags` 为准）

> 统一入口：`node training/train.mjs --mode=pg|supfit|distill|fuse|selftest [...]`

- **`pg-train.mjs`（强化 + 行为塑形 + KL 锚）**：`--up` / `--upstream`, `--obs`, `--games`, `--batch`, `--lr`, `--seed`, `--lamC`, `--lamF`, `--lamExp`, `--penDeadElec`, `--dmgW`, `--beadSpendW`, `--defTax`, `--temp`, `--out`, `--tag`, `--baseline` (`mean|ridge`), `--probe`, `--rollbackTol`, `--criticProbe`, `--ridgeL2`, `--ridgeFeat`, `--seatDrop`, `--seatL2`, `--segEvery`, `--snapEvery`, `--shapeKey`, `--shapeW`, `--shapeModes`, `--klModes`, `--onlySeg`, `--klW`, `--klTilt`, `--klTiltMul`, `--arenaPool`, `--arenaShapes`
- **`supfit-gd.mjs`（多教师蒸馏 + DAgger + 键道轮替）**：`--upstream` / `--up`, `--obs`, `--groups`, `--lr`, `--steps`, `--seed`, `--out`, `--tag`, `--objective` (`key|cand`), `--dagger`, `--defWeight`, `--oracleSubset`, `--dagtemp`, `--pool`, `--shapeBal`, `--classPow`, `--classCap`, `--keySplit`, `--teacher`, `--teacher2` / `3` / `4`, `--teacher2frac` / `3frac` / `4frac`, `--teacher2keys` / `3keys` / `4keys`, `--teacher2Shapes` / `3Shapes` / `4Shapes`, `--shapeTeachers`, `--rolloutMode`, `--arenaPool`, `--arenaShapes`, `--rareOnly`, `--rareFrac`, `--labelKindsMin`, `--labelSupportMin`, `--smoke`, `--regen`, `--detDose`, `--seatDrop`, `--seatL2`, `--snapEvery`, `--segEvery`, `--onlySeg`, `--winOnly` (`0|1|2`), `--teacherGate`, `--teacherGateT`, `--teacherGateHp`, `--selfTeacher`
- **`pack-fuse.mjs`（同形状权重插值）**：`--a`, `--b`, `--t`, `--out`, `--arm`（产物只作教师或双父系再蒸馏起点，见 `METHODOLOGY §148.6`）

---

## 三、总实验流水表（按时间倒序追加，最新在最上）

| 日期 / 班次 | 臂 ID | 假设与唯一控制变量 | 代码基线 (`commit`) | 模式 | 起点 (`--up` / `wid`) | 教师 / 对手池栈 | 核心非默认 `--flag`（含非默认 `env`） | 产物路径 & `wid` | 关键读数（`A / B / 极差 / promote`） | 裁定 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-21 晚 | `nov21-rod-rm` | 换高 `ep` 底座：`RING-MINIT-CONT` 起跑 + `rod` 专科（解决 `EQ-S4-E9` 不蓄 `3 ep` 问题） | `supfit` 专科版 | `supfit` | `RING-MINIT-CONT.bak` (`225404c8`) | `pack:RING-MINIT-CONT` + `rod@0.35` / `RINGB9,heavyfire,ringspam,deepsaver` | `--teacher2keys=rod --rareOnly=rod --rareFrac=0.35 --arenaShapes=5:multi,5:long --pool=5000 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | `scratch/arms/nov21-rod-rm.bak` · `61a48916f9cdb525` | `arenaB=-1.8635pt`（极差 `31.3`）；条件 `rod` **`8/100` 局**（vs `2×RINGB9+2×TF20`） | **留档候选**（`soft` 强位，待过线验 `promote` / PG 提强） |
| 2026-11-21 晚 | `nov21-rod-dsp0c` | `EQ-S4-E9` 上放大采样池（`pool=8000`）+ 高 `ep` 脚本池 + `rod@0.50` | `supfit` 专科版 | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `rod@0.50` / `deepsaver,farmer,ringspam,heavyfire` | `--teacher2keys=rod --rareOnly=rod --rareFrac=0.45 --pool=8000 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | `scratch/arms/nov21-rod-dsp0c.bak` · `10277ec16d2b813a` | `避雷针` 标签仍仅 `3/4800`（`t1` 不常在 `me.ep≥3 ∧ 敌雷威胁` 共现） | **机制诊断**（促成改换 `RING-MINIT-CONT` 底座） |
| 2026-11-21 晚 | `nov21-mirror-dsp0` | **DS-P0 镜面补盲**：`EQ-S4-E9@0.70 + mirror(pickMirrorSpam)@0.30` | `supfit` 专科版 | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `mirror@0.30` / 多人 `3/5/8` 桌 | `--teacher2keys=mirror --rareOnly=mirror --rareFrac=0.35 --arenaShapes=3:multi,5:multi,5:long,8:multi --pool=5000 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | `scratch/arms/nov21-mirror-dsp0.bak` · `192b029b3734a356` | `arenaB=+8.9883pt`（极差 `35.6`）；`G4[multi] 激光剑 72.7%>60%` ‖ `G5[long] 50%>40%` 阻断；部署 `mirror` 仅 `0–1/100` | **淘汰留档**（12 组 `(t1,t2)` 分散 `cand` 梯度且挤占主线） |
| 2026-11-21 晚 | `nov21-rod-dsp0b` | `EQ-S4-E9@0.65 + rod@0.35`（配 `RINGB9,heavyfire,ringspam` + `--rareOnly=rod`） | `supfit` 专科版 | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `rod@0.35` / `RINGB9,heavyfire,ringspam` | `--teacher2keys=rod --rareOnly=rod --rareFrac=0.35 --arenaShapes=3:multi,5:multi,5:long,8:multi --pool=5000 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | `scratch/arms/nov21-rod-dsp0b.bak` · `d6bb398dca72ed81` | `arenaB=+10.4475pt`（极差 `33.9`）；标签 `10/4800`，条件 `rod 1/100` 局 | **留档淘汰**（`rod` 过稀） |
| 2026-11-21 晚 | `nov21-rod-dsp0` | 无 `rareOnly` 基线对照组：`EQ-S4-E9@0.70 + rod@0.30` | `supfit` 专科版 | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `rod@0.30` / `EQ-S4-E9,MX6-GD-TF20,RINGB9,ringspam,heavyfire,aggro` | `--teacher2keys=rod --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | `scratch/arms/nov21-rod-dsp0.bak` · `17c8dbf0cd00df3a` | 标签 `4/3401`，条件 `rod 2/100` 局 | **留档对照** |
| 2026-11-21 晚 | **`nov21-taunt-dsp0b`** | **DS-P0 挑衅补盲（专科教师 `taunt`）**：替代低效 `ration6t` | `supfit` 专科版 | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9@0.70` + `taunt@0.30` / 默认 `11` 形 | `--teacher2keys=taunt --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | [`docs/artifacts/nov21-taunt-dsp0b.bak`](../docs/artifacts/nov21-taunt-dsp0b.bak) · `db7883520de2e2fe` | `arenaB=+17.9177pt`（极差 `33.7` / `arR=+35.83pt`）；`seatKill=0`（`multi` 7/7 全 `0%`）；`promote` 上线档 `pass`（`G4 0%/28%`, `G5[long] 29%≤40%`）；Stage1 **`taunt 95/120` 格（`1,822` 次）** | **✅ 入池 `hard`**（`invited=0`） |
| 2026-11-21 晚 | `nov21-taunt-dsp0` | 初探用 `ration6t` + `--teacher2keys=taunt`（对照：验证 `taunt` 在 `ration6t` 尾部被饿死） | `deb32cf5` | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `ration6t@0.30` | `--teacher2keys=taunt --rareOnly=taunt --rareFrac=0.3 --groups=3000 --steps=400 --lr=0.001 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | `scratch/arms/nov21-taunt-dsp0.bak` · `8eafc0bb668712e4` | `t2` 仅命中 `3` 次（`挑衅=1/6000`） | **淘汰**（促成新增专用 `tauntPick`） |
| 2026-11-21 晚 | **`nov21-purify-dsp0`** | **DS-P0 净化补盲**：`EQ-S4-E9@0.70 + purify@0.30`（vs 旧 `t2b` 反置配比 `-64.4pt`） | `deb32cf5` | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9@0.70` + `purify@0.30` / `day1119-det-gd,EQ-S4-E9,aggro` | `--teacher2keys=purify --rareOnly=purify --rareFrac=0.3 --arenaShapes=5:multi,5:long --groups=2400 --steps=500 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6` | [`docs/artifacts/nov21-purify-dsp0.bak`](../docs/artifacts/nov21-purify-dsp0.bak) · `b4a65ee4437584cf` | `arenaB=+14.0432pt`（极差 `50.1` / `arR=+18.61pt`）；`promote` **0 阻断**（珠闭环 `100%`）；`seatKill=0`；条件净化 **`0.27/局`** | **✅ 入池 `hard`**（`invited=0`） |
| 2026-11-20 凌晨 | `night2-E7-cannon30` | DS-P0 换专科对比：主锚 `EQ-S4-E9(0.70)` + 专科由 `detonate` 改为 `cannon(0.30)` | — | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `cannon@0.30` | `seed=2026112006`；其余同 `night2-E1-det-strong` | `4dbee487194173f4` | `arenaB=-39.64pt`（极差 `24.3`） | **淘汰**（比 E1 差 `9.3pt` 且更抖） |
| 2026-11-20 凌晨 | `night2-E5-det-share25` | `AGENTS §18` 镜像对照：`detonate` 专科份额 `0.30 -> 0.25` | — | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `detonate@0.25` | `seed=2026112004`；其余同 `night2-E1-det-strong` | — | `arenaB=-25.10pt`（极差 `28.4`） | **参考否定**（份额双侧均塌且极差扩大） |
| 2026-11-20 凌晨 | `night2-E4/E6-t2str-det` | 换强锚对比：`EQ-S4-E9` 换 `MX5-GD-T2STR`（原拟 E6 测 `--seed`，实证与 E4 逐位同 `wid` ⇒ 立 `§150`） | — | `supfit` | `MX5-GD-T2STR.bak` (`2648c672`) | `pack:MX5-GD-T2STR` + `detonate@0.30` | `t1/t2=4540/2060`, `seed=2026112003/2026112005` | `aeae5686ca04a5a3` | `arenaB=-25.09pt`（极差 `24.5`，双峰 `-10.5` / `-31~-35`） | **留档候选**（上限高但固有环境方差双峰） |
| 2026-11-20 凌晨 | `night2-E3-det-share35` | 剂量上调对比：`detonate` 专科份额 `0.30 -> 0.35` | — | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9` + `detonate@0.35` | `seed=2026112002`；其余同 `night2-E1-det-strong` | `a6c4605f610c424b` | `arenaB=-39.51pt`（极差 `53.2`，`-17~-71`） | **淘汰**（抖动爆炸） |
| 2026-11-20 凌晨 | `night2-E2-det-pg` | `day1119-det-realpg.seg1500` 上跑强真包混训 `PG` 续训 | — | `pg` | `day1119-det-realpg.seg1500` | 真包×5 + `aggro,wall,ringspam` | `--baseline=ridge` 等（洗塌旧成果 `-81 -> -105`） | — | `arenaB=-104.67pt` | **淘汰**（det 系续训 `lr/kl` 需单变量重校） |
| 2026-11-20 凌晨 | **`night2-E1-det-strong`** | **DS-P0 首证**：强包作底座+主教师（代替弱 `toolkit`）+ `detonate` 专科 `0.30` | — | `supfit` | `EQ-S4-E9.bak` (`a847eb3a`) | `pack:EQ-S4-E9@0.70` + `detonate@0.30` | 强锚定配比 `0.70/0.30`（具体步数/组数继承 EQ 蒸馏模板） | [`docs/artifacts/night2-E1-det-strong.bak`](../docs/artifacts/night2-E1-det-strong.bak) · `862e0ef47bcf06f7` | `arenaB=-30.36pt`（极差 **`10.6`**）；`promote` **0 阻断全过**；Stage1 `16/30` / Stage2 `23` 技 | **✅ 入池 `soft`**（第 25 枚；待补 `seat-rule`） |
| 2026-11-19 白班 | `day1119-det-realpg.seg1500` | 在 `det-gd` 上接真强包 `--arenaPool` 1500 局 PG 抬强度 | `v2.1.8` 时期 | `pg` | `day1119-det-gd` | 真强包 `--arenaPool=names:pack:...` | `--segEvery=1500`（截 `seg1500` 节点） | `scratch/arms/`（未入池） | `arenaB=-81.35pt`；引爆率 **`140%/156%`**；用卡 `13/8`；`G4[long] 62.7%` / `场A 6.2%` | **停于诊断**（差 G4长/场A） |
| 2026-11-19 白班 | `day1119-det-gd` | `MX8-R6C-KL` + `toolkit + detonate(0.35)` 打通 2.0 天火贴爆闭环 | `v2.1.8` 时期 | `supfit` | `MX8-R6C-KL.bak` (`ece05168`) | `toolkit` + `detonate@0.35` | `detonate` 份额 `0.35` + `closeCurseStorm` | `scratch/arms/` | `arenaB=-88.85pt`；引爆率 **`123%/158%`**；`firestorm 16%/19%` | **作 PG/咒源上游** |
| 2026-11-19 白班 | `day1119-cannon-pg` | `day1119-cannon` 系列入池试水 | `v2.1.8` | `pg` | `day1119-cannon-gd` 链路 | 混合真包 PG | — | `ae28c0aaf8bf6098`（`v2.1.9` 已退役并删） | `arenaB=-82.28pt`；`P2=+0.4077 / P3=+0.1677 / P5L=+0.0828`；复测 `seatKill=4` | **`v2.1.9` 已退役** |

---

## 四、单次新实验登记卡片模板（每次新建实验复制到本节顶部并填写）

```markdown
### [YYYY-MM-DD] <ARM-ID>
- **代码基线**：`<git rev-parse --short HEAD>`（分支 / worktree）
- **预注册假设与唯一变量**：<说明对照基线、仅改了哪 1 个变量，以及为何不重复 METHODOLOGY 已有结论>
- **可重跑完整命令**（`train.mjs` 标准形式）：
  ```bash
  node training/train.mjs --mode=<pg|supfit|fuse> ... --out=scratch/arms/<ARM-ID>.bak
  ```
- **非默认环境变量**（如有；全量定义只查 `training/TRAINING-KNOBS.md`）：`无` / `EPIRUS_...=...`
- **验尸与指纹**：`v:<92> | arch:<S1o> | params:<16411> | wid:<...>`
- **核心读数**（标明 `champ=` 夹具）：
  - **A 轴**（短 C / 长 C / `G4` / `G5` / `墙` / `场A`）：
  - **B 轴**（`arenaB` 中位 / 极差 / 6 种子明暗点）：
  - **C 轴 & `promote --dry --support=2`**：
  - **覆盖 & 人席**（`pool-skill-report` / `seatKill`）：
- **最终裁定**：`入池(hard|soft) / 留作教师 / 留档淘汰`
```
