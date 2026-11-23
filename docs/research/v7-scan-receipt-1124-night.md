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
| `v7b` | 4 | **A 抛异常**（两 era 都 exit=1） | `31310c26`/`e227d222` | 零 env（表值=era 默认） | 没出件 ⇒ 别记成配方 miss；先查 runner 为什么抛 |
| `v7new5_01` | 6 | **A + C 混**：校准抛异常，整扫 6 枚都出件但 wid 不等 | `6bd21e41`/`a81f9fbe` | commit 正文 `CLEAR_W=0.1` + wave4 模板 | 出件说明 era/命令通，wid 不等 = **差一维 env**（C 类）|
| `v7new5_005` | 4 | **A 抛异常**（两 era） | 同上 | 同上（`CLEAR_W=0.05`）| 校准没过后整批被跳过，没到 C |
| `v7ringA1` | 6 | **C**：12 次全出件、wid 全不等 | `407d2c6c`/`e5a6b4c5` | `l2-arms.mjs:28-29,54-55` + `RESEARCH-LOG-2026-09-18:149` | 两 era 都到 C ⇒ era 大概率对，**缺的是那一维 env** |
| `v7ringB1` | 4 | **A 抛异常**（只跑了一 era） | `407d2c6c` | 幸存者 meta：零偏差 + 池 16 | 没跑完，`e5a6b4c5` 未试 |
| `v7roleC2` | 3 | **A + C 混**：出件 3 枚 wid 不等 | `9adc22c5` | `DIV_ROLEW=1;WALL_FILTER=1` + cli-context seed 94/95/96 | 同 new5_01：命令通、配置差一维 |
| `v7rb2` | 3 | **A + B**：一 era 出件不等、另一 era 产物未落 | `be0698a6`/`0b289dc1` | `BIGCARD_W=0.2;RING2_W=0.25` + **`RING2_HOT=js/bundled-champion-3p.js`** | 唯一 3 枚有 `metaSeed` 背书的一批，值得先修 A |
| `v7rb1` | 3 | **A + B + C 都占** | 同上 | `BIGCARD_W=0.1`（口径冲突先用 0.1）| 症状最杂，排最后 |
| `v7expo` | 3 | **C**：两 era 各 3 枚全出件、wid 不等 | `407d2c6c`/`e5a6b4c5` | commit 正文 `ECO_TARGET=0.3;ECO_CAP=5;ECO_DIVW=0.15` | 与 ringA1 同 era 同症状 ⇒ 可能是**同缺那一维** |

## 本班最终账（00:2x 跑完，10 批 / 39 枚发完）

- **命中 3 枚**：`v7tgt5-31` (`243f3c44f6ab5b7b`) ‖ `v7tgt5-62` (`b2da91e48d37d018`) ‖ `v7tgt5-64` (`acbfa100611ad379`)——**3/3 全中**，正是"配方 + era + seed 逐字在案、零猜测"那一批。
- 台账：`missing 154 → 151` ‖ `sha-diff-wid-same 121 → 124` ‖ `ok 708` 未动。
- `node tools/land-recovered.mjs --check` **零违例**，第四条也 0（有结论 816→819，说明驱动给新命中回写的历史 ts 与我独立复算一致）。
- 三枚 `.bak` 已进 git（`git ls-tree HEAD docs/artifacts/` 可查）。⚠ **它们搭在了 `c1949d72`（一笔工具提交）里，那笔说明没提这三个文件** —— 属"说明与 diff 不对账"，历史不改（不 amend），在此明记；下一班按 `git show --stat c1949d72` 能看到。
- **其余 9 批 0 命中**，症状分三类，别混着记：
  - **runner 抛异常**（`new5_01/005`，`ring2-run.mjs:233` 栈）⇒ 是"跑不起来"，不是"配方不对"；
  - **校准件没产出**（`v7b` 的 `ENOENT v7b-37.bak`）⇒ 同上，先看产物落点；
  - **产物落盘但 wid 全不等**（`ringA1 @407d2c6c` 六枚、`rb1/rb2/expo` 若干）⇒ 这才是"差一维 env 或 era 错"，按 §"三种形状"去分诊。

## 下一班的第一个动作（别急着再扫）

发**只动 era、不动 env** 的探针把 `ringA1` 钉死：它的六枚 wid 全不等，而 env 出处是逐字的 `l2-arms.mjs:28-29,54-55`——先确认 era 里那份工具**确实是当年跑这批时的那一版**（`git show 407d2c6c:tools/l2-arms.mjs` 与 `RESEARCH-LOG-2026-09-18:149` 两处对照），再谈换 era。
`expo/rb1/rb2` 同理：**先证明"这一批当年用的是哪一份 runner 工作树"，不要拿默认 HEAD 的 runner 去重放**（11-23 已证过这个病：`train-3p.mjs` 里带 v7-era 补丁）。

## 明确不发（省算力）

- `fstA`（6 枚）：回执早已"两 era 试尽 ⇒ 归档"，本班不再碰。
- `v7s4…v7s9`（六批 18 枚）：链式热启动，全部锁在 `v7cur2-31` 恢复之后；先复现根才有意义。
- 39 个"只剩 1 枚"的批：每枚都要独立做 era 考古，性价比最低，留给白班按需点。
