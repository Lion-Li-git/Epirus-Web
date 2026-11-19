# HANDOFF & NEXT RESEARCH · 2026-11-19 白班（2.0 接口收口 ‖ `skill-report` 修复 ‖ 池 25 枚 ‖ 仓库清理 ‖ 下一步研究）

> 上一班交接：[HANDOFF-2026-11-19-morning-from-zcode-night.md](HANDOFF-2026-11-19-morning-from-zcode-night.md) ‖ 旋钮权威定义仅见 [training/TRAINING-KNOBS.md](../../training/TRAINING-KNOBS.md)（全集 40 / 在用 19，本文件不复抄）。

---

## 一、术语边界先对清：A 轴 / B 轴（评测尺）vs `--arenaPool`（`arena2` 训练对手池）

在口头讨论中「`arena`」出现了两次，工程上**不是同一个东西**：

1. **评测/演化图侧（产品与体检真尺）**：
   - **A 轴（脚本考卷）**：[tools/exam-4n.mjs](../../tools/exam-4n.mjs) 使用 `EXAM_POOL` 28 个**固定脚本对手**；`G4/G5/墙/场A` 同属对脚本的行为门槛。**脚本对手都在 A 轴**。
   - **B 轴（真包联盟）**：[tools/arena-eval.mjs](../../tools/arena-eval.mjs) / [tools/arena-noise-floor.mjs](../../tools/arena-noise-floor.mjs) 使用现役 **24 枚真冠军包**同桌对打，算 `arenaB`。
2. **训练侧（[training/proto2/pg-train.mjs](../../training/proto2/pg-train.mjs) / [supfit-gd.mjs](../../training/proto2/supfit-gd.mjs) 里的 `--arenaPool`）**：
   - `--arenaPool` 这个名字来源于训练环境文件 [training/proto2/arena2.mjs](../../training/proto2/arena2.mjs)，与 B 轴 `arena-eval.mjs` **无关**；它由 [roster-lib.mjs](../../training/proto2/roster-lib.mjs) `rosterFromArg` 解析，只决定**训练对局里非己方座位坐谁**：
     - **不传 `--arenaPool`（默认 `stratified mild`）**：`arena2` 构造「20 只脚本 bot + 30 个单技能死脚本 + random」并用 `bigT/reflect/snipe/guard` 天敌分层混入——**训练桌上全是脚本、没有真冠军包**。
     - **`--arenaPool=product`**：换为 `PRODUCT7` 7 个产品脚本。
     - **`--arenaPool=names:...`**：显式配置任意组合，支持 `OPP_SPECS` 脚本（`wall`、`ringspam`、`aggro` 等）与 **`pack:<在册id|.bak>` 真包**混摆。
   - **为什么实测必须把真包放进 `--arenaPool`**：默认纯脚本池做 PG 回火，虽然能拉高脚本鲁棒性（`场A` 等），但会使 B 轴 `arenaB` 大幅下跌（实测 `day1119-cannon-gd` 从 `-60.7pt → -82.3 → -99.2pt`）；改用 `--arenaPool=names:pack:...` 混真强包训练后，`day1119-cannon-realpg` 把下跌反转成了爬升（`-60.7pt → -54.1pt`；混 `aggro` 续训 `day1119-cannon-r2` 达 **`-51.2pt`**）。本质是让训练分布同时贴近 **B 轴（真包强度）+ 关键 A 轴对抗脚本（如 `aggro`、`wall`）**。

---

## 二、今日白班已落盘现状（`v2.1.6 → v2.1.8`）

1. **统一 2.0 训练接口与产品恢复（`v2.1.6`）**：
   - 新增 [training/train.mjs](../../training/train.mjs) 统一入口（`--mode=pg|supfit|distill|fuse|selftest`）及本机 2.0 HTTP+SSE 服务 [training/server/train-server.mjs](../../training/server/train-server.mjs) + [start-train-server.cmd](../../training/start-train-server.cmd)，恢复主页「🧪 训练场」；[viewer.mjs](../../champion-map/viewer.mjs) 按短/长拆列并补 `skill-report.html` 入口。
2. **`skill-report` 修复与页面信息升级（`v2.1.7` + `v2.1.8`）**：
   - [tools/pool-skill-report.mjs](../../tools/pool-skill-report.mjs) 与 [tools/skill-report.mjs](../../tools/skill-report.mjs) 剔除 0 费 `ji` 消融；[tools/strength-lib.mjs](../../tools/strength-lib.mjs) 为 `firestorm` 补齐 R64 贴符前置（24/24 全池天火强制命中率 `0% → 100%`）。
   - Stage 1 跨环境统计接通 `curseStats` 与 `bead`（电/爆珠分列），[champion-map/build-skill-page.mjs](../../champion-map/build-skill-page.mjs) 去掉卡片顶部重复横幅，在「天火/贴贴」行内显示**引爆率**（可超过 `100%`）、在「蓄能」行内分列**电珠/爆珠使用率**，已重烘 [champion-map/skill-report.html](../../champion-map/skill-report.html)（`25/25` 枚）。
   - 训练侧：[supfit-gd.mjs](../../training/proto2/supfit-gd.mjs) 加 `closeCurseStorm` 闭环守卫（`--teacher=chain` 默认路径同 seed `wid=d58efca69c0b6bbd` 逐位不变）；[pg-train.mjs](../../training/proto2/pg-train.mjs) 支持对无后续天火的孤儿 `curse` 负塑形并在 KL 锚中清零负塑形键（默认无负塑形路径同 seed `wid=13ed6123e3c5fa90` 逐位不变）。
