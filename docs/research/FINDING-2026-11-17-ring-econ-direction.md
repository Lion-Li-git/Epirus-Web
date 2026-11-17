# FINDING · 2026-11-17 晚 · 长程开环与珠经济训练方向试跑报告

> 结论时间：`2026-11-17 18:57 +08:00`。代码改动仅在 [supfit-gd.mjs](../../training/proto2/supfit-gd.mjs#L577-L660)（新增 `ringEcon` 教师并接进 `TEACHER_KNOWN`，零新增环境变量旋钮；`knobs.mjs --check` 全绿）。所有实验包暂存 `scratch/arms/`，未自动入图或改池。

## 一、病灶定位（`results/obs6.5` 与午后消融臂实测）

1. **`results/obs6.5` 10 局实机对战（1,145 条 AI 动作）**：
   - 全池 AI `聚能环 = 0 / 1,145 (0.0%)`，而玩家 `玩家1` 的聚能环使用率为 `R4–6: 83.3%`、`R7–10: 82.5%`（玩家夺冠 `4/10` 局）；
   - `hard` 池包在 **R2 出 `枪` 率达 `91.3% (42/46)`**（8 枚里有 7 枚 R2 100% 开枪，仅 `MX5-GD-LE40` 为 20%），导致 R3 掉回 `ep=0–1` 被迫大量按 `ジ (80.4%)`、`≥2` 费卡仅 `6.5%`，陷入前中期低费短打循环；`soft` 池 R2 出枪 `25.0%`、R3 `≥2` 费达 `50.0%`。
2. **模型机制核验**：
   - [policy2.js](../../js/train/policy2.js#L707-L720) 与 [arch2.mjs](../../training/proto2/arch2.mjs#L868-L885) 的两级 softmax 均用各键最大 logit `bestOf[k]`（含 `modeBias`），**不存在“按目标数偏置”**。
   - 真正锁死长程开环的是策略在 `ep=1` 对 `gun`、`ep=2` 对 `sword` 的高置信度，以及长程多对局里早期被抢断，导致始终达不到 `ep=3` 的聚能环门槛；哪怕午后 `EQ-S4-RING` 学会了 R2 `ji`，R3 仍 `100%` 出 `sword`（8P 长程 `聚能环=0%`）。
3. **关于“蓄能 vs 电磁炮 / 激光眼 / 珠浪费”的核验**：
   - 实测首轮试验臂 `EQ-S4-RINGEC1` 与 `EQ-S4-RINGEC2` 的**多余蓄能并没有去打激光眼**（两者自对局均 **`chgB=0, laserEye=0`**），而是**直接过期浪费**：
     - `RINGEC1`：`5P_long chargeProfile` 得 49 / 花电 9 / 花爆 0 / 过期 40，**花珠率仅 `18.4%`**；
     - `RINGEC2`：`5P_long chargeProfile` 得 96 / 花电 20 / 花爆 0 / 过期 75，**花珠率仅 `20.8%`**。
   - 对比 `hard` 池基线证明 2.0 网络完全可学：`EQ-S4-GD6ATEACH` 花珠率 **`77.3%`**（`8P_long chgE=70 -> rail=57`）、`MX3-GDEQ-GD` 花珠率 **`69.4%`**、`MX5-GD-LE40` 实现 `chgB=276 -> laserEye=165`（且 R2 `ji=82%/gun=18%`，混桌夺 1 率达 `18–22%`）。

## 二、后续训练方向（两段协同，零新旋钮）

1. **阶段 A（条件化长程教师蒸馏 + DAgger，`supfit-gd`）**：
   - **必须用 `--objective=cand --lr=0.001`（或 `0.0004–0.001`）与 `--dagger=2`**：实测 `supfit-gd` 默认 `lr=0.02 + key` 在多轮后易权重过冲塌缩（`RINGEC5` 第 2 轮似然 `-0.06 -> -0.40` 导致 `5P_long` 掉入 `proto+charge` 死循环，`花珠率=0.5%`）。
   - **长短桌形隔离（`shapeTeachers` 只派给 `3:long / 5:long / 8:long`）**：主教师保留 `pack:EQ-S4-GD6ATEACH.bak` 守住 `standard / multi`；长程教师严格按以下优先级生成标签：
     1. 多反弹墙（`≥2` 面）穿破反击 / 残血 `hp≤1` 保命 / 被 `≥2` 席集火还手（守住 `G4/G5` 与被动场 E/F）；
     2. **持珠优先立刻兑现（排在续环与落雷之前）**：手上有 `elec` 先出 `railgun`，有 `boom` 先出 `laserEye`——避免 1 回合珠（规则 R9'）被续环或大雷挤掉而过期；
     3. **长程开环三连阶梯先于新蓄能**：`ringStreak=0 ∧ round≤8 ∧ ep<3` 忍 `ji`，`ep≥3` 起环并免费续满 3 连；绝不在 `ep=2` 抢蓄爆珠把 `ep` 卡死在 `0–2`（`RINGEC4` 实测因此开不出环、`G5[long]=41%` 未过并混桌 `0/120`）；
     4. **双珠条件供弹**：仅在 `!elec && !boom && ringReady && ep≥3` 时按局面蓄珠（有反弹或 `≥2` 防席优先 `charge#boom`，否则 `charge#elec`），确保下一回合能合法兑现（`railgun` 需余 `ep≥2`、`laserEye` 需余 `ep≥1`）。
2. **阶段 B（KL 锚定 + 珠经济奖惩强化，`pg-train`）**：
   - 当阶段 A 已进入“能开环、有珠可花”的局部状态后，接 `--shapeModes=long --arenaShapes=5:long,8:long --klW=0.30 --klModes=multi,standard --lamExp=0.20 --penDeadElec=0.12 --beadSpendW=0.12 --lamF=0.06 --segEvery=400`；
   - 已验证从 `RINGEC2` 跑 800 局（`EQ-S4-RINGPG2.seg800`）即可在不破坏 R2 `ji` 与 `promote` 全门的前提下，将 `5P_long` 花珠率从 `20.8%` 拉到 **`45.3%`（第 6 道珠经济正式闭环 ✓）**，并把 `G(long)` 抬到 **`7.56`（S=2.099）**。
3. **下一发重点（冲 B 轴与池位强度）**：
   - 将 **`EQ-S4-RINGEC6`**（已兼备 `81.8%` 珠闭环 + `8P_long` 混桌 `15.0%` + `skE=18`）作为阶段 B 起点，使用 `pg-train` 将对手池 `--arenaPool` 切为混合强包谱（`EQ-S4-E9, MX3-GDEQ-GD, MX5-GD-LE40, EQ-S4-GD6ATEACH, MX8-TN25-KL`）并保持 `--klW≥0.30` 与 `--lamExp/--beadSpendW`，专门抬升 **B 轴冠军桌（当前 `RINGEC6` `C长=0.088`、`C多=0.145`）** 至 `hard/mid` 目标区，同时保留 `ring + railgun + laserEye + bigT` 多层技能。

## 三、本轮试训臂实测对照表

> `promote` 口径：`--dry --support=2`。`exam-4n` 口径：`rounds=25 seed=77000 dose=exam exam=both(v2) pool=v2#fbf59889 champ=MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,OBS6P4-S4000`。混桌口径：自建 8 席 `long` × 120 局 vs `EQ-S4-E9 / GD6ATEACH / MX3-GDEQ-GD / MX5-GD-LE40 / MX6-GD-TF15 / MX8-TN25-KL`。

| 试验臂 | 关键改动 | promote 门禁 | 5P_long 花珠率（得→花/过） | 8P 混桌夺1 | exam-4n (`C多` / `C长` / `skE`) | 主要发现 |
|---|---|---|---|---:|---|---|
| `EQ-S4-RINGEC1` | `upstream=RING`, `lr=0.02`, `ringEcon v1` | ✅ 全过 | `18.4%` (`49→9/40`) | `6.7%` (8/120) | `—` / `0.077` / `—`/`17` | 破 R2 枪（`ji:100%`）、`ring=23%`，但 8 成人长程不保珠且无 `laserEye` |
| `EQ-S4-RINGEC2` | `upstream=GD6ATEACH`, `lr=0.02`, `ringEcon v1` | ✅ 全过 | `20.8%` (`96→20/75`) | `9.2%`–`11.7%` | `0.191` / `0.109` / `15`/`16` | 混桌优于 `GD6ATEACH`，但续环/大雷挤掉手头电珠，废珠 `78%` |
| `EQ-S4-RINGPG1.seg400` | `RINGEC2` 接 PG（`klW=0.35`, `beadSpendW=0.05`） | `—` | `29.9%` (`87→26`) | `10.8%` (13/120) | `—` / `0.093` / `—`/`16` | 400 局即把花珠率抬至 ~30%，`reflect` 回升至 `2.1%` |
| `EQ-S4-RINGEC3` | 加 `hp<=3` 轻防 + `GD6ATEACH@0.30` 混训 | ⛔ 墙 95% 零伤 | `78.1%` (`96→75/21`) | `14.2%` (17/120) | `—` | 持珠优先显著修好废珠，但 `hp<=3` + 混训触发 73% 防御龟缩 |
| `EQ-S4-RINGEC4` | 撤龟缩，留 `ep=2` 优先蓄爆→激光眼 | ⛔ G5[long] 41% | `93.2%` (`458→427/31`) | `0.0%` (0/120) | `—` | 蓄爆抢光早期 `ep`，断环卡死低费；证明开环必须先于蓄能 |
| `EQ-S4-RINGEC5` | 先开环后蓄能，`lr=0.02, key` | ⛔ (未完成前先测出 `5Plong` 死锁) | `0.5%` (`1756→9/1747`) | `9.2%` (11/120) | `—` | `lr=0.02` 第 2 轮过冲，导致 `5P_long` 陷 `proto+charge` 死循环 |
| **`EQ-S4-RINGEC6`** | 同 `RINGEC5` 教师 + **`--objective=cand --lr=0.001`** | **✅ 全过（第6道闭环✓）** | **`81.8%`（promote 40局，`132→108/24`）/ `84.0%`（30局）** | **`15.0%` (18/120)** | `0.145` / `0.088` / **`16`/`18`** | **综合最佳监督臂**：`R2[ji:100%]`，电/爆双供弹，混桌与 `MX5-LE40` 相当 |
| **`EQ-S4-RINGPG2.seg800`** | `RINGEC2` 接 PG（`lamExp=0.20`, `beadSpendW=0.12`, `long` 专项） | **✅ 全过（第6道闭环✓）** | **`45.3%`（promote 40局，`53→24/29`）/ `37.5%`（30局）** | `4.2%`–`7.5%` | `0.120` / `0.106` / `15`/`16` | 首个靠 PG 自己跑通第 6 道的臂，`G(long)=7.56`, `S=2.099`，`ring@有ep=43.9%` |
