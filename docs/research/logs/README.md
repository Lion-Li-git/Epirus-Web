# docs/logs —— 按天的研究/夜班日志（**每份只装一天，不回填旧档**）

> 2026-10-06（qoder 夜班 · 用户：「docs 里面按天运行的日志放一个文件夹里面」）：
> 顶层 19 份 `RESEARCH-LOG-*` / `OVERNIGHT-*` 用 `git mv` 挪到这里。**只有位置变了，内容一字未改**
> （`git log --follow --oneline docs/logs/<文件名>` 可追全部历史）。

## 这里的命名约定

| 前缀 | 是谁的账 | 起于 |
|---|---|---|
| `RESEARCH-LOG-<日期>-{ds,qoder}.md` | 白班/当日的研究日志（DS 与千问各一份） | 09-18 |
| `OVERNIGHT-<日期>-qoder.md` | 夜班账本（§E 编号连续，跨夜就新起一份） | 09-28 那批起用 |

⚠ **一份日志只装一天**（`docs/archive/README.md` 2026-09-30 那节立的规矩：`RESEARCH-LOG-2026-09-28-qoder.md`
曾长到 5290 行、上下午混在一档读不动）。跨夜继续干就新起一份，别往旧档尾巴上堆。
§E 编号是**全仓连续**的，不随文件切换重排。

## 这些路径被谁引用

- **没有任何门读这里的路径**。判据是命令查出来的、不是印象：
  `grep -nE "readFileSync\((['\"])[^'\"]*docs/" tools/np-test.mjs` ⇒ 只有 `docs/RULES-2P.md`、`docs/METHODOLOGY.md`
  与 `docs/artifacts/*` 那几份在门的读取面上 ⇒ 挪日志属 docs-only，**不需要重认证**。
- 但 `js/`、`tools/`、`server/` 的**注释**里点名了不少旧日志路径（`RESEARCH-LOG-2026-09-2x-*` 那几份尤其多）。
  那些是"证据在哪"的锚，本仓不去改它们（**改历史比留一条断链更糟**：那些句子是当时的事实）。
  ⇒ 在代码注释里看到 `docs/RESEARCH-LOG-…` 或 `docs/OVERNIGHT-…`，加一层 `docs/logs/` 就是现在的位置。
- 唯一改了的现行入口是 `README.md`（两处"全文见 …"），因为 README 是**现在**给人指路用的，不是历史。
