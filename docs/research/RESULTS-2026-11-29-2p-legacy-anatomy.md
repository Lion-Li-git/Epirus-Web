# RESULTS · 2026-11-29 · 2P legacy 阶梯成员解剖

> 完成时间：2026-11-29 00:50（UTC+8）。
> 基线：`main@c8809216`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`，seed `98001–98004`。
> 证据：[`pool-2p-legacy-members-v2151.json`](evidence-2026-11-28-overnight-qwen/pool-2p-legacy-members-v2151.json)、[`pool-2p-legacy-members-v2151-analysis.json`](evidence-2026-11-28-overnight-qwen/pool-2p-legacy-members-v2151-analysis.json) 与 144 份逐 seed 原始格。

## 1. 结论

**新 seed 组没有复现 `regular` 与 `sparring` 仅差 `1.8pt` 的窄阶梯。**

- 当前 35 池基线：`regular = 26.15%`、`sparring = 30.25%`、`gap = 4.10pt`。
- 四个 seed 的 gap 分别为 `4.2 / 4.4 / 3.4 / 4.4pt`，全部 `≥2pt`。
- 因此本轮不把“阶梯过窄”当作已复现缺陷，不改成员、不调剂量、不补训练。

## 2. 成员归因

`Δgap = (摘除后 sparring − regular) − (BASE sparring − regular)`。正值表示摘除后阶梯变宽，即该成员当前在**压低 gap**；负值表示该成员当前在**支撑 gap**。

| 成员 | Δregular | Δsparring | Δgap | t 值 | 读法 |
|---|---:|---:|---:|---:|---|
| `TK-FS4` | −0.95 | 0.00 | **+0.95** | 3.18 | regular 侧最强支撑；摘除会显著拉开 gap |
| `TF-DR` | −0.58 | 0.00 | **+0.58** | 2.85 | regular 侧支撑 |
| `TN-S5` | −0.52 | 0.00 | **+0.52** | 2.66 | regular 侧支撑 |
| `JN-DR` | +0.40 | 0.00 | **−0.40** | 2.04 | 弱 gap 支撑；摘除会收窄 |
| `TK-PG` | +0.50 | −0.28 | −0.78 | 1.78 | 方向稳定但未过 2SE |
| `TM-S5-a40` | +0.10 | −1.08 | −1.18 | 1.70 | 方差大，不能单独归因 |
| `TA-S3-R8` | −0.22 | −1.42 | −1.20 | 1.63 | 方差大，不能单独归因 |
| `nov21-armor-tzt2d` | −0.25 | −1.22 | −0.97 | 1.35 | 方差大，不能单独归因 |

其余成员的 `|t| < 1.3`，不构成可行动信号。

## 3. 建议

1. **当前不调池**：4.10pt 阶梯已超过 2pt 目标线，没有需要修复的对象。
2. **后续若再出现窄阶梯**，先复核 seed 与桌形，再优先检查 regular 侧 `TK-FS4 / TF-DR / TN-S5` 是否被削弱；不要先删 soft 成员。
3. `TA-S3-R8 / TM-S5-a40 / nov21-armor-tzt2d` 的点估计显示它们支撑 sparring，但 seed 方差大，只能作为监测名单，不能据此改池。
4. 本报告只读，池表、顺序、剂量与规则指纹均未改。
