# RESULTS · 2026-11-26 · 缺件扫描与 Q1f 历史重放

## 结论

- 当前台账 `missing 133`；fam4/5/6 为 72 枚，`v7-scan-plan` 因根字段缺失全部判 T3。
- 仓外 `srv-wt-* / srv-replay-*` 已不在；quarantine、旧仓 `D:/code/Epirus` 与 32 个 `Temp/epirus-*` 扫描均 **0 命中**。
- 用 Git 历史工作树 `caebdf45` 重放 Q1f 配方，首次因 jobs TSV 少一列而跑成默认配置；修正 env 接线后确认 `IMIT_FRAC=0.5 / teacher=pickAimDefender / CLEAR_W=0.1 / DIV_W=0.3 / SEAT_GAMES=24` 全部生效，但三枚 wid 仍不中。
- 本轮未恢复权重、未改台账；得到的是两条可复用的仪器修正与一个更窄的缺口：Q1f 仍有未入册维度或工作树状态差异。

## 仪器修正

1. `scratch/sweep-server-batches.mjs`：jobs 表头有 `env` 而数据行缺该列时，立即报错，拒绝把 env 静默读成默认配置。变异体（14 列 vs 15 列表头）按预期 exit 1。
2. `tools/replay-diagnose.mjs --batches`：`metaSeed` 缺失时从 id 尾号回退取 seed；修复前会搜索 `arm-.bak`，把已落盘产物误报为“没找到”。
3. `training/proto2/pg-train.mjs`：训练日志改为打印真实 roster、`poolFp` 与 shapes；自定义 `--arenaPool/--arenaShapes` 不再硬印 `mild(cap2/mix0.5)`。

## Q1f 重放回执

- era：`caebdf45`（与 `28aff0a6` 的训练代码无 diff）。
- 配方：base v1.3.58，250 gens，pop16，gpo8，workers16，22 对手名单，seed 31/82/93。
- 目标 wid：`0660c3d11cf214c6 / e4aecf1d62980acb / 8a1dff1dd0cc48aa`。
- 修正后产物 wid：`8fab0c8e8c9832a1 / e75ea2f41e5b2a39 / cebc716ad7ac6c06`，均 miss。
- 下一步需要原始 shell 的完整环境或同批幸存者 META；在拿到新证据前不继续盲扫 era 或经济旋钮。

## 验证

- `training/train.mjs --selftest`：37 条原型自证、selftest3、浏览器对账全过。
- `np --only=D218`：1/1。
- malformed jobs 变异：exit 1，错误点名缺 env 列。
- 原始日志：`evidence-2026-11-26-style/anchor-scan-*.log`、`replay-diagnose-aim1f*.txt`、`pg-log-check.txt`；重放日志 `scratch/v7-mined/sweep-1126-aim1f*.log`。
