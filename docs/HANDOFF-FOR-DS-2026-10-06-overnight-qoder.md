# 给 DS 的夜班交接 · 2026-10-06（qoder · 01:49 +0800 起笔）

> 用户 01:4x 下了新一批八条（见最后一节），我按那批走。**这份先给结论，记账在后面。**
> 我这批全部落在 `champion-map/` + `docs/` + `tools/np-test.mjs` 的分组层，**没碰引擎、没开训练**。

## 一、三条结论

1. **门禁已经能按工作类型跑了**（§E335，已提交 `d8be200`）。以后"只改图/只改文档"的班次不必再等 800 秒：
   `node tools/gate-all.mjs --np --group=meta` ⇒ **15 道、35.6 秒**（整轮 272 道）。
   ⚠ 但 `--group=` 与 `--only=` 同罪：**不许当"四道全绿"引用**，总结论行会自己印"不是整轮认证"。
   六组：`meta 15 ‖ ui 7 ‖ ship 36 ‖ train 103 ‖ probe 36 ‖ engine 72`（累计依赖：跑 train 会连带 ship+meta）。
2. **这批"分数比现役高"的未上线冠军，铺满 F 全程重测之后只有 2 枚真赢现役**（§E334 + §E336，三批种子）。
   `v7s9-82` +10.4±2.6pt（三批同向）、`v7l2f-101` +9.4±2.2pt（三批同向）；其余 24 枚要么在噪声带内、要么输。
   ⇒ 这两枚是**上线候选**，但"能不能换包"我还没走完（上槽体检 + 页面口径复测 + 逐手看），见最后一节第 8 条。
3. **F 这把尺的 `T·S` 那一项在稀释它的排序效度**（实测，n=26 铺满 rank 1→901）：
   与配对实战差的秩相关 `H 考卷 0.534 ‖ Hp 页面 0.498 ‖ F 复合 0.388 ‖ S 广度 0.177`。
   而 §E334 那 12 枚（全在 rank 8~42 的窄带里）`rho(F, 实战) = 0.05`。
   ⇒ 两句话合起来：**F 能筛掉最差的，选不出最好的**；头部 band 内的名次没有实战含义。
   这是**口径问题** ⇒ 归用户裁，我不动 `js/train/evo.js` 里的 fitness。

## 二、记账（可复跑的凭证都在仓库里）

| 件 | 在哪 | 怎么复跑 |
|---|---|---|
| 分组实现 | `tools/np-test.mjs` 顶部 `GRP`/`CUM` + `t()` 过滤；`tools/gate-all.mjs` 接 `--group=` | `node tools/np-test.mjs --list-groups` |
| 整轮认证 | 本机 **01:29:57 +0800** 收口：`通过 272 / 272` ‖ `§E335 分组在册 ✅ 272 条门全部归组（269 个键）` ‖ `EXIT=0` | `node tools/np-test.mjs`（启动时刻没记 ⇒ 不引秒数） |
| 三批配对差 | `champion-map/duel-e336-s{77000,88000,99000}.tsv` + 合流表 `duel-e336-pooled.tsv` | `node champion-map/duel-run.mjs --ids=… --seed=…` ‖ `node champion-map/duel-stats.mjs` |
| 26 枚名单 | `champion-map/_e336-panel.tsv`（rank/F/Hp/S 同表） | 见 §E336 那节 |

⚠ **三处 hazard，下次你动 `tools/` 前值得先看一眼**：
- **认证树 = 提交树**这条对 `.gitignore` 也成立：**L5 会 `readFileSync('.gitignore')`**（断言 `-out.js` 在册）。
  我那趟整轮跑完之后才加了一条忽略规则 ⇒ 严格讲认证的是**加之前**的树，所以我补了 `--only=L5` 单腿（1/1 绿，01:33:04→01:33:15）。
- `gate-all` 红时落的 `docs/artifacts/gate-fail-<job>.txt` **原本没被忽略**（`*-out*/` 只盖目录）⇒ 跑红一次就多一份未跟踪的 35KB 红日志，
  下次 `git add -A` 会把它当成果提交。本班补了忽略规则（只忽略、没删盘上的旧取证）。
- 本仓工作树是 CRLF ⇒ **`split('\n')` 之后末列带裸 `\r`**。`coords.tsv` 的 `path` 列正好是末列，
  一旦有人用 LF 重写这份表，`indexOf('path')` 就返回 −1，`lineage`/`feas`/`duel-run` 三个工具会**一起瞎**且不报错。
  现在这几处读文件都统一 `replace(/\r\n/g,'\n')`，`attach-path` 还带"写完立刻回读"守卫。

## 三、用户 01:4x 新下的八条（我正在做，别撞车）

1–5 全在 `champion-map/viewer.mjs`（批次切换 / 点大小=名次+精确命中 / 颜色以现役为绿红分界 / 滚轮放大点跟着变大 / 冠军卡按上线时间排一列可加入对比）；
6 = 门禁再规划一层（在 §E335 的分组之上）；7 = **全息屏障→原型制御 这次要做**（此前一直是 pending，我没动过）；
8 = `docs/` 整理：按天日志进一个文件夹、没用的移出去。

⇒ **我这批会动 `docs/` 的目录结构**（`git mv`，内容一字不改）。已经先审过引用面：
**没有任何门读 `OVERNIGHT-*` / `RESEARCH-LOG-*` 的路径**（`grep -nE "readFileSync\([^)]*docs/" tools/np-test.mjs` 只有 `RULES-2P.md`/`METHODOLOGY.md`/`artifacts/*` 那几份），
所以移动它们属 docs-only、不需要重认证；但 `CHANGELOG.md` 与旧日志里那些"见 docs/OVERNIGHT-…"的指针会指到旧位置，
我按 `docs/archive/README.md` 的既有做法**给一张 old→new 对照表，不改历史文字**。
你若按旧路径找某夜的账，先看那张表。
