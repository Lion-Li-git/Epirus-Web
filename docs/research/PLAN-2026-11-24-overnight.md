# PLAN · 2026-11-24 通宵班（23:15–06:30）

> 基线：`f2e62d6a`（在 `origin/main` `d996f42d` 之上含晚班 7 笔研究与数据修复提交）。规则指纹 `bfd49045`；现役池 `23` 枚（`hard 12 / soft 11`）；图谱在册 `1,028` 枚（`lineage` 2.0 行 `197`）。
> 本文是执行计划与本晚实测审计汇总；训练旋钮全量请唯一查 [`training/TRAINING-KNOBS.md`](../training/TRAINING-KNOBS.md)（不复抄），工作纪律遵守 [`AGENTS.md`](../../AGENTS.md)。

---

## 一、提交前测试与仓库现状审计（22:42–23:02 实测）

### 1. 门禁与自检实测

| 检查项 | 命令 | 结果 | 说明 |
|---|---|---|---|
| **整轮门禁（主树）** | `node tools/gate-all.mjs --np` | `np 167/167 (210.5s)` · `spec 81/81 (0.3s)` · `battle OK (34.2s)` · `map OK (7.6s)` · `smoke exit=1` | `smoke` 仅第 9 项 `FAIL 界面无 over 覆盖层`（随机 2P `lv:regular` 对局里 4 回合固定招 `['ジ','防御','ジ','防御']` 吃穿 3 HP 提前终局） |
| **浏览器复测（同树）** | `node tools/smoke.mjs` + `node tools/gate-all.mjs` | `spec 81/81` · `smoke OK` · `battle OK` · `map OK` | `0` JS 报错，`SUMMARY: SMOKE OK` |
| **UI 行为探针** | `node tools/ui-probe.mjs` | **`20 / 20 PASS`** (`exit 0`) | 目标弹窗、锁定防重放、原位摘要/自动换行、88 事件压力全过 |
| **2.0 协议与双胞胎** | `selftest2.mjs` + `browser-parity.mjs` | **`37/37` + `P1–P8` 全绿** (`exit 0`) | `obs6` / `S1o` / `16,561` 维与浏览器端逐位同分 |
| **规则/旋钮/数据一致** | `rules-fingerprint` / `knobs.mjs --check` / `land-recovered --check` / `check-lineage` / `validate --strict` | **全部 `exit 0`** | 指纹 `bfd49045`；旋钮册 `186`（在用 `109` / 动态 `51` / 暗键 `26`）；恢复台账零违例；`registry=1028, batches=119, readings=74168, canonical matched=998 mismatch=0` |
| **图谱与全链审计** | `map-audit.mjs` + `pipeline-audit.mjs` | **`exit 0`** | `map-audit`: `137` 盘上缺失 + `138` quarantine sha 差异；`pipeline-audit`: `1028` 枚中 `604` 枚带历史/ms 戳/sha 差异（`lineage 353 / sha256 138 / file 137 / ts 69 / legacy 46 / archived 19 / parent 19 / soup 2`） |

### 2. 池健康快照（`23` 枚：`hard 12 / soft 11`）

- 覆盖口径（`champion-map/data/skill-report/*.json`）：`totalUses > 0` 为 **`29/29`**（全池覆盖到全部 29 个活跃键，仅 `mirror` 不在活跃集）；`coverage >= 1`（格数阈值）为 **`27/29`**，仅 **`dualGun`、`purify`** 尚未跨过格门槛；全员 `seatUnknown = 0`。
- 带伤 / 特邀（`invited=1` 或红指标）成员：
  - `hard`：`FC-G1`（`invited=1`, `promote=block` 因 `G5[long]=31%`）、`nov21-taunt-dsp0b`（`promote=block`, `G5[long]=29%`, `onlyStick`, `noGrab`）、`RING-MINIT-CONT`（`invited=1`, **`seatKill=2`**, `onlyStick`, `noGrab`）。
  - `soft`：`nov21-rod-tzt2d-r10`（`invited=1`, **`seatKill=2`**）、`MX8-R6B-KL`（`invited=1`, **`seatKill=1`**, `onlyStick`, `noGrab`）、`MX6-GD-TF20`（`invited=1`, `onlyStick`, `noGrab`）。
  - 另：`TK-FS4` 因大量贴咒被盾挡在聚合比率列标 `onlyStick`（`detRate=18.7%`），但真实 `loopRate=79.8%`、`takeRate=48.1%`（`noGrab=0`）——需修区分文案（#78 相关）。

