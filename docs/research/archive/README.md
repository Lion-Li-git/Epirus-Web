# docs/archive —— 历史审核与交接（**只读存档，不是现行约定**）

> 2026-09-21（DS 整理 · 用户要求"docs 里也清理一下旧的 handoff 和审核文件"）：把**已被取代、且没有任何代码/门禁引用**
> 的文档移到这里。**只有位置变了，内容一字未改**（`git log --follow` 可追全部历史）。

## 什么还留在 `docs/` 顶层（现行）

| 文件 | 为什么留 |
|---|---|
| `RULES-2P.md` / `RULES-NP.md` | 规则裁定（被 `js/`、`tools/` 引用 ⇒ 动不得） |
| `METHODOLOGY.md` | 方法学（5 处代码引用；"打印机必须打印门所判的量"等规矩在此） |
| `PARAMS-PLAN.md` / `OPTIMIZATION-ep-cliff.md` | 参数与 EP 悬崖计划（有代码引用） |
| `REVIEW-QODER-2026-09-19.md` / `REVIEW-3P.md` / `AUDIT-RESPONSE-v1.5.85.md` | 仍有代码引用的复核件 |
| `RESEARCH-LOG-2026-09-21-ds.md` | **DS 当日研究日志**（归因、预注册、三栏对照等） |
| `RESEARCH-LOG-2026-09-21-qoder.md` | **千问当日研究日志** |
| `RESEARCH-QUEUE-2026-09-20.md` | 研究队列 + "别重做"清单（仍在使用） |
| `RESEARCH-QUEUE-2026-09-20.md` | 研究队列 + "别重做"清单（仍在使用） |
| `HANDOFF-2026-09-19.md` | 有 3 处代码引用 ⇒ 保留（内容已部分过时，但引用还在） |
| `l2-eval.md` + 生成的 `.html/.tsv/.json` | 被工具引用/生成 |

⚠ 本表是 **09-21 那次的现场快照**，已经漂过：`HANDOFF-FOR-QWEN-2026-09-21.md` 在 2026-10-03 那批里被挪进本档（见下面的 10-03 一节）。
⇒ 想知道"现在顶层有什么"请 `ls docs/*.md`，不要信这张表。

## 这里存档的是什么

- `AUDIT-RESPONSE-*`（v1.5.17 ~ v1.5.104 及 09-19 overnight）· `AUDIT-REQUEST-*` · `AUDIT-2026-09-19-post-merge` ·
  `GATE-AUDIT-2026-09-19` —— 各轮第三方复核的应答，**结论已落进代码与 CHANGELOG**。
- `REVIEW-5P.md` —— 早期的 5 人场复核。
- `HANDOFF-2026-09-16.md` · `HANDOFF.md` —— 更早的交接件（现行见 `HANDOFF-FOR-QWEN-2026-09-21.md`）。
- `RESEARCH-LOG-2026-09-18-overnight.md` · `RESEARCH-LOG-2026-09-20-qoder.md` —— 早期研究日志。
- `PROMOTION-CANDIDATE-*` · `PLAN-RING-FEATURE.md` · `FOLLOWUP-for-ds-2026-09-19.md` · `v1.5.71-verify.md` —— 一次性工单/计划。

## 2026-09-30（Qoder 整理 · 用户要求"旧的归档一下，今天下午以来的新内容写到另一个文档里，不要全堆在一起"）

**这次挪进来的 4 份**（判据：`js/ tools/ server/ tests/ index.html CHANGELOG.md README.md docs/{METHODOLOGY,RULES-2P,RULES-NP}.md` 里**零引用** ⇒ 挪走不会打断任何门或代码注释；且都已被更新的一份取代）：

| 归档件 | 被谁取代 / 为什么不再现行 |
|---|---|
| `HANDOFF-FOR-QWEN-2026-09-22.md` | 班与班交接；现行那份是 `docs/HANDOFF-FOR-DS-2026-09-28-qoder.md` |
| `HANDOFF-FOR-QWEN-2026-09-25.md` | 同上 |
| `HANDOFF-FOR-QWEN-2026-09-27-ds.md` | 同上（DS→千问那一支也已由 09-28 那份接上） |
| `NEXT-FOR-QWEN-2026-09-29-ds.md` | "下一步"清单；里面每条已被 09-30 的 §E179~§E184 走完或判废 |

