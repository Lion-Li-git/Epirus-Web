# PREREG · 2026-11-29 · hard `proto` 绿色备份探针

> 立项时间：2026-11-29 01:00（UTC+8）。
> 基线：`main@f412ed6a`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 边界：一枚轻量预研臂，只回答“能否造出第二枚可梯度续训的绿 proto 载体”；不强制入池。

## 1. 动机与方法论对账

- 当前 hard 唯一 `proto` 载体是 `T65-RINGBEAD`（Stage 1 `proto=50`），但它是 `selftest3` 红座，不能直接续训。
- `PH-S2` 已证可用低废方式承载 `proto=8 / holo=29`，且自身全绿；`PG-DR` 是绿色经济底座（Stage 1 `52.17%`、`ring=19`），但 `proto=0`。
- 本臂只验证“绿色底座 + 受限 proto/holo 蒸馏”能否点亮第二枚 hard proto 载体，不重做 PH-S2 入池链，不改规则或池。

## 2. 固定命令

```bash
node training/train.mjs --mode=supfit \
  --up=docs/artifacts/PG-DR.bak \
  --teacher=pack:docs/artifacts/PG-DR.bak \
  --teacher2=pack:docs/artifacts/PH-S2.bak --teacher2keys=proto,holo --teacher2frac=0.35 \
  --rareOnly=proto,holo --rareFrac=0.35 \
  --dagger=0 --objective=cand --rolloutMode=game \
  --groups=1200 --steps=120 --lr=0.00015 --seed=20261129 \
  --shapeBal=1 --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --out=scratch/arms/HARD-PROTO-PROBE.bak
```

第一枚产物落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`；血统错或结构红立即淘汰。

## 3. 探针判据

1. `selftest3` 六腿全绿；
2. Stage 1：`proto ≥ 8`、`holo ≥ 15`、`winRate ≥ 48%`、并集不少于底座 17；
3. 只报 Stage 1 与血统，不跑 promote、人席或入池；通过则留作白班完整评估候选，失败则记录负结果。

不扫教师份额、学习率、seed 或第二步 PG。