---

## 二、晚间方法试测：`t65` 稀疏保护多教师蒸馏 + KL 固化消融（`scratch/2p-preserve-1124/`）

为了验证「不用线性融合短包 `nov24-2pfuse-ringbead-t65.bak`（过 `promote --dry`、2P `23.4%`、珠闭环 `81.7%`、天火局闭环 `20%`，但 `selftest3` 红：`可分辨格 52 < 60`、`curse logit[14]` 数值梯度偏差 `0.5`），能否通过 **多教师稀疏保护蒸馏 + 候选级 KL PG 固化** 从干净 `RING-MINIT-CONT.bak` 上洗出全绿且兼顾 2P 与多技能的包」，在 `scratch/arms/` 跑了一组对照消融（基准同场 500 局 `2:standard` rule-human 对战 `seed=77000`：`RING-MINIT-CONT = 33.6%`，`t65 = 23.4%`，`js/bundled-champion.js = 81.2%`）：

| 候选包 (`scratch/arms/`) | 关键配方 | `selftest3` | 2P `rule` (越低越强) | `long` 珠花掉% (`probe-bead-loop`) | Stage 1 并集 | Stage 1 `ring` / `rail` / `curse` / `fs` |
|---|---|---:|---:|---:|---:|---|
| `t65`（融合原件，`158KB`） | 65% fusion（红线禁开 PG） | **✘ 红** (格52/腿F) | **23.4%** | **81.7%** (浪费 17.4%) | — | `ring=4` · `rail=35` · `curse=3` · `fsOk=1` (局 5/25) |
| `fuse-distill`（旧单师） | `t65` 1200组/50步 无 `rareOnly` | ✔ **6/6** (0.00) | 74.8% | 44.7% (买不起 62.2%) | — | `ring=5` · `rail=10` · `curse=0` · `fs=0` |
| `rare-d0`（含 `charge` 富集） | `t65`+`bundled`+`fsSpec@0.2` · `rareOnly=ring,rail,charge,curse,fs@0.25` | ✔ **6/6** (0.00) | — | **32.0%** (买不起 57.9%) | 17/30 | `ring=12` · `rail=14` · `curse=4(55)` · `fsOk=0` |
| `rare-klpg`（从 `rare-d0` 起） | `pg-train --klCand=0.5 --klW=0.3 --beadSpendW=0.35` (1000g) | ✔ **6/6** (0.00) | — | 35.6% (买不起 67.3%) | 17/30 | `ring=7` · `rail=15` · `curse=5(53)` · `fsOk=0` |
| **`nocg-d0`**（去 `charge` 富集） | 去 `charge`，`rareOnly=ring,rail,curse,fs@0.20` · `classPow=0.35/cap=5` · 12形×200 | ✔ **6/6** (0.00) | 78.0% (`5P=0%`) | **47.5%** (浪费 48.2%) | **20/30** | `ring=16` · `rail=13` · `curse=15` · **`fsOk=3(90)`** |
| `nocg-klpg`（从 `nocg-d0` 起） | `pg-train --klCand=0.5 --beadSpendW=0.5 --penDeadElec=0.3 --shapeKey=ring:0.12,fs:0.15` (1500g) | ✔ **6/6** (0.00) | 81.4% | 41.3% (浪费 57.6%) | **20/30** | **`ring=17`** · `rail=17` · `curse=17` · **`fsOk=4(99)`** |
| **`2pw3`**（去 `bundled` + 3×`2:std`） | `t65` 教师（无 `bundled`），7形（3/7 为 `2:std`）60步 `lr=1.2e-4` | **✘ 红** (腿C ReLU 拐点 `1e+0`) | **31.6%** | **79.8%** (浪费 17.7%) | 16/30 | **`ring=31`** · `rail=26` · `curse=1` · `fsOk=0` |
| `2pw3s`（轻步 `lr=8e-5` 40步） | 同 7 形配比 | **✘ 红** (腿C 3点 `1.51e-3`) | 55.0% | **85.1%** (浪费 14.0%) | 16/30 | **`ring=35`** · `rail=25` · `curse=1` · `fsOk=0` |

