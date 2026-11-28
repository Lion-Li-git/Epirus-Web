# PLAN · 2026-11-28 通宵班（千问执行版）：工程清账 + 联合减负 LOO + 双主线精细化（`SOFT-RING`/`TM`） + 阶梯与红座加固 + 加班队列

> **计划定稿**：2026-11-28 23:25（UTC+8）；**23:32 修订**：按用户最新优先级将 `dualGun/mirror` 降为末尾 Stretch，并修正全池普查入口。
> **执行窗口**：2026-11-28 23:30 → 次日 08:30（UTC+8）；**禁止提前闲置收工**，主线提前完成后按顺序执行 §三 Stretch 加班队列。
> **出发基线**：`v2.1.51` + 补账提交 `0cd5ddcc`（已补齐 `TM-S5-a40`/`TN-S5` 噪声地板与 `TM-S5-a40` 小雷靶向复核），规则指纹 **`c61298e6`**，冠军池 **35 枚（`hard 17 / soft 18`）**，`pool-add --audit` 为 `bad=[] / arenaUnknown=0 / seatKilledAuto=0 / seatUnknown=0`。
> **证据目录**：[`evidence-2026-11-28-overnight-qwen/`](evidence-2026-11-28-overnight-qwen/)（本夜训练与测量专属目录）；全池 `selftest3` 沿用现有普查脚本的固定输出目录，文件名加 `v2151` 前缀。
> **授权边界**：允许清理已确认暗键、提交工作树补账、开发只读诊断工具、开展预注册训练与完整入池链升级；**严禁**修改 `js/core/` 规则引擎或改动规则指纹 `c61298e6`、**严禁**对 `selftest3` 红座直接开梯度、**严禁**跑 `--group=engine` 整轮门禁（遵守 `AGENTS.md §9`）、**严禁**物理抹除代码或旧权重（清理一律按 `AGENTS.md §24` 先对账 `registry.tsv` 再整体移至仓外隔离区）。

---

## 一、出发态势与约束护栏（避免重复劳动）

### 1.1 当前已核实的真实盘面（23:24 实测）

- **全池覆盖与单点短板**：`hard` 与 `soft` 各覆盖 **`28/28`** 技能（`dualGun/mirror` 仍为 **`0`**）。单成员独挑大梁的脆弱槽位：
  - `hard` 仅 1 枚覆盖：`mine`（`MN-PG`，且 `v2.1.49` 时为 `selftest3` 红）、`cannon`（`PG-CN`）、`purify`（`PUR-2P`）、`proto`（`T65-RINGBEAD`，`selftest3` 红）、`transfer`（`TF-DR`，废珠 `94.0%`）、`armor` ＆ `tank`（共在 `TK-FS4`）；
  - `soft` 仅 1 枚覆盖：`taunt`（`L1B-S1200` 仅 1 格）、`laserEye`（`LE-S2`）、`purify`（`PUR-DR`）、`rod`（`TF2-RD`）、`miniT`（`TM-S5-a40`）。
- **池内最突出弱包 / 冗余信号**：
  - `SOFT-RING-C3G25`（`soft`）：Stage 1 胜率 **`34.3%`**（全池最低）、`arenaB = -32.6`、废珠 `61.2%`；
  - `FC-S1`（`soft`）与 `MT-PG`（`hard`，`selftest3` 红、`miniT` 靶向 `0/39` 分）：`v2.1.49` LOO 已将其列为**退役建议候选**，尚缺联合摘除验证；
  - `TM-S5-a40`（`soft`）：已过 `PREREG` 硬门，但 `miniT` 靶向得分仅 **`8` 分 / `0.250` 分每施放**（`32` 施放中有 `24` 次打在 `ji(21)/gun(3)` 上，低于已淘汰的 `TM-S2` 的 `11` 分 / `0.688` 分每施放）；
  - `TA-S3-R8`（`soft`）：`seatKill=0`（`8.0%/6.5%`），但以 `long` 重八卦阵（`41.8%` 非ジ出手 / 白防 `87.6%`）与零珠经济换得；**本轮保留观察，不无故回退或重训**；
  - `2P legacy` 难度阶梯：`19.8% < 25.1% < 26.9%`，`regular` 与 `sparring` 间距收窄到 **`1.8pt`**。
