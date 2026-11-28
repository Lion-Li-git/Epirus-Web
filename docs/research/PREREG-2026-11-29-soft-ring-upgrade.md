# PREREG · 2026-11-29 · `SOFT-RING-C3G25` 原位升级

> 立项时间：2026-11-29 00:25（UTC+8）。
> 基线：`main@d558abce`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 启动条件：联合 LOO 的 `LOO-2` 确认摘除 `SOFT-RING-C3G25` 不造成强度或唯一覆盖损失；否则本臂不启动。
> 边界：只训练与候选验收；不改规则，不先删旧成员，未过完整链不入池。

## 1. 动机与方法论对账

- `SOFT-RING-C3G25` 当前 Stage 1 `winRate=34.25%`、`arenaB=-32.6pt`、废珠约 `61%`，是 soft 下限的主要拖累；它的 `curse/firestorm/ring` 覆盖分别为 `75/57/35`，天火闭环 `401/401`，是有价值的角色教师。
- `L1B-S600` 是当前全绿经济底座：Stage 1 `winRate=54.42%`、废珠约 `31%`、`ring=13`；`FS2-LE26` 虽天火闭环强，但胜率仅 `38.58%` 且电珠浪费高。因此本臂选 `L1B-S600`，只从弱包蒸 `curse/firestorm/ring`，避免把弱包整体策略带回来。
- 这是“弱包角色迁移到强经济底座”，不是重跑已关闭的 `DR-R3E Stage C` 废珠对比，也不是重新证明双教师蒸馏成立。

## 2. 固定配方

### S1：受限三键蒸馏

```bash
node training/train.mjs --mode=supfit \
  --up=docs/artifacts/L1B-S600.bak \
  --teacher=pack:docs/artifacts/L1B-S600.bak \
  --teacher2=pack:docs/artifacts/SOFT-RING-C3G25.bak \
  --teacher2keys=curse,firestorm,ring --teacher2frac=0.25 \
  --rareOnly=curse,firestorm,ring --rareFrac=0.30 \
  --dagger=0 --objective=cand --rolloutMode=game \
  --groups=1400 --steps=120 --lr=0.00015 --seed=20261130 \
  --shapeBal=1 --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --out=scratch/arms/SOFT-RING-A1-S1.bak
```

### S2：短程岭基线 PG

```bash
node training/train.mjs --mode=pg \
  --up=scratch/arms/SOFT-RING-A1-S1.bak \
  --games=2000 --baseline=ridge --seed=20261130 \
  --klModes=standard --klTilt=ring,firestorm,curse --klTiltMul=2.5 \
  --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --out=scratch/arms/SOFT-RING-A1-S2.bak
```

S1 第一枚产物落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`；红或血统错立即淘汰。S2 终点再验一次。

## 3. 硬门

全部满足才考虑同位替换 `SOFT-RING-C3G25`：

1. `selftest3` 六腿全绿；
2. Stage 1：`winRate ≥ 44%`、总废珠 `≤ 45%`、`ring ≥ 20`、`firestorm ≥ 15`，天火闭环 `≥ 80%` 且空爆 `=0`；
3. 六 seed `Arena B > 0pt`，并同报 A/B/C；
4. `promote --dry --support=2` 0 阻断，`90210/90211 seatKill=0`；
5. 同位替换后 `2P rule/legacy`、`5P multi/long` 四组全部保序，且 `2P legacy sparring − regular ≥ 2.0pt`。

任一硬门失败即淘汰；不扫教师份额、学习率、seed 或 PG 剂量。若 LOO-2 未通过，本臂直接取消，不找替代靶点硬开。
