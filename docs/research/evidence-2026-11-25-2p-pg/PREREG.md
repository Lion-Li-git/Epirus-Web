# PREREG · 2026-11-25 · 2P-only PG 受控臂

## 目标

只回答一个问题：**从现有全绿包出发，直接用 2P 终局结果训练，能否在不明显拖退 5P 的前提下改善候选包的 2P standard 强度？**

本臂不决定产品难度阶梯，不决定入池，不做推理端路由。

## 底座与对照

- 底座：`docs/artifacts/ROD-DR.bak`，wid `c5f68b29031ab56c`。
- 选它的理由：selftest3 全绿、seatKill=0、当前 hard 成员；复跑 2P rule/legacy 两 seed 均值分别为 `18.4% / 19.4%`。
- 对照：同底座在相同验收 seed 上的冻结读数；两粒训练 seed 分别配对，不混池。

## 处理

两粒训练 seed：`20261128 / 20261129`。

```bash
node training/proto2/pg-train.mjs \
  --up=docs/artifacts/ROD-DR.bak \
  --games=2000 --batch=48 --lr=0.0002 --seed=<seed> \
  --lamC=0 --lamF=0 --lamExp=0 --dmgW=0 --beadSpendW=0 \
  --arenaShapes=2:standard \
  --arenaPool=names:human:rule,human:legacy,gunspam,heavyfire,aggro,targeter \
  --klModes=standard --klW=0.30 --klCand=0 \
  --baseline=mean --segEvery=500 \
  --out=scratch/arms/nov25-2ppg-roddr-s<seed>.bak
```

- 奖励只用 `arena2.scoreNet`；2P 下等价于胜 `+1`、平 `0`、负 `-1`。
- `klW` 是冻结底座的键级 CE 锚，不是严格 KL；`klModes` 只是训练损失掩码，不是产品路由。
- 对手混桌包含两枚人席替身与四类脚本，避免只拟合单一替身。
- 500 局一段保存快照；最终候选优先看 1000/2000 局，不追逐单点。

## 验收

### 主尺

- `n=2, mode=standard`，rule/legacy 两把替身。
- 每把 `seed=77000,90210`，各 1000 局。
- 人类替身夺冠率越低越强；每粒训练 seed 单独与底座配对。
- 两粒训练 seed 均同向改善才写“候选级方向成立”；只报方向不显著时不宣称提升。

### 5P 护栏

- Arena B page 六 seed，比较 multi/long 配对变化。
- 人席 90210/90211 不得新增 `seatKill≥2`。
- 若 5P 综合配对均值低于 `−3pt`，或任一模式低于 `−5pt`，判“买 2P 卖 5P”，本臂不收。

### 产物与停止线

- 任一臂 selftest3 红、训练非零退出、连续零梯度或 sidecar 缺失：停止，不拿产物继续。
- 两粒都没有 2P 同向信号：停止本机制，不扫 KL/lr/seed 剂量。
- 本臂不入池、不改产品路由；池级效果必须另做替换模拟与 8 seed 阶梯。
