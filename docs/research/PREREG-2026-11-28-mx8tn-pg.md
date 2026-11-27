# PREREG · 2026-11-28 · MX8-TN35-KL3 保覆盖 PG

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`MX8-TN35-KL3` 当前 selftest3 绿，Stage 1 电珠浪费 90.2%，承担 soft laserEye（17 格）、proto（10 格）、ring（13 格）与 holo（20 格）覆盖。

## 1. 假设

从绿色 `MX8-TN35-KL3` 出发，既有 PG 珠经济奖励可在保住 `laserEye/proto/ring/holo` 有效格与 2P 阶梯的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/obs6-coldstart/MX8-TN35-KL3.bak`（`137f584ec08418b2`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `lamC=0`、`lamF=0`、`lamExp=0.90`、`penDeadElec=0.50`、`beadSpendW=0.15`。
- `klW=0.35`、`klCand=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 输出：`scratch/arms/nov28-mx8tn-pg.bak`。

## 3. 验收

- 首件血统 `v:92 / S1o / 16561` 且 selftest3 全绿。
- Stage 1：`laserEye≥10`、`proto≥6`、`ring≥8`、`holo≥12`、并集≥18、胜率≥40%、废珠≤60%、花珠绝对值≥底座 80%。
- 2P rule/legacy 相对底座退化≤2pt。
- 只有通过者才跑 promote、人席和池级替换。

## 4. 止损

- 首件血统错或 selftest3 红：立即停。
- 首件 Stage 1 覆盖或废珠不达标：停止，不扫 lr/KL/seed。

## 5. 结果

- 首件 `seg600` 血统 `v:92 / S1o / 16561`，selftest3 六腿全绿。
- Stage 1：胜率 `46.75%→47.08%`、并集 `21→19`；laserEye `17→18`、proto `10→13`、ring `13→8`、holo `20→21`，覆盖与胜率硬门过。
- 总废珠率 `90.23%→63.35%`，花珠绝对值 `301→676`；但 63.35% 仍高于 60% 硬门 3.35pt。
- 按预注册淘汰；不追 `seg1200`、不 promote、不入池。