### 本组试测证出的三条机制结论

1. **把 `charge` 放进 `--rareOnly` 会直接打塌珠经济**：对比 `rare-d0`（`32.0%`）与 `nocg-d0`（`47.5%`）以及 `2pw3`（`79.8%`），强行过采样 `charge` 会教会模型"无论后续有没有 2 ジ 都要蓄能"，造成 `57.9%–74.8%` 下一回合买不起电磁炮；**正确做法是仅把 `railgun,ring,curse,firestorm` 放进 `--rareOnly`，让 `charge` 只按天然语境分布采样**。
2. **此前 `2:standard` 崩塌的两个真因已全部钉死**：① 先前配方误把 `pack:js/bundled-champion.js` 当强 2P 教师，而同尺实测它在 `2:standard` 上让规则人类胜率高达 **`81.2%`**；② 在 12 形均匀菜单里 `2:standard` 只占 `1/12 (8.3%)`，梯度被另外 11 个多人桌形冲淡。去掉 `bundled-champion.js` 并把 `2:standard` 配重提到 `3/7` 后，`2pw3` 当场从 `78.0%` 拉回 **`31.6%`**，同时保住 `79.8%` 珠闭环与 `ring=31`。
3. **新发现的双重边界（通宵班 P0 待解）**：
   - 当对 `RING-MINIT-CONT.bak` 用仅 7 形集中拉 `2:standard` 时，`selftest3` 腿 C 会在几个隐藏单元跨越 ReLU 零点拐点报错（`1.51e-3–1.00e+0`）；而 12 形均衡蒸馏的 `nocg-d0` 稳定过 `selftest3 6/6 (0.00)` 且 Stage 1 并集达 `20/30`（含天火闭环）。
   - `pg-train`（无论是否开 `--klCand=0.5`）现役 rollout 桌面只有 `5P arena2`，会把 `2:standard`（`78.0% -> 81.4%`）和珠经济（`47.5% -> 41.3%`）向 5P 均势微漂；要想在蒸馏后用 PG 固化 2P，必须确认或使用低人数桌形分布。

---

## 三、全仓未完工作清单（按优先级整理）

1. **P0｜训练与测试脆弱点（阻塞交付质量）**
   - **`tools/smoke.mjs:127–137` 第 9 项随机暴毙**：固定 4 手 `['ジ','防御','ジ','防御']` 对随机抽取的 `lv:regular` 3HP AI 有概率在第 4 回合被破防打死触发 `#overlay-root`，造成整轮 `gate-all --np` 偶发红。
   - **2P 兼顾候选闭环**：在 `supfit-gd.mjs` 中组合「12 形基础集 + `--arenaShapes` 内加权 `2:standard@3` + `--teacher2=fsSpecialist`（仅 `5:long`）+ `--lr` / 截断微调」，争取在同一冻结推理包上同时站稳 `2P ≤ 35%`、珠闭环 `≥ 75%`、`ring + 天火` 活跃；`selftest3` 只记录该包能否继续梯度训练。
   - **v5 / `baseswap` 6 粒收尾评价**：早班 §三已指出这 6 粒仍未跑全 `pool-skill-report` 池级并集与 6-seed 同尺 Arena，尚无 `pool-add` 资格。

