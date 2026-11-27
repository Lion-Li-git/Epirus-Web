# PLAN · 2026-11-27 通宵班（千问执行版）：442b4b68 新指纹基准重建 + 现成绿粒落地 + 高废珠与新规则红利线

> **计划定稿**：2026-11-27 23:20（UTC+8）
> **执行窗口**：2026-11-27 23:30 → 2026-11-28 08:00（共 8.5 小时）
> **出发基线**：`v2.1.43`（`rulesFingerprint = 442b4b68`，35 池 `hard 17 / soft 18`，含 `v2.1.42` 核心规则边界修复 + `v2.1.43` P1/P2 修复）
> **执行主体**：千问（遵循 `AGENTS.md` §15–24 夜班规范：不设「待裁」，预注册达标直接走完整入池链；收工落盘 `RESULTS` 与 `HANDOFF`）

---

## 一、出发前必须认清的现状（为什么今晚先建基线再开训）

1. **旧技能账已全部过期（35 / 35 非当前指纹）**：
   - 截至 v2.1.43，`champion-map/data/skill-report/*.json` 里有 33 份仍贴着 `bfd49045`、2 份贴着 `03a9cc97`，**0 份**测量于当前规则指纹 `442b4b68`（`v2.1.42` 集中修了回魂免珠、过载炮互轰、金刚盾 pri 3 主动判定、镜面复制已作废来源、激光眼破双盾/次轮八卦、取消大雷连带转向与全息反打、天火转移穿透、避雷针/反复横跳等 11 项核心规则）。
   - 同时，`v2.1.43` 修复了 `js/pool-draw.js` 在 2P 桌因 `distinct===1` 把 `lv:regular` 的 `bandW` 洗成均匀抽签的 bug、`policy2.js`/`arch2.mjs` 的 `greedy:true` 恒取第 0 候选 bug、`evo.js` `beliefSearchPick` 对 2.0 包报错与 `wrapBotN` 丢 `bead` bug。
   - ⇒ **所有旧 `skill-report`、旧 2P `lv:regular` 阶梯读数都必须在本班 Phase 0 重新测量**，不许拿旧表数字当新基线（`AGENTS.md §7/8`）。
2. **明确不做的方向（`AGENTS.md §15/21` · 禁重复已否证路线）**：
   - 不改 `js/core/**`（规则已封板）；不改 `obs6` 特征语义（`outcomeBits` 跨回合泄漏推迟至未来 `obs7` 专案）；
   - 不做 2P 独立子池（`D-34`）或 2P 推理端路由（`D-35`）；不动 `lv:sparring` `scriptMix` 签名（受 `D227` 与 `tools/diff-ladder-claims.mjs` 约束，`st:mix` 在首席系防止 `long` 倒挂之有意设定）；
   - **禁止重跑 11-26 夜间已淘汰配方**（见 [`PLAN-2026-11-26-overnight-shape-coverage.md`](PLAN-2026-11-26-overnight-shape-coverage.md) §六）：
     - `W1/W2`（`PG-DR + taunt` 导致电珠闭环塌至 13–22% 且电磁炮归零）；
     - `W3`（`MT-DR` 单段 PG，已由 `v2.1.37` 的两段式 `MT-PG` 解决并替换入 hard）；
     - `T1–T3 / T6 / T7`（高剂量坦克蒸馏或 `OBS6E9` 坦克教师）；
     - `R1 / R2 / R3`（对绿色包直接硬喂 `charge`/`railgun` 教师导致盲蓄泛滥）；
     - `TF-DR` 继续堆 `transfer` 出手。

---

## 二、铁律与预注册验收口径

