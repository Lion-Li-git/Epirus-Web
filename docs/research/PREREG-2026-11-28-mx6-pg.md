# PREREG · 2026-11-28 · MX6-GD-TF20 保覆盖 PG

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`MX6-GD-TF20` 当前 selftest3 绿，Stage 1 电珠浪费 96.7%，承担 soft transfer（30 格）、miniT（6 格）与 railgun 覆盖。

## 1. 假设

从绿色 `MX6-GD-TF20` 出发，既有 PG 珠经济奖励可在保住 `transfer/miniT/railgun` 有效格与 2P 阶梯的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/obs6-coldstart/MX6-GD-TF20.bak`（`bab64e2b297b1e68`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `lamC=0`、`lamF=0`、`lamExp=0.90`、`penDeadElec=0.50`、`beadSpendW=0.15`。
- `klW=0.35`、`klCand=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 输出：`scratch/arms/nov28-mx6-pg.bak`。

## 3. 验收

- 首件血统 `v:92 / S1o / 16561` 且 selftest3 全绿。
- Stage 1：`transfer≥20`、`miniT≥4`、`railgun≥6`、并集≥15、胜率≥38%、废珠≤60%、花珠绝对值≥底座 80%。
- 2P rule/legacy 相对底座退化≤2pt。
- 只有通过者才跑 promote、人席和池级替换。

## 4. 止损

- 首件血统错或 selftest3 红：立即停。
- 首件 Stage 1 覆盖或废珠不达标：停止，不扫 lr/KL/seed。

## 5. 结果

- 首件 `seg600` 血统 `v:92 / S1o / 16561`，selftest3 六腿全绿。
- Stage 1：电珠过期 `2662→1580`（降 40.7%）、花珠 `89→99`（底座 111%）；transfer `30→29`、miniT `6→6`、railgun `9→14`，覆盖与经济硬门均过。
- 但胜率 `39.08%→37.58%`，低于预注册 38% 硬门 0.42pt；按预注册淘汰，不用 `seg1200` 追线。
- 不 promote、不入池；证据保留供下一班判断该门槛是否合理。
