# `docs/` 的两层 —— 先读这一页再翻文件

这一页只回答一件事：**你要找的是"结论"还是"过程"。**

| 层 | 在哪 | 是什么 | 怎么引 |
|---|---|---|---|
| **长期文档** | `docs/`（本目录顶层） | 给人看的、**可以被裁定直接引用**的东西：规则裁定、方法学、门禁口径、候选登记、报表 | 直接引文件名 + 条款号（如 `docs/RULES-2P.md` R56） |
| **研究流水** | `docs/research/` | 按天/按班次记的**过程账**：做了什么、实测到什么、判读、自曝 | 引**编号锚**（`§E342`、`⑩c`、`§7-5`），别引行号 —— 行号会随增删漂 |

---

## 一、顶层：长期文档（六份）

| 文件 | 它管什么 | 谁在读它 |
|---|---|---|
| [`RULES-2P.md`](RULES-2P.md) | **2 人规则裁定版**：R1..R60 + 子证（R19'/R23'/R34'） | 引擎注释逐条对应；`spec-run` / `np-test` 有多道门读它（钉的是"这条裁定在不在册"，不是措辞） |
| [`RULES-NP.md`](RULES-NP.md) | **多人（3~5 人）裁定版**：N1..N27（血量轴 N26、难度阶梯 N27） | 同上 |
| [`METHODOLOGY.md`](METHODOLOGY.md) | **方法学与口径陷阱**（编号逐条累积） | 人读；`np-test` 有腿读它的段落存在性 |
| [`GATE-SHIFTS.md`](GATE-SHIFTS.md) | **班次 → 该跑哪几组门禁**（§E335 六组 + §E341 `--auto` + §E355 CI 整轮） | 值班主任（DS / Qoder）每班对照 |
| [`CHAMPION-CANDIDATES.md`](CHAMPION-CANDIDATES.md) | 够格当"第三包"的候选登记（页面「导入冠军包」吃得下的那些） | 换包体检前查它 |
| `skill-report*.html` | 几代冠军 × 实机口径的技能分布报表（4 份：`-2p` / `-cmp` / `-cmp-3p` / 裸名） | 由 `tools/skill-report*.mjs` 重新生成 |

⚠️ **规则是用户的**：`js/core/*` 与这两份 RULES 文档里的裁定，改动一律只能由用户裁定；两个代理（DS / Qoder）不许自行"还原"或"顺手统一"。

## 二、`docs/research/`：研究流水（四个抽屉）

| 抽屉 | 装什么 | 规矩 |
|---|---|---|
| [`logs/`](research/logs/README.md) | `OVERNIGHT-<日期>-<代理>.md`（值班日志：DONE/DOING/NEXT + 预注册判据 + 自我报告）‖ `RESEARCH-LOG-<日期>-<代理>.md`（当日研究账：§E 编号 → 预注册 → 实测 → 判读） | **一份只装一天**；收工后整块搬进 `archive/`，不在活文件里堆历史 |
| [`handoff/`](research/handoff/) | `HANDOFF-FOR-DS-*`（Qoder 写给 DS）‖ `HANDOFF-FOR-QWEN-*`（**DS 写给 Qoder** —— "千问"="QWEN"=Qoder 本尊，不是第三方） | 交接件会过期；过期了就搬 `archive/`，别留在顶层骗下一个人 |
| [`reviews/`](research/reviews/) | 第三方复核（`REVIEW-*` ‖ `AUDIT-RESPONSE-*`）、决策单（`DECISIONS-*`）、提案（`PROPOSAL-*`）、薄汇总（`SUMMARY-*`）、研究队列（`RESEARCH-QUEUE-*`）、单次分析（`PARAMS-PLAN` / `OPTIMIZATION-ep-cliff` / `REVIEW-3P`） | 这类文件的**结论若被采纳**，要落进 CHANGELOG + 长期文档，然后它就退化成过程账 |
| [`archive/`](research/archive/README.md) | 过期流水（只读）。里面有历次搬动的 **old→new 对照表** | 只进不出；改名/合并都要在对照表里补一行 |

