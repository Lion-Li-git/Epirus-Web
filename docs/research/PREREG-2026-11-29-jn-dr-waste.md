# PREREG · 2026-11-29 · `JN-DR` 高废底座降废

> 立项时间：2026-11-29 00:45（UTC+8）。
> 基线：`main@c8809216`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 边界：一臂四快照；不改规则、不改池，未过完整链不入池。

## 1. 动机与方法论对账

- `JN-DR` 当前 `selftest3` 全绿，Stage 1 `winRate=53.67%`、`jinshield=22`、电珠 `407` 得 / `295` 过期，废珠 `72.48%`；小雷探针 `27` 次施放全打 `ji`，`0` 分。
- 本臂不是重开 `DR-R3E Stage C` 对比，而是回答一个未闭合的工程问题：能否在不丢 hard `jinshield` 与 2P 强度的前提下，把绿色硬座的整体珠经济修到可接受范围。
- 只跑预注册配方与四个固定快照，不扫奖励剂量、学习率或 seed。

## 2. 固定命令

```bash
node training/train.mjs --mode=pg \
  --up=docs/artifacts/JN-DR.bak \
  --games=2400 --batch=48 --lr=0.0003 --seed=20261129 \
  --baseline=ridge --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15 \
  --klModes=standard --klW=0.35 --klTilt=jinshield,miniT --klTiltMul=3 \
  --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --segEvery=600 --out=scratch/arms/JN-DR-WASTE-S1.bak
```

第一枚 `JN-DR-WASTE-S1.seg600.bak` 落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`；血统错或结构红立即淘汰。后续 1200/1800/2400 快照与终点同样验血统。

## 3. 硬门

只按固定快照顺序验收，不挑早期读数：

1. `selftest3` 六腿全绿；
2. Stage 1：`winRate ≥ 50%`、`jinshield ≥ 25`、电珠废珠 `≤ 45%`；
3. 小雷探针如实报告 `totalPts / pts/cast`，不设虚构门槛，但必须确认不是全打 `ji` 的零分复读；
4. 通过后才跑 `promote --dry --support=2` 与 `90210/90211` 人席，要求 `0 阻断 / seatKill=0`；
5. 2P rule/legacy 相对 `JN-DR` 基线的 `Δregular ≥ −1.0pt`，四组池级阶梯全部保序。

任一硬门失败即淘汰；不补 PG、不扫参、不换底座。