3. **池 `24 → 25`（`hard 11 / soft 14`）**：
   - **`day1119-cannon-pg`**（`docs/artifacts/day1119-cannon-pg.bak`，`wid=ae28c0aaf8bf6098`）完整走完 `promote --dry --support=2`（**0 阻断全过**）→ `measure-point --bake` → `pool-add --tier=soft` → `exam4n-mixedfix-1116` → `rebuild-map`（`1002` 行，`100 PASS`）→ `build-pool-bundle`（`7642 KB`）。
   - 关键读数：Stage 1 覆盖 `cannon` **28/120 格**、`armor` **81/120 格**、`shift` 41、`proto` 17、`snipe` 17、**电珠使用 97%**（`2393/2469`）、0 废贴；A 轴 `P2=+0.4077 / P3=+0.1677 / P5L=+0.0828 / MxSkE=20`；`arenaB=-82.28pt`（强于软带 `night2-X2b-fuse -87.25pt` 与 `night2-S6 -104.76pt`）。
4. **仓库清理（第一、二档完成）**：
   - 清理 `22,029` 个未跟踪废文件释放 **`2,181.99 MB`**，经 `git gc --prune=now` 后全目录从 **~2.5 GB 降至 `295.81 MB`**（`.git` `141.94 MB`、`docs` `79.62 MB`、`champion-map` `37.38 MB`、`scratch` `20.76 MB` 仅留 `day1119-*`/`night2-*`/`fuse-*`/教师锚）。

---

## 三、全池 25 枚现状 X 光（问题定位）

| 分带 | `arenaB` 范围（中位） | `switchJs`（应变度） | 暴露出来的核心矛盾 |
|---|---|---|---|
| **`hard`（11 枚）** | `+2.3 ~ +34.7pt`（**+14.2**） | `0.067 ~ 0.144` | **战力强但极窄**：**8 项技能为 `0/11`**（`armor/rod/firestorm/mine/taunt/cannon/purify/mirror`），**8 项仅 `1–2/11`**（`tank:1/miniT:1/laserEye:1/dualGun:1/ring:2/jinshield:2/drain:2/transfer:2`）；且顶尖硬包普遍少花电珠（`OBS6P9-S4000` `0%`、`EQ-S4-E9` `6%`、`OBS6E9` `0%`）。 |
| **`soft`（14 枚）** | `-104.8 ~ +0.7pt`（**-21.0**） | `0.015 ~ 0.146` | 承接冷门技能，但全池 25 枚中仍有 **4 项 `0/25` 灭绝**（`rod / taunt / purify / mirror`）、**3 项 `1/25`**（`firestorm / miniT / dualGun`）、**2 项 `2/25`**（`mine / cannon`）。现有全池最高天火引爆率仅 `14%`（`MX8-TN25-KL` `1/7`）与 `12%`（`MX8-R6B-KL` `14/113`），`night2-X2b-fuse`（`0/671`）与 `night2-S6`（`0/315`）仍是负资产。 |

---

## 四、今天新实验浪潮对比（全部 `v:92 / S1o / obs6 / 16561` 维）