**看过但故意没挪的**（点名留档，免得下一个人以为漏了）：`CHAMPION-CANDIDATES.md`（0 引用，但属冠军槽名单 ⇒ DS/用户裁定地盘，不自作主张）、`DECISIONS-2026-09-29.md`（裁定件，当天还要对着读）、`RESEARCH-QUEUE-2026-09-20.md`（本档上面那张表自己写着"仍在使用"）、`HANDOFF-2026-09-19.md`（5 处代码引用）。

**同日另一件事（不是归档，是拆档）**：`docs/RESEARCH-LOG-2026-09-28-qoder.md` 从 09-28 夜班一路长到 5290 行、当天上下午混在一档里读不动 ⇒
把 **09-30 下午起的 §E181~§E184 整体搬进新档 `docs/RESEARCH-LOG-2026-09-30-qoder.md`**（编号连续、内容一字未改，旧档末尾留了指针）。
⇒ 今后按本仓既有约定：**一份日志只装一天**（`RESEARCH-LOG-<日期>-{ds,qoder}.md`）；跨夜继续干就新起一份，别往旧档尾巴上堆。
搬运用的是可校验做法：`余下部分 + 搬走的块 == git HEAD 里那份原文` 逐行成立（0 丢行、0 改写）。

## 2026-10-03（Qoder 整理 · 用户要求"整理一下目前的仓库，旧的资料归档一下"）

判据**本批只用了 09-30 那次的"代码/门禁零引用"那一半，另外一半是我有意放宽的**（照实写在这里，免得下一个人以为规矩是"随便挪"）：
- **硬的**：`js/ tools/ server/ tests/ index.html` + `README.md` 的现行指针 ⇒ 这 9 份**逐份 grep 过，零命中**（挪走不打断任何门、任何代码注释、任何现行入口）。
- **放宽的**：09-30 那次还要求 `CHANGELOG.md` 与 `docs/{METHODOLOGY,RULES-2P,RULES-NP}.md` 零引用，**并且真的做到了**（那批 4 份里只有 `HANDOFF-FOR-QWEN-2026-09-27-ds` 在 CHANGELOG 留了 1 处）；
  本批**没有**满足这条 —— 9 份里只有 `HANDOFF-FOR-QWEN-2026-10-02-econ-plan` 是干净的，其余 8 份都被 `CHANGELOG.md`（`HANDOFF-2026-09-23-ds` · `HANDOFF-FOR-DS-2026-09-28-qoder` · `HANDOFF-FOR-QWEN-2026-09-21` · `OVERNIGHT-2026-09-28/29/30` · `OVERNIGHT-2026-10-01` · `RESEARCH-2026-09-23-*`）
  或另一份旧研究日志（`RESEARCH-LOG-2026-09-27-ds` / `-09-28-qoder` / `-10-01-qoder`）点过名。
  我的理由：那些是**记账文字**而不是判据，没有任何门读它们（本档全文 grep 过 `tools/`：零处引用 `docs/archive`），而"把一夜的夜班账留在顶层"会让人误读成现行计划。
  ⇒ 代价写在下一段：**旧文档里的路径会指到旧位置**，本档给出对照表。
**用 `git mv`**（历史可追、`--follow` 有效），**内容一字未改**；且都已被一份更新的取代。

