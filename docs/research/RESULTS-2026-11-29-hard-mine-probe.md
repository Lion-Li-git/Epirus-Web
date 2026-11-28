# RESULTS · 2026-11-29 · hard `mine` 绿色备份探针

> 完成时间：2026-11-29 01:15（UTC+8）。
> 预注册：[`PREREG-2026-11-29-hard-mine-probe.md`](PREREG-2026-11-29-hard-mine-probe.md)。
> 基线：`main@f6d6b32e`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。

## 1. 结论

**探针失败：`mine` 仍为 0，不能作为 `MN-PG` 的绿色备份。**

- 产物 `HARD-MINE-PROBE.bak`（`14ddbf4553995273`）血统为 `PG-DR → 120 步受限 mine 蒸馏`，`selftest3` 六腿全绿。
- Stage 1 `winRate=47.75%`、并集 `20`、`ring=26`，但 `mine=0`。
- 预注册要求 `mine≥10 / win≥50% / union≥17`，仅并集过线，核心 mine 与胜率失败。
- 不跑 promote、人席或入池，不扫教师份额、学习率或 seed。

## 2. 读法

1. **键道完全没有兑现**：与 proto 探针的 `holo` 成功不同，本次 mine 覆盖为 0；红座教师的存在不等于绿色底座能承接该键道。
2. **底座强度被稀释**：胜率从 `PG-DR` 的 `52.17%` 降到 `47.75%`，说明受限蒸馏本身带来了额外策略漂移。
3. **不能替代红座**：`MN-PG` 仍是 hard 唯一有效 mine 载体（`mine=21`），本次探针没有解除该绑定。
4. **不再追加实验**：核心端点已失败；白班若继续，应另立“mine 单键课程或不同绿色底座”预注册，不把 ring 覆盖提升当 mine 成功。

## 3. 产物处置

- 产物保留在 `scratch/arms/HARD-MINE-PROBE.bak`，未入池。
- Stage 1 报告复制到本夜证据目录。
- 池表、顺序、规则指纹、线上 bundle 均未改。
