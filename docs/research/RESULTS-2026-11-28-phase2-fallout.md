# 研究结果：2026-11-28 Phase 2 soft fallout 筛选与入池

> 对应计划：[`PLAN-2026-11-27-overnight-qwen.md`](PLAN-2026-11-27-overnight-qwen.md)。
> 基线：`v2.1.44 / c61298e6`；产品版本：`v2.1.45`。
> 证据目录：[`evidence-2026-11-27-overnight-qwen/`](evidence-2026-11-27-overnight-qwen/)。
> 完成时间：2026-11-28 01:25（UTC+8）。

## 1. 现成快照快筛

| 快照 | selftest3 | Stage 1 胜率 | 并集 | 电珠闭环 | 裁定 |
|---|---|---:|---:|---:|---|
| L1b seg600 | 绿 | 54.42% | 18 | 68.67%（57/83） | 升级完整链 |
| L1b seg1200 | 绿 | 51.58% | 19 | 84.15%（69/82） | 升级完整链 |
| L1b seg2400 | 绿 | 51.25% | 17 | 83.87%（52/62） | 并集较弱，暂缓 |
| ROD seg1800 | 绿 | 53.42% | 17 | 40.00%（20/50） | 闭环未过 60%，淘汰 |

`seg600` 与 `seg1200` 都通过 promote 0 阻断和两 seed 人席 `seatKill=0`。两者在 40 局自对局 promote 栏均出现“得珠/花珠为 0”，说明 Stage 1 闭环依赖夹具对手，不能外推成稳定自对局经济能力。

## 2. A/B/C 与单包剖面

| 候选 | MxC | MxCL | arS | arL | arR | H | S |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1B-S600 | 0.2400 | 0.1703 | 0.2215 | −0.0693 | 0.2445 | 58.1 | 1.42 |
| L1B-S1200 | 0.2562 | 0.1197 | 0.1919 | −0.0811 | 0.1565 | 58.4 | 1.50 |

`seg600` 长程综合与 Arena 更强；`seg1200` 综合与 5P multi 考卷略高。结合本班“修 soft 5P long”目标，选择 `seg600`。

## 3. 池级同位替换

靶点先筛 `MX8-R6B-KL / MX6-GD-TF20 / MX8-TN35-KL3 / RING-MINIT-CONT`，单 seed 全部保序；`RING-MINIT-CONT` 代价最小。对 `seg600` 做八 seed 2P、四 seed 5P 全矩阵：

| 视图 | hard | regular | sparring |
|---|---:|---:|---:|
| 2P rule | 0 | −0.1125 | −0.9750 |
| 2P legacy | 0 | +0.0375 | +0.2875 |
| 5P multi | 0 | −0.4000 | +0.0250 |
| 5P long | 0 | +0.5000 | +0.1250 |

所有 seed 均保持 hard < regular < sparring。产品 `seed=77000` 复核：2P rule `−0.40/−0.30pt`，legacy `+0.30/+0.10pt`，5P multi `+0.80/+1.80pt`，5P long `+0.20/0.00pt`，同样全序。

## 4. 覆盖与槽位

- 全池有效并集保持 28，无技能归零。
- soft 深度变化：holo `5→6`、jinshield `6→5`、laserEye `2→1`、proto `4→3`。
- 候选放回 `RING-MINIT-CONT` 原第 29 行，池维持 35 枚 `hard 17 / soft 18`。
- `pool-add --audit`：`bad=[]`、`seatUnknown=0`。
- soft 参照变化使现役 invited `MX8-TN35-KL3` 的带内 seatKill 从 1 更新为 2；这是重算结果，未隐瞒，也不把它算作候选否决。

## 5. 入池后验证

- Stage 1/2、promote、measure-point、两 seed 人席、bundle/manifest、地图重烘均完成。
- `spec 96/96`、`ship-pool 1/1`、`ship-promote 19/19`、`meta-repo 13/13`、`D16`、`D168` 全绿。
- 真实 Chrome `SMOKE OK`、`BATTLE OK`，无 JS errors。
- 未跑 `--group=engine` 整轮。

## 6. 裁定

- `L1B-S600`（`wid=910b82ecbc976e0f`）入 soft，原位替换 `RING-MINIT-CONT`，版本 v2.1.45。
- `L1B-S1200` 留作第二候选；它综合与 multi 更强，但本班长程收益不如 `seg600`。
- `seg2400`、`ROD seg1800` 本轮不入池。
- 进入 Phase 3 A 线：先用绿色 `DR-R3E` 做 Stage C 对照/处理，首件落盘立即验血统。

## 7. 06:50 续班：L1b seg1800 当前池快筛

- 候选 `scratch/arms/nov27-long-pgdr-l1b.seg1800.bak` 的 selftest3 六腿全绿；使用当前 `bf22eff0` 池做同 seed 同位替换，基线为 2P rule `45.4/57.0`、2P legacy `25.3/27.6`、5P multi `10.3/15.8`、5P long `8.3/15.8`（普通/简单）。
- 单 seed 快筛没有正信号：`MX6-GD-TF20` 的 5P long `-1.3/-2.3pt`；`MX8-R6B-KL` 的 2P rule simple `-1.6pt`、5P multi simple `-1.5pt`；`FC-S1` 的 2P rule simple `-2.3pt`；`MX8-TN35-KL3` 的 5P multi 普通 `-2.0pt`。
- 裁定：`L1b seg1800` 本轮淘汰，不跑完整矩阵、promote 或入池链；证据见 `evidence-2026-11-27-overnight-qwen/L1B-S1800-pool-replacement-screen.tsv`。

## 8. 06:55 续班：L1b seg2400 当前池快筛

- 同一当前池、同一 seed `95001`、同一四靶点快筛；`selftest3` 已有全绿回执。
- `MX6-GD-TF20` 的 5P long `-1.3/-1.8pt`；`MX8-R6B-KL` 仅 5P long 简单 `+0.5pt`，但 2P rule 简单 `-1.5pt`、普通档长程无增益；`FC-S1` 的 2P rule 简单 `-1.9pt`；`MX8-TN35-KL3` 的 5P multi 普通 `-2.0pt`。
- 裁定：`L1b seg2400` 也没有值得升级的替换点，本轮淘汰；不跑完整矩阵或入池链。证据见 `evidence-2026-11-27-overnight-qwen/L1B-S2400-pool-replacement-screen.tsv`。
