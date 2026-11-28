# RESULTS · 2026-11-29 · v2.1.51 联合减负 LOO

> 完成时间：2026-11-29 00:30（UTC+8）。
> 预注册：[`PREREG-2026-11-29-pool-joint-loo.md`](PREREG-2026-11-29-pool-joint-loo.md)。
> 基线：`main@d558abce`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`，seed `97001–97004`。
> 证据：`evidence-2026-11-28-overnight-qwen/pool-joint-loo{1,2}-v2151.{json,tsv}`、逐 seed `*.txt`、[`pool-joint-loo-v2151-analysis.json`](evidence-2026-11-28-overnight-qwen/pool-joint-loo-v2151-analysis.json)。

## 1. 结论

1. **`MT-PG + FC-S1` 通过预注册的联合退役安全门**：六配置 `Δregular` 均 `< +1.5pt`，无显著新增倒挂，hard/soft 技能并集均保持 `28/28`。但本臂不删成员；且联合摘除会把 hard `miniT` 变成 `JN-DR` 单载体，真正退役前应同批补回冗余或明确接受该风险。
2. **`SOFT-RING-C3G25` 未通过升级靶点门**：`2P rule Δregular = +0.625pt`，高于预注册 `≤ +0.5pt` 上限；虽然 2P legacy 与 5P multi 摘除后变强，但方向不一致。因此 **取消 `SOFT-RING-A1` 训练臂**，不找替代靶点硬开。
3. 池成员、顺序、规则指纹均未改；Phase 2 只执行已预注册的 `TM-S5-a40` 小雷靶向镜像双臂。

## 2. 主尺读数

`Δ = 摘除 − BASE`，单位 pt；正值 = 摘除后替身夺冠上升 = AI 变弱。

| 视图 | 配置 | BASE regular | 摘除 regular | Δregular | Δsparring | 新增倒挂 |
|---|---|---:|---:|---:|---:|---:|
| `MT-PG+FC-S1` | 2P rule | 41.25 | 41.28 | **+0.03** | −1.60 | 0 |
| `MT-PG+FC-S1` | 2P legacy | 24.90 | 25.60 | **+0.70** | +0.10 | 0 |
| `MT-PG+FC-S1` | 5P multi | 11.38 | 8.25 | **−3.13** | −1.50 | 0 |
| `MT-PG+FC-S1` | 5P long | 8.25 | 7.63 | **−0.63** | +2.63 | 0 |
| `MT-PG+FC-S1` | 8P multi | 11.50 | 11.13 | **−0.38** | +0.88 | 2 |
| `MT-PG+FC-S1` | 8P long | 9.25 | 9.13 | **−0.13** | −0.75 | 1 |
| `SOFT-RING-C3G25` | 2P rule | 41.25 | 41.88 | **+0.63** | +2.50 | 0 |
| `SOFT-RING-C3G25` | 2P legacy | 24.90 | 24.18 | **−0.73** | −0.33 | 0 |
| `SOFT-RING-C3G25` | 5P multi | 11.38 | 9.25 | **−2.13** | −2.88 | 0 |
| `SOFT-RING-C3G25` | 5P long | 8.25 | 7.75 | **−0.50** | +3.75 | 0 |
| `SOFT-RING-C3G25` | 8P multi | 11.50 | 12.25 | **+0.75** | −0.75 | 1 |
| `SOFT-RING-C3G25` | 8P long | 9.25 | 8.25 | **−1.00** | −0.50 | 0 |

### 新增倒挂的显著性

- 联合摘除的 8P multi 两枚新倒挂对应 `Δregular = −0.75 / 0.00`，方向不为正，不构成“摘除后显著变弱”。
- 联合摘除的 8P long 仅 1 枚新倒挂（`+1.50`）；弱包摘除的 8P multi 也仅 1 枚（`+3.00`）。单 seed 无法估计 SE，按预注册不判显著。
- 没有任何配置出现 `n≥2` 且 `mean(Δregular) > 2×SE` 的正向新增倒挂。

## 3. 覆盖端点

| 状态 | hard 成员 / 并集 | soft 成员 / 并集 | 唯一覆盖变化 |
|---|---:|---:|---|
| BASE | 17 / 28 | 18 / 28 | 基线如旧 |
| 摘 `MT-PG+FC-S1` | 16 / 28 | 17 / 28 | 无归零；hard `miniT` 新增单载体 `JN-DR` |
| 摘 `SOFT-RING-C3G25` | 17 / 28 | 17 / 28 | 无归零 |

覆盖并集按当前 Stage 1 报告 `coverage>0` 重算；`dualGun/mirror` 仍为 0，不计入 28 技能并集。

## 4. 执行事故与隔离

首次运行把 `LOO_TARGETS=MT-PG,FC-S1` 解释成两枚独立单摘，产出了不属于本预注册的重复单摘读数。该批文件已整体移到：

`D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-29-loo-single-repeat\`

本结果只使用修正后的 `MT-PG+FC-S1` 联合变体；`+` 现表示联合摘除，逗号仍表示多个独立变体。

## 5. 裁定

- `MT-PG / FC-S1`：保留为“可联合退役候选”，但**本班不执行退役**；没有同批替代包，不先删后补。
- `SOFT-RING-C3G25`：保留；取消 `SOFT-RING-A1`，不扫种子或换靶点。
- `TM-S5-a40`：按 [`PREREG-2026-11-29-tm-minit-targeting.md`](PREREG-2026-11-29-tm-minit-targeting.md) 开 `TM-MINIT-A0/A1` 镜像双臂。
