# PREREG · 2026-11-28 · nov21-taunt-dsp0b 保 taunt PG

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`nov21-taunt-dsp0b` 是当前可读废珠最高的 hard 包（98.0%），但 taunt 覆盖 92 格、闭环 100%，不能直接退役。

## 1. 假设

从绿色 `nov21-taunt-dsp0b` 出发，既有 PG 珠经济奖励可在保住 taunt 覆盖与闭环的同时，把过期电珠 `/局` 降低 ≥40%，且花珠绝对值不低于底座的 80%。

## 2. 固定条件

- 底座：`docs/artifacts/nov21-taunt-dsp0b.bak`（`db7883520de2e2fe`）。
- seed：`20261128`。
- `games=2400`、`batch=48`、`lr=0.0003`、`segEvery=600`。
- `lamC=0`、`lamF=0`、`lamExp=0.90`、`penDeadElec=0.50`、`beadSpendW=0.15`。
- `klW=0.35`、`klCand=0.35`、`klModes=standard`。
- `arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long`。
- 输出：`scratch/arms/nov28-taunt-pg.bak`。

## 3. 验收

- 首件血统 `v:92 / S1o / 16561` 且 selftest3 全绿。
- Stage 1：`taunt≥70` 格且兑现率≥90%、并集≥15、胜率≥40%、废珠≤60%、花珠绝对值≥底座 80%。
- 2P rule/legacy 相对底座退化≤2pt。
- 只有通过者才跑 promote、人席和池级替换。

## 4. 止损

- 首件血统错或 selftest3 红：立即停。
- 首件 Stage 1 覆盖或废珠不达标：停止，不扫 lr/KL/seed。

## 5. 结果

- 上游 `nov21-taunt-dsp0b.bak` 当前 selftest3 腿 C 红（最坏相对误差 `1.00e+0`），`pg-train` 按启动门拒绝开跑（exit 8）。
- 本臂没有产生训练产物，不评估、不 promote、不入池。
- 11-26 旧 census 的绿色状态已过期；当前全池普查另行重跑。
