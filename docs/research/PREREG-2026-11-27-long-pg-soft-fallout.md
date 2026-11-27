# PREREG · 2026-11-27 · 长程 PG 与 soft fallout 筛选

> 基线：`main@93b6cde9`（v2.1.39）。
> 证据目录：[`evidence-2026-11-27-long-pg/`](evidence-2026-11-27-long-pg/)。
> 用户授权：提交推送 v2.1.39 后开始训练。本臂只做研究，不自动改池。

## 1. 问题与假设

- 当前池 `34` 枚（hard/soft 各 17），全池有效并集 `29/30`；`dualGun/mirror` 为已知豁免缺口，不再以凑 `30/30` 为目标。
- v2.1.37 后 2P 阶梯已有序；5P long 为 `3.75% < 7.25% < 13.25%`，普通/简单档仍有提升空间。
- 假设：从绿色 `PG-DR` 出发，只改变训练桌形配额、提高 `5:long` 份额，保留既有珠经济奖励与 2P KL 锚，可产出比末端 hard 包更适合 soft 的中间快照。
- 本臂不重证已收口的 taunt/tank/railgun/transfer 直接注入，不重开 2P-only PG，不开 dualGun/mirror 载体。

## 2. 基线冻结

- `node training/train.mjs --selftest`：通过。
- `PG-DR` 与 `DR-R3E` 的 `selftest3`：六腿全绿。
- 同 seed `20261127`、同配方、1000 局，在父提交 `c6a62d4f` 与 `93b6cde9` 各跑一枚：
  - 归一化权重 SHA-256 均为 `c497131f7c8bffb0bbf3bc1d19aff7eebb034cdee03e576087919f3454978ddb`；
  - dims 与 layout 哈希也逐位相同；
  - `.bak` 整文件哈希不同仅来自 META 时间戳与 arm 名。
- 结论：默认训练权重路径未因 v2.1.39 改变；新臂以 `93b6cde9` 为基线。

## 3. 先筛现有快照

候选来源：

- `scratch/arms/nov27-pg-mt-s1.seg*.bak`
- `scratch/arms/nov27-pg-mt-s2.seg*.bak`
- `scratch/arms/nov27-pg-rod-s1.seg*.bak`
- `scratch/arms/nov27-pg-rod-s2.seg*.bak`
- `scratch/arms/nov26-pgcn2-pg3.seg*.bak`

筛选顺序：

1. Stage 1 技能剖面：并集、废珠、`5:long` 使用与闭环；
2. 单包 5P long 与 2P rule/legacy 快筛；
3. 对通过者做同抽签池级替换，目标位优先 `AR-TK2 / RINGB11 / MSB11`；
4. 只有池级读数通过者才进完整入池链。

快照不得直接入池；终选必须重新验 `v:92 / S1o / 16561` 与 `selftest3`。

## 4. L1 受控 PG 先导

唯一变量：训练桌形配额。奖励、KL、学习率、批大小与 `PG-DR` 已用配方保持一致。

```bash
node training/train.mjs --mode=pg \
  --up=docs/artifacts/PG-DR.bak \
  --games=3600 --batch=48 --lr=0.0003 --seed=20261127 \
  --lamC=0 --lamF=0 --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15 \
  --klW=0.35 --klCand=0.35 --klModes=standard \
  --arenaShapes=2:standard@2,3:multi,5:long@2,8:long \
  --segEvery=600 \
  --out=scratch/arms/nov27-long-pgdr-l1.bak --tag=nov27-long-pgdr-l1
```

第一枚快照落盘立即验血统；任一快照 `selftest3` 红只禁止继续梯度训练，不单独否决冻结推理，但必须如实记录。

## 5. 验收与止损

- 候选 Stage 1 并集不低于 15；废珠率不高于 60%。
- 2P rule/legacy 八 seed 均值相对 `PG-DR` 退化不超过 3pt。
- 5P long 池级替换后保持 `hard < regular < simple`，hard 单带不退化；普通档不允许显著变弱。
- `promote --dry --support=2` 0 阻断、`seatKill=0` 才考虑入池。
- 第一枚无信号或结构红即停止，不扫 lr/KL/seed 剂量；有信号才用 `DR-R3E` 做第二起点。
- 所有结论 A/B/C 三列同看；池级阶梯与单包分数分开报。

## 6. DONE / DOING / NEXT

### DONE

- v2.1.39 已提交并推送：`93b6cde9`。
- 训练栈、`PG-DR/DR-R3E` 可训练性与默认路径复现已验。
- L1 旧红灯定位为并列最大值与 `ε=1e-6` 舍入假红；量具修正且真变异仍红。
- L1b 同 seed 重跑 3600 局，全部快照与终点 `selftest3` 绿；前 1200 局权重与 L1 逐位相同。
- `PG-CN seg1200` / `ROD seg1800` 已完成 A/B/C、promote、人席、2P 八 seed、5P 双桌形与覆盖深度验证。
- `PG-CN-S1200` 已入池替换 `AR-TK2`，候选放回原槽位后重烘；`ship-pool`、`ship-promote` 与浏览器 `SMOKE OK` 通过。

### DOING

- 无训练臂或入池操作在跑。

### NEXT

- 若继续补 soft，先完整验证 L1b `seg1200`；不要自动入池。
- transfer 状态窗诊断与 dualGun/mirror 载体仍单独立项。
