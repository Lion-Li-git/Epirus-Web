# RESULTS：11-01 深夜 → 11-02 晨（ZCode 夜班，NIGHT3）

> 配套：`PLAN-2026-11-01-NIGHT3-zcode.md`（含 00:1x 两轮用户裁定修订）。
> 干预全关协议（本班新账）见 §二；所有本班读数一律干净口径（`--shipbigt=0 --shipdrain=0` / 训练四键全 0）。

## §一 Phase 1 收口：B 路线在 obs3b 天生成立（00:2x，零改动）

- **8P 观测集合 = 自己 + 全部对手**（真路径探针 `scratch/probe-obs3b-seats.mjs`）：
  `obs3Scene`（`obs3.mjs:283`）对 alive **全量发席**：2P=2 席 / 3P=3 / 5P=5 / **8P=8**；
  `forwardObs3`（`arch2.mjs:414`）池化循环无闸（自己单列 h_self，对手全进 mean/max）；
  人数族归一 `/NMAX=10`（`obs3.mjs:133`，2.0 目标本写 2–10 人）。8P 真前向 sane、8P 整局跑完。
- **病根记账**：00:0x 的探针（`scratch/probe-seats.cjs`）量的是 `P.oppSlots`——**v7 面**（policy.js）的助手，
  "8P 截 5 席"是 v7 面的事实，被错推广到了 gen-3 头上。gen-3 从第一天起就是全可见。
- 三条实现全查：`obs3.mjs`（工具侧）‖ `arch2.forwardObs3`（网络路）‖ **`policy2.js scene()`（浏览器镜像）**——
  全部全量流式 ⇒ **gen-3 上浏览器的观测面也ready**（发货任务只剩打包，不是训练堵点）。
- 回归腿：selftest2 **36/36 绿** ‖ selftest3 全绿（腿 A–F）‖ `js/` 未动 ⇒ v7 轨迹与 gen-3 ≤5P 逐字节不变**按构造成立**。
- 原 B-1~B-5（featuresSeats/seatVecs/policy2 镜像/指纹翻动）**全部作废**。指纹未翻动。

## §二 干预全关协议（00:1x，用户裁定「3 代训练和考试把引擎的干预先关掉」）

盘点（`js/train/evo.js` 全量）：

| 干预 | 默认档 | 作用面 | 本班处置 |
|---|---|---|---|
| `BIGT_PUSH` 大雷硬兑现 | **12 = 开**（v1.5.333 起） | 挂 `policyChooserN` eps 分支**之前** ⇒ 训练/考卷/skill-report 三条路全污染 | **训练 `EPIRUS_BIGT_PUSH=0`；考试/报告 `--shipbigt=0`** |
| `DRAIN_PUSH` 摄魂软注入 | 1 = 开（10-03 裁定） | 仅 eps>0 soft 分支（浏览器）⇒ 节点侧结构性到不了 | 训练显式 `EPIRUS_DRAIN_PUSH=0`（回执制） |
| `CURSE_PUSH` 贴贴软注入 | 0 = 关（10-25 覆盖裁定） | 仅 eps>0 soft | 训练显式 0（回执制） |
| `SUPPORT_PRIOR` 全息送盾先验 | 0 = 关 | HOLO 目标改写/扣送 | 保持 0；送盾由教师/网络自己学 |
| `LOCK_NARROW` / `BELIEF_SEARCH` | 0 = 关 | — | 不动 |

- 接线：train-3p 部署档名单 2→4 键（+`EPIRUS_CURSE_PUSH`/`EPIRUS_SUPPORT_PRIOR`，黑键闸+逐键回执）；
  skill-report 加 `--shipbigt`/`--shipdrain`（不设 = 引擎默认档，历史口径不动）。
- **审计结论（§三.1）**：既往 bigT 读数（GATE4b-s13 "bigT 39/40"）混有引擎强塞——干净口径下 bigT 出手率 **2.98%**。
  带兑现档的历史读数今后引用必须标口径。
