# 门禁班次表 —— 什么改动跑哪几道（§E341 · 2026-10-06）

> 用户 ⑥：「门禁重新规划一下」。§E335 已经把**所有门**分成六组并支持 `--group=`（条数与末号别在这里抄 ——
> 机器版本是 `node tools/np-test.mjs --list-groups`），这份补的是**上面那一层**：
> 拿到一次改动，怎么知道该跑哪一组。默认命令是 **`node tools/gate-all.mjs --auto`**（它读 `git status` 自己判）。
> ⚠ 为什么不写进 `docs/METHODOLOGY.md`：那份文件**在门的读取面上**（D153 读它），往里加一段就得重跑一整轮
> —— 为一张操作表付 20 分钟不划算。这里是操作性内容，不是方法学规矩。

## 一、六组是什么、谁依赖谁

| 组 | 条数 | 管什么 | 跑它也等于跑 |
|---|---|---|---|
| `meta` | 16 | 仓库纪律：CHANGELOG/README/版本三处、门号、落盘残留、可复现性 | — |
| `ship` | 36 | 出厂面：可行性闸、当选、promote、线上槽、METHODOLOGY/RULES-2P 的读面 | meta |
| `train` | 104 | 训练侧：`js/train/`、chooser、特征、env 旋钮、并发跑器 | ship + meta |
| `ui` | 7 | 页面与前端契约 | train + ship + meta |
| `probe` | 36 | 研究量具**自身**的牙（判据不许只在开发时跑过一次） | train + ship + meta |
| `engine` | 全部 | 引擎与规则语义（`js/core/`、`server/`、`tests/`、根 `index.html`、门禁自己） | 整轮，不分组 |

`node tools/np-test.mjs --list-groups` 是这张表的机器版本（数出来的，不是手抄的）。

## 二、班次 → 该跑什么

| 我这次改的是 | 跑这条 | 实测耗时 |
|---|---|---|
| 只动 `champion-map/`、`docs/` 里不被门读的那些、`results/` | `node tools/gate-all.mjs --np --group=meta` | **~36 秒** |
| 动了 `CHANGELOG.md` / `README.md` / `.gitignore` / 任何 `.bak` 落盘 | 同上（`meta` 就是为这个存在的：D8 / D82 / D205 / D194 都在里面） | ~36 秒 |
| 动了 `docs/METHODOLOGY.md` / `docs/RULES-2P.md` / `docs/RULES-NP.md` / `docs/artifacts/e129-out/matrix.json` | `--np --group=ship` | ~2 分钟 |
| 动了 `js/train/`、`tools/train-3p.mjs`、`tools/eval-5p.mjs`、`tools/style-exam.mjs`、env 旋钮 | `--np --group=train` | ~10 分钟 |
| 动了 `js/ui/`、页面契约、`tools/smoke.mjs` / `battle-test.mjs` | `--np --group=ui` | ~11 分钟 |
| 动了**量具本身**（`tools/probe-*`、`analyze-*`、`pool-frontier-lib`、被门当输入的 `docs/artifacts/e16*-*.mjs`） | `--np --group=probe` | ~10 分钟 |
| 动了 `js/core/`、`server/`、`tests/`、根 `index.html`、`tools/np-test.mjs` 自己 | **整轮**：`node tools/gate-all.mjs --np`（不带 `--group`） | ~20 分钟 |
| 说不清改了哪些面 | `node tools/gate-all.mjs --auto`（它自己判，**认不出来就升到整轮**） | 取决于判定 |

## 三、三条不许越过的线

1. **分组跑出来的不是认证。** `--group=` 与 `--only=` 同罪：总结论行会自己印「§E335 分组 xxx：**不是整轮认证**」。
   要引用"整轮全绿"，只有不带 `--group` 的整轮算（D194 钉这条，D205 钉门号）。
   ⚠ §E365 起这一句的措辞从"四道全绿"改成"整轮全绿"—— 把**道数**写进判词，加一道门就会让所有旧判词过期（那是第 89 条说的那类"钉数字的措辞"）。