1. **过程护栏**：
   - 并行子进程 **≤ 2**；后台任务靠完成后处理，不前台空转轮询；
   - 新臂**第一枚** `.bak` 落盘立即验血统（`v:92 / S1o / 16561` + `runSelftest3`，见 `training/README.md` §五）；`selftest3` 红立刻停臂止损，禁止带着红色底座跑后段梯度；
   - 严禁运行 `np-test --group=engine` 整轮门禁；按改动面挑定向门；
   - 任何清理旧文件/临时目录不得物理 `rm`，必须按 `AGENTS.md §24` 先对账 `champion-map/data/registry.tsv` 后整体移至仓外 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-27\`。
2. **统一入池完整链（`AGENTS.md §20`）**：
   - 每枚候选入池必须走完：`promote-champion.mjs --dry`（0 阻断、人席 `90210/90211` `seatKill=0`） → `measure-point.mjs --bake` → `pool-add.mjs` → `probe-diff-ladder.mjs --pool=1`（2P 8 seed + 5P multi/long 4–8 seed 阶梯不反超、不塌陷） → `pool-skill-report.mjs` → `build-pool-bundle.mjs --split` → `rebuild-map.mjs` → `np-test --part=ship-pool` / `--part=meta-repo` / `--only=D16` / `--only=D168`。
3. **三轴同看（`AGENTS.md §7`）**：任何淘汰/保留判断必须同时记录 A（脚本池）/ B（冠军混合夹具 `champ=` 戳）/ C=(A+B)/2 与 2P `rule/legacy`、`5P multi/long` 阶梯影响，不许只报单一胜率。

---

## 三、分阶段执行线与预注册达标线

### Phase 0（23:30–00:30 · 60 min）— 新指纹 `442b4b68` 全量基线重建【必做】

1. **全池技能普查重跑（约 15–20 min，≤2 并发分批）**：
   - 运行 `node tools/pool-skill-report.mjs --all`（确认所有 35 份 json 均写上 `rulesFingerprint: "442b4b68"`、`fixtureKey: "fx-pool1126d"`），重烘 `champion-map/skill-report.html`。
   - 重点核对规则敏感成员变化：`JN-DR`（金刚盾改独立 pri 3 后胜率/命中率变化）、`HL-G1`（全息在大雷下不再反打被护者）、`FS-DR / FS2-LE26 / TK-FS4`（天火转移穿原型制御 + 激光眼破双盾/次轮八卦）、`RD-PG`（避雷针电伤走铁索+拦截镜面雷）、`MN-PG / PG-CN`。
2. **`selftest3` 35 池绿色底座重普查（约 5 min）**：
   - 运行修复版 `selftest3`（`v2.1.40` 修正了并列 argmax 与 `ε=1e-5`）过一遍 `hard 17` 与高优先级 `soft`，更新一份当前 35 池的绿色可行底座清单（替换掉 `v2.1.36` 前的旧 25 池账），明确 `DR-R3E`、`JN-DR`、`nov21-taunt-dsp0b`、`HL-G1`、`PG-DR`、`T65-RINGBEAD`、`TF-DR`、`OBS6E9` 等谁绿谁红。
3. **新基线难度阶梯重测（约 10–15 min）**：
   - 跑 `node tools/probe-diff-ladder.mjs --pool=1`（2P `rule/legacy` 8 seed + 5P `multi/long` 4 seed），落盘对比 v2.1.41 旧阶梯：
     - 检验修复 `pool-draw.js` 2P `bandW` 后，**2P `lv:sparring < lv:regular < lv:hard`** 是否从真实加权抽签中保持单调有序（此前 2P `lv:regular` 被洗牌兜底吞掉）。
     - 若新指纹下 `5P long` 出现普通/简单反超，立即记录并交给 Phase 1/3 的 soft 替换线修复。

---

### Phase 1（00:30–01:40 · 70 min）— 零新训高 ROI：现成绿快照在新指纹下落地

1. **评估现成绿粒候选**（均已有磁盘产物且在 v2.1.40 通过 `selftest3`）：
   - `nov27-long-pgdr-l1b` 的 **`seg1200`**（原测 19/30 并集、84.15% 电珠闭环，是 `v2.1.40` 遗留待入池候选）以及 `seg600` / `seg2400`；
   - `nov27-pg-rod-s1.seg1800`（`v2.1.40` 第二候选，5P multi 更强）。
2. **替换靶点（专清 soft 带 `seatKill > 0` + 超 90% 废珠历史欠账）**：
   - 目前池内仍有 4 枚 `invited=1, seatKill>0` 的 soft 成员：`MX8-R6B-KL`（`seatKill=1, waste=91.9%`, `rod` 载体，但 hard 已有 `RD-PG` 承担 312 次 `rod`）、`MX6-GD-TF20`（`seatKill=1, waste=96.9%`）、`MX8-TN35-KL3`（`seatKill=1, waste=90.4%`）、`RING-MINIT-CONT`（`seatKill=2`）。
   - 检查规则：先用 Phase 0 的新 `skill-report` 核对 **pool-wide 技能下限与并集**：只有当某项唯一载体不会归零，且替换后 **`seatKill=0`、promote 0 阻断、2P/5P 三档阶梯保持有序不软化**，才执行入池替换。
   - 达标阈值：新入 soft 候选废珠率 ≤ 60%、A/B/C 正向或持平、5P `long` `regular`/`sparring` 不再产生 ≥2σ 退化。

---

### Phase 2（01:40–04:50 · 190 min）— 主线训练：高废珠清理（A 线）与新规则红利先导（B 线）

#### A 线：hard 带剩余高废珠清理（沿用 `v2.1.37` Stage C PG 配方，不新增旋钮）
- **候选排序**（按 [`replacement-priority.tsv`](evidence-2026-11-26-value-coverage/replacement-priority.tsv) + Phase 0 绿账，只选 `selftest3` 为绿的底座）：
  1. **`DR-R3E`**（当前 `waste=77.6%`, `drain` 核心载体, 已知 `selftest3` 全绿）；
  2. **`JN-DR`**（当前 `waste=77.0%`, `jinshield` 核心载体，**若 Phase 0 `selftest3` 仍红则直接跳过，不硬跑梯度，改用以绿色底座蒸出 `jinshield`**）；
  3. **`nov21-taunt-dsp0b`**（`waste=97.8%` 全池最高，`selftest3` 绿，**注意教训 W1/W2**：不可用纯 `PG-DR + taunt`，改以自身或含 `taunt` 的绿底座跑 Stage C PG 并带 `--klW` 保住 `taunt` ≥ 8 格）。
- **统一配方**：
  - `node training/train.mjs --mode=pg --up=<底座> --games=2400..3600 --batch=48 --lr=3e-4 --lamExp=1.10 --penDeadElec=0.70 --beadSpendW=0.50 --klW=<视漂移 0.2..0.5> --klModes=standard --segEvery=600`
- **A 线预注册达标与止损**：
  - 废珠率相对底座下降 **≥ 40%**（或电珠闭环升至 **≥ 45%**）；
  - 底座立身技能（如 `DR-R3E` 的 `drain`、`nov21-taunt-dsp0b` 的 `taunt`）Stage 1 有效格不归零、降幅 ≤ 30%；
  - Arena B 不劣于底座 `-2pt`、2P `rule/legacy` 退化 ≤ 2pt、promote 0 阻断、`seatKill=0`；
  - 若 `seg1200` 出现立身技能跌破阈值，立即降预算切 `seg600` 或换下一底座，绝不盲目拉长到 4800 局。

#### B 线：新指纹 `442b4b68` 规则红利先导诊断与轻调（先诊断 15 min，有信号才开训）
- **研究假设**：
  - **金刚盾主动判定**：`442b4b68` 起金刚盾不再要求「先挨打」才反击，变为 pri 3 独立判定伤害声明目标。先对 Phase 0 产出的 `skill-report` 统计全池 `jinshield` 窗口与胜率变化。
  - **全息与复合光火/聚光炮**：大雷不再因给队友套全息而被弹死，测试 `HL-G1` 的 `holo` 兑现与团队生存贡献是否显著改善。
- **开训门槛（严格 `METHODOLOGY §48`）**：
  - 先跑窗口/胜率诊断（15 分钟上限）；仅当发现明确的「可负担高胜率窗口未充分利用」且存在绿色底座时，才跑 1 组「轻剂量 PG/蒸馏 vs 无修改对照组（`AGENTS.md §18` 镜像/同 seed 对照）」验证因果，否则只落盘诊断结论并把剩余 GPU/CPU 预算转回 A 线或 Phase 3。

---

### Phase 3（04:50–06:30 · 100 min）— C 线：`soft` 5P 长程防软化与旧世代包退场

- 针对 `soft` 带里仍拖累 5P `long` 的历史旧包：
  1. **`MSB11-R1S130778313`**（`obs5` 旧架构化石，Arena B `-47.80pt`）；
  2. **`RINGB11` / `SOFT-RING-C3G25`**（Arena B `-32.72pt` / `-32.56pt`）；
  3. **`MX6-GD-TF20` / `MX8-TN35-KL3`**（`seatKill=1`，`waste > 90%`）。
- 优先从 Phase 1（`l1b` 各 seg 快照、`nov27-pg-rod-s1`）、Phase 2 淘汰但 5P 强健的中间快照（soft fallout 口径），以及少量低风险 `PG-DR` 轻蒸多技能副本中选出 1–2 枚替换候选，做到 **不增加 2P/5P 反超、降低 `soft` 平均废珠并清零 `seatKill`**。

---

### Phase 4（06:30–08:00 · 90 min）— 完整验收链、页面重烘与交接【禁止再开贵臂】

1. **06:30 起停开任何超过 5 分钟的新训练臂**，专注已完成候选的收口。
2. 对今晚决定入池的所有成员逐一跑完完整闭环：
   - `promote-champion.mjs --dry` → `measure-point.mjs --bake` → `pool-add.mjs`
   - `node tools/pool-skill-report.mjs --all` + 重烘 `skill-report.html`
   - `node tools/build-pool-bundle.mjs --split --ver=<新池戳>`
   - `node champion-map/rebuild-map.mjs`
   - `node tools/probe-diff-ladder.mjs --pool=1`（验证 2P `rule/legacy` 与 5P `multi/long` 全相邻台阶有序）
   - `node tools/pool-add.mjs --audit`（确认 `bad=[]`）
   - 定向门禁与真浏览器测试：`np-test --part=ship-pool`、`np-test --part=meta-repo`、`np-test --only=D16`、`np-test --only=D168`、`smoke.mjs`、`battle-test.mjs`（**不跑 `--group=engine` 整轮**）。
3. **文书与交接（`AGENTS.md §11/14/23`）**：
   - 写 `docs/research/RESULTS-2026-11-28-overnight-qwen.md`（写清 A/B/C 三轴读数、`champ=` 戳、每条淘汰臂的失败腿，拒绝只报单轴）；
   - 写 `docs/research/HANDOFF-2026-11-28-morning.md`（附真实时钟、池前→池后对照、下阶段明确建议）；
   - 若池成员或版本更新，同步 `CHANGELOG.md` 与 `README.md` 最新现状（遵守 `README.md` 不留历史快照、范围用 `–` 不用 `~`），**仅本地提交，不要 `git push` 或擅自物理删文件**；
   - 顺手附带整理一页 **P3 工程债务可执行清单** 供白天确认（不直接动手删文件）：
     - `.github/workflows/pages.yml` 排除 ~17.5MB `champion-map/archive/`；
     - `.github/workflows/training.yml` 补上 `js/train/policy2.js` 触发路径；
     - `training/knobs.mjs`（当前 185 键，KPI ≤40）清理前置对账与 `train-3p.mjs` 遗留引用扫除清单。

---

## 四、时间盒总览

| 时段（UTC+8） | 核心目标 | 硬退出条件 |
|---|---|---|
| `23:30–00:30` | Phase 0：35 池 `skill-report` (`442b4b68`) + `selftest3` 全谱 + `probe-diff-ladder` 新基线 | 三表全部落盘；若 2P/5P 阶梯出现严重异常，优先定位再进 Phase 1 |
| `00:30–01:40` | Phase 1：`nov27-long-pgdr-l1b.seg1200` / `nov27-pg-rod-s1.seg1800` 新指纹验收与入池评估 | `promote` 0 阻断且 `seatKill=0`、5P `long` 不软化即落地替换 `seatKill>0` 成员，否则记账淘汰 |
| `01:40–04:50` | Phase 2：A 线（`DR-R3E` / `nov21-taunt-dsp0b` Stage C PG）+ B 线（15min 诊断 + 决策） | 首枚必须验血统；连续 2 臂未达标立刻切换线路 |
| `04:50–06:30` | Phase 3：C 线（清理 `MSB11` / `seatKill>0` 对 `soft` 与 `5P long` 拖累） | 确保全池技能并集不降、`5P long` 阶梯保序 |
| `06:30–08:00` | Phase 4：全套烘焙、池审计、定向门与浏览器验证、`RESULTS` / `HANDOFF` 交接 | `06:30` 起禁止新开重训练；收工前跑齐验收命令并确认工作树整洁 |

---

## 五、常用命令速查

```powershell
# 0. 检查规则指纹与旋钮守卫
node tools/rules-fingerprint.mjs
node training/knobs.mjs --check