- **工程账（Phase 0 已闭合）**：`node training/knobs.mjs --check` 为 **全集 35 / 暗键 0**；4 个历史名字已登记为退役项，设置时会响亮拒绝，`EPIRUS_JSON` 输出协议保持不变。环境旋钮定义唯一真源见 [`training/TRAINING-KNOBS.md`](../../training/TRAINING-KNOBS.md)（本文禁止复抄）。

### 1.2 明确禁止重复（`AGENTS.md §15`）

- ❌ 不重跑 `MN-PG / MT-PG / FC-S1 / TF2-RD` 单枚 LOO 角色审计（`v2.1.49` 已结案）；
- ❌ 不重跑 `L1b seg1800/2400`、`AR-TK2`/`FC-S1`/`MX8-R6B-KL`/`nov21-armor-tzt2d`/`MX6-GD-TF20`/`MX8-TN35-KL3`/`RG-MN` 直接 PG 或 `DR-R3E` Stage C 废珠对比（11-28 早班已证伪）；
- ❌ 不重开 `transfer` 注入与 `TA-S3-R2..R7` 已淘汰方案；
- ❌ 不以 `MN-PG / MT-PG / T65-RINGBEAD` 等 `selftest3` 红座作梯度训练起点。
- ❌ 不在核心主线前重开 `dualGun/mirror` 训练；用户已明确其优先级低于 `TA-S3` 与现役池加固，本班仅列为末尾 Stretch。

### 1.3 过程铁律

1. 并行子进程 **≤ 2**；`measure-point` 显式 `--jobs=2`；后台任务靠事件等待，严禁 sleep 轮询。
2. 新训练臂第一枚 `.bak` 落盘后**立即**验 `v:92 / S1o / 16561` + `selftest3`；凡声称「默认不变」或新机制旋钮方向性主张，按 `AGENTS.md §17–§18` 做同 seed 双跑 / 正反镜像对照。
3. 每次开臂前写入 `PREREG-*` 与 [`docs/TRAINING-RUN-LOG.md`](../TRAINING-RUN-LOG.md)；所有读数必须并列 **A / B / C=(A+B)/2** 及 `rulesFingerprint`、`fixtureKey`、seed、`champ=`。
4. 入池走完整链：`promote --dry --support=2` → `measure-point --bake --jobs=2`（`--fam=27` 或 `--method`）→ `pool-add` → `probe-diff-ladder --pool=1` → `pool-skill-report`（Stage 1 + Stage 2）→ `build-pool-bundle --split` → `rebuild-map` → `gate-all --auto`。

---

## 二、Phase 执行线（23:30 → 08:30）

### Phase 0（23:30–00:10 · 40 min）：工作树收口、消除旋钮暗键、刷新全池 `selftest3` 与固化只读探针