| 归档件（旧 `docs/<x>` → 新 `docs/archive/<x>`） | 被谁取代 / 为什么不再现行 |
|---|---|
| `HANDOFF-FOR-DS-2026-09-28-qoder.md` | 交接件；现行是 `HANDOFF-FOR-DS-2026-10-03-qoder.md`（＋ DS 回信 `HANDOFF-FOR-QWEN-2026-10-03-pushrank-ds.md`） |
| `HANDOFF-FOR-QWEN-2026-09-21.md` | 同上（那份 09-21 的"当前有效"已被 09-28 → 10-03 两度接上） |
| `HANDOFF-FOR-QWEN-2026-10-02-econ-plan.md` | 经济轴计划；§E229 已按用户裁定**判否收摊**，接续的是 10-03 那两份 |
| `HANDOFF-2026-09-23-ds.md` | 班与班交接，已被 09-28 那份接上 |
| `OVERNIGHT-2026-09-28-qoder.md` · `-09-29-` · `-09-30-` · `-10-01-` | 夜班账本；每档只装一夜，现行那一夜是 `OVERNIGHT-2026-10-02-qoder.md`（§E234~§E271 一直写到 10-03） |
| `RESEARCH-2026-09-23-ds-ring-and-harvest.md` | 环流/收割专题；结论已落进 `CHANGELOG.md` 与 `docs/RULES-2P.md` |

**⚠ 旧文档里的路径指针会因此指到旧位置** —— 本仓不去改它们（**改历史比留一条断链更糟**：那些句子是当时的事实）。
本表就是 old→new 对照；`RESEARCH-LOG-2026-09-27-ds.md` / `-09-28-qoder.md` / `-10-01-qoder.md` 与 `CHANGELOG.md` 里各有几条这样的指针。

**看过但故意没挪的**（点名留档，免得下一个人以为漏了）：
- `HANDOFF-FOR-QWEN-2026-09-24.md`（`tools/probe-ep-reach.mjs` 引用）· `HANDOFF-FOR-QWEN-2026-10-01.md`（`tools/log-reading.mjs` 引用）
  · `PROPOSAL-2026-10-02-econ-exam-tables.md`（`tools/np-test.mjs` + `server/opp-pool.mjs` 引用）⇒ **有代码引用，挪了会打断门**；
- 各份 `RESEARCH-LOG-2026-09-2x-*` / `-10-0*`（多数被 `js/`、`tools/` 的注释点名，属"证据在哪"的锚）；
- `CHAMPION-CANDIDATES.md` ⇒ **09-30 那批已记为"DS/用户裁定地盘，不自作主张"，本次仍留在顶层**（我曾顺手挪走，核对那条记账后**又挪回来了**）；
- `DECISIONS-2026-09-29.md`（裁定件）· `RESEARCH-QUEUE-2026-09-20.md`（本档上面那张表自己写着"仍在使用"）· `HANDOFF-2026-09-19.md`（5 处代码引用）。

**同日的另一件清理（不是归档）**：`README.md` 头部那面"每版堆一行"的墙（46 行、v1.5.316~v1.5.331 全摞在第一章上面）压回 **16 行、只留当前版本**，
历史逐版结论指回 `CHANGELOG.md` ⇒ 这条规矩本来就写在 README 自己那句"README 不是账本"里，这次是照自己立的规矩做一遍。

## 2026-10-06（qoder 夜班 · 用户：「整理一下 docs，没用的东西移出去」）

判据这次**收紧回 09-30 那条硬的**，没有再放宽：先跑一遍引用面审计
（`docs/artifacts/e337-out/docref-audit.mjs`，把 `js/ tools/ server/ tests/ index.html README.md .gitignore` + 门读的三份 docs 算"硬面"，
`CHANGELOG.md` 与其余 docs 算"软面"，逐份数命中），**硬面非零的一份都不挪**。
`git mv`、内容一字未改。

