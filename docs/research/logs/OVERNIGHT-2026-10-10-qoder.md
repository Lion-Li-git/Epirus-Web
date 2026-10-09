# 通宵班日志 2026-10-10（千问 · 实测起点 23:16:50 → 09:00）· 分支 `qoder/e566-gate-coverage-overnight`

> ⚠️ 本班第一处更正：这一行原本写"23:4x 起"、下面各节写"00:0x–00:5x"，**都是我估的**。
> 实测锚点：分支起点 `23:16:50`（git）‖ `tools/np-cache.mjs` mtime `23:29:05` ‖ `tools/np-test.mjs` `23:35:20`
> ‖ `docs/GATE-SHIFTS.md` `23:36:20` / `CHANGELOG.md` `23:36:40` / `docs/METHODOLOGY.md` `23:37:57` ‖ 整轮判词 `23:52:31`。
> ⇒ 下面一律改成实测区间。（这正是我今晚点给 DS 的 `5866ec8` 那条，我自己又犯了一次 —— 记在这里不抹掉。）

用户裁定：按 **A** 保留 `outputs` 能力并补上测试；剩下的按我的判断做；**开新分支**做到明早 9 点；DS 已退，不抢 CPU。

班规矩（沿用）：不 promote ‖ 不碰线上两颗冠军槽 ‖ 不改 `js/**`（读可以）‖ **只加腿不加门**（规矩 2 总数封顶）‖
每条新腿都要"装上绿 + 把病复原红"两向 ‖ 文本只走 Edit/Write ‖ 提交信息在落盘并 grep 到证据之后才写。

---

## DONE

### §E566-a（23:17–23:29 实测）`D157` 的 `outputs` 行为级三段式自证 —— 已落地并两向验过
**动的文件**：`tools/np-cache.mjs`（+12 行：`export function cacheDir()` + 头注「前置要求」的口径更新）‖
`tools/np-test.mjs`（D157 里 +34 行腿体；另把一条**钉 import 逐字顺序**的文本腿改成钉语义）。

**三条判据**（各自都能红）：① 真跑 ⇒ 产出落在声明路径里；② 命中 ⇒ 把**本次被删掉的**产出还原回来、且真跑次数不许变；
③ 盒子里少一项 ⇒ **不再算命中**（回退真跑）。观测点是 `counter.txt` —— 它**故意不声明进 outputs**，所以"有没有偷偷重跑"可数。

**两向实测**（都是 `--only="D157 "`）：
| 装的是哪一版 | 判词 |
|---|---|
| 现状（`cb20db1` 之后那个洞已补） | ✔ **通过 1 / 1**（冷跑与热跑各一遍）|
| **把那个洞原样装回**（`if (!existsSync(src)) return;`） | ✘ **通过 0 / 1** ‖ 判词直指 `③ 盒子里少一项必须不再…` |
装回病 ⇒ 红；改回来 ⇒ 绿；`git diff --stat tools/np-cache.mjs` = **12 insertions(+), 0 deletions** ⇒ 那一行没被我留歪 ✔

**顺带两处口径更正（写进 np-cache 头注）**：
1. 「只许缓存断言只用 stdout 的子进程」这句在 10-10 之后已经不成立 ⇒ 现在是**两种**安全做法（绕开 ‖ 声明覆盖全部产出），
   并明记"②的覆盖面**机制测试永远看不见**，只能逐门读代码"（反例 `D127`：命中那遍门红）。
2. `outputs` 传给原生 `spawnSync` 会被**静默忽略**（实测 status 照回、error undefined）⇒ 用②必须确认那句调的是 `spawnCached`。

**我自己被咬到的一次（记下来）**：那条 `ok(/import \{ spawnCached, inputHash, cacheStats \}/…)` 钉的是**逐字顺序**，
我往里加一个 `cacheDir` 就当场红 —— 与今晚被摘掉的两条"数名字出现次数"同族，只是这次咬的是我。已改成
"必须从 `./np-cache.mjs` 导入 spawnCached"（加名字算接上，删导入才算红）。
⚠️ 另一处我的手滑：第一次编辑 `cacheStats` 时把 `miss` 写成了别的表达式（语法过、语义歪），当场发现改回 —— 这正是 §E558 那条"语法过不等于对"。

### §E566-b 第一段复勘的结论（决定后面做谁）
| 处 | 现在谁都不读它的证据 | 可行性 | 处置 |
|---|---|---|---|
| `D68` server 认 `EPIRUS_TGT_W` | `grep -c EPIRUS_TGT_W` 在 np-test=2（默认关的 eq + worker 文本腿），其余仪器 0 | **现成载体**：`server/knob-guard.mjs` 的 `detectDarkKnobs` 会跟 import 链找真读键处（D143 就这么用）| ✅ 今晚补行为级腿 |
| `D12` 冠军对手走哪条推理路径 | `grep -c opp-champs` 只剩那条 §删 注释 = 1 ⇒ 整个文件 0 条腿读 | `opp-champs.mjs:47/58` 导出 `makeOppSelResolver/makeChampOppResolver` ⇒ 可跑 N 场与直接 `T.policyChooserN` 比逐场结果（照 D56 的 `eq(B,A)` 形状）| ✅ 今晚补（若门内 sb 可用）|
| `D56` `evo.js` 的 `LEGACY()` 认标记 | `legacyFrom` 只剩 2 处（pack/unpack 自身）；`isLegacyChooser` 只剩 policy.js 侧 | 待查：`evo.js` 的选择路径有没有测试可见入口（`T.*`）| ⏳ 查完再定，造不出能红的就不写 |
| `D13` `paralleltrain` 随消息下发切片 | `grep -c styleOppNames` = **0** | 要真行为只能跑 N 进程那条路（分钟级 ⇒ 等于新增门，撞规矩 2）| ❌ 记为**接受损失**，并写明该判据的正经去处 |
| `D58` 页面每局带盐 | `js/ui/ui.js:89` 是全 `js/` 里唯一给 `slotSalt` 赋值处；门里读到 `slotSalt` 的 25 处全是引擎/探针自己的夹具 | ui.js 是浏览器文件，node 侧 import 不动 ⇒ 正经去处是 `tools/smoke.mjs`（页内仪器），那是产品侧改动 | ❌ 记为**接受损失** + 提案（不今晚动 smoke）|

