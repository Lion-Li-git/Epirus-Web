# RESULTS · 2026-11-29 · soft `laserEye` 绿色备份探针

> 完成时间：2026-11-29 01:35（UTC+8）。
> 预注册：[`PREREG-2026-11-29-soft-lasereye-probe.md`](PREREG-2026-11-29-soft-lasereye-probe.md)。
> 基线：`main@ffe4dc28`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。

## 1. 结论

**探针失败：`laserEye` 仍为 0，不能作为 `LE-S2` 的绿色备份。**

- 产物 `SOFT-LASEREYE-PROBE.bak`（`e769934cc01d7e66`）血统为 `L1B-S1200 → 120 步受限 laserEye 蒸馏`，`selftest3` 六腿全绿。
- Stage 1 `winRate=49.58%`、并集 `19`、`ring=10`，但 `laserEye=0`。
- 预注册要求 `laserEye≥10 / win≥48% / union≥19`，仅胜率与并集过线，核心 laserEye 失败。
- 不跑 promote、人席或入池，不扫教师份额、学习率或 seed。

## 2. 读法

1. **键道没有兑现**：底座可正常承接 taunt，却在 laserEye 上保持 0；单键教师并不保证任意绿色底座都能长出该键。
2. **不是结构红**：产物可梯度续训，失败发生在策略覆盖。
3. **不能替代唯一载体**：`LE-S2` 仍是 soft 唯一有效 laserEye 载体（`laserEye=15`）。
4. **不再追加实验**：核心端点已失败；白班若继续，应另立“laserEye 单键课程或不同绿色底座”预注册。

## 3. 产物处置

- 产物保留在 `scratch/arms/SOFT-LASEREYE-PROBE.bak`，未入池。
- Stage 1 报告复制到本夜证据目录。
- 池表、顺序、规则指纹、线上 bundle 均未改。
