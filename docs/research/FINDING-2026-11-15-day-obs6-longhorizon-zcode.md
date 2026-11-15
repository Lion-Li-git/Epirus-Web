# FINDING · 2026-11-15 早/白班（ZCode）：跨构修虫、`ep=2` 保留下的长程珠经济、激光眼审计与鼓励电磁炮实测

> **承接关系**：承 [STATUS-2026-11-15-night-zcode.md](file:///d:/code/Epirus-Web/docs/research/STATUS-2026-11-15-night-zcode.md)（§三⁶ 早班修虫与 T12 终判）与
> [FINDING-2026-11-15-night-distill-curriculum-zcode.md](file:///d:/code/Epirus-Web/docs/research/FINDING-2026-11-15-night-distill-curriculum-zcode.md)；实时接力账见
> [STATUS-2026-11-15-day-longhorizon-zcode.md](file:///d:/code/Epirus-Web/docs/research/STATUS-2026-11-15-day-longhorizon-zcode.md)。
> 覆盖时段：2026-11-15 `08:00–14:25 +08:00`（提交 `fdce295f` / `e1be9b1c` / `e3bec149` / `e2816572` / `abfefc9f`，版本号升至 `v2.0.8`）。

---

## 一、早班两处静默训练虫与普查勘误（`fdce295f` / `e1be9b1c`）

### 1.1 虫①：跨构 `pack:` 教师 `.p2` 标签被剥导致静默按错偏移切片

- **根因**：[policy2.js](file:///d:/code/Epirus-Web/js/train/policy2.js) 用参数向量上的 `.p2` 属性标记 2.0 架构；但 [supfit-gd.mjs](file:///d:/code/Epirus-Web/training/proto2/supfit-gd.mjs) 旧 `buildTeacherPick` 对 `loadChamp(W0, ...)` 取回的参数调用 `Float64Array.from(...)`，把 `.p2` 剥除后交回只装载 `obs6`（`16411` 维）的 `W.EpirusTrainer`。
- **实际后果**：`GD16m-D1`（`obs5`, `12393` 维）与 `CB3-s13`（`obs3b`, `7993` 维）被错按 `obs6` / v7 偏移读取。对照实测：
  - 原生 `GD16m-D1`（5 局）：`{ji:150, curse:25, firestorm:50, ring:75, bigT:25}`（`chargeProfile 30 局 spent=209/209, 0% 浪费`）；被剥 `.p2` 后退化为 `{ji:230, gun:211, ...}`（`0 ring / 0 bigT`）。
  - 原生 `CB3-s13` 被剥 `.p2` 后退化为 `66% guard/reflect/bagua`（`0 drain / 0 ring / 0 bigT`）。
  - 这直接解释了早班 `T12` 期间 `GD16m` `40292` 次咨询仅命中 `1` 次，以及前序 `E8c`/`T11` 中“GD16m 龟化”的假象。
- **修复**（`fdce295f`）：[supfit-gd.mjs](file:///d:/code/Epirus-Web/training/proto2/supfit-gd.mjs) 保留 `.p2` 并通过教师各自沙箱 `W0.EpirusTrainer.policyChooserN` 分发决策；修复后单采 `GD16m-D1` 200 组立得 `ring=27, charge=18, railgun=18, bigT=7`。

### 1.2 虫②：`R.SK` 驼峰键 vs 蛇形键静默失效 + 普查勘误（`e1be9b1c`）

- **根因**：引擎 [rules.js](file:///d:/code/Epirus-Web/js/core/rules.js) 真值为驼峰键 `bigT / miniT / laserEye / dualGun`；早先实验参数与普查脚本误写为 `big_t / mini_t / laser_eye`，而训练脚本无键名校验导致副教师按空键静默回落。
- **修复与重测**：`supfit-gd.mjs`（`--teacher2/3/4keys` / `--rareOnly`）与 `pg-train.mjs`（`--shapeKey` / `--klTilt`）统一加入 `R.SK` fail-fast 门（含 `big_t -> bigT` 等提示，`exit 2`）；`e1be9b1c` 修正普查脚本后重跑 `17` 枚既有包，确认 **`bigT` 实为 `2/17`（`GD16m` + `GD6a-TILT`）**，`miniT / mine / laserEye / cannon` 仍真 `0/17`，`tank / transfer / drain / ring / railgun` 行不受影响。

### 1.3 三层长程结构瓶颈（复核 T12 后仍阻断长程出招的机制）

1. **短视经济陷阱（`ep >= 3` 为 `0.0%`）**：15 局 `long` 自对局下，`OBS6E5c`（3007 手 `maxEp=2, chg@2=15, chg@3+=0`）、`OBS6E9`（3164 手 `ep>=3 0.0%, chg@2=20, chg@3+=1`）、`OBS6P9-S4000`（3336 手 `maxEp=2, chg@2=61, chg@3+=0`）全部在 `ep=1–2` 用枪/剑/狙花光资金，高费卡全剧合法窗口仅 `0–1` 次（对照 `GD16m-D1`：`ep>=3 22.8%, ep>=4 7.6%, ringLeg=293, bigTLeg=73`）。
2. **`ep=2` 蓄电珠必废闭环**：`CHARGE_MIN_EP = 2`（[evo.js](file:///d:/code/Epirus-Web/js/train/evo.js)）在 `ep=2` 放行蓄能，耗 1 `ep` 后仅余 `1 ep`，而 `railgun` 需 `2 ep + 1 elec`（[state.js](file:///d:/code/Epirus-Web/js/core/state.js#L155-L157)），能量珠回合末又清空（[resolve.js](file:///d:/code/Epirus-Web/js/core/resolve.js#L1320-L1325)），导致 `E5c 77/78 (98.7%)`、`E9 28/29 (96.6%)`、`P9-S4000 179/179 (100.0%)` 蓄出的电珠次回合必买不起炮。
3. **逐手回落扼杀副教师**：在 `--rolloutMode=step` 下，高阶副教师 `GD16m` 在低 `ep` 时选 `ji` 蓄钱会越出 `--teacher2keys` 范围而立即回落至 `v7blk1/E6c/E9` 把钱花光，自身永远踩不到 `ep >= 3`（修完 `.p2` 后混跑仍 `t2Hits=0`）。

---

## 二、保留 `ep=2` 激光眼蓄能下的珠经济打通：`game` 滚局、`--lamExp` 与 `--classPow/--classCap`

遵循用户裁定**不砍 `CHARGE_MIN_EP = 2`**（保护 `ep=2 -> charge#boom -> laserEye` 连招），午间通过纯 CLI 旗标（未增 env 旋钮，总 env 集仍合规）打通长程珠经济：

1. **[supfit-gd.mjs](file:///d:/code/Epirus-Web/training/proto2/supfit-gd.mjs)**：
   - `--rolloutMode=game`（缺省 `step` 不变）：整局由单名教师用原始策略完整跑到深回合（`ep=3–6` / `ringStreak` / `boom`），仅在收集标签时按各教师 `keys` 过滤训练样本。
   - `--classPow=<p> --classCap=<c>`（缺省 `1` / 无上限）：把类逆频权重从激进的 `1/freq` 缓和为 `(1/freq)^classPow` 并设上限，防止极端稀疏键样本冲垮强攻防底座。
2. **[pg-train.mjs](file:///d:/code/Epirus-Web/training/proto2/pg-train.mjs)**：
   - `--lamExp=<w>`：按局内 `row.evs` 时序追踪产珠 `CHARGE`（`delta > 0`），一旦后续被 `delta < 0` 消耗则清零，**仅在 `beadExpire` 过期浪费时对对应那次 `CHARGE` 扣分**——零误伤 `ep=2 -> charge#boom -> laserEye`，精准打击 `ep=2 -> charge#elec -> 过期`。
   - `--shapeKey` 扩展为多键加权 `k1:w1,k2:w2`（均过 `R.SK` 校验）。

### 实验矩阵全谱汇总（`OBS6-LH1–LH8R4`）

1. **首波打通珠经济（`LH1–LH4P`，录自 `STATUS` 基线测量）**：
   - `OBS6-LH2`（干净底座 `GA2PG-8K` + `game` 蒸馏）：打通 **79.4%（`long 166/209`，`elec:109/boom:57`）/ 79.0%（`multi 83/105`）双珠花掉**，并将“买得起电磁炮却不射”压到 **`0.0% (0/86)`**，用卡 **13**、`G_M/G_L = 6.67 / 5.99`，但纯冷启动蒸馏 `C5长` 仅 `0.0331`。
   - `OBS6-LH4`（`OBS6E9` 底座 `--dagger=0`、`65% E9` 无 `charge` + `GD16m/lasereye/LH2`）：`C5长` 提至 `0.1117`、用卡 **10**、`0.0% (0/76)` 惜炮、花珠 `60.8% / 51.0%`；续 PG `LH4P.seg1000` 保持 `63.3% / 66.3%` 花珠与 `C5长 0.0949`，但默认 `1/class` 类权仍折损 `E9` 战力。

2. **次波 `--classPow/--classCap` + 强且宽候选统一重测（`seg-eval` 120 局 × 4 卷 + `mem-probe-e6` 120 局 × 8 核，本次收工前全量复核）**：

| 候选臂 | 核心配方 / 变量 | C5短 | C5长 | X̄₄短 / 长 | 用卡 | 防御% | G_M / G_L | `mem-probe-e6`（R / H / **Gap**） | 结论 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| `OBS6-LH5` | `E9` 底座 + `classPow=0.4, classCap=6` (`t2=0.65`) | 0.1096 | 0.1777 | 0.0854 / 0.1051 | 12 | 43.7% | 7.75 / 5.92 ✓✓ | 39.3% / 41.9% / **-2.6pt** | SFT 强度拉回至 `0.18` |
| `OBS6-LH5b` | `lr=0.008, steps=65, classPow=0.25, classCap=5` | 0.1012 | 0.1036 | 0.0172 / 0.0511 | 10 | 50.2% | 5.75 / 5.74 ✓✓ | 20.1% / 22.2% / **-2.1pt** | 步数减半导致强度偏弱 |
| **`OBS6-LH6`** | `E9` + `t2=0.76, classPow=0.25, classCap=3`（**入图**） | 0.1376 | 0.2054 | 0.1256 / **0.2039** | 8 | 5.9% | 2.87 / 6.46 ✗ | 52.2% / 65.8% / **-13.6pt** | 长程双峰破 `0.20` 且最干净；防薄待 PG |
| **`OBS6-LH6P`** | `LH6` + `product` PG `3000g` (`lamExp=0.04`, **入图**) | **0.1729** | **0.2058** | **0.1395** / 0.1834 | **13** | 28.8% | **7.56 / 4.69** ✓✓ | 50.7% / 59.9% / **-9.2pt** | 综合最佳代表：13 卡、双 G✓、干净负 Gap |
| `OBS6-LH7` | `E9` + `t2=0.70, classPow=0.33, classCap=4.5` | 0.1180 | 0.1674 | 0.0528 / 0.1340 | 13 | 41.8% | 7.86 / 3.15 ✓✓ | 53.2% / 43.1% / **+10.1pt ✗** | 类权/配比越界，滑向**考卷过拟合** |
| `OBS6-LH8R` | `LH6P` + `:r1` 混桌 PG (`penDeadElec=0.06, s7`) | 0.1429 | 0.1705 | 0.0790 / 0.1367 | 7 | 6.6% | 3.18 / 4.55 ✓✓ | 41.4% / 40.1% / **+1.3pt ✗** | `r1` 偏移且 Gap 转正 |
| `OBS6-LH8R2` | `LH6P` + `:r1` 混桌 PG (`penDeadElec=0.06, s11`) | **0.1744** | 0.1880 | 0.1318 / 0.1730 | **13** | 40.7% | 7.35 / 4.40 ✓✓ | 52.9% / 63.3% / **-10.4pt** | 最强 `:r1` 混训臂，停于 promote 三道红线 |
| `OBS6-LH8R3` | `LH6P` + `:r1` 混桌强惩罚 (`penDeadElec=0.25, s19`) | 0.1288 | 0.1659 | 0.0814 / 0.1548 | 12 | **53.8%** | 4.74 / 3.73 ✓✓ | 49.4% / 51.0% / **-1.5pt** | 高压惩罚拉高防御至 53.8%，牺牲攻击强度 |
| `OBS6-LH8R4` | `LH6P` + 纯 `:r0` 强惩罚 `6000g` (`penDeadElec=0.25`) | 0.1333 | 0.1956 | 0.0483 / 0.1543 | **13** | 48.1% | 5.46 / 3.91 ✓✓ | 全程 **-6.9pt 至 -0.4pt** | 纯 `r0` 无补贴最高 `C5长`，验证 `rail` 正增量 |

- **过拟合边界实证**：`OBS6-LH6`（`-13.6pt`）、`OBS6-LH6P`（`-9.2pt`）、`OBS6-LH8R2`（`-10.4pt`）及 `LH8R4` 全分段（`1500g -6.9pt` → `3000g -4.9pt` → `4500g -3.9pt` → `6000g -0.4pt`）均守住负 `Gap`；一旦 SFT 降低底座比例并抬高类权重到 `classPow=0.33 / classCap=4.5`（`LH7`），`Gap` 立刻反转至 `+10.1pt`。

---

## 三、`OBS6-LH6` + `OBS6-LH6P` 串链入图与 `champion-map` 管线修复（`e2816572` / `abfefc9f`）

1. **断父与虚线根因定位及修复**：
   - [add-point.mjs](file:///d:/code/Epirus-Web/champion-map/pipeline/add-point.mjs) 原先仅检查直连一跳 `hotstartFrom` 是否已在图谱中：当直接父包 `OBS6-LH6` 尚未入图时，`OBS6-LH6P` 找不到 `hotstartFrom`，被迫退回近似祖先估计边——对应 [viewer.mjs](file:///d:/code/Epirus-Web/champion-map/viewer.mjs) 中无 `_idenBacked` 证据的 `kind=1` 虚线。
   - **已修**：`add-point.mjs` 新增 `--parent=<id>` 并增加局部 `.bak` 目录多跳 `hotstartFrom` 回溯；[measure-point.mjs](file:///d:/code/Epirus-Web/champion-map/pipeline/measure-point.mjs) 新增 `--reuse`（命中 `staging/` 子产物即跳过重测）与 `--readings=` / `--display=` / `--parent=` 透传。
2. **串链落地（`abfefc9f`）**：按父子顺序先入 [OBS6-LH6.bak](file:///d:/code/Epirus-Web/docs/artifacts/obs6-coldstart/OBS6-LH6.bak)（`wid=b768758160541e66`，`ruler H=40, S=1.248, Geff=3.483, distinctKeys=13`），再入 [OBS6-LH6P.bak](file:///d:/code/Epirus-Web/docs/artifacts/obs6-coldstart/OBS6-LH6P.bak)（`wid=457e635123000e85`，`ruler H=36.8, S=2.122, Geff=8.351, distinctKeys=16`），在 [lineage-g3.tsv](file:///d:/code/Epirus-Web/champion-map/data/page/lineage-g3.tsv) 上组成全实线血统链 **`OBS6E9 —> OBS6-LH6 —> OBS6-LH6P`**（`parentSrc=seedpack-wid`，`shot.mjs` **100 PASS ‖ 0 FAIL**，`registry.tsv` `951` 行）。

---

## 四、为什么激光眼远多于电磁炮，以及激光眼加权有效率审计

### 4.1 经济边界根因：不是“偏爱激光眼”，而是 `ep=2` 后根本买不起电磁炮

- `charge` 消耗 `1 ep`，且未用能量珠回合末清空（[resolve.js](file:///d:/code/Epirus-Web/js/core/resolve.js#L1320-L1325)）。
- 当 AI 在最常见的 **`ep=2`** 回合蓄能后，下一回合仅有 `1 ep`：**`laserEye` 仅需 `1 ep + 1 boom`，合法可放；而 `railgun` 需 `2 ep + 1 elec`（[state.js](file:///d:/code/Epirus-Web/js/core/state.js#L155-L157)），`ep=1` 时在 `legalActions` 中仅作为 `affordable: false` 不可用项存在**。
- 实测 `OBS6-LH6P`（`long 120g self5`, `task-3178`）蓄能直方图：`ep=2#boom=426`、`ep=2#elec=108`、`ep=3#elec=5`、`ep=3#boom=5`；只要真走到 `ep >= 3` 且持电珠，`LH6P` 的 `canRail` 实放率极高（`80g self5 long`: `rail=7/7`、`prod5`: `2/2`）。

### 4.2 激光眼有效率双口径审计（`80g × 5p, temp/eps=0.2`）

按用户口径：**打在防御类技能上计 1 分，若同一回合另有他源攻击/伤害落在同一目标上计双倍（2 分），裸命中无防计 0 分**：

| 口径 / 候选 | `long self5` | `long prod5` | `multi self5` | `multi prod5` | 口径说明 |
|---|---:|---:|---:|---:|---|
| **事件口径 `OBS6-LH6P`**（`task-3168`） | **57.9%** (`132/228`) | **85.4%** (`41/48`) | **53.3%** (`49/92`) | **59.1%** (`13/22`) | 实际触发 `voided(laserEye)` + 同回合另有 `amt>0` 伤害（`prod5`=`PRODUCT7`） |
| **事件口径 `OBS6-LH5P-S3k`**（`task-3168`） | 52.2% | 76.3% | 53.6% | 81.5% | 同上，纯 PG 中段快照全项 >50% |
| **事件口径 `OBS6-LH5`**（纯 SFT, `task-3168`） | 43.9% | 72.1% | 47.1% | 67.6% | 自对局 <50%（大量打在已被消或无防席位，`1dmg` 偏多） |
| **意图口径 `OBS6-LH6P`**（`task-3594`） | 63.7% (`170/267`) | 60.0% (`15/25`) | 64.9% (`61/94`) | 30.8% (`8/26`) | 目标当回合选 `GUARD_FAMILY` + 他席同目标 `ATK`（`prod5`=18 枚池） |
| **意图口径 `OBS6-LH5`**（`task-3594`） | 95.9% (`604/630`) | 54.5% (`18/33`) | 105.4% (`432/410`) | 50.0% (`8/16`) | 镜面自对局高频防御（43.7%）推高意图合击分，但事件口径实效仅 43.9% |

- **结论**：经过 `product` PG 微调的 **`OBS6-LH6P` 在真实破防事件口径下四项全数超过 50%**（`self5` `53.3% / 57.9%`、`prod5` `59.1% / 85.4%`）；未接 PG 的 `OBS6-LH5` 在同口径下自对局低于 50%（`43.9% / 47.1%`），PG 显著提升了破防选点精度而非单纯凑动作意图。

---

## 五、为什么 `long` 下聚能环与电磁炮反而少于 `multi`（模式倒挂根因）

理论上 `long`（5 血 50 分胜）续航更深、中途不易被抢死，理应比 `multi`（3 血）更多使用 `ring` 与 `railgun`。80 局 × 5 席控制对照（`ε=0.2`）精准定位了倒挂来源：

| 包 | `long`（`turns` / `ring` / `rail` / `laser` / `ep>=3`） | `multi`（`turns` / `ring` / `rail` / `laser` / `ep>=3`） | 形态诊断 |
|---|---:|---:|---|
| `GD16m-D1`（链教师本体） | `7587` / **`1108`** / **`504`** / `0` / **`1612`** | `4795` / `844` / `118` / `0` / `938` | 符合直觉：`long` 显著大于 `multi`（`rail` **4.3×**） |
| `OBS6-LH2`（干净冷启动 SFT） | `13226` / **`878`** / `11` / `116` / **`895`** | `8190` / `644` / `56` / `167` / `705` | 干净蒸馏保留了 `long > multi` 的 `ep>=3` 与 `ring` 倾向 |
| `OBS6E9`（底座 + `76%` 主教师） | `16882` / `1` / `0` / `0` / `7` | `10413` / `0` / `0` / `0` / `2` | `long` 极高频在 `ep=2` 花钱进攻/短兵相接 |
| **`OBS6-LH6`**（`E9` 底座 + `76% E9` + `14% GD16m`） | `20195` / `184` / `9` / `133` / `244`（`ep2Atk=2194, ep2Ji=66`） | `6230` / **`2856`** / **`49`** / `25` / **`3230`**（`ep2Atk=468, ep2Ji=408`） | **倒挂点**：`E9` 在 `long` 压缩 `ep=2` 蓄钱空间（`ep2Ji` 仅 `66`），把 `ring/rail` 挤进 `multi` |
| **`OBS6-LH6P`**（KL 锚定 `LH6`） | `ep=3/4/5+: 100/5/31`, `ring=109` | `ep=3/4/5+: 127/12/158`, `ring=253` | 继承 `LH6` 的 `multi` 偏向，`long` 下仍很少攒到 `ep>=3` |

- **根因一句总结**：不是引擎规律反转，而是 **`OBS6-LH6` 高权重（`76%`）继承了 `OBS6E9` 在 `long` 模式下的 `ep=2` 即时消费反射**，把 `GD16m` 的 `ring/ep>=3` 空间只放行给了 `multi` 分支。

---

## 六、鼓励电磁炮 PG 模式（`--penDeadElec`）实验与 `promote` 阻塞分析

在 [pg-train.mjs](file:///d:/code/Epirus-Web/training/proto2/pg-train.mjs) 新增 `--penDeadElec=<w>`：**单向惩罚必废的 `ep < 3` 蓄电珠**，不碰 `ep=2#boom -> laserEye`，并将 `--lamC` 奖励收紧到 `bead==='elec'` 且 `ep >= 3`。

### 6.1 `:r1` 补贴桌混合（`LH8R–LH8R3`）与 `LH8R2` 上槽体检

- 在 `arenaShapes` 混入 `:r1`（每回合额外 +1 `ep`）后，训练局内 `炮/局` 从 `LH6P` 的 `0.037` 跃升至 `0.198`（`LH8R2`）/ `0.204`（`LH8R3`），但大量 `ep >= 3` 来自规则白送能量而非自主蓄钱。
- `OBS6-LH8R2` 体检指标：`mem-probe-e6 Gap -10.4pt`（干净）、`C5短=0.1744 / C5长=0.1880`、`用卡=13`、`G_M=7.35 / G_L=4.40`（`promote` 口径 `7.77 / 4.99`，严格 `4.62`）、`花珠率=75.4% (107/142)`、`G4` max `36.7%/37.7%`、`G5带档` PASS（`long 33% / multi 11%`），但在 `promote-champion --dry` 上被三项地板阻断：
  1. **反弹墙主动伤害**：`0.00 <= 0.5/局`；
  2. **场A 被集火还手率**：`13.7% < 20%`；
  3. **G5 无档 `long`**：`33% > 25%`。

### 6.2 纯 `:r0` 无补贴对照 `OBS6-LH8R4`（`5:long, 5:multi`, `6000g`, `--penDeadElec=0.25 --lamC=0.15 --lamF=0.25`）

- 在 `80g × 5p, temp=0.2` 标准无补贴自对局下的 `ep + 电珠/炮` 直方图对照：

| 候选 / 分段 | `multi ep2b / ep2e` | `multi ep3e / affRail / rail` | `long ep2b / ep2e` | `long ep3e / affRail / rail` | `C5短 / C5长` | `Gap` |
|---|---:|---:|---:|---:|---:|---:|
| `OBS6-LH6P`（起点） | `138 / 84` | `18 / 18 / 11` | `201 / 58` | `1 / 1 / 1` | 0.1729 / **0.2058** | **-9.2pt** |
| `OBS6-LH8R4.seg1500` | `156 / 37` | **`63 / 59 / 13`** | `324 / 60` | `1 / 1 / 1` | 0.1714 / 0.1756 | **-6.9pt** |
| `OBS6-LH8R4.seg3000` | `167 / 47` | `33 / 31 / 7` | `289 / 67` | `5 / 4 / 3` | 0.1602 / 0.1698 | **-4.9pt** |
| `OBS6-LH8R4.seg4500` | `268 / 63` | `3 / 3 / 3` | `314 / 60` | `3 / 3 / 2` | 0.1483 / 0.1699 | **-3.9pt** |
| `OBS6-LH8R4`（`6k` 终点） | `253 / 100` | `7 / 6 / 1` | `309 / 50` | **`5 / 5 / 5`** | 0.1333 / 0.1956 | **-0.4pt** |

- **结论**：`--penDeadElec` 的确把 `multi` 的 `ep=2#elec` 死珠减半（`84 -> 37`）并将 `ep>=3#elec` 与 `long rail` 双双推高至 `3.5×–5×`；但在零补贴 `r0 long` 里，“多攒一回合 `ji` -> `ep=3#elec` -> 电磁炮”天生比“直接 `ep=2#boom -> laserEye`”慢一拍，仅靠无价值头的 REINFORCE 无法压倒短闭环经济诱因。

---

## 七、后续接力方向

1. **修正 `long < multi` 模式倒挂的 SFT 重炼**：降低 `OBS6E9` 在 `long` 对局中的 `ep=2` 抢攻采样比例（或以干净 `OBS6-LH2` 为起跑/更高 `GD16m` 长程占比 + 严控 `classPow=0.25, classCap=3` 守住负 `Gap`），让 `long` 恢复比 `multi` 更多的 `ep>=3 / ring` 供给。
2. **打破 `ep=2 laserEye` 短闭环压制**：在 `pg-train` 引入多步价值基线（critic）降低跨 2–3 回合憋 `ep=3 -> railgun/bigT` 的方差，避免单纯靠稀疏回报让策略退回 `ep=2` 即时兑现。
3. **补齐 PG 产物上槽三道地板**：把针对反弹墙（穿透攻击频率）与场A（被集火还手）的 `r0` 阶段练回 `LH6P/LH8R2` 类候选，同时维持 `G4/G5` 与负 `Gap` 双红线。
