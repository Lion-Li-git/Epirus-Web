# PREREG · 2026-11-28 · AR-TK2 保覆盖 PG

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`AR-TK2` 是 soft 的 armor 深载体（120/120）并承担 tank/transfer 覆盖，但 Stage 1 电珠浪费约 97.3%，不能直接退役。

## 1. 假设

从绿色 `AR-TK2` 出发，用既有 PG 珠经济奖励可在保住 `armor/tank/transfer` 有效格与 2P 阶梯的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/AR-TK2.bak`（`b5d4cbc6af57bbdd`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `lamC=0`、`lamF=0`、`lamExp=0.90`、`penDeadElec=0.50`、`beadSpendW=0.15`。
- `klW=0.35`、`klCand=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 输出：`scratch/arms/nov28-artk2-pg.bak`。

## 3. 验收

每枚快照同时报：

- `elecGained / elecSpent / elecExpired` 与 `/局`；
- `armor/tank/transfer` 有效格、使用数与兑现；
- Stage 1 胜率、并集、2P rule/legacy、5P multi/long；
- 只有通过者才跑 promote、人席和池级替换。

硬条件：

1. 过期电珠 `/局` 相对底座下降 ≥40%；
2. 花珠绝对值不低于底座的 80%；
3. `armor` 有效格不低于 100，`tank` 不低于 15，`transfer` 不低于 8；
4. 2P rule/legacy 退化 ≤2pt；
5. promote 0 阻断、两 seed 人席 `seatKill=0` 才考虑入池。

## 4. 止损

- 首件血统错或 `selftest3` 红：立即停该臂。
- 第一枚完整候选无行为信号：停止该线，不扫 lr/KL/seed。
- `seg1200` 立身技能跌破阈值：可用 `seg600`，不盲目拉长。

## 5. 结果

- 训练完成 2400 局，但首件 `seg600` 血统为 `v:92 / S1o / 16561`，`selftest3` 腿 C 红（最坏相对误差 `1.27e-3`）。
- 按预注册立即停止；后续 `seg1200/1800/2400` 不评估、不 promote、不入池。
- 训练日志与首件自检回执保存在 `evidence-2026-11-27-overnight-qwen/nov28-artk2-pg-train.txt` 与 `nov28-artk2-pg-seg600-selftest3.txt`。