还有三个**产物目录**不属于"文档"：`docs/artifacts/`（臂产物 `.bak` 与仪器脚本 —— 门 D82 读它）‖ `docs/debug/` ‖ `docs/screenshots/`。

## 三、引用规矩（本仓栽过的形状，逐条对着防）

1. **别引行号，引编号。** `§E342` / `D229⑧` / `§7-5` 这种锚会活着；"某某文件第 N 行"一定会落空（本仓已四次踩到）。
2. **历史文本里的旧锚不改写。** 搬家时只修**活引用**（代码、README、当前有效的交接件）；
   `CHANGELOG.md` 与 `research/**` 里那些指向旧路径的句子属于**当时的账**，按下面的对照表换读法即可 —— 把它们逐条改掉等于改写历史。
3. **产物 ≠ 结论。** `docs/artifacts/` 里的东西**大部分只在个别机器上存在**（`*.log`、`*-out*/` 全被 gitignore），
   文档引用它时必须同时给出**可重跑的命令行**。
4. **门不许钉"某句话必须出现"**（`METHODOLOGY.md` 第 89 条）：文档面只允许钉存在性/一致性（版本号三处相等、点名的产物盘上真有、
   提到的门号真在册、指针不许落空）。措辞在册那种门同时造出假绿与假红。

## 四、搬动对照表（旧路径 → 现在在哪）

| 旧锚（历史文本里还会看到） | 现在的路径 | 何时搬的 |
|---|---|---|
| `docs/OVERNIGHT-<日期>-*.md` ‖ `docs/RESEARCH-LOG-<日期>-*.md` | `docs/research/logs/…` | 10-06（§E356；此前 10-05 §E339 已把它们从顶层收进 `docs/logs/`） |
| `docs/HANDOFF-*.md`（顶层散文件） | `docs/research/handoff/…` | 10-06（§E356） |
| `docs/REVIEW-*.md` ‖ `docs/AUDIT-RESPONSE-*.md` ‖ `docs/DECISIONS-*.md` ‖ `docs/PROPOSAL-*.md` ‖ `docs/SUMMARY-*.md` ‖ `docs/RESEARCH-QUEUE-*.md` ‖ `docs/PARAMS-PLAN.md` ‖ `docs/OPTIMIZATION-ep-cliff.md` ‖ `docs/REVIEW-3P.md` | `docs/research/reviews/…` | 10-06（§E356） |
| `docs/logs/` ‖ `docs/archive/` | `docs/research/logs/` ‖ `docs/research/archive/` | 10-06（§E356） |
| 更早在 `docs/archive/README.md` 里记的那批（10-05 §E339 的 19 + 16 份） | 同上，再套一层 | 10-05 / 10-06 |

⚠️ 三处**故意没改**的旧锚：`js/core/resolve.js`、`js/core/state.js`、`js/train/policy.js` 的注释里还写着顶层旧路径。
原因是这三个文件属于**规则指纹五件套**（`tools/rules-fingerprint.mjs` 的 `FINGERPRINT_FILES`），改一个字符就要换代指纹 + 重记两个线上槽的 meta，
而代价只是"注释里的锚要多跳一次" ⇒ 留旧锚，靠本表兜。**别顺手去改它们**（改了指纹就变，那是裁定面）。

## 五、机器怎么守这一层

`np-test` 的门 **D230** 扫**活引用面**（`tools/` `server/` `js/` 非指纹部分 `champion-map/` `tests/` `.github/` 与 `README.md`）：
其中出现的每个 `docs/…md` 指针都必须**真的在盘上** ⇒ 下一次再搬目录，漏改引用会当场红，而不是像今天这样靠人翻。
历史文本（`CHANGELOG.md` 与 `docs/research/**`）不在扫描范围内 —— 那是账本，改写账本比留着错更糟。
