# 门禁（tools/gates/）—— 怎么跑 · 每个部分管什么

> **规矩第一条：默认不跑整轮。**
> 整轮 = `node tools/np-test.mjs`（171 条 · 本机约 4~5 分钟）= `--group=engine`。
> 挑门这件事**已经有自动化**（`node tools/gate-all.mjs --auto` / CI 的 `--part` 矩阵），
> 所以「不知道跑哪组」不是跑整轮的理由 —— 先看 §3 的判定表，再不行就问用户。
> 用户 2026-11-06 原话：「我们有很好的自动跑门禁系统，可以自动检测哪些门禁要跑……**禁止随意跑整轮**」。

---

## 0. 速查

| 你要做的事 | 命令 |
|---|---|
| 不知道改了什么、想按改动面挑 | `node tools/gate-all.mjs --auto` |
| 只跑某一组（含更浅的组） | `node tools/np-test.mjs --group=meta` / `=ship` / `=ui` / `=probe` |
| 只跑一个部分文件（CI 就是按这个切） | `node tools/np-test.mjs --part=engine-rules` |
| 只跑一条门 | `node tools/np-test.mjs --only=D234` |
| 看有哪些组 / 哪些部分 / 每部分几条 | `--list-groups` / `--list-parts` / `--list-parts --json` |
| 看执行顺序（原始行号 + 门名） | `node tools/np-test.mjs --list-order` |
| 本机想快 | `node tools/gate-par.mjs`（同一份名单，按部分并发） |
| 改完页面想验交互 | `node tools/smoke.mjs` / `node tools/battle-test.mjs`（真 Chrome，各 15~35 秒） |
| 引擎用例（不当门禁跑） | `node tools/spec-run.mjs`（61 条，0.4 秒） |

⚠ **`--group=engine` 就是整轮**（`CUM.engine = null` ⇒ 全部）。它不是「只跑引擎组」，别拿它当轻量选项。

---

## 1. 三个入口是什么关系

```
gate-all.mjs      五道一起跑 + 一行总结论（np / spec / smoke / battle / champion-map 页内自检）
   ├─ np-test.mjs      ← 门禁本体（171 条，注册 / 过滤 / 执行 / 收尾都在这里）
   │    └─ gates/*.mjs ← 11 个部分文件（门体全在这里；本 README 也在这一层）
   ├─ spec-run.mjs     ← 引擎用例（不是门禁，但认证里算一道）
   └─ smoke / battle-test / champion-map/shot.mjs  ← 真 Chrome 三道（需要浏览器）
gate-par.mjs       np 整轮的并行跑法（按部分并发；名单现读 --list-parts）
gate-parts-check.mjs  并集守卫：11 个部分拼回来必须正好等于全量（CI 里跑）
```

- `gate-all.mjs` 的 `--np` 会把 np 那条腿一起跑；**不带 `--np` 时它只跑 spec + 三道浏览器（约 45 秒）**。
- `--no-browser` 摘掉浏览器三道 ⇒ 那一遍**不是全绿**（总结论会点名缺了哪几道）。
- `docs/GATE-SHIFTS.md` 是**耗时与「该跑哪组」的真源表**；本文件不复写秒数。

---

## 2. 两个轴：`--group`（累计）与 `--part`（分区）—— 别混

| 轴 | 语义 | 取值 | 能当认证吗 |
|---|---|---|---|
| `--group=` | **累计深度轴**：跑一组 = 这一组 + 它依赖的更浅组 | `meta`(16) ⊂ `ship`(53) ⊂ `ui`(61) / `probe`(90) ⊂ `engine`=全部(171) | 不能（工具会自己印「只跑了 N / 171」） |
| `--part=` | **分区轴**：11 个部分文件互不重叠、并集 = 171 | 见 §4 的 11 行 | 不能（同上） |
| `--only=` | **单条**（子串匹配，不是列表） | `D234` / `N8` / `R65`… | 不能（同上） |

- `--part` 与 `--group` **不许同时给**（一个是分区轴、一个是累计深度轴，混起来只会得到「看着像全量」的假绿，runner 会直接拒）。
- CI 用的是 `--part` 矩阵：`.github/workflows/gates.yml` 的 `plan` 作业**现读** `--list-parts --json` 生成矩阵，
  加第 12 个部分文件时不用改 workflow。
- `--only=` 打错字会被拒（「含糊拼写不许当没写」）。

---

## 3. `--auto`：按改动面自动挑组（改了 `js/core/**` 会退化成整轮）

`node tools/gate-all.mjs --auto` 读 `git status --porcelain` + `git diff --name-only HEAD`，把每个路径分类，
取**最深**的那一类当这次该跑的组：`meta < ship < train < ui/probe < engine`。

| 改动路径 | 判到 | 实际跑 |
|---|---|---|
| `js/core/**`、`tests/**`、`index.html`、`server/**`、`tools/np-test.mjs`、`tools/gate-all.mjs`、`tools/spec-run.mjs`、`tools/gates/_ctx.mjs`、未跟踪的**新目录** | engine | ⚠ **整轮**（保守方向：宁可多跑） |
| `tools/gates/<前缀>-*.mjs` | 按前缀映射到 engine / ship / probe / meta / ui | 那一组 |
| `js/ui/**`、`tools/smoke.mjs`、`tools/battle-test.mjs` | ui | `--group=ui`（61） |
| `js/train/**`、`js/bundled*`、`tools/train-*`、`tools/eval-5p`、`tools/promote-champion*`、`tools/probe-*`、`tools/analyze-*` | ship | `--group=ship`（53） |
| `docs/METHODOLOGY.md`、`docs/RULES-2P.md`、`docs/RULES-NP.md`、`champion-map/pool-*`、`champion-map/pack-*` | ship | 同上 |
| `tools/*.mjs`、`champion-map/*.mjs`、`docs/debug/**` | probe | `--group=probe`（90） |
| 其余（`docs/` 其它、`champion-map/` 的表与页面、`results/`） | meta | `--group=meta`（16） |

**注意 engine 那一行**：`--auto` 碰到 `js/core/**`（哪怕只改了一句注释）就会退回整轮。这是设计上的保守方向，
不是 bug。想避免它，就显式给 `--group=` 或 `--part=`。例：只动了 `js/core/resolve.js` 的注释 ⇒
`node tools/np-test.mjs --part=engine-rules` + `--part=engine-fuzz` 两条就够（75 条，而不是 171 条）。

⚠ `--auto` 的结论**也不是认证**：总结论行会写「只跑了 N / 171」。

---
