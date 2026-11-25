# RESULTS · 2026-11-26 · 风格候选续训与 2P 修复研究

## 结论

- 全网络风格候选不能直接续训：两枚 selftest3 腿 C 均红，10%–75% 父代融合仍红。
- `onlySeg=skillHead` 与混合桌 PG 都能保持全绿，但 holo/shift 注入不足；稀疏 PG 塑形每局仅 0–0.03 次命中。
- 全网络短程蒸馏找到“全绿 + 2P 不退 + 风格覆盖”的区间：40/80 步 rule `−0.38/−1.70pt`、legacy `−3.10/−3.30pt`，holo/shift 各 `41/5`、`38/7` 格；但到 hard 质心 L1 仅 `0.229/0.178`，加入后整池平均 L1 不升。
- 120 步 selftest3 红，140 步全绿但 L1 仍仅 `0.230`；holo/shift 路线按预注册停止。
- 改攻 taunt 外围轴：两候选 L1=`0.432/0.461`、前五轴约 55%、taunt=`16/27` 格，但 2P rule 恶化 `35.85/61.40pt`、Arena B=`−65.80/−61.44pt`，强度坍塌，淘汰。
- 本轮证明“2P 退化可以通过短程蒸馏与 2P 权重修复”，但尚未得到同时满足外围风格与强度的候选；未改主池。

## 分臂回执

| 路线 | 产物 | selftest3 | 风格 | 2P | Arena B | 裁定 |
|---|---|---|---|---|---|---|
| 直接续训 | util-dr/rod-s30 | 红 | holo/shift≈14%，L1≈0.34 | rule +11.55pt | DR −5.63pt | 不能续训，淘汰 |
| 父代融合 | DR 10%–75% | 全红 | — | — | — | 排除融合修复 |
| skillHead-only | dr/rod-head-s30 | 绿 | DR 0/0；ROD 1/4 | 未测 | — | 风格注入失败 |
| 混合桌 PG | dr/rod-mixpg-s30 | 10/10 快照绿 | holo/shift≈0 | 未测 | — | 塑形采样过稀 |
| 短程 40/80 | dr-short40/80-s30 | 绿 | holo/shift 41/5、38/7；L1 0.229/0.178 | rule −0.38/−1.70；legacy −3.10/−3.30 | 未测 | 2P 修复成立，风格离散不足 |
| 短程 120/140 | dr-short120/140-s30 | 120 红 / 140 绿 | 140 L1=0.230 | 未测 | — | 停止 holo/shift 路线 |
| taunt 80 | taunt-dr/rod-s30 | 绿 | L1 0.432/0.461；taunt 16/27 | rule +61.40/+35.85 | −61.44/−65.80pt | 强度坍塌，淘汰 |

## 工具修正

- `pg-train` 过去无论是否传 `--arenaPool/--arenaShapes` 都硬印 `arena2 mild(cap2/mix0.5)`，导致自定义训练日志口径失真；现改为打印真实 roster、`poolFp` 与 shapes。
- 未新增旋钮，未改规则代码，未改产品池。

## 证据

- 预注册：`evidence-2026-11-26-style/PREREG-2P-REPAIR.md`、`PREREG-MIXED-PG.md`、`PREREG-SHORT-DISTILL.md`、`PREREG-TAUNT.md`。
- 原始日志、Stage 1、2P、Arena 与 selftest3：`evidence-2026-11-26-style/`。
- 训练台账已逐臂登记 `docs/TRAINING-RUN-LOG.md`。