- 全息屏障**理想形态已核**（README 原文 + resolve.js:1162）：给**被作用者**套一回合原型制御（v1.5.4 起即此语义）。

## §三 Phase 2：双口径基线 + 8P 首测（00:5x 电池，`scratch/night3-phase2.sh`）

### 1. 5P 四骰 ×2 口径（12/combo，seed 77000，48 局/包）

| 包 | 干预全关 | 带兑现档 | 差 |
|---|---|---|---|
| GA2R-sword-s13 | **64.0** | 64.0 | 0 |
| GA2R-sword-s41 | **64.0** | 63.6 | +0.4 |
| GATE4b-s13 | **48.6** | 47.6 | +1.0 |
| GATE4b-s41 | 48.1 | 47.6 | +0.5 |
| GA-ration-s41 | 58.3 | 57.6 | +0.7 |
| v7 冠军（参照） | 57.6 | 56.9 | +0.7 |

- 兑现档价签在这些包身上 **0 ~ +1.0pt**（关掉反而不亏）——量大雷强塞对强度的均价 ≈ §E270 的 −0.4~−0.5pt 同向。
- 注意：GA2R-s13 昨日账面 67.5 是**另一批样本**（当时未标局数/口径）；**本表为准**（48 局/包、seed 77000、干净口径）。

### 2. 8P 首测（10/combo = 40 局/包，seed 81000，干预全关）

| 包 | 8P 1st% |
|---|---|
| **GA-ration-s41** | **56.9**（8P 最强） |
| GA2R-sword-s13 | 52.9 |
| GA2R-sword-s41 | 49.7 |
| GATE4b-s41 | 44.0 |
| GATE4b-s13 | 40.9 |

- **GA-ration-s41（经济配给系）在 8P 反超**——经济骨架比 5P 特调的贪心系更耐多桌。5P 冠军 GA2R-s13 仍稳（52.9）。
- GATE4b 系 8P 偏弱（40.9/44.0）：其贪心剂量是在 5P 镜像上调的，8P 桌还没适配。
- MERGE-s41 无产物（merge 臂 gen≈160 塌，只有日志）⇒ 不入表。

### 3. skill-report 干净口径（3P，6 局/条件；`scratch/night3/sr-*-clean.json`）

- GATE4b-s13：gun 17.0% ‖ sword 8.8% ‖ **bigT 2.98%**（带档口径曾读"39/40"⇒ 污染坐实）‖ **tank/snipe/全部防御族/特殊族 = 0**。
- GA2R-s13：gun 32.4% ‖ sword **0.59%**（而 sword 强度 **+4.9pt** = "没学会的强招"）‖ bigT 2.7% ‖ curse 0.04% ‖ 其余 0。
- **坦克/狙击零使用触发用户兜底条款**：GD3-ALL 产物审计若仍零使用 ⇒ 训练桌补短程对局重蒸（不特训，不开技能课）。
- skill-report 修复：装载清单补 `policy2.js`（否则 v:92 容器解包失败）。

### 4. 8P 训练桌
- 契约：`EPIRUS_ARCH2=<spec> node tools/train-3p.mjs GENS N GAMES POP`（argv[2..5]），`N=8` 即 8P 桌；
  冒烟（3 代 × pop6 × 4 局 × 8P，干预全关）见 §三.5。
- eval-8p = `node tools/eval-5p.mjs 10 8 81000 <包> --shipbigt=0 --shipdrain=0`（eval-5p 天生支持 N；脚本桌按 `field[oi%len]` 轮转填座）。

## §四 Phase 3：技能工厂（进行中）
- 语义修正落格：摄魂 = **自保回血**（门 = 自身缺血 ∧ 窗口目标存在；非终结技定位）；
  藤甲 = 双面（施放者 guardSet 反弹族 + 目标 fireWeakNow+Next，`resolve.js:1152` 已核）；
  全息 = 给被作用者送盾（FFA 里 = 对将死之席的"均势盾"，队伍模式 = 队友盾——教师按前者实现并注明）。
- 教师批 2/批 3 → `ration6`（全能配给）：见下批记录。