1. **确认干净基线**：补账已独立提交为 `0cd5ddcc`、本计划提交为 `36a9cca1`；核对 `git status`，记录当前分支、真实时间与 `pool-add --audit` 回执，Phase 0 代码改动另笔提交。
2. **退役 4 个历史暗键（已完成）**：在 `training/server/knob-guard.mjs` 登记 `EPIRUS_DIV_W`、`EPIRUS_JSON`、`EPIRUS_T3P_BASELINE`、`EPIRUS_WORKERS` 的退役原因；将它们排除出旋钮全集，同时保留 `detectDarkKnobs` 的响亮拒绝。已重生成 `TRAINING-KNOBS.md` 并验证 **全集 35 / 暗键 0**，逐个设置旧键均进入 `gone` 而非静默忽略。
3. **固化 `miniT` 靶向得分只读工具（已完成）**：新增 `tools/probe-minit-effectiveness.mjs`，支持 `--pack=<path|id>` 与 `--compare=<id1,id2>`，复用 `audit-lib`、`opp-pool` 与 `fixtures.tsv` 的 120 格种子；只计直放小雷，按目标 action 配对 `voided/voidImmune/rodBlock`。已复现 `TM-S5-a40 = 8 / 0.250`、`TM-S2 = 11 / 0.688`、`MT-PG = 0`、`JN-DR = 0`、`DR-R3E = 0`，证据落在本夜目录 `minit-*.txt`。
4. **刷新 `v2.1.51` 全池 `selftest3` 普查（已完成）**：以 `CENSUS_BASELINE=67ab6641` 跑现有普查脚本，产物为 `evidence-2026-11-27-overnight-qwen/selftest3-pool-v2151.{txt,json}`；实测 **31 绿 / 3 红 / 1 legacy / 0 error**。红座为 `MN-PG / MT-PG / T65-RINGBEAD`，legacy 为 `MSB11-R1S130778313`；`TM-S5-a40 / TN-S5 / TA-S3-R8` 均绿。

---

### Phase 1（00:10–01:30 · 80 min）：池减负与弱包角色联合 LOO 审计（先量再动）

**动机**：确定 `v2.1.49` 列出的退役候选（`MT-PG` + `FC-S1`）及全池最低胜率软包 `SOFT-RING-C3G25` 在 `v2.1.51` 池中的真实边际贡献，避免直接删包导致 `2P legacy` 变弱或新增倒挂。

- **测量工具**：`node tools/probe-diff-ladder.mjs --pool=1 --poolomit=...`
- **独立 seed 组**：`97001–97004`（2P `rule/legacy` 各 `4×1000` 局；5P `multi/long`、8P `multi/long` 各 `2×400` 局）。
- **三组实验**：
  1. **基线对照**（35 枚全池 `v2.1.51`）
  2. **Arm LOO-1**：`--poolomit=MT-PG,FC-S1`（联合摘除两枚退役候选）
  3. **Arm LOO-2**：`--poolomit=SOFT-RING-C3G25`（审计全池 `wr=34.3%` 最弱软包及软档 `2P legacy` 响应）
- **预注册判据**：
  - 若 **LOO-1** 无任何配置均值 `Δregular ≥ +1.5pt`、无新 `≥2σ` 倒挂、且经 Stage 1 覆盖复核 `hard` 与 `soft` 的 `28/28` 技能并集 **0 归零**：登记“两枚确认可联合退役”结论（若打算维持 35 枚编制，则在 Phase 2 完成后再同批补入新候选，保持 35 槽稳态）；
  - 若 **LOO-2** 摘除 `SOFT-RING-C3G25` 后反而使 `2P/5P` 变强或不变、且覆盖无唯一归零（检查其技能是否被 `L1B/LE-S2/PH-S2` 全覆盖）：确立在 Phase 2A 中优先**原位升级替换 `SOFT-RING-C3G25`** 的靶点。
- **结果（00:30）**：LOO-1 通过安全门，六配置 `Δregular=+0.03/+0.70/−3.13/−0.63/−0.38/−0.13pt`，覆盖仍 `28/28`；但 hard `miniT` 会变成 `JN-DR` 单载体，本班不退役。LOO-2 的 `2P rule +0.625pt > +0.5pt`，未过靶点门，Phase 2A 取消。详见 [`RESULTS-2026-11-29-pool-joint-loo.md`](RESULTS-2026-11-29-pool-joint-loo.md)。

---

### Phase 2（01:30–04:00 · 150 min）：单线精细化升级（严控单变量 + 硬止损）

> 至多两条训练线串行或 `≤2` 并行；每条必须先写 `PREREG-2026-11-29-*.md` 后启动，第一枚 `.bak` 立即验 `selftest3`。

#### 主线 A1（已取消）：升级 `SOFT-RING-C3G25`
- LOO-2 未过预注册靶点门（`2P rule Δregular=+0.625pt > +0.5pt`），本臂不启动，也不寻找替代靶点硬开。