### §E566-b（23:2x–23:3x）三条行为级腿 + 两处判为接受损失 + 复勘把 `D127` 从损失名单里划掉
**复勘方法**：不按"同门还有没有别的腿"判，改按**全仓**判 —— `grep -c` 数"谁读这个文件/这个符号"。
`server/opp-champs.mjs` = 0 ‖ `styleOppNames` = 0 ‖ `isLegacyChooser` 只剩 policy.js 侧 3 行 ‖ `slotSalt` 的 25 处全是引擎/探针夹具 ‖ `EPIRUS_TGT_W` 只剩默认关的 eq + worker 文本腿。
⇒ **更正**：`D127` 不算丢覆盖（`audit-lib.mjs:536` 单源、两边都 import、定义点数值另有 D229 的 ⑧ 钉着）⇒ 我 22:5x 那句"D127 最容易：把两处的值读出来比"**撤回**（前提"有两处"就是错的）；DS 的"6 处"应是 **5 处**。

| 处置 | 判据形状 | 实测（正对照 = 这条腿有牙的证据） |
|---|---|---|
| ✅ `D68` 已补 | `detectDarkKnobs({EPIRUS_TGT_W:'0.07'},{entry:'server/train-server.mjs'})` 的 dark 不许含它 | server `dark=[]` ‖ 对照 `train-fast dark=[EPIRUS_TGT_W]` ⇒ 探测器会说"不认" ⇒ 不是空枪 ‖ `--only="D68 "` **1/1** |
| ✅ `D12` 已补 | 解析出的 chooser vs 直接 `policyChooserN(params,0.15)`，三场 `winner/回合/血量` 逐场相同 | temp 换 0.6 **确实不一样** ⇒ 等式有判别力 ‖ `--only="D12 "` **1/1** |
| ✅ `D56` 已补 | 走 evo 评分那条路（`LEGACY()` 在 `evo.js:146`），带 `lv` 标记与原生旧口径同分 | 摘掉标记 **确实变分** ‖ `--only="D56 "` **1/1** |
| ❌ `D13` 接受损失 | 唯一 sound 的替法要起真 worker；np 门里 `grep -c "new Worker"` = **0** ⇒ 进阻断档 = 引入 flaky 面 | 损失范围窄：同一消息对象里 `imitPlan/imitOnly/subBead` 仍被 D85-D87 钉着，丢的只是 `styleOppNames` 一个字段名 |
| ❌ `D58` 接受损失 | ui.js 是浏览器文件 ⇒ 正经去处是页内仪器（CI **观察档**），不顺手塞进 np | 产品侧确实无人守（`ui.js:89` 是唯一赋值点），已明记 |

### §E566-c 记账（23:36–23:37 实测）
`CHANGELOG` 新开 **v1.6.47**（更正 `D127` 那条写在最前）‖ README / index.html / CHANGELOG 三处版本对齐 v1.6.47 ‖
`GATE-SHIFTS` 新增 **§十五**（§十四 那三条欠账的处置 + 更正 + 我今晚被咬到的两次）并把 DS 那节 `### 十四` 的标题层级修成 `## 十四` ‖
13 处 §删 注释里已过时的"6 处真丢覆盖…"收成**指向 §十五 的一句指针**（细节不在门体里复制 13 遍）‖
`METHODOLOGY` 新增 **127**（摘腿先答"它本来能拦住什么" ‖ 丢了/已覆盖按全仓判 ‖ 补腿必带正对照 ‖ 造不出能红的变异就别写）。
`git diff --stat tools/np-cache.mjs` = **12 insertions / 0 deletions** ⇒ 那个洞所在的行没被我顺手改花 ✔

## DONE-追加 · 整轮判词（23:37 起跑 → 23:52:31 判词，单实例无抢核）

`门禁：np 277/277（883.5s） · spec 52/52（0.3s） · smoke OK（11.4s） · battle OK（33.6s） · map OK（2.8s）` ⇒ **结论行 `✔ 5 道全绿`，RC=0** ✔
（对照：DS 那遍 1356s、我上一遍撞车 1404s 都**不能**当基线；这一遍可以。）

## NEXT（按顺序）

1. 提交并推送**本分支**（`main` 动不动由用户裁 —— 他这次明确要开分支）。
2. `workflow_dispatch` 到本分支跑一次 ubuntu 阻断档：今晚两次红都是"Linux 那一支本机看不见"（我的 `isAbsolute` 病、DS 的门没这一类），值得花一次 runner 分钟。
3. 明早收尾汇报：先结论后记账 + 实测时间戳。
4. 若 03:00 后机器空闲再开训练侧欠账：先修 `ruler-measure --ids` 的静默漏人，再小批试 `exam=120`（全库约 75 min@jobs=4，**不并发**）。

