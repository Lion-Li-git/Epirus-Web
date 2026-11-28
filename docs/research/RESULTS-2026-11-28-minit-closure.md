# RESULTS · 2026-11-28 · 小雷闭环量具修复

> 发现时间：2026-11-28 13:04（UTC+8）。
> 基线：`main@594ef9a2`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 结论：旧 `pool-skill-report` 把小雷当伤害技能计数，导致成功打断也记成未兑现；本笔只修量具与 4 份报告，不改规则、不改池。

## 1. 缺陷

`tools/pool-skill-report.mjs` 的闭环通用分支只认 `damage && via === skill`。小雷的规则效果是作废目标行动，不造成伤害，因此只要小雷成功打断，旧逻辑仍会把它记进 `wasted`。

引擎真实事件顺序为：

1. `voided { pid: 目标, by: 'miniT', byPid: 施法者 }`；
2. `voidedBy { pid: 目标, by: 'miniT' }`。

旧逻辑没有消费这两条事件，全池小雷 `paid` 恒为 0。

## 2. 修复

- 在现有事件扫描中配对紧邻的 `voided → voidedBy`，用 `byPid` 归因到被测席；
- 用前一条 `mirror` 事件的 `pid/to/key` 排除镜面复制的小雷，只计直放；
- 不改引擎事件形状，规则指纹保持 `c61298e6`；
- 重跑全部 4 枚有小雷覆盖的池成员，其他字段逐字不变，仅 `miniT` 闭环与测量时间戳变化。

## 3. 复测结果

| 成员 | 旧 paid/uses | 新 paid/uses | 新兑现率 | 解读 |
|---|---:|---:|---:|---|
| `DR-R3E` | 0/1 | 1/1 | 不可读（<20） | 样本太少，不据此排序 |
| `MT-PG` | 0/30 | 23/30 | 76.67% | 旧读数完全反向 |
| `MX6-GD-TF20` | 0/16 | 0/16 | 不可读（<20） | 复测后仍未成功打断，不能写成 0% |
| `JN-DR` | 0/13 | 13/13 | 不可读（<20） | 旧读数完全反向 |

原始复测件在 `scratch/minit-closure-check/`；在册报告已更新并重烘 `champion-map/skill-report.html`。

## 4. 验证

- `node tools/spec-run.mjs`：96/96；
- `node tools/rules-fingerprint.mjs`：`c61298e6`；
- 4 份报告剔除 `measuredAt/stageSec/miniT` 后与旧件逐字相同；
- Pages、Training CI 成功；Gates 见最终收口回执。

## 5. 对训练研究的影响

- 不能把旧表中的 `miniT paid=0` 当作“小雷无价值”的证据；
- `MT-PG` 与 `JN-DR` 的小雷有真实兑现；
- `MX6-GD-TF20` 的 soft 小雷覆盖仍是“出手但未打断”，且样本仅 16，不能单独构成保留或训练理由。