# 1. Phase 0 新指纹基线重建
node tools/pool-skill-report.mjs --all
node champion-map/build-skill-page.mjs
node tools/probe-diff-ladder.mjs --pool=1

# 2. 新臂首枚落盘血统 + selftest3
node training/proto2/selftest3.mjs --pack=<path.bak>

# 3. Stage C 控废珠 PG（先按 Phase 0 确认底座 selftest3 全绿）
node training/train.mjs --mode=pg --up=<绿底座.bak> --games=2400 --batch=48 --lr=3e-4 `
  --lamExp=1.10 --penDeadElec=0.70 --beadSpendW=0.50 --klModes=standard --segEvery=600 --out=<out.bak>

# 4. 入池标准验收链（必须按顺序走完）
node tools/promote-champion.mjs --pack=<out.bak> --dry
node tools/measure-point.mjs --pack=<out.bak> --bake
node tools/pool-add.mjs --pack=<out.bak> ...
node tools/pool-add.mjs --audit
node tools/build-pool-bundle.mjs --split --ver=<ver>
node champion-map/rebuild-map.mjs

# 5. 收工定向门禁（禁跑 --group=engine 整轮）
node tools/spec-run.mjs
node tools/np-test.mjs --part=ship-pool
node tools/np-test.mjs --part=meta-repo
node tools/np-test.mjs --only=D16
node tools/np-test.mjs --only=D168
node tools/smoke.mjs
```

