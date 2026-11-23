# 协同开发与后续计划 · 2026-11-23 午后版

> 本文档接力 [HANDOFF-2026-11-23-morning-for-next-shift.md](HANDOFF-2026-11-23-morning-for-next-shift.md) 与 [GOAL-2026-11-19-ruler-resolution.md](../GOAL-2026-11-19-ruler-resolution.md)，对齐 `13:35` 退役提交 `1061ac9e` 后的仓库真实基线，作为多 agent 后续并行协同的唯一入口。
> 训练旋钮与环境键真源一律引用 [TRAINING-KNOBS.md](../../training/TRAINING-KNOBS.md)，本文不复抄键表。

---

## 一、 当前对齐基线（`1061ac9e` 之后）

| 提交 | 内容 | 当前效果与遗留 |
|---|---|---|
| `bd69f75b` | 为 203 枚重训恢复的 `.bak` 回写历史 `META.ts` 并同步 `registry.tsv` / `lineage.tsv` | 修复 `SOUP-stock1XK2-l35` 触发的 `D233 §E487` 时间倒挂；`ARTIFACT-LOSS` 已在 `1061ac9e` 重刷为 0 违例。 |
| `4b7afe9a` + `f40236a0` | `champion-map/lineage.mjs` 的 2.0 `wid` 回退 | 已被 `1061ac9e` 的 registry 单源取代；`lineage-g3` 已退役。 |
| `c4e88431` | 修复 [ui.js](../../js/ui/ui.js) / [trainer.js](../../js/train/trainer.js) 4 处前端 Bug、[supfit-gd.mjs](../../training/proto2/supfit-gd.mjs) `--rareFrac` 切分 Bug；`v7press2` (6/6) + `v7role1` (3/3) 9 枚登账 | 池维持 32 枚（`hard 16 / soft 16`，`v2.1.16`）；`spec 81/81`、`knobs --check`（186 键：在用 19 / 暗键 167）、`smoke OK` 全绿；`missing` 181 → **172**。 |

---

## 二、 后续分阶段执行计划

### P0｜台账、谱系与门禁红灯清零（已完成 · 2026-11-23）

1. **P0-1 · `lineage-g3` 退役，`registry` 成为唯一血统源**
   - 已完成：`lineage-g3.tsv` 删除，完整快照归档到 `champion-map/archive/lineage-g3-retired-2026-11-23.tsv`；10 枚孤行归档到 `champion-map/archive/lineage-g3-orphans-2026-11-23.tsv`。
   - 已完成：`registry.tsv` 扩到 39 列，190 行 2.0 血统迁入；`lineage.tsv` 只由 registry 生成；`EFFG-s41` 已是 `cdeb5f7c18e336ba`。
   - 已完成：`add-point` / `viewer` / `anchor-recover` / `land-recovered` / `pipeline-audit` / `backfill` / D233 / D234 全部切走 g3。
2. **P0-2 · 同步 `docs/ARTIFACT-LOSS-1119.tsv` 状态与第 4 列**
   - 已完成：按“字节等于 registry.sha256 ⇒ ok；否则 sha-diff-wid-same + 记盘上 sha”重刷 216 行。
   - 结果：`node tools/land-recovered.mjs --check` 退出码 0；`state=ok 708` / `sha-diff-wid-same 103` / 标错态·第 4 列·wid·缺文件全部 0。
   - 根因记录：419 条不是新复刻包，是 `bd69f75b` 的 203 枚恢复件 META.ts 改写后台账未刷新；`KD-K2` 的 wid 已按盘上真实权重修为 `e2306c670a4c1a3f`。