| 归档件 | 为什么不再现行（硬面引用数全为 0） |
|---|---|
| `REVIEW-2026-09-24-criteria-measurement.md` · `-gate-layer-audit.md` · `-metrology-audit.md` | 09-24 那轮三方复核；结论已落进 `CHANGELOG` 与门（同批的 `-killreward-ds` 有 README 指针 ⇒ **留在顶层**） |
| `HANDOFF-FOR-QWEN-2026-10-03-drain-verdict-ds.md` · `-drain-window-ds.md` · `HANDOFF-FOR-QWEN-2026-10-04-well-rescale.md` · `-well-rounds.md` · `HANDOFF-FOR-DS-2026-10-04-well-v3-qoder.md` | 班与班的交接；现行那支是 `docs/HANDOFF-FOR-DS-2026-10-05-gate-vs-objective-qoder.md` → `HANDOFF-FOR-DS-2026-10-06-overnight-qoder.md` |
| `PROPOSAL-2026-09-30-adversary-model.md` · `PROPOSAL-2026-10-02-config-axis-ds.md` | 两份都已判完：对手模型那支落进 §E148~§E156；配置轴那支 §E230 **判否收摊**。⚠ 同名的 `-econ-exam-tables` 有 `np-test.mjs` + `server/opp-pool.mjs` 硬引用 ⇒ 留在顶层 |
| `l2-eval-matrix-120.tsv` · `-engine-1391c094.tsv` · `-engine-61a7711c.tsv` | 09-19 那批 L2 矩阵读数，规则指纹已换三代（`1391c094`/`61a7711c` 就是当时那两个），现在的尺读不出可比读数 |
| `skill-report-3p.html` · `-5p.html` · `-5p.png` | 09-11/09-12 的技能报告页；现行的是 `-2p` / `-cmp-3p` / `skill-report.html`（后者有 `tools/skill-report.mjs` 硬引用 ⇒ 留） |

**同日另一件事（不是归档，是挪日志）**：19 份 `RESEARCH-LOG-*` / `OVERNIGHT-*` 进了 **`docs/logs/`**，
判据与"为什么不用重认证"写在 `docs/logs/README.md`。那两份 README 互相是对照表，别只读一份。

**看过但故意没挪的**（点名留档，免得下一个人以为漏了）：
`CHAMPION-CANDIDATES.md`（0 硬引用，但按 09-30 那节记的"DS/用户裁定地盘"，本次仍不动）·
`DECISIONS-2026-09-29.md`（裁定件）· `RESEARCH-QUEUE-2026-09-20.md`（本档上面那张表自己写着"仍在使用"）·
`HANDOFF-2026-09-19.md` · `PARAMS-PLAN.md` · `OPTIMIZATION-ep-cliff.md` · `REVIEW-3P.md` · `REVIEW-QODER-2026-09-19.md` ·
`AUDIT-RESPONSE-v1.5.85.md` · `METHODOLOGY.md` · `RULES-2P.md` · `RULES-NP.md` ⇒ **全部有硬面引用**（`js/`、`tools/` 或门本身），挪了会打断代码注释里的锚。

## 2026-11-06（Qoder 午班 · 用户：「旧文档归档一下」）

搬进 **`archive/2026-11-06-doc-sweep/`** 共 **107 份**，`git mv`、内容一字未改。三条判据同时成立才挪：

1. **硬引用面零命中** —— 扫 `README.md` ‖ `CHANGELOG.md` ‖ `docs/README.md` ‖ `tools/ server/ js/ champion-map/ tests/ .github/`
   全部 `.mjs/.js/.md/.html/.yml/.json` 的文件正文，文件名一次都没出现（这就是 D230 的活引用面，外加 CHANGELOG 与 docs/README）；
2. **活账本没点名** —— `LIVE-LINES.md` 与 `DECISIONS.md` 的正文里查不到这份文件名（被台账指着的 = 还在用，不挪）；
3. **不是当班的账** —— 文件名里的日期 ≥ 11-05 的一律不动（11-05 夜 / 11-06 晨那两批还在被引用与被复核）。

按前缀的行数（逐份名单 = `scratch/qoder-1106-archive-list.txt`，挪之前现算的那一份）：

| 前缀 | 份数 | 前缀 | 份数 |
|---|---|---|---|
| `PREREG-*` | 28 | `RESULTS-*` | 28 |
| `HANDOFF-*` | 11 | `PLAN-*` | 5 |
| `ANALYSIS-*` ‖ `DESIGN-*` ‖ `STATE-*` | 各 2 | `NEXT-STEPS` ‖ `POOL-12ROW` ‖ `PROPOSAL` ‖ `RESEARCH` ‖ `REVIEW` ‖ `REVIEW-CHAMPION-2.0` ‖ `TODO` 等 | 各 1 |
| 其余单次专题（`ADAPT-ARCH` / `AUDIT-V7-DIMS` / `BEHAVIOR` / `BREADTH-PRESSURE` / `CAPACITY` / `CF-GATE` / `CHAMPION-2.0-OBS` / `COMPOSITE` / `DEFENSE-TIMING` / `ESTIMATES` / `FINDING` / `G4-MECHANISM` / `GATE-AB` / `GATE-DISTILL` / `GATE-DRIFT` / `HOTSTART-LASER` / `LASER-EYE-LINE` / `STRENGTH-RULER-FIX` / `STYLE-ADAPT` / `SURVIVAL-PAYOFF` / `THREAT-GATE` / `WHY-DEFENSE`） | 各 1 | | |

