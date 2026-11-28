# PREREG · 2026-11-29 · hard `mine` 绿色备份探针

> 立项时间：2026-11-29 01:10（UTC+8）。
> 基线：`main@f6d6b32e`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 边界：一枚轻量预研臂；红座 `MN-PG` 只作受限教师，不作梯度起点；不强制入池。

## 1. 动机与方法论对账

- `MN-PG` 是 hard 唯一 `mine` 载体（Stage 1 `mine=21`），但 `selftest3` 红，不能直接续训。
- 绿色 `PG-DR` 当前 `mine=0`、Stage 1 `52.17%`、`ring=19`，是已验证的经济底座；`PH-S2` 不带 mine，不能复用本次 proto 探针的教师。
- 本臂只回答“绿色底座 + 红座受限 mine 蒸馏”能否点亮第二枚可续训绿 mine 载体，不重跑 MN-PG 原始合成链，不改规则或池。

## 2. 固定命令

```bash
node training/train.mjs --mode=supfit \
  --up=docs/artifacts/PG-DR.bak \
  --teacher=pack:docs/artifacts/PG-DR.bak \
  --teacher2=pack:docs/artifacts/MN-PG.bak --teacher2keys=mine --teacher2frac=0.35 \
  --rareOnly=mine --rareFrac=0.35 \
  --dagger=0 --objective=cand --rolloutMode=game \
  --groups=1200 --steps=120 --lr=0.00015 --seed=20261129 \
  --shapeBal=1 --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --out=scratch/arms/HARD-MINE-PROBE.bak
```

第一枚产物落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`；血统错或结构红立即淘汰。

## 3. 探针判据

1. `selftest3` 六腿全绿；
2. Stage 1：`mine ≥ 10`、`winRate ≥ 50%`、并集不少于底座 17；
3. 只报 Stage 1 与血统，不跑 promote、人席或入池；通过则留作白班完整评估候选，失败则记录负结果。

不扫教师份额、学习率、seed 或第二步 PG。