2. **认证树必须等于提交树，范围限定在"被门读取的那些文件"。** 整轮跑起来之后再动 `tools/`、`js/`、
   `CHANGELOG.md`、`README.md`、`.gitignore`、`docs/METHODOLOGY.md`、`docs/RULES-2P.md`、
   `docs/artifacts/e129-out/matrix.json`、`train-3p-out.js`、`e161-ply.mjs`、`e168-style-human.mjs`、
   `e169-beadprice.mjs`、`tools/human-pool.mjs` ⇒ 那一轮立刻作废。
   ⚠ `.gitignore` 也在读取面上（**L5** 读它断言 `-out.js` 在册）—— 这条最容易漏，因为它看着像纯仓库配置。
3. **加门必须同时登记分组。** 不带 `--group` 的整轮会检查"每条门都在分组表里"，漏了就 `exit 4` 点名
   ⇒ 分组表不会悄悄漏腿（D205 管门号撞车，这条管归组）。

## 四、为什么没有把门物理拆成几个文件

拆文件要先把 ~1200 行共享前导（沙箱、`ok/eq`、`spawnSync` 包装、夹具）搬进一个 harness 模块，
而收尾那条"注册数 == 执行数 + 跳过数"的守卫（D194 钉它的源码形状）会连带改形 ——
**收益是零**（跑多少条由分组决定，与文件怎么切无关），风险却是本仓最怕的那一类：门绿着，但它没在看你要上线的东西。
⇒ 分组已经提供了"跑子集"的全部收益，物理拆分留作纯机械活。

## 五、整轮由谁兜底（§E355 · 10-06 用户裁定）

本机分组跑的**前提**是有人跑整轮。这一层从今天起交给 CI：

| 谁 | 跑什么 | 阻断吗 | 覆盖到哪 |
|---|---|---|---|
| **GitHub（每笔 push / PR）** | `node tools/gate-all.mjs --np --no-browser` | ✅ 阻断 | np **整轮**（不带 `--group`，全部门）+ spec |
| **GitHub 的 browser job** | `smoke.mjs` + `battle-test.mjs` + `champion-map/shot.mjs --check`（windows runner） | ⚠️ `continue-on-error` | 浏览器三道（§E365 起含演化页）；10-01 起是观察档（转阻断后 3 跑 2 红、根因未定，**转正判据 = 连续 5 次绿**） |
| **本机收工前** | `node tools/gate-all.mjs --np` | —— | 五道全绿 = **认证那一遍**（CI 覆盖不到浏览器那三道的判定，所以"认证"这句话仍然只能说本机那一遍） |

⇒ 于是"本班只跑了 meta 那 15 道"这件事不再等于"红可能潜伏到下一班"：**潜伏窗口从"下一次有人想起来跑整轮"缩短到"这一笔提交的 CI"**。
⇒ 起因就是今天的一条实测：D225⑩c 从 `c9c382b`（README 排版整理）起红了**五笔提交、约 11 小时**，
   期间每一班都只跑了 `--group=meta` 或 `--only=` 单道，而那道门在 `train` 组里 —— 见 `CHANGELOG.md` 的 v1.6.10 与 v1.6.11。

## 六、今天新增的这条门读哪些文件（改这些面要跑它）

**D230**（§E357，归 `meta` 组）扫"活引用面"：`README.md` + `tools/` `server/` `js/` `champion-map/` `tests/` `.github/` 里的
`.mjs / .js / .html / .cmd / .yml`，抽其中每一个 `docs/**.md` 指针并要求**盘上真有这个文件**。

- ⇒ **搬动 `docs/` 里的文件 = 动了 D230 的读取面** ⇒ 那一班至少跑 `--np --group=meta`（它就在 meta 里）。
- 不扫的：`CHANGELOG.md` 与 `docs/research/**`（那是账本，历史锚按 `docs/README.md` 第四节的对照表换读法，逐条改写等于篡改历史）‖
  `docs/artifacts/*`（产物面归 D82）‖ 模板写法（含 `*` `<>` `{}` 的那种"路径写法"不是路径）。
- 三条**已知豁免**（`js/core/resolve.js` ‖ `js/core/state.js` ‖ `js/train/policy.js` 注释里的旧顶层锚）：
  这三个文件在规则指纹五件套里，改一个字符就要换代指纹，代价远大于"注释里的锚多跳一次" ⇒ 豁免**只放那一条锚**，
  这三个文件里新出现的落空指针照样红（腿 ③c 就是钉这个，防止豁免退化成文件级免检）。