**看过但故意没挪的**（点名留档，免得下一个人以为漏了）：
`LIVE-LINES.md` ‖ `DECISIONS.md`（跨班状态表与裁定台账，按 `docs/README.md` 第二节本来就不参与搬 archive）；
`CHAMPION-2.0-RESEARCH-*` ‖ `ACCEPTANCE-LINES-*` ‖ `CHAMPION-2.0-ARCH-*`（`docs/README.md` 第四节软链着的三份专题件）；
`GATE-AUDIT-2026-10-22-qoder.md` ‖ `REVIEW-STRENGTH-RULER-2026-10-29-qoder.md` ‖ `PREREG-2026-10-19-gift-veto-qoder.md` ‖
`CARD-VALUE-2026-10-13.md` ‖ `EXAM-FIT-MATCH-2026-10-10.md` ‖ `FINDING-2026-10-20-ring-payoff-ds.md` ‖ `DIM-V8-LANDING-2026-10-15.md` ‖
`TRAINING-METHOD-CONCLUSIONS-2026-10-17-ds.md` ‖ `RECOMMEND-2026-10-29-NIGHT-ds.md` ‖ `PROTO2-CAPACITY-N-2026-10-29-zcode.md` ‖
`ORACLE-TEACHER-2026-11-02-ds.md` ‖ `PREREG-2026-10-30-LONGSKILL-zcode.md` ⇒ **全部有硬面引用**（`tools/` 或 `js/` 的代码注释把它们当出处），
挪了会打断代码里的锚 —— 这正是 10-06 那节"硬面非零的一份都不挪"的判据在起作用。

同日另一件事不是归档而是清工作树：15 份未跟踪的临时件（重复页面 / 改表前快照 / 包副本 / 截图）挪进
`scratch/_cleanup-2026-11-06/`，逐份理由写在那格的 README 里；`champion-map/coords.tsv.pre-e600.bak` 因
`relabel-lineage.mjs` 拿它当回滚锚而**原地不动**。

## 2026-11-06（Qoder 午后 · 用户：「champion-map 里也有一堆没用的旧文件也删了」）

搬进 **`archive/2026-11-06-champion-map-evidence/`** 共 **67 份**（0.61 MB，`git mv` / 未跟踪的直接搬，内容一字未改）。
**为什么这些在 champion-map 而不是 docs/research**：那个目录同时是"每个 §E 的证据堆放处"——329 份里 `e*-*` / `epsfull-*` 占 86 份、
下划线开头的一次性回执占 47 份。搬完降到 **262 份**。

三条判据同时成立才搬：① **代码与门的正文一次都没提过这个文件名**（扫 `tools/ server/ js/ champion-map/*.mjs tests/ .github/` + README/CHANGELOG/index.html）
② 不落在任何**按命名约定解析**的通道上：`feas-long-*` / `feas-short-*`（`attach-hlong.mjs:68`、`attach-hshort.mjs:37` 通配读入）‖
`*-epsfull.tsv` / `*-ruler.tsv`（`rebuild-coords.mjs:105` 按 ruler 表名反推线上口径表）‖ `epsfull-g3*/r64*/v7long*`（现行 Hp/Hlong 的出处）
③ 只搬**数据回执**，脚本一律原地留（`.mjs` 是别条链的入口，挪了会打断相对路径）。

留下的 42 份各有上面第二类的依赖，逐份原因可用 `node scratch/qoder-1106-mapmove-list.txt` 之外的那次扫描复算（判据写在该脚本头注）。

