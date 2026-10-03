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

## 怎么找回全文

```bash
git log --follow --oneline docs/archive/<文件名>     # 追这份文件的全部历史
git show <旧提交>:docs/<文件名>                      # 移动之前的路径
```
