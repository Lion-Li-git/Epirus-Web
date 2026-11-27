# PREREG · 2026-11-28 · DR-R3E Stage C 对照与处理

> 基线：`v2.1.45 / 82427b8a`，规则指纹 `c61298e6`。
> 证据目录：[`evidence-2026-11-27-overnight-qwen/`](evidence-2026-11-27-overnight-qwen/)。
> 唯一处理变量：Stage C 奖励包（`lamExp / penDeadElec / beadSpendW`）整体开关；不声称拆开三个旋钮的独立贡献。

## 1. 假设

从绿色 `DR-R3E` 出发，Stage C 奖励包可在保住 `drain` 立身技能、2P 强度和 Arena 强度的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/DR-R3E.bak`（`eae4b0ad4013c202`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `klW=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 两路最多并行 2；首枚 `.bak` 落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`。

## 3. 两臂

### A0 对照

`lamExp=0 / penDeadElec=0 / beadSpendW=0`，其余与 A1 完全相同。

### A1 处理

`lamExp=1.10 / penDeadElec=0.70 / beadSpendW=0.50`，其余与 A0 完全相同。

输出：

- `scratch/arms/nov28-dr-r3e-a0.bak`
- `scratch/arms/nov28-dr-r3e-a1.bak`

## 4. 验收

每个快照同时报：

- `elecGained / elecSpent / elecExpired` 与 `/局`；
- `boomGained / boomSpent / boomExpired` 与 `/局`；
- 2/3/5/8P × multi/long 剖面；
- `drain` 有效格、兑现率与次数；
- Stage 1 胜率、并集、A/B/C、2P rule/legacy、5P multi/long。

硬条件：

1. 过期电珠 `/局` 相对 A0 下降 ≥40%；
2. 花珠绝对值不低于 A0 的 80%；
3. `drain` 有效格不归零，降幅 ≤30%；
4. Arena B 不劣于 A0 2pt；
5. 2P rule/legacy 退化 ≤2pt；
6. promote 0 阻断、两 seed 人席 `seatKill=0` 才考虑入池。

## 5. 止损

- 首件血统错或 `selftest3` 红：立即停该臂。
- 第一枚完整候选无行为信号：停止该线，不扫 lr/KL/seed。
- `seg1200` 立身技能跌破阈值：可用 `seg600`，不盲目拉长。
- 两臂都无信号：转后备队列，不用重复测量填时间。
- 只有 A1 有信号才开第二起点；第二起点从 Phase 1 绿色 `JN-DR` 或 `FS-DR` 中选一枚。
