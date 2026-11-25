# 证据索引 · 2026-11-25 2P 单包普查与池替换模拟

对应结果：[`RESULTS-2026-11-25-2p-census.md`](../../RESULTS-2026-11-25-2p-census.md)。

## 目录

- `raw/`：28 枚池成员 × rule/legacy × 4 seed 的固定包 2P 原始 JSON；每次同时测 hard/simple 两剂量、500 局/档。
- `calibration/`：v7 专用 2P 锚按历史 1000 局、seed 77000/90210 的复跑 JSON。
- `pack-strength.tsv`：逐包、逐替身、逐剂量的四 seed 均值/标准差/极值。
- `band-summary.tsv`：hard/soft 带级均值。
- `ranking.tsv`：带内 2P 强度排名。
- `ruler-correlation.tsv`：rule/legacy 跨包 Pearson/Spearman。
- `prediction-check-*.tsv`：逐包均值预测与 8 seed 整池实测的对账。
- `swap-simulation-*.tsv`：全部 195 个 hard/soft 换位的 H/R/S 投影与 seatKill/ArenaB/覆盖成本。
- `ordering-shortlist.tsv`：按最终 `hard < regular < simple` 次序与最小台阶排序。
- `projected-seatKill-all.tsv`：每个换位在目标 hard 带参照下的人席否决投影。
- `final-shortlist.tsv`：叠加次序、seatKill=0、全池覆盖不降后的短名单。
- `double-swap-shortlist.tsv`：两枚联动换位搜索，未找到三档单向改善解。
- `swap-validation/`：四个代表换位的 `--banddef` 临时视图实跑，8 seed × 两替身 × 1000 局/档；含逐 seed 配对差与聚合。
- `post-swap/`：产品真源表完成 `purify→hard / armor→soft` 后的 2P 八 seed 与 5P multi/long 复测。
- `promote-purify-hard.txt`：换带前 `promote --dry --support=2` 原始回执。
- `manifest.tsv`：224 次普查 + 4 次校准的时间、退出码与 SHA-256。
- `sha256-manifest.tsv`：本目录除自身与索引外所有文件的 SHA-256。

## 关键判语

- v7 锚证明两把尺各自有效，但 28 包排序相关低，必须分列。
- 逐包均值预测整池阶梯最大误差 0.56pt。
- 内部换位不能三档单向改善，但可修复倒挂；普通档几乎不动。
- `armor→purify` 的 2P 台阶最大且 seatKill=0，但 hard 丢 `transfer`；`HL-G1→purify` 覆盖不丢但增益弱；`armor→MX6` 增 hard `miniT` 但 projected seatKill=1。
- 用户批准后已执行 `purify→hard / armor→soft`，产品表与生成产物同步更新；未改规则代码、未跑本地整轮门禁。