| 实验臂（均留档在 `scratch/arms/`） | 配方 | 镜像卡谱（multi / long） | `arenaB` | 体检与机理结论 |
|---|---|---|---|---|
| `day1119-X2b-cf` | `night2-X2b-fuse` 上 `closeCurseStorm` 双教师清废贴 | `用卡 7/6 · tank 18%/16% · armor 2% · curse 0%` | **`-60.73pt`**（`+26.52pt`） | 清掉 671 手废贴立涨 26.5pt |
| `day1119-cannon-gd` | `MX8-R6C-KL` + `toolkit + cannon(0.25)` | `用卡 7/8 · cannon 3%/3% · armor 1% · transfer 1–2%` | **`-60.73pt`** | 1 阻断（`场A 14.9%`），证明双教师治单卡坍缩成立 |
| `day1119-cannon-realpg` | 上包 + 真强包 `--arenaPool` 4500 局 PG | `用卡 8/8 · cannon 1%/1% · armor 3%/2% · snipe 1%/3%` | **`-54.10pt`**（seg3000）/ `-55.21pt` | `G4/G5` 大余量全过、`花珠 98%`，仅 `场A 17.8%` 差 `2.2pt`（对比弱脚本 PG `-99.2pt` 高 `44pt`） |
| `day1119-cannon-r2` | 上包 + 掺 `aggro` 再训 1500 局 | `用卡 6/7 · transfer 3%/2% · armor 1%/2%`（`cannon <0.5%`） | **`-51.18pt`** | 再涨 4pt 但 `场A 15.1%` 且 `cannon` 稀释 |
| **`day1119-det-gd`** | `MX8-R6C-KL` + `toolkit + detonate(0.35)` | `用卡 6/7 · firestorm 16%/19% · curse 13%/12%` | `-88.85pt` | **引爆率 `123% / 158%`**，首次在 2.0 稳定出真「贴爆闭环」 |
| **`day1119-det-realpg.seg1500`** | 上包 + 真强包 `--arenaPool` 1500 局 PG | **`用卡 13/8 · firestorm 14%/14% · curse 10%/9%`** | **`-81.35pt`** | **引爆率 `140% / 156%`**，修好`墙`、`G4[multi] 50.3%`、`G5 6%/8%`；余 `G4[long] 62.7%`（超 `2.7pt`）与 `场A 6.2%` |

---

## 五、下一步研究路线（按投入产出排 4 条主线）

1. **P0 · 把强包本身（`pack:EQ-S4-E9` / `pack:MX5-GD-T2STR`）替换成 `--teacher2`，代替弱基线 `toolkit`**
   - **病根**：用 `MX8-R6C-KL`（`-26.8pt`）起步 + `toolkit` 做 0.5 轮替教师，虽能教会冷门卡，但会把基本攻防（`sword/reflect/guard`）和局面应变（`switchJs` `0.14 → 0.015~0.056`）洗塌，导致产物总在 `-60 ~ -105pt` 起跑。
   - **实验假设**：以 `EQ-S4-E9.bak`（`+14.3pt`）或 `MX5-GD-T2STR.bak`（`+20.5pt`）作 `--up` 与 **`--teacher2`**（占 `0.65~0.75`），只把 `0.25~0.35` 配额留给专科教师（`detonate` / `cannon` / `pack:S3` / `purify`）。预期 Stage A 直接落在 `-15 ~ +10pt` 且保留 `switchJs ≥ 0.10`。
2. **P1 · 修复 `roster-lib.mjs` 跨维对手限制 + 真强包×关键脚本混合 PG（Stage B 标准化）**
   - 修 [training/proto2/roster-lib.mjs](../../training/proto2/roster-lib.mjs#L40-L51) 的 `buildPackSeat`，参照 `supfit-gd.mjs` 使用独立布局分发，解除 `OBS6P9-S4000`（`+34.7pt`, `16411` 维）与 `OBS6E9` 进不了 `16561` 维 PG 陪练池的限制。
   - PG `--arenaPool` 采用「**强真包 × 5 + `aggro,wall,ringspam`**」混装并对比 `--baseline=ridge`，解决只练真包时 `场A` 欠拟合（`17.8% < 20%`）以及净分为负时的正塑形方差漂移。
3. **P2 · 冲线 `day1119-det-realpg` 过 `G4/场A` 入池，替换掉软带两枚废贴老包**
   - 目标：拿下一枚 `promote` 0 阻断、引爆率 `≥100%` 的「贴爆闭环」包进 `soft`，同时用 `pool-add.mjs --retire` 摘掉负资产 `night2-S6`（`-104.8pt`, 0/315）与 `night2-X2b-fuse`（`-87.2pt`, 0/671）。
4. **P3 · 逐张清零 4 张绝种卡（`purify / taunt / rod / mirror`）与把 `ring / miniT` 抬入 `hard` 带**
   - **净化 `purify`**：现成的 `day1119-det-gd.bak`（`curse 13%`）放进 `supfit-gd --arenaPool` 当活咒源，搭配 `--teacher=purify --teacher2=pack:EQ-S4-E9`，彻底解决过去净化状态 0 可达问题。
   - **挑衅 `taunt` + 避雷针 `rod`**：用注册表已有 `ration6t`（或 `pack:MX8-TN35-KL3` 教师）配 `pack:EQ-S4-E9` 双教师蒸出功能反制包。
   - **聚能环 `ring` + 小雷 `miniT` 进 `hard` 带**：以 `RING-MINIT-CONT`（`+2.3pt`, `爆 97%`）为起点跑真强包 PG，看能否把强度推至 `+12 ~ +20pt`。
5. **工程顺手债（低优）**：7 台研究脚本补 `rejectUnknownFlags`；7 枚新池成员补跑 [seat-rule](../../champion-map/seat-rule.mjs) 并 `--refresh`；视需要决定是否执行第三档跟踪归档清理（`proto2/` 27 个 10 月探针、`champion-map/archive/` `17.4 MB`、`docs/research/archive/` `32.2 MB`）。