⚑ **本班的一次自抓**：第一遍筛的时候我用"文件名前缀"当判据，误搬了 11 个 `.mjs` 脚本与 `epsagg.tsv` / `epsfull.tsv` 这类被代码读的真源表。
发现后把 140 份**全部退回**、`git reset`，再用"引用检查 + 排除脚本 + 排除通配约定"重做 ⇒ 最终这 67 份。
搬完重烘一次并跑四视图页内自检（`tree / 1d / 3db / map` 各 99 PASS / 0 FAIL）才敢说没打断东西。


## 2026-11-06（夜 · 用户：「仓库里似乎还有一些东西没有清理」）

### A. `docs/research/` 顶层十月流水 → **`archive/2026-11-06-october-sweep/`**（49 份）

判据：文件名或 mtime 的日期 **≤ 2026-10-31**，且不在保留名单（`LIVE-LINES.md` / `DECISIONS.md` / `PROBLEMS-2026-11-06.md` / 当天新增的 FINDING）。
搬完顶层只剩 **11-01 起的流水 + 三份常驻**（`LIVE-LINES` / `DECISIONS` / `PROBLEMS`）。
**活引用同步改了**：`docs/README.md` 三处（`CHAMPION-2.0-RESEARCH` / `ACCEPTANCE-LINES` / `CHAMPION-2.0-ARCH`）、
`docs/GATE-SHIFTS.md` 三处（`GATE-AUDIT-2026-10-22`）、以及 **13 处源码注释**（`tools/*.mjs`、`js/train/bots.js`、`champion-map/k8arms.mjs`）
—— 判据是 D230「活引用面里的 `docs/**.md` 指针必须真在盘上」，搬完它当场红了 18 处、逐处改到绿。

### B. `champion-map/` 清理

| 动作 | 数量 | 说明 |
|---|---|---|
| **删除**（作废的分页图） | 3 份 / **3.4 MB** | `index-2v-18.html`（1.3 MB）‖ `index-2v-20.html`（633 KB）‖ `index-2v-all.html`（1.39 MB）—— 三合一之后由单页 `index.html` 取代，且已无门比对它们 |
| **搬进 `archive/2026-11-06-champion-map-cleanup/`** | 25 份 / 114 KB | 只搬**数据回执**（`seat-*` / `k8*` / `opphuman-verdict-*` / `e641-arms` / `g4scan-*` / `holo-e649-*` / `pool12/pool-only/poolts` 等），对照表在 `INDEX.tsv` |
| 原地保留 | — | 所有 `.mjs`（脚本是别条链的入口）‖ `*epsfull*` 与 `*ruler*`（`rebuild-coords.mjs` 按名字反推口径表）‖ `feas-*`（`attach-hlong/hshort` 通配读）‖ `coords*` / `point-data*` / `lineage*` / `pool-*`（页面与池的真源） |
| 删除（根目录） | 1 个目录 / 340 KB | `d180-bands/`（3 份 9-28 的 `.bak`，未被跟踪、零引用） |

⚠ **本班的一次事故（如实记）**：第一遍用了宽松判据（「代码没点名就搬」），把 **34 个 `.mjs` 与 `*epsfull*`/`*ruler*` 通配表一起搬走了** ——
那正是上一节自己写下的第 ③ 条禁令（「脚本一律原地留」）。回退时 `git mv` 只还原得了 tracked 的那些，
**11 份从未入过库的未跟踪文件（`_breadth.tsv` / `_clone-report.json` / `_pf-*.tsv` / `e470/e493/e497/e518/e529-*`）随临时目录一起被删掉，无法恢复**。
它们的共同点是：0 代码引用、全部是 10-05～10-08 的一次性回执、其中 4 份还是 `.gitignore` 挡着的 `_` 临时件。
教训与上一节那条同族：**判据要先写成「只碰 tracked + 只碰数据回执 + 排除通配约定」，再执行**。

## 怎么找回全文

```bash
git log --follow --oneline docs/archive/<文件名>     # 追这份文件的全部历史
git show <旧提交>:docs/<文件名>                      # 移动之前的路径
```