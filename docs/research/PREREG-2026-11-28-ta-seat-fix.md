# PREREG · 2026-11-28 · `TA-SEAT-FIX`：修复 TA 载体 long 反弹席否决

> 立项时间：2026-11-28 20:49（UTC+8）。
> 触发事实：v2.1.49 最终 `TA-S3` 补测后为 `seatKill=2`；已有 `TA-S4-a30/a50/a70` 插值快照均不能同时满足 P2 覆盖/经济门与 `seatKill=0`。
> 本臂是发布缺陷修正，不改变 LOO 四候选审计，也不退役任何成员。

## 1. 唯一假设

`TA-S4-a70` 已满足 Stage 1 的 win/tank/armor/jinshield/废珠门，但 long 反弹型人类替身夺冠率过高。用**反弹特化对手表 + 原策略 KL 锚**做短程 PG，能在保住 `armor/tank/jinshield` 的同时把两批人席拉回带内否决线以下。

## 2. 固定配方

- 起点：`scratch/arms/TA-S4-a70.bak`（`TA-S3` 与 `TK-FS4` 的 `alpha=0.7` 插值）。
- 命令骨架：
  - `--mode=pg --games=1600 --batch=48 --lr=0.0003 --baseline=ridge`
  - `--lamC=0 --lamF=0 --lamExp=0.1 --penDeadElec=0.1 --dmgW=0.04 --defTax=0.02`
  - `--klW=0.35 --klCand=0.35 --klModes=multi,long --klTilt=armor,tank,jinshield --klTiltMul=3`
  - `--arenaPool=names:reflectspam,reflectmix,reflecttank,human:rule,human:legacy,wall,gunspam,heavyfire,guardgun`
  - `--arenaShapes=2:multi,2:long,3:multi,3:long,5:multi,5:long,8:multi,8:long --segEvery=400`
  - `--seed=20261138 --out=scratch/arms/TA-SEAT-FIX.bak`
- 首件与终点都跑 `selftest3`；中间快照只作候选，不自动入池。
- 启动前预检发现 `defreflectgun` 不在 `server/opp-pool.mjs` 的 `OPP_SPECS`，尚未产生任何训练产物；按同一反弹特化假设替换为已登记的 `guardgun`，其余配方不变。

## 3. 硬门

1. `v:92 / S1o / 16561`，首件与终点 `selftest3` 六腿全绿；
2. Stage 1：胜率 ≥45%、`tank≥8`、`armor≥25`、`jinshield≥8`、总废珠 ≤50%；
3. `promote --dry --support=2` 0 阻断；
4. 90210/90211 两批人类席 `seatKill=0`；
5. 通过后才做同位替换与 2P/5P 阶梯，任一倒挂 ≥2σ 即淘汰。

## 4. 硬止损

- 起点 `selftest3` 红：不启动。
- 首件或终点结构红：立即淘汰。
- Stage 1 任一覆盖或经济门失败：淘汰，不扫 lr/alpha/seed。
- 两批人席仍 `seatKill>0`：淘汰，不回滚到 `TA-S3`，也不扫更多 PG 局数。
- 本臂失败后的安全动作仅限恢复到 v2.1.48 的 `OBS6E9` 槽位，等待下一轮新假设。
