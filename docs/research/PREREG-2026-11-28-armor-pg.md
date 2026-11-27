# PREREG · 2026-11-28 · nov21-armor-tzt2d 保覆盖 PG

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`nov21-armor-tzt2d` 当前 selftest3 绿，Stage 1 电珠浪费 97.1%，承担 soft armor 深覆盖（120/120）与 transfer。

## 1. 假设

从绿色 `nov21-armor-tzt2d` 出发，既有 PG 珠经济奖励可在保住 `armor/transfer` 有效格与 2P 阶梯的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/nov21-armor-tzt2d.bak`（`7819b2196ba23fca`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `lamC=0`、`lamF=0`、`lamExp=0.90`、`penDeadElec=0.50`、`beadSpendW=0.15`。
- `klW=0.35`、`klCand=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 输出：`scratch/arms/nov28-armor-pg.bak`。

## 3. 验收

- 首件血统 `v:92 / S1o / 16561` 且 selftest3 全绿。
- Stage 1：`armor≥100`、`transfer≥3`、并集≥14、胜率≥38%、废珠≤60%、花珠绝对值≥底座 80%。
- 2P rule/legacy 相对底座退化≤2pt。
- 只有通过者才跑 promote、人席和池级替换。

## 4. 止损

- 首件血统错或 selftest3 红：立即停。
- 首件 Stage 1 覆盖或废珠不达标：停止，不扫 lr/KL/seed。

## 5. 结果

- 首件 `seg600` 血统 `v:92 / S1o / 16561`，selftest3 六腿全绿。
- Stage 1：胜率 `40.0%→39.8%`、并集 `14→16`，armor `120→116`、transfer `4→5`，覆盖达标。
- 但电珠过期 `1742→1636`，仅下降约 6%；花珠 `38→29`（底座 76%），主目标与绝对花珠硬门均未达。
- 按预注册停止；后续快照不评估、不 promote、不入池。
