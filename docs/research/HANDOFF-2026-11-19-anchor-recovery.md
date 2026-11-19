# HANDOFF · 2026-11-19 23:20 +08:00 —— B 轴 24 锚恢复交接（已完成 4/7，在盘 21/24）

> 目标：`ARENA24-PL-1118-PAGE`（[arena-league-1118-page.tsv](file:///d:/code/Epirus-Web/champion-map/data/arena-league-1118-page.tsv)）缺失的 7 枚 B 轴锚点全部按 `widOf(...)` 逐位复现并落回原路径，`git add -f`、`registry.tsv` 同步 `sha256`，跑通 `tools/arena-eval.mjs`、`tools/map-audit.mjs`、`tools/gate-all.mjs --auto`。
>
> **铁律提醒（[AGENTS.md](file:///d:/code/Epirus-Web/AGENTS.md) §24）**：仓内禁止直接 `rmSync` / `Remove-Item` 物理删除产物，清理只准挪到仓外隔离目录或用 `git worktree remove --force` 清临时 worktree。

---

## 一、总进度：`21 / 24` 已就位（本班恢复 `4 / 7`，均已通过 `widOf` 逐位核验）

| `idx` | `pack_id` | 目标路径 | 期望 `wid`（`lineage*.tsv`） | 本班状态 | 关键复现事实 / 阻塞点 |
|---:|---|---|---|---|---|
| 3 | `v7blk1-92` | [v7blk1-92.bak](file:///d:/code/Epirus-Web/docs/artifacts/v7blk1-92.bak) | `6b749817f5cfc725` | **✅ 已恢复落盘** | commit `071df683`；须配完整 `v7press3 + E4` env 栈（`EPIRUS_DIV_W=0.3`, `EPIRUS_BLOCK_W=0.2`, `EPIRUS_CLEAR_W=0.1`, `EPIRUS_TRAIN_SEAT_GAMES=24`, `EPIRUS_IMIT_TEACHER=pickDeepSaver`, `EPIRUS_IMIT_OVERRIDE=1`, `EPIRUS_IMIT_FRAC=0.5`）且**不要设 `EPIRUS_WALL_MS=0`**（`071df683` 下会 gen 0 超时退）。 |
| 5 | `MSB13-R1S791820660` | [MSB13-R1S791820660.js](file:///d:/code/Epirus-Web/docs/artifacts/night-adapt/MSB13-R1S791820660.js) | `5625693e5e54f30a` | **✅ 已恢复落盘** | commit `61ca3570`；热启 `MSB11-R2S306293884.js`，`seed=791820660`，`200 5 24 8`。 |
| 14 | `P9-CN-MINI-CONT` | [P9-CN-MINI-CONT.bak](file:///d:/code/Epirus-Web/docs/artifacts/obs6-coldstart/P9-CN-MINI-CONT.bak) | `70a2a6bc27cc64c7` | **✅ 已恢复落盘** | commit `bf303d0d` 重现。 |
| 21 | `TZ2C` | [TZ2C.bak](file:///d:/code/Epirus-Web/docs/artifacts/obs6-coldstart/TZ2C.bak) | `f5776ccecb333168` | **✅ 已恢复落盘** | commit `942bf9e4`；5 跳链真实 `--detDose` 阶梯为 `RINGEC6(3) → TZ1(3, b81628ef9d6750ee) → TZ2A(2, c97a2a5cf3772389) → TZ2B(1, 2a8db39908ad4a8d) → TZ2C(1, f5776ccecb333168)`（与 `a48691cd:scratch/arms/EQ-S4-*.bak.meta.json` 对表每跳吻合）。 |
| 12 | `DIV-V3-ANTIDEF` | `docs/artifacts/obs6-coldstart/DIV-V3-ANTIDEF.bak` | `0c31e13f5ab6ba9c` | **⏳ 缺前序 `V3a.snap0`** | 下游链完全已知；卡在 `OBS6-SHAPEDIST-V3S2`（`669145027f8020ae`）6 路原料中唯一缺失的 `v3as0`（`OBS6-SHAPEDIST-V3a.snap0.bak`）。 |
| 11 | `OBS6-LH6P` | `docs/artifacts/obs6-coldstart/OBS6-LH6P.bak` | `457e635123000e85` | **⏳ 缺前序 `OBS6-LH6`** | `GD16m-D1`（`332e009fbebe5f93`）已复现并落于 `D:/code/wt-repro-1115/scratch/arms/GD16m-D1.bak`；卡在 `OBS6-LH6`（`b768758160541e66`）。 |
| 13 | `DIV-LH6-HEAVY-S2` | `docs/artifacts/obs6-coldstart/DIV-LH6-HEAVY-S2.bak` | `6b7b5fc2dcba1834` | **⏳ 缺前序 `OBS6-LH6`** | 已从对话历史实证：**上游直接是 `OBS6-LH6.bak`**（不是 `OBS6-LH6P`，虽 `lineage` 记了 `LH6P`），是 `DIV-LH6-HEAVY.seg2000.bak` 的拷贝。 |

> 说明：已恢复的 4 枚包 `wid` 均与 `lineage*.tsv` 逐位一致；因 `META.ts` 不同，当前 `champion-map/data/registry.tsv` 中这 4 行的 `sha256` 尚未更新（`shaMatch=false`），且因 `docs/artifacts/` 在 `.gitignore`，**暂未 `git add -f` / 提交**，留待余下 3 枚补齐后一并入账。

---

## 二、未解 1：`DIV-V3-ANTIDEF`（卡在 `OBS6-SHAPEDIST-V3a.snap0` → `V3S2`）

### 2.1 已知后端精确配方（`v3as0` 一旦解出，下游零猜测直接一条龙跑完）

1. **合成 `OBS6-SHAPEDIST-V3S2.bak`（期望 `wid=669145027f8020ae`）**：
   - 真值来源：`08c29d18:scratch/zcode-1113-deps/fix-v3s2-provenance-1116.mjs`
   - 6 路线性平均：`{ v2s0: 0.25, sd: 0.2, v2s1: 0.15, v3as0: 0.15, v3as1: 0.15, v3bs1: 0.1 }`
   - 除 `v3as0` 外，其余 5 路均已在盘（`docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST{-V2.snap0,.bak,-V2.bak,-V3a.bak,-V3b.bak}`），实测 `wid` 分别匹配 `ca8d81c6b8799575 / 97a9254e178a1661 / 74cdf345a95ee15d / 94f1343cd158ebb1 / 4237f96c6604f876`。
2. **训练 `DIV-V3-PRESSURE.seg2000.bak`（期望 `wid=1c726b7bfaf2f345`，工作树 `D:/code/wt-repro-1118pm` @ `bf303d0d`）**：
   - 先将 `OBS6-SHAPEDIST-V3S2.bak`、`OBS6E9.bak`、`OBS6B2.bak`、`OBS6P9-S4000.bak` 复制到 `D:/code/wt-repro-1118pm/docs/artifacts/obs6-coldstart/`。
   - 运行（注意需跑过 seg2000 或 `--games=6000 --segEvery=2000`，以防影响轮前状态；`pg-train` `--seed=11181`）：
     ```bash
     node training/proto2/pg-train.mjs --up=docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3S2.bak --obs=obs6 --games=6000 --segEvery=2000 --batch=48 --lr=3e-4 --seed=11181 --arenaPool=names:pack:OBS6E9,pack:OBS6B2,pack:OBS6P9-S4000,ringspam,reflectspam,baguaspam,snipespam,protowall,targeter,heavyfire --dmgW=0.06 --beadSpendW=0.06 --defTax=0.04 --lamC=0.01 --lamF=0.06 --penDeadElec=0.04 --klW=0.12 --klTilt=snipe,sword,railgun,laserEye,bigT,miniT --klTiltMul=1.5 --out=scratch/arms/style1118/DIV-V3-PRESSURE.bak
     ```
   - 核验 `scratch/arms/style1118/DIV-V3-PRESSURE.seg2000.bak` `wid === '1c726b7bfaf2f345'`。
3. **训练 `DIV-V3-ANTIDEF.bak`（期望 `wid=0c31e13f5ab6ba9c`，同在 `D:/code/wt-repro-1118pm`）**：
   ```bash
   node training/proto2/pg-train.mjs --up=scratch/arms/style1118/DIV-V3-PRESSURE.seg2000.bak --obs=obs6 --games=4000 --segEvery=2000 --batch=48 --lr=3e-4 --seed=11186 --arenaPool=names:defend,guardspam,wall,reflectspam,ringspam,targeter,pack:OBS6E9,pack:OBS6P9-S4000 --dmgW=0.05 --defTax=0.03 --beadSpendW=0.05 --lamF=0.05 --klW=0.14 --klTilt=snipe,tank,railgun,laserEye,bigT,cannon --klTiltMul=2.0 --out=scratch/arms/style1118/DIV-V3-ANTIDEF.bak
   ```
   - 核验 `wid === '0c31e13f5ab6ba9c'`，拷到 `docs/artifacts/obs6-coldstart/DIV-V3-ANTIDEF.bak`。

### 2.2 `V3a` / `v3as0` 当前定位线索（不要重跑的已证伪假设）

按 [FINDING-2026-11-15-shapedist-v2.md](file:///d:/code/Epirus-Web/docs/research/FINDING-2026-11-15-shapedist-v2.md) 第 100 行在 `D:/code/wt-repro-1115v3`（`a0feae0f`）试跑 `V3a`：
- **我们跑出的结果**：`v3as0 = 3bef2ed82cd27df4`，`V3a(r1) = aed322bbe83400a1`（与在盘 `V3a.bak` `94f1343cd158ebb1` 有 10915/16411 维差异）；拿 `3bef2ed82cd27df4` 混 `V3S2` 得到 `72d8e3a9739af128`（非 `669145027f8020ae`）。
- **关键量化异常**：我们跑的 `6400` 组标签为 **`蓄能=375, 电磁炮=19, 真正的落雷=8, ring=0`**，而 `FINDING` 原文记录 `6400` 组标签为 **`charge=505, bigT=26, railgun=21, ring=2`**！
- **已排除（勿重复）**：
  - 将 `js/core/resolve.js` + `js/train/evo.js` 退回 `1b7e73cd`（与 `a0feae0f` 轮 0/1 损失逐字同；已恢复 `wt-repro-1115v3` 到 `a0feae0f`）。
  - 去掉 `supfit-gd.mjs` 的 `splitByShape`（`V3a-nosplit` 得 `snap0=9a5e3d886f8bad31 / final=81503734998bf012`；且 `STATUS-2026-11-15-training-shape-distill.md` §五明确写了 `splitByShape` 是在 V2/V3 之前已修）。
  - Round 0 探针已排：`--arenaPool=product`（`chg=48`）、`8:standard,8:long`、`--teacher4keys=ring,charge,railgun,bigT,laserEye`（`chg=370, ring=0`）、省略 `--arenaShapes` 用全 11 形（`rg=6, ring=0`）。
- **给下一棒的排查切入点**：
  1. 查 `V3a` 生成时间（`2026-11-15T12:42:40.234Z` = 20:42 +08:00，早于 `a0feae0f` 提交 21:53）与在盘 `V3a.bak` META（其中 `keySplit:0, detDose:3, objective:cand`，无 `teacher2..4` 字段是 `supfit-gd.mjs` 终盘 writer 未写）。
  2. 查为什么原版 `t4`（`T8-s114`）多出了 `+130 charge`、`+18 bigT`、`+2 ring`：试探 `--arenaShapes` 次序/集合（是否含 `3:standard` / `5:standard` / `8:multi4` 等）、`pickBresenham` 在 `335752ac..a0feae0f` 间写法、或 `--teacher3` / `--teacher4` 实际所传路径/权重（`T8-s114.js` 与 `js/bundled-champion-3p.js` 已实证同 `wid=24d8fa30bb0c3414`，可免怀疑）、或 `--classPow`/`--classCap`、`--dagger=1` 轮 1 是否有 `--pool` / `--dagtemp` 差异。
  3. 注：`V3S2` 的公式是**线性加权平均**（`v3as0` 权 `0.15`），注意只要能先从 Round 0 标签对齐 `bigT/ring/charge`（Round 0 探针单次约 3 秒），即可确认 `V3a` 环境并拿到 exact `v3as0`。

---

## 三、未解 2：`OBS6-LH6`（`b768758160541e66`）→ `OBS6-LH6P` + `DIV-LH6-HEAVY-S2`

### 3.1 已知下游配方（`OBS6-LH6.bak` 一旦解出即可连跑两锚）

1. **`OBS6-LH6P.bak`（`idx 11`，期望 `wid=457e635123000e85`，工作树 `D:/code/wt-repro-1115` @ `e2816572`）**：
   - 将 `OBS6-LH6.bak` 放至 `docs/artifacts/obs6-coldstart/OBS6-LH6.bak`（含 worktree 内），运行 `pg-train.mjs --up=docs/artifacts/obs6-coldstart/OBS6-LH6.bak --obs=obs6 --arenaPool=product --games=3000 --lamExp=0.04 --seed=7`（需检查 `e2816572:training/proto2/pg-train.mjs` 缺省 `--klW` / `--arenaShapes` 与 `FINDING-2026-11-15-day-obs6-longhorizon-zcode.md` §2 `OBS6-LH6P（KL 锚定 LH6）`；注意 `LH6P` 的 `ts` 在 `lineage-g3.tsv` 仅比 `LH6` 晚 **2 分 37 秒**）。
2. **`DIV-LH6-HEAVY-S2.bak`（`idx 13`，期望 `wid=6b7b5fc2dcba1834`，工作树 `D:/code/wt-repro-1118pm` @ `bf303d0d`）**：
   - 先拷入 `OBS6-LH6.bak`、`OBS6E9.bak`、`OBS6-SHAPEDIST-V3S2.bak`、`OBS6P9-S4000.bak`。
   - 运行精确命令行（源自本机 `transcript_full.jsonl` S761 / S1297）：
     ```bash
     node training/proto2/pg-train.mjs --up=docs/artifacts/obs6-coldstart/OBS6-LH6.bak --obs=obs6 --games=6000 --segEvery=2000 --batch=48 --lr=3e-4 --seed=11182 --arenaPool=names:pack:OBS6E9,pack:OBS6-SHAPEDIST-V3S2,pack:OBS6P9-S4000,ringspam,reflectspam,targeter,heavyfire,swordspam,combocounter --dmgW=0.03 --defTax=0.02 --lamExp=0.04 --lamF=0.04 --beadSpendW=0.04 --klW=0.18 --klTilt=railgun,bigT,sword,tank,holo,miniT,snipe --klTiltMul=2.0 --out=scratch/arms/style1118/DIV-LH6-HEAVY.bak
     ```
   - 取 `scratch/arms/style1118/DIV-LH6-HEAVY.seg2000.bak`，核验 `wid === '6b7b5fc2dcba1834'` 后拷至 `docs/artifacts/obs6-coldstart/DIV-LH6-HEAVY-S2.bak`。

### 3.2 `OBS6-LH6`（`b768758160541e66`）已试且未命中的全部组合（共 32 发，勿重复）

工作树：`D:/code/wt-repro-1115`（`e2816572`），固定 `--upstream=docs/artifacts/obs6-coldstart/OBS6E9.bak --seed=20261031`（前序 `GD16m-D1.bak` `wid=332e009fbebe5f93` 已核验在盘）：

- **第一批 `C1 / L1..L3 / M1..M4`**：
  - `C1`（`groups=1200, steps=400, lr=0.02, classPow=0.25, classCap=3, t1=GD16m, t2=E9(noChg)@0.76, t3=lasereye@0.10`）→ `45e30cf3eaf2e77e`
  - `L3 / L1a / L1b / L1c / L1d` → `c304ae1210b1fee6`, `c623c79cd178be5d`, `fcec951a67cc3507`, `e4c8dab4278e4374`, `c8ea932dd92472f0`
  - `M1..M4`（`steps=130, lr=0.015, groups=800/1200`）→ `dcb7764b99896605`, `ed036efff94a224e`, `f07f8d5f51f24999`, `6f51133f21e75bf3`
- **`N1..N4`（`groups=800, steps=400, lr=0.02`）**：
  - `N1`（`t1=GD16m, t2=E9(noChg)@0.76, t3=lasereye(laserEye,charge)@0.10, classPow=0.25, classCap=3`）→ `0261e97b4cf036e2`
  - `N2`（同 `N1` 去 `t2keys` 过滤）→ `f0d088bad2b73079`
  - `N3`（同 `N1` 改 `classPow=0.5, classCap=12`）→ `b3b05b8c63ff6167`
  - `N4`（`t1=lasereye, t2=E9(noChg)@0.76, t3=GD16m(ring,bigT,railgun,charge)@0.14`）→ `e35476a7a4744dbc`
- **`P1..P10`（轮换 `dagger=1` / `t1` / `t3` / `classPow` / `arenaShapes`）**：
  - `P1_dag1`（`N1` + `--dagger=1`）→ `98099ca42aadb391`
  - `P2_dag1_g1200`（`groups=1200, pool=1600, dagger=1`）→ `23567685e8ba31c3`
  - `P3_t1las_lr008`（`N4` + `steps=130, lr=0.008`）→ `20c4a36d190d5ee4`
  - `P4_t1las_not3k`（`t1=lasereye, t3=GD16m(ring,bigT,railgun,charge,ji)@0.14, groups=1200`）→ `394cc8018a9cf028`
  - `P5_noT3_g800` / `P6_noT3_g1200`（`t1=GD16m, t2=E9(noChg)@0.76`, 无 `t3`）→ `d9147c1bc2d3bfb6` / `c53012ca33415a12`
  - `P7_t3lasOnly`（`t3keys=laserEye` 去 `charge`, `groups=1200`）→ `03c968085849940f`
  - `P8_t1E9_t2GD`（`t1=OBS6E9, t2=GD16m@0.14, t3=lasereye@0.10, groups=1200`）→ `fbd429998adc8f52`
  - `P9_t1E9_c5_12`（`P2` + `classPow=0.5, classCap=12`）→ `8aebdcccde57febe`
  - `P10_prod_shp`（`C1` + `--arenaShapes=5:multi,5:long`）→ `bb3fcd41844e1b54`
- **`Q1..Q12`（在 `N1` 底上扫此前未测正交维度）**：
  - `Q1_e9params`（`steps=250, lr=0.012`）→ `842f202684401ff8`
  - `Q2_keyObj`（`--objective=key`）→ `3fefd827871a1dd9`
  - `Q3_shapeBal0`（`--shapeBal=0`）→ `fb94fa8fb1579849`
  - `Q4_prodPool`（`--arenaPool=product`）→ `a9cac719fe6eedbc`
  - `Q5_prod8shp`（`--arenaPool=product --arenaShapes=2:multi,3:multi,5:multi,8:multi,2:long,3:long,5:long,8:long`）→ `1060eb66ce06bad7`
  - `Q6_g1600` / `Q7_g2400` → `27fb387610c06c29` / `703d0a4b774e837b`
  - `Q8_s130_lr02`（`steps=130, lr=0.02`）→ `6a587c88a54dc9c4`
  - `Q9_g1200_s250`（`groups=1200, steps=250, lr=0.012`）→ `57429e3800fbe06f`
  - `Q10_g1200_key`（`groups=1200, objective=key`）→ `55262144504bcfa9`
  - `Q11_s200_lr01`（`groups=1200, steps=200, lr=0.01`）→ `afa2e11820c67247`
  - `Q12_ga2pg`（`t1=OBS6-GA2PG-8K, t2=E9(noChg)@0.76, t3=GD16m@0.14`）→ `d598d7bca2898d26`

### 3.3 给下一棒的 `OBS6-LH6` 排查突破口

1. **为什么 `OBS6-LH6` 防御%骤降到 `5.9%` / `用卡=8`（[FINDING-2026-11-15-day-obs6-longhorizon-zcode.md](file:///d:/code/Epirus-Web/docs/research/FINDING-2026-11-15-day-obs6-longhorizon-zcode.md) line 57）？**
   - 同表 `OBS6-LH5` 为 `43.7%`（12 卡）、`LH5b` 为 `50.2%`（10 卡）、`LH7` 为 `41.8%`（13 卡），唯独 `LH6` 是 **`5.9%` 防御、`G_M=2.87`**。
   - **重要疑点**：可用 `tools/behavior-profile.mjs`（或简短 eval）测一下上面已生成的 `LH6-N1.bak` / `LH6-Q4` 等，看哪一档真的把防御压到了 ~6%；此外检查：
     - `OBS6-LH2`（从 `OBS6-GA2PG-8K.bak` 按 `game` 蒸馏重造 `LH2`）是否作为 `t1` / `t4` 参与（`LH4` 明确含 `GD16m/lasereye/LH2`）。
     - `OBS6-LH6` 是在 `e3bec149` 之后、`e2816572` 提交之前（`13:05 +08:00`）跑出的：**check `supfit-gd.mjs` 中 `--classPow`/`--classCap` 当时的初始版本**（例如 `STATUS` 初版写 `--classPow=0.5 --classCap=12`，到 `abfefc9f` 才改成 `0.25/3`，需留意初版实现是否 `minW` 或 `guard/oracleDef` 分支有细微差异；注意 `git diff e3bec149..e2816572 -- training/proto2/supfit-gd.mjs`）。
     - `--teacher=pack:scratch/arms/GD16m-D1.bak --teacher2=pack:docs/artifacts/obs6-coldstart/OBS6E9.bak --teacher2frac=0.76`（**无 `teacher3`** 时若不限 `t2keys`？未测 `noT3 + no t2keys`；或 `t1=OBS6E9` + `t2=GD16m@0.14` 无 `lasereye`；或 `t1=GD16m` + `t2=E9@0.85` 含与 `t3` 碰撞导致实际占 `76%`！注意 `pickBresenham` 里若 `t3frac=0.10` 且 `t2frac=0.84`，`t2` 实际组份额才是 `76%`！）。
     - `--arenaShapes` 组合（如 `2:long,3:multi,3:long,5:multi,5:long` 或 `3:multi,3:long,5:multi,5:long` 等）。
     - `--detDose=0` 或其它默认值、或者 `Q1..Q12` 未组合交叉（如 `product` + `classPow=0.5/12`、`t1=E9, t2=GD16m@0.14, t3=lasereye@0.10` 配 `steps=130/lr=0.015` 或 `no t3` 等）。

---

## 四、现场 Git Worktree 与收尾清单

### 当前盘上工作树（均干净可用，已完工的 `wt-repro-0919` / `1111` / `1118` 已移除）
- `D:/code/Epirus-Web` (`main` @ `87c58dcb`) —— 已落盘 21/24 锚点（含本班 4 枚：`v7blk1-92.bak`, `MSB13-R1S791820660.js`, `P9-CN-MINI-CONT.bak`, `TZ2C.bak`）。
- `D:/code/wt-repro-1114` (`3b92c0e8`) —— 已产出验证过的 `GD16m-D1.bak`（`wid=332e009fbebe5f93`）。
- `D:/code/wt-repro-1115` (`e2816572`) —— `OBS6-LH6` / `OBS6-LH6P` 专树（`scratch/arms/GD16m-D1.bak` 与 `LH6-*.bak` 在内）。
- `D:/code/wt-repro-1115v3` (`a0feae0f`) —— `V3a` / `V3S2` 专树（已重置 `resolve.js/evo.js` 回 `a0feae0f` 干净状态，`v7blk1-92.bak` / `T8-s114.js` 等原料在位）。
- `D:/code/wt-repro-1118pm` (`bf303d0d`) —— `DIV-V3-ANTIDEF` & `DIV-LH6-HEAVY-S2` 专树。
- `C:/Users/14765/AppData/Local/Temp/epirus-v7-1008` & `1009` —— 先前 `Q-s47` 遗留 worktree（`Q-s47` 已在主仓）。

### 余下 3 锚全部落盘后的收尾步骤
1. 用 `wid` 核对脚本确认 `arena-league-1118-page.tsv` **`24 / 24`** `wid` 全部命中。
2. 对所有新落盘文件执行 `git add -f docs/artifacts/...`。
3. 更新 [registry.tsv](file:///d:/code/Epirus-Web/champion-map/data/registry.tsv) 中**仅因 `META.ts` 不同而变化**的各新落盘行 `sha256`（`wid` 已逐位同），并同步 [ARTIFACT-LOSS-1119.md](file:///d:/code/Epirus-Web/docs/ARTIFACT-LOSS-1119.md) / `ARTIFACT-LOSS-1119.tsv` 与 [ANCHOR-LOSS-2026-11-19.md](file:///d:/code/Epirus-Web/docs/research/ANCHOR-LOSS-2026-11-19.md)。
4. 跑门禁与验收：`node tools/arena-eval.mjs`、`node tools/map-audit.mjs`、`node tools/gate-all.mjs --auto`。
5. `git worktree remove --force` 清掉 `D:/code/wt-repro-*`（产物拷进主仓并验过再移，严禁删主仓在册路径），提交（按用户授权再 push）。
