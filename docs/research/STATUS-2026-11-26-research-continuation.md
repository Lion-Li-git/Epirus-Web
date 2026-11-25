# STATUS · 2026-11-26 研究续班（01:14 →）

> 分支：`research/2026-11-26-style-2p-repair`；起点 `25b3cdc`。
> 用户指令：不停在第一次阴性结果；继续解决 2P 退化，风格训练结束后转复刻考古。

## DONE

- 两枚全网络风格候选 `nov26-util-dr-s30` / `nov26-util-rod-s30` 的 selftest3 腿 C 均红，不能直接续训。
- 与绿色父代做 10%–75% 融合，四档仍红；排除“简单融合恢复可训练性”。
- `onlySeg=skillHead` 双底座臂完成，血统正确且 selftest3 全绿；但 DR holo/shift=0/0、ROD=1/4，风格注入失败。
- 结论：冻结骨干时只训 skillHead 不足以注入 holo/shift，需让共享表示与结果/塑形共同更新。
- 混合桌 PG 双底座 4000 局完成，10/10 快照 selftest3 全绿；但 holo/shift 命中仅约 0–0.03 次/局，Stage1 仍≈0，风格注入失败。
- 修复 `pg-train` 的口径日志：过去无论是否传 `--arenaPool/--arenaShapes` 都硬印 mild，现在打印真实 roster、poolFp 与 shapes。

- 全网络短程蒸馏 40/80 步均全绿；holo/shift=`41/5`、`38/7` 格，2P rule `−0.38/−1.70pt`、legacy `−3.10/−3.30pt`，2P 修复成立。
- 但 40/80 到旧 hard 质心 L1 仅 `0.229/0.178`，加入后整池平均 L1 未升，尚未达到风格离散目标。

- 120 步 selftest3 红，140 步虽绿但 L1=0.230；holo/shift 路线按预注册停止。
- 改攻 taunt 外围控制轴：DR/ROD 两底座均全绿，taunt=`16/27` 格，L1=`0.432/0.461`，前五轴=`55.99%/54.85%`，达到风格目标。

- taunt 双候选 2P 与 Arena 均严重退化：rule `+61.40/+35.85pt`，Arena B `−61.44/−65.80pt`，按预注册淘汰；风格训练线收口，无候选入池。
- 结果报告：`RESULTS-2026-11-26-style-repair.md`。

- 复刻考古：仓外 `srv-wt-*` 已不在，改用 Git 历史工作树重建 `caebdf45`；quarantine、旧仓与 Temp 扫描均 0 命中。
- 首次 Q1f 重放 0 命中，定位为 jobs TSV 少一个空校准列，env 被解析进 `calibPath`，实际跑成默认配置；补列后重跑中。
- 修复 `replay-diagnose --batches` 在 metaSeed 缺失时不从 id 尾号取 seed 的问题，现已能找到隔离件。

- `v7aim1f` 修正 env 后完成重放，三枚 wid 仍 miss；未恢复权重、未改台账。结果见 `RESULTS-2026-11-26-archaeology.md`。
- 训练栈自证、D218、malformed jobs 变异均通过。

## NEXT

1. Q1f 仍需原始 shell 完整环境或同批幸存者 META；拿到新证据前不盲扫 era/经济旋钮。
2. 跳过已判死的 `fstA`；不为单枚长尾盲扫。
3. 本分支只做研究，不擅自改主池或合 main；整理证据后推送研究分支。