#### 主线 A2：`TM-S5-a40` 小雷（`miniT`）精准靶向微调（目标：`pts/cast` 从 `0.250` 提至 `≥ 0.48`）
- **科学问题**：`TM-S5-a40` 已在 `soft` 入池，但 `miniT` 打中 `ji/gun` 达 `24/28` 次，浪费了高费反制定位。
- **单变量机制实验**（配 `winOnly=1` vs `winOnly=0` 镜像对照，遵守 `AGENTS.md §18`）：
  - 以全绿 `TM-S5-a40.bak` 为学生底座，用 `TM-S2.bak`（`miniT` 均分 `0.688`）作专科教师（`--teacher2=pack:docs/artifacts/TM-S2.bak --teacher2keys=miniT --teacher2frac=0.25`）+ `TM-S5-a40` 自教师护住 `transfer,jinshield,ring`（`--rareOnly=miniT,transfer,jinshield --rareFrac=0.30 --rolloutMode=game --objective=cand --dagger=0 --groups=1400 --steps=120 --lr=0.00015 --seed=20261129`）；同时跑两臂：`winOnly=0` vs `winOnly=1`（只改这一个标志）。
  - 若需要降废/稳场，对较优一臂补一段短程 `ridge PG`（`--games=1600 --klW=0.35 --klTilt=miniT,transfer,jinshield --klTiltMul=3`）。
- **硬门（全部达标才替换 `TM-S5-a40`，否则保留 `TM-S5-a40`）**：
  1. `selftest3` 全绿，`promote` 0 阻断，`90210/90211 seatKill=0`；
  2. Stage 1：`winRate ≥ 42%`、`miniT ≥ 4`、`transfer ≥ 15`、`jinshield ≥ 25`、废珠 `≤ 35%`；
  3. 用 `tools/probe-minit-effectiveness.mjs` 复测：`totalPts ≥ 10` **且** `pts/cast ≥ 0.48`（比 `TM-S5-a40` 的 `8 / 0.250` 明确翻倍级提升）。
- **结果（00:40）**：A0/A1 小雷分数达 `0.794/0.898`，但 Stage 1 胜率仅 `37.08%/36.58%`、废珠 `58.7%/44.4%`；A1 固定 PG 后胜率 `37.92%`、废珠 `55.7%`，仍不过门。三枚全部淘汰，`TM-S5-a40` 保留，池不变。详见 [`RESULTS-2026-11-29-tm-minit-targeting.md`](RESULTS-2026-11-29-tm-minit-targeting.md)。

---

### Phase 3（04:00–06:20 · 140 min）：`2P legacy` 阶梯解剖与 `JN-DR` 降废加固

**目的**：把原 Phase 3 的 `dualGun/mirror` 破冰降为末尾 Stretch，优先解决现役池可量化的阶梯收窄与高废底座问题。

1. **`2P legacy` 细粒度脚本解剖（40 min，只读）**：在相同 seed 下拆解当前 35 池在 `regular / sparring / hard` 的夺冠矩阵，定位 `regular (25.1%)` 与 `sparring (26.9%)` 仅差 `1.8pt` 的成员来源；输出定量调整建议，不直接改池。
2. **`JN-DR` 高废底座降废（100 min，预注册单臂）**：以绿色 `JN-DR.bak` 为起点跑 Stage C ridge PG（`--games=2400 --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15 --klModes=standard --klW=0.35 --klTilt=jinshield,miniT --klTiltMul=3`），首件立即验血统与 `selftest3`；硬门为 `jinshield ≥ 25`、总废珠 `≤ 45%`、`selftest3` 全绿、`promote` 0 阻断、两批人席 `seatKill=0`，并用小雷探针报告 `pts/cast`。未达门只记负结果，不扫参挽救。

---

### Phase 4（06:20–07:20 · 60 min）：`hard` 红座消隐可行性探针 ＆ 仓库一致性核验

