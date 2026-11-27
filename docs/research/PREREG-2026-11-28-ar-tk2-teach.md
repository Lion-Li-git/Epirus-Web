# PREREG · 2026-11-28 · AR-TK2 教师式保覆盖

> 基线：当前 `main`，规则指纹 `c61298e6`；证据目录：`evidence-2026-11-27-overnight-qwen/`。
> 动机：`AR-TK2` 直接 PG 首件 selftest3 红；改为从绿色低废珠 `PG-DR` 出发，只借 `AR-TK2` 的 `armor/tank/transfer`，避免继承高废珠底座。

## 1. 假设

低剂量教师蒸馏可在保留 `PG-DR` 珠经济的同时，把 `armor/tank/transfer` 深覆盖搬到候选上，且 Stage 1 废珠不高于 60%。

## 2. 固定条件

- 底座/主教师：`docs/artifacts/PG-DR.bak`。
- 次级教师：`pack:docs/artifacts/AR-TK2.bak`。
- `teacher2keys=armor,tank,transfer`、`teacher2frac=0.10`。
- `teacher2shapes=3:multi,3:long,5:multi,5:long,8:multi,8:long`。
- `rareOnly=armor,tank,transfer`、`rareFrac=0.30`。
- `groups=1000`、`steps=80`、`lr=0.0001`、`seed=20261128`。
- `shapeBal=1`、`keySplit=1`、`dagger=1`、`snapEvery=1`。
- `arenaShapes=2:standard@4,3:multi,5:long@2,8:long`。
- 输出：`scratch/arms/nov28-artk2-teach.bak`。

## 3. 验收

- 首件血统 `v:92 / S1o / 16561` 且 selftest3 全绿。
- Stage 1：`armor≥100`、`tank≥15`、`transfer≥8`、并集≥15、胜率≥45%、废珠≤60%。
- 2P rule/legacy 相对 `PG-DR` 退化≤2pt。
- 只有通过者才跑 promote、人席和池级替换。

## 4. 止损

- 首件血统错或 selftest3 红：立即停。
- 教师标签未部署或 Stage 1 覆盖/废珠不达标：停止，不扫教师比例、步数或 seed。

## 5. 结果

- `snap0` 与终点血统均为 `v:92 / S1o / 16561`，selftest3 六腿全绿。
- 终点 Stage 1：胜率 `41.9%`、并集 `21`、电珠过期 `11/31（35.5%）`，经济达标。
- 但 `armor=16`、`tank=5`、`transfer=0`，均远低于覆盖硬门；教师标签没有形成可用部署。
- 按预注册停止；不提高教师比例、不扫步数或 seed、不 promote、不入池。