3. **P0-3 · 清理重复暂存产物 `docs/artifacts/.training-in-3p.js`**
   - 已完成：按 `AGENTS.md` 第 24 条挪至 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-23-retire-lineage\.training-in-3p.js`；D191 已转绿。

---

### 执行记录（2026-11-23 13:35）

- 退役提交：`1061ac9e refactor(map): 退役 lineage-g3，2.0 血统并入 registry 单一管线`
- 全量认证：`np 166/166 · spec 81/81 · smoke OK · battle OK · map OK`，5 道全绿
- 台账：`land-recovered --check` 0 违例
- 工作区：干净（仅本文件为未跟踪的计划文档）

---

### P1｜2.0 冠军池盲区攻坚与规则对齐（核心产品线）

1. **P1-1 · 训练「反只枪压制 × 天火」新风格包（补齐 C 线弱点格与 `hard` 覆盖）**
   - **背景**：11-23 `probe-pool` 显示全 `hard` 池对人类「只枪压制」均值被赢 14.00%（最高 26.4% / `3.7σ`）、「全程只防御」`long` 最高 19.5%；且 `nov23-fs-c3g-tzt2d` 亦因被只枪打穿 65.7% 而淘汰。现 `supfit-gd.mjs` 的 `--rareFrac <= 0.25` 切分 Bug 已修，小剂量稀有键蒸馏通道已打通。
   - **路线**：开臂前先查 `docs/METHODOLOGY.md`（§15），第一枚落盘即验 `v:92 / arch:S1o / params=16,561` 血统（§16；`53,730` 是 v7 包的参数量，不是 obs6）。推荐方案：在抗枪底座（如 `taunt-dsp0b` / `OBS6P9` 行为栈）与 `c3g` 的 `curse,firestorm` 双键道间采用低剂量配比（`--rareOnly=firestorm,curse --rareFrac=0.10–0.20`）并用 `--shapeBal=1 --objective=cand`。
   - **入池全链**：严格执行 `promote --dry --support=2` → `measure-point --bake` → `pool-add` → `build-pool-bundle --split` → `pool-skill-report --bake` → `gate-all --auto`。
2. **P1-2 · 补齐 `hard` 带其余 0 覆盖技能与纠正 `long` 难度倒挂**
   - **`hard` 带覆盖缺口**（Stage 1 120 格当前为 0 活跃）：`firestorm`、`mine`、`cannon`、`rod`、`purify`、`mirror`（其中 `mirror` 已有可缺省裁定；`purify` / `rod` 可先从低成本微调推进）。
   - **简单档倒挂修复**：[bots.js](../../js/train/bots.js) 中 `lv:sparring`（「简单·陪练」）在 5 血 `long` 模式因掺入 `st:toolkit` 导致胜率压过 `lv:regular`（`-3.23σ` 倒挂），需调低 `st:toolkit` 席位比例或提高简单档探索率 `eps`。
3. **P1-3 · 引擎与裁定待确认项（需先对齐再改代码）**
   - **无害防误触修复**：[state.js](../../js/core/state.js) 中 `attemptAction` 在费用/CD 检查前提前写入 `lastTarget/lastTarget2` 且 `setVoid`/`endTurn` 未清，导致作废动作泄漏进 2.0 关系特征。
   - **规则裁定确认**：向用户确认 `N5`（小雷链从链首结算 vs 轮换序）、`N6`（大雷是否连带作废无辜第三方）、`N12`（全灭时回魂直接判胜）三项边缘语义；以及归档规则是否将 `spread > 2×容差带` 写入阻塞断言（见 [HANDOFF-2026-11-22-night-for-glm.md](HANDOFF-2026-11-22-night-for-glm.md) §5.3）。

---

### P2｜v7 历史权重回收余量（剩余 `172` 枚，严格分短批 `≤40 分钟` 推进）

- 现 [sweep-server-batches.mjs](../../scratch/sweep-server-batches.mjs) 已修复 `RING2_FORCE=1`、次选 era 候选与去并发 `git add`；后续任何新命中在入库前需像 `bd69f75b` 一样把 `.bak` 的 `META.ts` 对齐回 `registry.tsv` 的历史时间，防止再诱发 `D233` 倒挂。
- **剩余批次拆分（每轮控制在 20–35 分钟内，禁止堆长批）**：
  1. **Wave-A（30 分钟内 · 配方先校准再跑）**：先重查 `v7bead1 / bead2 / bead3` 在 09-21 原始跑法中的缺失变量（本次带着 `v7n1-93` 热启动与已挖 env 仍校准未过，疑似还有隐藏开关或 `BASE`/池版本差异）+ 跑 `v7bead15` / `v7bead25` / `v7bead100` 单 seed 探针。
  2. **Wave-B（25 分钟内 · 尾批收口）**：`v7curri2`（在 `0f66ee8f` 消融 `gens`/16 名池）、`v7role12`、`v7divK2`。
  3. **Wave-C（先挖后扫）**：用 [fam-recipe-mine.py](../../scratch/fam-recipe-mine.py) 全量块挖掘（取全部组合，严禁只取第一块）考古 `ringA1 / ringB1 / protoE / densE / t1 / t2 / u1` 后再分批排扫。

---

### P3｜工程瘦身、暗键清理与 CI 门禁转正

1. **推理补丁剥离与 `evo.js` 解耦**：评估逐步移除 [evo.js](../../js/train/evo.js) 中损害破防率的硬编码截胡先验（如 `BIGT_PUSH=12`、`DRAIN_PUSH=1`、`SUPPORT_PRIOR=2`），拆分退役的 v7 演化代码与 2.0 浏览器端推理外壳（严守 `js/train/policy2.js` 与 `training/proto2/arch2.mjs` 双胞胎约定）。
2. **env 旋钮与暗键清理**：[TRAINING-KNOBS.md](../../training/TRAINING-KNOBS.md) 当前总计 `186` 键（在用 19 / 暗键 167），分批清理暗键向 `AGENTS.md` KPI `≤40` 逼近。
3. **CI 与门禁哨兵**：清理 `gate-sentinel.mjs` 中过期签名（`L3 / L5 / D61 / D79`）与源码正则门；在连续 CI 稳定后移除 [.github/workflows/gates.yml](../../.github/workflows/gates.yml) 中 `browser` 任务的 `continue-on-error: true`。

---

## 三、 协同工作纪律速记

- **改动面门禁**：按改动的模块执行 `node tools/gate-all.mjs --auto`（非全轮），涉及界面变动加跑 `node tools/smoke.mjs` 与 `node tools/np-test.mjs --group=ui`；涉及图/池变动跑 `node tools/map-audit.mjs` 与 `node tools/land-recovered.mjs --check`。
- **防误删与不空等**：废弃权重与临时产物一律移入 `D:\code\Epirus-Web-artifacts-quarantine\`；长批跑前先做 1 粒 `calibSeed` 或估算总时长（≤40 分钟）。
