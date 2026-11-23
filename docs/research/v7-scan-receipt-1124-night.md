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

## 00:3x 追加：两个仪器缺陷 + 一条能省掉整轮猜测的新路子

1. **驱动会读上一波的旧件冒充本次结果（已修）**。runner 中途抛异常时**没写产物**，而阶段 2 直接 `existsSync(arm-seed.bak)` 就比 wid ⇒ 比的是**上一班留下的同名旧件**。
   实测：驱动报 `v7new5_005` 校准 `wid=ffbc54b6712dfe64`，那是 **16:53 的旧件**；静机重跑的真产物是 `a0afbfbdc32cd0fb`（第三个值）。
   修在 `scratch/sweep-server-batches.mjs`：起跑前把同名件**改名隔离**（`.stale-<ts>`，不删），比 wid 前再断言**件的 mtime 晚于本次起跑**。
2. **重放是确定性的**——这点必须先钉，否则"0 命中"什么都说明不了。同一 era、同一 env、同一 seed **静机跑两遍**：`gen0/50/100` 的 best 逐位相同（`0.9050793335978562 / 1.1901569134577763 / 1.165702756174485`），产物 wid 两遍都是 `a0afbfbdc32cd0fb`。
   ⇒ **不等就一定是差输入**，不是随机性；但**并发抢核会让 runner 抛异常**（今晚 `new5_*` 两 era 的 `exit=1` 在静机复现时 92 秒正常跑完）⇒ **A 类批要静机重跑，别当配方错**。
3. **新路子：规格写在同批幸存者的件身上**。`tools/replay-diagnose.mjs`（本班新建）读 `.bak` 内嵌 META 的 `source/n/gens/games/pop/opps/mode/styleW`。
   为什么需要它：线谱表的 `mode/gens/oppsN/styleW` 是**从包内 META 烘出来的** ⇒ 包丢了这几列就是 `-`（`v7new5_005` 的缺件 -82/-91/-92/-93 四行全 `-`，而同批幸存者 -31/-81 记着值）。
   **"表里没记"从来不等"当年没参数"**：同一批的定义就是"同配置、不同 seed"，所以**拿幸存者的逐字 `opps` 名单当批次规格**即可。已用 `--emit-jobs` 写出第二轮 `scratch/v7-mined/server-jobs-1124-r2.tsv`（4 批：`v7b / v7new5_005 / v7ringB1`（+ 已全recover 的 `v7tgt5` 会被驱动自己跳过））。
4. ⚠ 顺手记一处在册**自相矛盾**：`v7new5_005-31` 的线谱行写 `oppsN=17`，而它**自己的 META 写 `pop=16` 且名单正好 16 个名字**。以件为准还是以表为准，得由管 lineage 生成的人裁——**别顺手改表**（11-17 那次把空值当权威广播的事故就是这么来的）。
5. ⚠ 我在这台诊断器第一版里犯的两样，都记下来防重犯：
   - 自己写 `META = {…}` 的非贪婪正则 ⇒ 停在**第一个内层 `}`**（META 里有 `feasibility:{…}`），39 枚里 35 枚"解不出来"。改用仓里那把 `extractJsonObject`（花括号配平）后 39/39 可解析。
   - 在 `tools/` 里顺手写了三个**我编的键名** `EPIRUS_TRAIN_GENS/GAMES/N` ⇒ 宇宙扫描当场把它们当新旋钮，`training/knobs.mjs --check` **变红**。正解是删掉臆造、只搬有证据的 `opps`，**不是**重生成册子把假键登记成在册暗键。

发**只动 era、不动 env** 的探针把 `ringA1` 钉死：它的六枚 wid 全不等，而 env 出处是逐字的 `l2-arms.mjs:28-29,54-55`——先确认 era 里那份工具**确实是当年跑这批时的那一版**（`git show 407d2c6c:tools/l2-arms.mjs` 与 `RESEARCH-LOG-2026-09-18:149` 两处对照），再谈换 era。
`expo/rb1/rb2` 同理：**先证明"这一批当年用的是哪一份 runner 工作树"，不要拿默认 HEAD 的 runner 去重放**（11-23 已证过这个病：`train-3p.mjs` 里带 v7-era 补丁）。

## 明确不发（省算力）

- `fstA`（6 枚）：回执早已"两 era 试尽 ⇒ 归档"，本班不再碰。
- `v7s4…v7s9`（六批 18 枚）：链式热启动，全部锁在 `v7cur2-31` 恢复之后；先复现根才有意义。
- 39 个"只剩 1 枚"的批：每枚都要独立做 era 考古，性价比最低，留给白班按需点。

## 01:3x 追加：把 206 个重放树当扫描源，`v7ringB1` 收回 4 枚

扫描口换成 `--sources=<默认 6 条 + 全部 srv-wt-* / srv-replay-*>`（`scratch/run-anchor-scan-1124.sh`，214 条源）。

| 读数 | 值 |
|---|---|
| 源文件 / 唯一 wid | 8003 / 1396 |
| 台账 missing（扫前 → 登记后） | **151 → 147** |
| 可恢复 / 无 wid 目标 / 无源 | 4 / 0 / **147** |
| 命中的那 4 枚 | `v7ringB1-31` `v7ringB1-82` `v7ringB1-91` `v7ringB1-92` ← `D:/code/srv-wt-s0-407d2c6c/docs/artifacts/` |

三件要留给下一班：

1. **源文件名写的是 `v7ringA1-*.bak`，而它们的 `widOf` 逐位等于在册 `v7ringB1-*`。** 按"wids 即身份"的在册约定登记为 B1，但这处不一致必须记下来：**重放树里的文件名不能当批次证据**（这台树当时在写 A1 的路径、产的是 B1 的权重）。
2. 这 4 枚是**重放复算逐位命中历史 wid** ⇒ 上一节那句"`ringA1` 的 era 还没钉死"要改写：至少 B1 这一族的配方已经被字节级复现验证过一轮；剩下 147 枚的无源仍是 era/env 未定，不是"扫过了没有"。
3. 登记步的两条自动腿都在真件上生效过：`META.ts` 回写历史时刻（`2026-11-23T15:34–15:43Z` → `2026-09-18T13:37–13:45`，只改那一个字段），以及"表不许落后于件"当场点名这 4 行。跑生成器 + 重烘页面后 `land-recovered --check` exit 0、页内自检 100 PASS。
