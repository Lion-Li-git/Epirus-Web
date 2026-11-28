# PREREG · 2026-11-29 · v2.1.51 联合减负 LOO

> 立项时间：2026-11-29 00:10（UTC+8）。
> 基线：`main@67ab6641`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`，池 35 枚 `hard 17 / soft 18`。
> 边界：只读摘除测量；不改池、不退役、不入池、不训练。

## 1. 动机与方法论对账

- `PREREG/RESULTS-2026-11-28-v2149-role-audit.md` 已关闭四枚单成员 LOO：`MT-PG` 与 `FC-S1` 当时均无强度关键信号，也无唯一覆盖缺口，只列为退役建议候选。
- 本轮不是重证单枚结论，而是回答两个新增问题：两枚联合摘除是否安全；全池最低胜率软包 `SOFT-RING-C3G25` 是否已成为可原位升级的靶点。
- 当前池已换成 `TA-S3-R8`，且 `TM-S5-a40 / TN-S5 / TA-S3-R8` 的人席与噪声地板已补齐，因此使用新 seed 组 `97001–97004`，不与历史 `95001–96004` 混表。

## 2. 固定测量

- 工具：`tools/probe-diff-ladder.mjs --pool=1`；摘除组只改 `--poolomit`，其余成员与顺序不变。
- 配置与剂量：
  - `2p-rule`：`n=2, mode=standard, surrogate=rule, 4 seed × 1000 局`；
  - `2p-legacy`：`n=2, mode=standard, surrogate=legacy, 4 seed × 1000 局`；
  - `5p-multi / 5p-long / 8p-multi / 8p-long`：`surrogate=legacy, 2 seed × 400 局`。
- 三组视图：
  1. `BASE`：35 枚全池；
  2. `LOO-1`：`--poolomit=MT-PG,FC-S1`；
  3. `LOO-2`：`--poolomit=SOFT-RING-C3G25`。
- 主端点：`Δ = 摘除 − BASE`，单位 pt；正值表示摘除后替身夺冠上升，即 AI 变弱。
- 覆盖端点：用当前 35 枚 Stage 1 报告按 `hard/soft` 重算技能并集；只把“摘除后某带唯一覆盖技能归零”记为不可替代缺口。

## 3. 预注册判据

### LOO-1：联合退役安全性

满足全部三条才登记“两枚可联合退役”：

1. 六个配置的平均 `Δregular` 均 `< +1.5pt`；
2. 无显著新增倒挂：某 seed 原有序、摘除后倒挂，且该配置这些 seed 的 `Δregular` 均值 `> 2×SE` 并为正；
3. `hard/soft` 技能并集均无唯一技能归零。

即使通过，本臂也不删成员；若后续维持 35 枚编制，须与新候选同批替换，避免先删后补造成空窗。

### LOO-2：弱软包升级靶点

同时满足则确立 Phase 2A 原位升级 `SOFT-RING-C3G25`：

1. `2p-rule / 2p-legacy / 5p-multi / 5p-long` 的平均 `Δregular ≤ +0.5pt`；
2. 无显著新增倒挂；
3. 覆盖无唯一归零，或其技能由 `L1B / LE-S2 / PH-S2` 等剩余成员完整覆盖。

否则保留 `SOFT-RING-C3G25`，不为了追胜率直接删除。

## 4. 执行命令与产物

```bash
LOO_OUT=docs/research/evidence-2026-11-28-overnight-qwen \
LOO_PREFIX=pool-joint-loo1-v2151 LOO_TARGETS=MT-PG+FC-S1 \
LOO_SEED_BASE=97001 LOO_BASELINE=67ab6641 \
node docs/research/evidence-2026-11-27-overnight-qwen/pool-loo-2026-11-28.mjs

LOO_OUT=docs/research/evidence-2026-11-28-overnight-qwen \
LOO_PREFIX=pool-joint-loo2-v2151 LOO_TARGETS=SOFT-RING-C3G25 \
LOO_SEED_BASE=97001 LOO_BASELINE=67ab6641 \
node docs/research/evidence-2026-11-27-overnight-qwen/pool-loo-2026-11-28.mjs
```

每组产出 `*.json / *.tsv` 与逐 seed 原始 `*.txt`。`LOO_TARGETS` 内 `+` 表示联合摘除，逗号仍表示多个独立变体。读数方向冲突或样本不足时保留现状，不扫种子挽救。