1. **`hard` 红座（`T65-RINGBEAD` / `MN-PG` / `MT-PG`）替身可行性探针**
   - **背景**：若 `Phase 1` 确认 `MT-PG` 可被安全摘除或替出，池内 `hard` 红座将仅剩 `MN-PG`（唯一 `hard mine`）与 `T65-RINGBEAD`（唯一 `hard proto`）。
   - **动作**：按 `PH-S2` 的低废 `proto` 经验，只跑 **1 组轻量预研臂**（`PG-DR.bak` 绿底座 + `PH-S2.bak(proto,holo@0.35)` 蒸馏 `groups=1200, steps=120` + Stage 1 普查），验证能否低成本为 `hard` 造出第二枚可梯度续训的绿 `proto` 载体，解除 `T65-RINGBEAD` 的唯一覆盖绑定（**不强制在本班进池**，拿硬读数为白班铺路）。
2. **整页与地图数据互证**：
   - 运行 `node tools/pool-skill-report.mjs --bake`（若本班修改过池），运行 `node champion-map/rebuild-map.mjs` 与 `node tools/map-selfcheck.mjs`，确认 `skill-report.html` 卡数、`pool-members.tsv` 行数、`bundled-champion-pool.js` 与 `champion-map/index.html` 四视图 **`101 PASS / 0 FAIL`** 完全对齐。

---

## 三、Stretch 加班队列（07:20 前提前完成主线时顺序执行，直到 ≥08:15 再进入收工门禁）

> **规则**：凡主线提前做完或提前止损，立即顺延取用下列高价值条目，**不要提前数小时挂机收工**！

- **Stretch 1 · 历史 `scratch/` 大目录隔离清理**：
  先严格用脚本对账 `champion-map/data/registry.tsv`（及 `lineage.tsv` 父链）确认哪些 `scratch/arms/` 旧快照**无主且超期**，将无主旧临时文件夹保持原相对路径整体迁至仓外 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-29\` 并留 SHA256/清单，严禁任何直接删除。
- **Stretch 2 · `AR-TK2` 低优先级监测复核**：
  检查 `TA-S3-R8` 入 `soft` 后，`AR-TK2` 是否仍有保留价值（例如对比移除 `AR-TK2` 后的 4P/5P 阶梯变化与 `armor/tank` 覆盖深度）。
- **Stretch 3 · `dualGun/mirror` 只读诊断（最低优先级，不占核心窗口）**：
  仅在所有核心主线、加固与收工门禁完成后仍有余量时，依据 [`RESULTS-2026-11-28-dualgun-mirror.md`](RESULTS-2026-11-28-dualgun-mirror.md) 统计 `legal` 状态窗与策略概率；本班不开训练、不入池、不改规则引擎。

---

## 四、终轮收工门禁与交接规范（08:15–08:30）

1. **必跑验证**（按改动面执行，**不跑 `--group=engine`**）：
   - `node training/knobs.mjs --check`（必须 `暗键 0`）
   - `node champion-map/pipeline/validate.mjs --quiet`
   - `node tools/pool-add.mjs --audit`（必须 `bad=[]`、`untracked=0`、`seatUnknown=0`、`arenaUnknown=0`）
   - `node tools/gate-all.mjs --auto`（全部通过；报告中明确标注 `--auto` 为局部门禁，非全量认证）
2. **文书留痕**：
   - 更新 [`docs/TRAINING-RUN-LOG.md`](../TRAINING-RUN-LOG.md) 与 [`CHANGELOG.md`](../../CHANGELOG.md)（仅当产品池/代码有发布变更时升级版本号）；
   - 新建交接报告 `docs/research/HANDOFF-2026-11-29-morning.md`：按「已完成 / 未达门淘汰 / 新机制结论 / 未动保留项 / 次日白班建议」分栏，逐条写明真实文件路径、产物 `wid`、seed、`rulesFingerprint=c61298e6`、`fixtureKey=fx-pool1126d` 与未跑项说明，严禁编造或跳过失败项。
