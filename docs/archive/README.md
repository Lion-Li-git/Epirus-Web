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
| `HANDOFF-FOR-QWEN-2026-09-21.md` | **给千问的训练侧交接件**（当前有效） |
| `HANDOFF-2026-09-19.md` | 有 3 处代码引用 ⇒ 保留（内容已部分过时，但引用还在） |
| `l2-eval.md` + 生成的 `.html/.tsv/.json` | 被工具引用/生成 |

## 这里存档的是什么

- `AUDIT-RESPONSE-*`（v1.5.17 ~ v1.5.104 及 09-19 overnight）· `AUDIT-REQUEST-*` · `AUDIT-2026-09-19-post-merge` ·
  `GATE-AUDIT-2026-09-19` —— 各轮第三方复核的应答，**结论已落进代码与 CHANGELOG**。
- `REVIEW-5P.md` —— 早期的 5 人场复核。
- `HANDOFF-2026-09-16.md` · `HANDOFF.md` —— 更早的交接件（现行见 `HANDOFF-FOR-QWEN-2026-09-21.md`）。
- `RESEARCH-LOG-2026-09-18-overnight.md` · `RESEARCH-LOG-2026-09-20-qoder.md` —— 早期研究日志。
- `PROMOTION-CANDIDATE-*` · `PLAN-RING-FEATURE.md` · `FOLLOWUP-for-ds-2026-09-19.md` · `v1.5.71-verify.md` —— 一次性工单/计划。

## 怎么找回全文

```bash
git log --follow --oneline docs/archive/<文件名>     # 追这份文件的全部历史
git show <旧提交>:docs/<文件名>                      # 移动之前的路径
```
