# 研究结果：2026-11-28 transfer 状态窗诊断

> 证据目录：[`evidence-2026-11-27-overnight-qwen/`](evidence-2026-11-27-overnight-qwen/)。
> 完成时间：2026-11-28 01:43（UTC+8）。

## 读数

| 包 | 2P multi | 3P multi | 5P long | 8P long |
|---|---:|---:|---:|---:|
| TF-DR 声明数 | 0 | 0 | 7 | 16 |
| TF-DR 兑现/声明 | — | — | 0% | 12.5% |
| AR-TK2 声明数 | 43 | 13 | 10 | 8 |
| AR-TK2 兑现/声明 | 100% | 69.2% | 40.0% | 25.0% |
| PG-DR 声明数 | 0 | 0 | 0 | 0 |

- 三包在所有被测桌形均无无效目标。
- `TF-DR` 的转移声明稀少且长程兑现低，继续堆 transfer 出手没有明确收益。
- `AR-TK2` 在 2P multi 与 3P multi 有较高兑现，适合作为条件转移载体保留。
- `PG-DR` 完全不声明 transfer，不需要为它补转移训练。

## 裁定

- 不开 transfer 蒸馏臂。
- 保留 `AR-TK2` 作为 transfer 条件载体；`TF-DR` 的后续价值优先看其他技能，不看 transfer 出手数。
