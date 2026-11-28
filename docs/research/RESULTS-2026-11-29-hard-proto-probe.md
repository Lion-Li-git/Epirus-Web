# RESULTS · 2026-11-29 · hard `proto` 绿色备份探针

> 完成时间：2026-11-29 01:05（UTC+8）。
> 预注册：[`PREREG-2026-11-29-hard-proto-probe.md`](PREREG-2026-11-29-hard-proto-probe.md)。
> 基线：`main@f412ed6a`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。

## 1. 结论

**探针失败：`holo` 覆盖显著提升，但 `proto` 仍为 0，不能作为 `T65-RINGBEAD` 的绿色备份。**

- 产物 `HARD-PROTO-PROBE.bak`（`b58f80cbd2a34b10`）血统为 `PG-DR → 120 步受限蒸馏`，`selftest3` 六腿全绿。
- Stage 1 `winRate=49.83%`、并集 `19`、`holo=36`，但 `proto=0`、`ring=11`。
- 预注册要求 `proto≥8 / holo≥15 / win≥48% / union≥17`，仅胜率、holo、并集过线，核心 proto 端点失败。
- 不跑 promote、人席或入池，不扫教师份额、学习率或 seed。

## 2. 读法

1. **键道没有闭环**：同一教师栈能把 holo 从底座 3 提到 36，却完全没有点亮 proto；说明本次受限蒸馏只兑现了较容易的 holo 键道。
2. **不是结构红**：产物可梯度续训，失败发生在策略覆盖而非引擎或血统。
3. **不能替代红座**：`T65-RINGBEAD` 仍是 hard 唯一有效 proto 载体（`proto=50`），本次探针没有解除该绑定。
4. **不再追加实验**：本臂只是低成本可行性探针，核心端点已失败；白班若继续，应另立“proto 单键教师/单键课程”预注册，不把本次 holo 成功当 proto 成功。

## 3. 产物处置

- 产物保留在 `scratch/arms/HARD-PROTO-PROBE.bak`，未入池。
- Stage 1 报告复制到本夜证据目录。
- 池表、顺序、规则指纹、线上 bundle 均未改。
