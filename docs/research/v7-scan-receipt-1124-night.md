# v7 扫批回执 · 2026-11-24 通宵班（Qoder）

> 承接 [v7-scan-receipt-1122-night.md](v7-scan-receipt-1122-night.md) 与 [STATUS-2026-11-24-night-qoder.md](STATUS-2026-11-24-night-qoder.md) §4.4。
> 执行器：`scratch/sweep-server-batches.mjs`（**单分片**——它每次命中会整表重写 `docs/ARTIFACT-LOSS-1119.tsv`，两个分片并发会互相吃掉对方的行）。
> jobs：`scratch/v7-mined/server-jobs-1124.tsv`（生成器 `scratch/v7-jobs-1124.mjs`，10 批 / 39 枚）。
> 日志：`scratch/v7-mined/sweep-1124.log` ‖ 台账改动前 sha：`scratch/v7-mined/ledger-sha-before-1124.txt`。

## 本班新学的三条

1. **`v7-scan-plan.mjs` 的 "T3" 不等于"没救"**：它判的是"这枚的 `wid` 不在 `registry.tsv`"，而 era 槽根其实还能从
   `lineage.tsv` 的 `parent` 列 + 文档里的热启动记录推出来。⚠ 别照那个词排班（本班就是这么差点砍掉整条线）。
2. **缺件的 `metaSeed` 在表里是空的**（元数据随 `.bak` 一起丢了）⇒ 剩余 154 枚里只有 `v7rb2` 的 3 枚能靠 `metaSeed` 定 seed，
   其余仍要按包名尾数猜、由 `targets` 列的在册 `wid` 当场否证。**"seed 权威在 metaSeed" 这句只对有元数据的行成立。**
3. **runner 抛异常 ≠ 配方不对**：`new5_01/005` 的校准跑是 `runner exit=1`（`tools/ring2-run.mjs:233` 抛栈），
   而 `v7b` 是 `ENOENT …/docs/artifacts/v7b-37.bak`（校准件没产出来）。这两种红**不该记成"配方 miss"**，
   否则下一班会把它当成"这批 era 不对"去换 era，白烧一整轮。

## 按批回执

| 批 | 枚数 | 判 | era | env 出处 | 备注 |
|---|---:|---|---|---|---|
| `v7tgt5` | 3 | ✅ **3/3 全中** | `3242a160` | commit 正文：同池 E + `EPIRUS_TGT_W=0.05` | `v7tgt5-31/62/64`，已 `git add -f`；`land --check` 随后仍 0 违例 |
| `v7b` | 4 | ✗ 校准没出件 | `e227d222`/`31310c26` | 零 env（表值 = era 默认） | `ENOENT v7b-37.bak` ⇒ 先看 runner 为什么没落产物，再判配方 |
| `v7new5_01` | 6 | ✗ 校准抛异常 | `6bd21e41`/`a81f9fbe` | commit 正文 `CLEAR_W=0.1` + wave4 模板 | 同批整扫阶段倒是出了件但 wid 不符 ⇒ 两条症状要分开查 |
| `v7new5_005` | 4 | ✗ 校准抛异常 | 同上（`CLEAR_W=0.05`） | 同上 | `runner exit=1 @ring2-run.mjs:233` |
| `v7ringA1` | 6 | ✗ 全 miss（`407d2c6c`） | 换试 `e5a6b4c5` | `l2-arms.mjs:28-29,54-55` + `RESEARCH-LOG-2026-09-18:149` | 六枚 wid 全不等 ⇒ 更像差一维 env，而不是 era 错 |
| `v7ringB1` | 4 | 待跑 | — | 幸存者 meta：零偏差 + 池 16 | — |
| `v7roleC2` | 3 | 待跑 | `9adc22c5` | `DIV_ROLEW=1;WALL_FILTER=1` + cli-context URL 的 seed 94/95/96 | — |
| `v7rb2` | 3 | 待跑 | `be0698a6`/`0b289dc1` | `BIGCARD_W=0.2;RING2_W=0.25` + **`RING2_HOT=js/bundled-champion-3p.js`**（wave4 没发 HOT 就是 0 命中病） | 唯一三枚 seed 有 `metaSeed` 背书的批 |
| `v7rb1` | 3 | 待跑 | 同上 | `BIGCARD_W=0.1`（两处口径冲突，先用 0.1） | miss 就换 0.2 |
| `v7expo` | 3 | 待跑 | `407d2c6c` | `ECO_TARGET=0.3;ECO_CAP=5;ECO_DIVW=0.15` | — |

## 明确不发（省算力）

- `fstA`（6 枚）：回执早已"两 era 试尽 ⇒ 归档"，本班不再碰。
- `v7s4…v7s9`（六批 18 枚）：链式热启动，全部锁在 `v7cur2-31` 恢复之后；先复现根才有意义。
- 39 个"只剩 1 枚"的批：每枚都要独立做 era 考古，性价比最低，留给白班按需点。
