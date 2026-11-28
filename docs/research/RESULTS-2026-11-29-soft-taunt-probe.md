# RESULTS · 2026-11-29 · soft `taunt` 绿色备份探针

> 完成时间：2026-11-29 01:25（UTC+8）。
> 预注册：[`PREREG-2026-11-29-soft-taunt-probe.md`](PREREG-2026-11-29-soft-taunt-probe.md)。
> 基线：`main@0f848674`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。

## 1. 结论

**探针通过：`SOFT-TAUNT-PROBE` 可作为 soft 第二绿色 taunt 载体的白班候选。**

- 产物 `SOFT-TAUNT-PROBE.bak`（`85eb06cb92d19ac9`）血统为 `L1B-S1200 → 120 步受限 taunt 蒸馏`，`selftest3` 六腿全绿。
- Stage 1 `winRate=49.50%`、并集 `19`、`taunt=20`、`ring=15`，达到预注册 `taunt≥10 / win≥48% / union≥19`。
- 相比底座 `L1B-S1200` 的 `taunt=1`，覆盖显著提升；胜率从 `51.58%` 降到 `49.50%`，仍在探针线内。
- 按预注册不跑 promote、人席或入池；留作白班完整评估候选。

## 2. 后续完整评估清单

1. 六 seed Arena B 与 A/B/C；
2. `promote --dry --support=2`；
3. `90210/90211` 两批人席；
4. 与 `L1B-S1200` 的同位/新增槽位阶梯比较；
5. 若考虑入池，优先作为**新增 soft 成员**补 taunt 冗余，或不替换任何唯一载体；是否维持 35 枚编制由白班裁定。

## 3. 产物处置

- 产物保留在 `scratch/arms/SOFT-TAUNT-PROBE.bak`，未入池。
- Stage 1 报告复制到本夜证据目录。
- 池表、顺序、规则指纹、线上 bundle 均未改。
