# HANDOFF · 2026-11-26 晨班

## 已完成

- v2.1.31：三维行为轴 all / 1.8 / 2.0 独立拟合并同步切换；过线场默认 40%、势场默认 50%。
- 版本投影生成链接入 `rebuild-map`，重复运行 display/projections SHA 逐位稳定。
- `skill-mastery` 增加 transfer 回传已知答案腿，修复 miniT 子断言不计入总失败；变异体按预期 exit 1。
- 31 池同 seed 回归完成，无广泛退化。
- holo/shift 双底座风格候选达到风格目标，但 DR 候选 2P rule `+11.55pt`、ROD 候选 promote 偏座，均淘汰，池未改。
- transfer 六枚旧臂补训练台账，原始证据升格。

## 验证

- `rebuild-map`：版本投影自证通过，页内 `101 PASS / 0 FAIL`。
- map validate：canonical `998 / mismatch 0`。
- pool-sync：31/31；D234、D82 单独通过。
- `np --group=probe`：83/83；`np --group=ui`：55/55。
- 浏览器 `SMOKE OK`、`BATTLE OK`。
- 以上均为定向验证，不是本地整轮门禁。

## 下一班

1. 先读 [`RESULTS-2026-11-26-style-and-map.md`](RESULTS-2026-11-26-style-and-map.md) 与 [`STATUS-2026-11-26-style-overnight.md`](STATUS-2026-11-26-style-overnight.md)。
2. 风格训练若重开，先解决 2P 保护；不要在本次失败配方上继续扫剂量。
3. `dualGun / mirror` 已豁免，不为 `30/30` 凑覆盖。
4. 31 池当前 hard 16 / soft 15；本轮无池表改动。