---

## 六、DONE / DOING / NEXT（交班起点）

- **DONE**：
  - `v2.1.42` 核心规则边界 11 项修复及取消大雷连带转向已本地提交，规则指纹 `442b4b68`、`spec 94/94`、`engine-rules 63/63`、`ui-contract 8/8`、`meta-repo 13/13`、`D16`/`D168`/`smoke` 全绿。
  - `v2.1.43` 已完成 P1（`pool-draw.js` 2P `bandW` 修复、`pool-loader.js` 整表校验、`style.css` 窄屏与弹窗换行、`ui.js` 观战刷新/待生效徽章/梦魇摄魂/3P 导入导出隔离/DAgger 进度曲线、`rules-panel.js` 加粗渲染）与 P2（`policy2.js`/`arch2.mjs` `greedy` 修复、`evo.js` `beliefSearchPick` 2.0 兼容与 `wrapBotN` `bead` 保留、`train-server.mjs` Windows 进程树与安全/参数修复、`pg-train.mjs`/`supfit-gd.mjs` 防呆）。
- **DOING**：
  - 无正在运行的训练进程或后台任务。
- **NEXT（千问接班第一步）**：
  - 立刻从 **Phase 0** 起步：并发 `≤2` 重跑 35 池 `pool-skill-report.mjs`（对齐 `442b4b68`），同步跑新 `selftest3` 全谱与 `probe-diff-ladder --pool=1`，拿到最新基准后再执行 Phase 1 → Phase 2。