2. **P1｜冠军池提质与弱项替换**
   - **摘除两枚 `seatKill=2` 硬伤包**：`RING-MINIT-CONT`（`hard`，`invited=1`）和 `nov21-rod-tzt2d-r10`（`soft`，`invited=1`，是 `rod` 主载体）。新底座过 `promote --dry --support=2`、6-seed `seatKill=0` 与 Arena 三列后再 `--retire`。
   - **补齐 `dualGun / purify` 格阈值与决策 `mirror`**：当前全池 `coverage >= 1` 仅缺 `dualGun / purify`；`mirror` 在活跃集为 `0`，确认维持书面"可没有"或补入低剂量 `soft` 载体；另有 `FC-G1`（`G5[long]=31%`）与 `nov21-taunt-dsp0b`（`G5[long]=29%`）两枚可被更洁净双协同载体替代的成员。
   - **#78 文案区分**：区分"被盾挡导致聚合 `detRate < 25%`（如 `TK-FS4 loopRate=79.8%`）"与"真不引爆"两类病，更新 `firestorm-closure` / 页面文案，并在 `AGENTS.md §20` 下决策是否给 `firestorm-closure-1124.tsv` 配轻门。

3. **P2｜管线一致性、代码卫生与考古扫尾**
   - **#62 Lineage 增量与时间戳对齐**：当前 `137` 枚历史权重缺失导致 `rebuild-map` 跳过 `lineage.mjs` 全量重算；且 `pipeline-audit` 报 353 条秒级 vs 毫秒级 `ts` 格式漂移（如 `17:03:38` vs `17:03:38.760Z`）与 `138` 枚恢复件 `sha256` 差异，应在核对规则后给出只读对齐方案。
   - **旋钮 KPI 与扫描识别（已完成）**：`knobs.mjs` 现识别 `e.<KEY>` 等 env 别名，`EPIRUS_DIV_W / WALL_GAMES / VOID_W / BEAD_BOOM_W` 等回到在用；扫描器排除注释假键与 `EPIRUS_INSTR` 仪器全局量。当前全集 `185` / 在用 `144` / 动态 `41` / 暗键 `0`，`--check` 通过。
   - **`training/proto2/` 零代码引用探针归档（已完成）**：`coverage-gate.mjs` 与其余 22 个一次性探针共 23 个文件已整体移到仓外隔离目录，保留原相对路径与 SHA 清单；训练 README 已改为当前入口说明。
   - **v7 现成第 2 轮考古队列**：`scratch/v7-mined/server-jobs-1124-r2.tsv` 尚余 `v7b / v7new5_005 / v7ringB1` 三批可低成本静机验证，遵循 `AGENTS.md §12` 单分片跑、命中后回写历史 `META.ts`。

---

## 四、2026-11-24 通宵班执行时间表（23:15–06:30 · 并行子进程 ≤ 2）

> 红线：不跑整轮门禁，按改动面做定向验证；不直接 `rmSync` 删件（`AGENTS.md §24`）；不改 `js/core/**`（保住规则指纹 `bfd49045`）；训练启动对真实上游验 `selftest3`，新臂第一枚产物落盘立即验 `wid/v=92/arch=S1o`。

