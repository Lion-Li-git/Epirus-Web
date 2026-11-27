# PREREG · 2026-11-28 · FC-S1 保天火 PG

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`FC-S1` 是 soft 的天火/过载炮载体，但 Stage 1 电珠浪费约 96.4%；其电珠链与天火链分离，适合检验 PG 是否能只修电珠而不拆天火。

## 1. 假设

从绿色 `FC-S1` 出发，既有 PG 珠经济奖励可在保住 `firestorm/cannon/curse` 有效格与 2P 阶梯的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/FC-S1.bak`（`9390478ce2e1ba00`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `lamC=0`、`lamF=0`、`lamExp=0.90`、`penDeadElec=0.50`、`beadSpendW=0.15`。
- `klW=0.35`、`klCand=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 输出：`scratch/arms/nov28-fcs1-pg.bak`。

## 3. 验收

每枚快照同时报：

- `elecGained / elecSpent / elecExpired` 与 `/局`；
- `firestorm/cannon/curse` 有效格、使用数与兑现；
- Stage 1 胜率、并集、2P rule/legacy、5P multi/long；
- 只有通过者才跑 promote、人席和池级替换。

硬条件：

1. 过期电珠 `/局` 相对底座下降 ≥40%；
2. 花珠绝对值不低于底座的 80%；
3. `firestorm` 有效格不低于 15，`cannon` 不低于 3，`curse` 不低于 30；
4. 2P rule/legacy 退化 ≤2pt；
5. promote 0 阻断、两 seed 人席 `seatKill=0` 才考虑入池。

## 4. 止损

- 首件血统错或 `selftest3` 红：立即停该臂。
- 第一枚完整候选无行为信号：停止该线，不扫 lr/KL/seed。
- `seg1200` 立身技能跌破阈值：可用 `seg600`，不盲目拉长。

## 5. 结果

- 首件 `seg600` 血统 `v:92 / S1o / 16561`，selftest3 六腿全绿。
- Stage 1：胜率 `39.1%→42.0%`，firestorm `22→18` 格、cannon `6→8`、curse `42→48`，立身技能达标。
- 但电珠过期 `1591→2133`，主目标反向；花珠 `21→22` 只是绝对值略升，不能抵消浪费增加。
- 按预注册停止；后续快照不评估、不 promote、不入池。
