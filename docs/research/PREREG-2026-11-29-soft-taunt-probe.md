# PREREG · 2026-11-29 · soft `taunt` 绿色备份探针

> 立项时间：2026-11-29 01:20（UTC+8）。
> 基线：`main@0f848674`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 边界：一枚轻量预研臂，只回答“能否给 soft 唯一 taunt 载体做绿色备份”；不强制入池。

## 1. 动机与方法论对账

- 当前 soft 唯一 `taunt` 载体是 `L1B-S1200`，覆盖仅 `1/120`，属于明确的结构脆弱点。
- `TN-S5` 有 `taunt=37`、Stage 1 `42.83%`，是现役绿色教师；`L1B-S1200` 底座 `winRate=51.58%`、并集 19、`taunt=1`。
- 本臂只蒸 `taunt` 单键，验证能否在保住底座胜率与并集的同时补出第二载体；不重跑 TN-S5 原始训练，不改规则或池。

## 2. 固定命令

```bash
node training/train.mjs --mode=supfit \
  --up=docs/artifacts/L1B-S1200.bak \
  --teacher=pack:docs/artifacts/L1B-S1200.bak \
  --teacher2=pack:docs/artifacts/TN-S5.bak --teacher2keys=taunt --teacher2frac=0.35 \
  --rareOnly=taunt --rareFrac=0.35 \
  --dagger=0 --objective=cand --rolloutMode=game \
  --groups=1200 --steps=120 --lr=0.00015 --seed=20261129 \
  --shapeBal=1 --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --out=scratch/arms/SOFT-TAUNT-PROBE.bak
```

第一枚产物落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`；血统错或结构红立即淘汰。

## 3. 探针判据

1. `selftest3` 六腿全绿；
2. Stage 1：`taunt ≥ 10`、`winRate ≥ 48%`、并集不少于底座 19；
3. 只报 Stage 1 与血统，不跑 promote、人席或入池；通过则留作白班完整评估候选，失败则记录负结果。

不扫教师份额、学习率、seed 或第二步 PG。
