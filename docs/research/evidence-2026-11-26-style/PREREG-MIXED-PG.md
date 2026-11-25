# PREREG · 2026-11-26 · holo/shift 混合桌 PG（KL 锚 + 结果/塑形双付账）

## 前序结果

- 全网络蒸馏能把 holo/shift 合计做到约 14%、L1≈0.34，但候选 selftest3 红且 2P rule 退化。
- `onlySeg=skillHead` 修复臂重新全绿，但 DR 的 holo/shift=0/0，ROD=1/4；风格注入失败，证明冻结骨干时 skillHead 不足以改变这套行为。
- 2P-only PG 在 11-25 已失败，本轮不复用“只练 2P”的形状。

## 假设

从绿色通用底座出发，用混合桌 PG 同时优化胜负与 holo/shift 成功使用，并以冻结起点的键级/候选级 CE 锚保护原有策略；2P 占 40%，holo/shift 只在 multi/long 付账。

## 固定配方

两个独立底座各一臂，除 upstream/out/tag 外逐字相同：

- 底座：`DR-R3E.bak`、`ROD-DR.bak`
- `--games=4000 --batch=48 --lr=0.0001 --seed=20261130`
- `--baseline=mean --segEvery=1000`
- `--arenaShapes=2:standard@4,3:multi,5:multi,5:long@2,8:multi,8:long`
- `--arenaPool=names:human:rule,human:legacy,gunspam,heavyfire,aggro,targeter,wall,ringspam,beadburst,pack:FC-G1,pack:HL-G1`
- `--shapeKey=holo:0.20,shift:0.20 --shapeModes=multi,long`
- `--klW=0.15 --klCand=0.05 --klTilt=holo,shift --klTiltMul=3 --klModes=standard,multi,long`
- `--lamC=0 --lamF=0 --lamExp=0 --dmgW=0 --beadSpendW=0 --defTax=0`
- 输出：`scratch/arms/nov26-util-dr-mixpg-s30.bak`、`scratch/arms/nov26-util-rod-mixpg-s30.bak`

## 止损与验收

- 上游 selftest3 红即不开训；每个 seg1000/2000/3000/4000 快照立即验血统。
- 主尺先看 2P rule/legacy 与 Stage 1：rule 比基座退化 >3pt 或 holo/shift 任一 <3 格，即停止该底座后续臂。
- 候选需 selftest3 绿、Arena B 不低于基座超过 5.8pt、promote 0 阻断、seatKill=0。
- 5P multi/long 用 probe-pool 主体席配对，无显著回退。
- 过线才考虑完整准入；本分支不擅自改主池。