| 时段 | 任务 | 具体动作与预算 | 硬验收 / 止损线 |
|---|---|---|---|
| **P0a · 23:15–23:45** | 修 `smoke.mjs` 第 9 项随机暴毙 | 检查并加固 `tools/smoke.mjs:126–138`（如改 `5` 血或切 `lv:sparring` 后跑 4 手安全招，保留"真的打完 4 回合且不提前误弹出 over"校验），连跑 `5` 遍 `smoke.mjs` 复现验证 | 5/5 `SMOKE OK`，不放松失败判定；改 `tools/smoke.mjs` 后跑 `node tools/gate-all.mjs --np --group=ui` |
| **P0b · 23:45–01:15** | 攻关 `2P + 珠 + 天火` 候选包 | 以 `RING-MINIT-CONT.bak`（或洁净 `EQ-S4` / `RG-CN`）为底，`--teacher=pack:t65`、`--shapeTeachers` 禁用 `bundled-champion.js` 且在 `5:long` 加 `fsspecialist`、`--rareOnly=railgun,ring,curse,firestorm`（禁 `charge`），调 `12` 形中 `2:standard` 权重（如 `@2` 与 `@3` 对照）+ 微调 `lr`（`5e-5` / `1e-4`）/ `snapEvery`；每批 2 seed，训练启动预检过后测 2P `rule/legacy`、`probe-bead-loop`、`promote --dry`、6-seed Arena B | 目标：`promote --dry` **0 阻断**、2P `rule <= 35%`、珠闭环 `>= 70%`；连续 3 组上游预检不过则换正交基座，不降低数值门槛；产物 `selftest3` 只记可续训性 |
| **P1 · 01:15–03:15** | 池替换准备：`seatKill=2` 去偏（`ring` & `rod`） | ① 从 `FS-G2`/`TK-FS4` 或洁净 `RING` 底座重训低 `seatKill` 载体（先验证 2-seed `seatKill=0` 与 Stage 1 覆盖）；② 对高潜力候选跑完整入池前体检：`promote --dry --support=2` + 2-seed `seat` + 6-seed `arena-noise-floor` + `pool-skill-report --stage=1/2` | 只产生候选报告进 `STATUS`（按 `AGENTS.md §20` 完整链过线后才做 `pool-add`；任一柱子退步 > 阈值即放弃换包） |
| **P2a · 03:15–04:30** | 工程与管线清洁（不动核心语义） | ① 修 `training/knobs.mjs` 对 `nv(e.EPIRUS_*)` 读法的扫描口径后核查真正无读者死键，制定首批 `暗键` 清单并更新 `TRAINING-KNOBS.md`；② 为 `proto2/` 23 枚零引用文件生成迁移清单一览，准备提案或归档进隔离目录 | `node training/knobs.mjs --check` 绿；`meta` 门全绿；零误删 |
| **P2b · 04:30–05:30** | v7 第 2 轮短批 + #78/`audit` 收尾 | ① 静机单分片重跑 `scratch/v7-mined/server-jobs-1124-r2.tsv`（限时 ≤40 分钟，`--check` 保持 0 违例）；② 整理 #78 文案修复点（仅改动展示层或记录方案） | 命中即回写历史 `META.ts` 并 `git add -f`；超时立即收停并记结论 |
| **收口 · 05:30–06:30** | 定向认证与交接 | ① 清除临时失败日志并确认 `land-recovered --check`、`validate.mjs --strict`、`check-lineage.mjs` 全绿；② 按改动面跑定向组，`smoke` 单独连测确认稳定；③ 写入 `docs/research/STATUS-2026-11-25-morning.md` 并更新 `CHANGELOG.md`（如有发布变更），按规范提交 | 定向日志留档并注明不是整轮；零孤儿 `node` 进程 |

---

## 五、P3 低优先级余量：剩余丢失权重考古与复刻

仅在前面任务收口后、仍有时间时执行。以 `docs/ARTIFACT-LOSS-1119.tsv`、`scratch/v7-mined/` 与 `replay-diagnose` 的现账为队列，按单分片、可逐位验 `wid` 的方式继续；不猜参数、不把近似权重登记成原件。命中即回写台账与历史 `META.ts`，未命中保留诊断证据。时间不足时在晨间 STATUS 留下“已扫源 / 剩余批 / 下一枚最值得跑”的接力清单，不挤占 P0–P2 验收。
