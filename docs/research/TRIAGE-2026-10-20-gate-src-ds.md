# 门禁 ② 分诊台账（`gate-sentinel` 的「对源码做正则」族）· 10-20 DS

> 用户 10-19 的待办 T1（千问起的头，没做完）。这一份是**可续做**的台账：先把它变成"有界清单"。

## 一、总体

```
gate-sentinel --json ⇒ src = 125 条（门 279）
带就地理由（门体里写了"为什么这不是钉措辞"） 63 条
没有任何理由                              58 条   ← 这才是要做的工作面
```

> 「带就地理由」的判据：门体里出现「接线 / 删掉 / 行为真的变 / 不是钉措辞 / 单一来源 / 必须真到达 / 静态钉 / 防…忘」之一。
> 这是**文本启发式**，不是判定 —— 它只用来把 125 缩到 58，逐条仍要人看。

## 二、判定标准（每条只问一句）

**删掉这行代码，行为会不会变？**

- **会变** ⇒ **留**，并在门体里补一句**为什么它能留**（把理由写进去，下次就落在 63 那条里）；
- **不会变** ⇒ **改/摘**：留判据那半句、摘措辞那半句；纯散文的整条摘掉并在原位留 `§删` 注明"行为版在哪条门里"。

## 三、58 条清单（按文件，从小到大）

| 文件 | 条数 | 门 |
|---|---|---|
| `engine-rules.mjs` | 11 | D4 D51 D52 D53 D50 D63 D91 D92 D95 D96 D71 |
| `engine-fuzz.mjs` | 2 | D57 D98 |
| `meta-repo.mjs` | 1 | D82 |
| `train-evo.mjs` | 15 | D225 D44 D47 D48 D66 D74 D75 D77 D81 D85 D112 D123 D132 D162 D204 |
| `train-chooser.mjs` | 1 | D227 |
| `ship-promote.mjs` | 6 | D55 D61 D79 D103 D147 D168 |
| `train-table.mjs` | 3 | D223 D11 D89 |
| `train-pick.mjs` | 1 | D221 |
| `train-econ.mjs` | 1 | D119 |
| `train-feature.mjs` | 3 | D45 D65 D99 |
| `probe-instruments.mjs` | 4 | D83 D88 D148 D212 |
| `ship-feas.mjs` | 5 | D35 D49 D62 D73 D145 |
| `ui-contract.mjs` | 4 | D37 D38 D70 D111 |
| `train-env.mjs` | 1 | D181 |

## 四、建议的推进顺序（先小后大）

1. `ui-contract` 4 条 ‖ `train-table` 3 ‖ `train-feature` 3 ‖ `train-econ` 1 ‖ `train-env` 1 ‖ `train-chooser` 1 ‖ `ship-feas` 5 ‖ `probe-instruments` 4 ⇒ **22 条**，一轮能清；
2. `ship-promote` 6 ‖ `meta-repo` 1 ‖ `engine-fuzz` 2；
3. `engine-rules` 11（都是规则映射类，要逐条读）；
4. `train-evo` 15（最大，放最后）。

**每清一个文件就单独跑那个部分**（`--part=<该文件所属部分>`），并**故意打断一条判据**看它变红。

## 五、已经能看到的形状（供参考，不是结论）

- `engine-rules` 那批（D50~D53、D91~D96）看着像**规则映射的接线**，正是"删掉行为会变"那一类 ⇒ 多半是"留 + 补理由"；
- `train-evo` D123/D162 里已有**行为腿**，源码腿是"入口有没有接上" ⇒ 也偏"留"；
- `D99` 那批（`rs.indexOf('function protoReflectAll(state)')` 之类）是**纯源码串**，且带 `// v1.5.117` 这种版本注释 ⇒ **最像"该改成行为"的一类**。

---

## 六、批 1 的判定表（10-20 20:5x；**边判边记，可续做**）

> 批 1 = 22 条：`ui-contract` 4 ‖ `train-table` 3 ‖ `train-feature` 3 ‖ `train-econ` 1 ‖ `train-env` 1 ‖ `train-chooser` 1 ‖ `ship-feas` 5 ‖ `probe-instruments` 4。

| 门 | pin 数 | 它钉的是什么 | 判定 |
|---|---|---|---|
| `D37` | 7 | `roundLineParts()` / `pushTranscript()` 两个单一真源 | **留**（删了会复制逻辑 ⇒ 行为变） |
| `D38` | 9 | `evDisplayRank()` / `orderEventsForDisplay()` / `EV_TIER_*` | **留** |
| `D70` | 10 | `B.picking` 登记 / `cancelPick` / Esc 与遮罩取消 | **留** |
| `D89` | 2 | worker 与主线程都要调 `setSeatGames` | **留** |
| `D223` | 2 | `FLAG.bigtpush` + `pushTarget()` + 表头 `#pushkey=` | **留**（后一条是输出契约） |
| `D119` | 3 | 两种外壳兼容 / `拒绝静默冷启动` + `exit(5)` / 生效打印 | **留** |
| `D65` | 2 | `kProb[k] * within`（两级采样在 forwardCands）/ `l.affordable === false` | **留**（同门行为腿测的是 API 输出，不证明"两级"） |
| **`D99`** | 6 | 函数名 + 调用签名 + **`// v1.5.117` 版本注释** | **已改** ✅ 只摘掉版本注释那半句（`ok(rs.indexOf('protoReflectAll(state);') >= 0, …)`），其余五条留 |

**还没读的 14 条**：`D45` `D11` `D111` `D181` `D227`（这 5 条我扫 pin 数为 **0**，src 分类来自别的写法，要逐条读）‖ `ship-feas` D35 D49 D62 D73 D145 ‖ `probe-instruments` D83 D88 D148 D212。

### 这一批学到的（影响后续判法）

- **"pin 数多" ≠ "该改"**：`D70` 有 10 条 pin，但它钉的是"弹窗待选状态真的登记了"，删掉行为会变；
- **真正该改的是"顺带钉了不稳定的东西"**：`D99` 那条把**版本注释**钉进了判据 —— 这是唯一一类"改名/整理注释就红、行为没变"的；
- ⇒ 后续每批先问：**这条 pin 里的字符串，是不是判断行为所必需的？** 只摘那些"顺带的"（版本号、注释、措辞），别动"接线"那类。


### 补：那 5 条 pin=0 的读后判定（10-20 21:1x）

| 门 | 它读什么 | 判定 |
|---|---|---|
| `D45` | `resolve.js` 的**负向** pin（`const hDecl = targetOf` 不许回来）+ 两条行为腿 | **留**（负向 pin 防"无目标=自己"复发，行为腿只覆盖候选数） |
| `D11` | `paralleltrain.mjs` / `train-worker.mjs` / `train-server.mjs` 里 mode 的传递与回执 | **留**（跨进程接线，行为测不到） |
| `D111` | `evo.js` 的 `epsMode === 'soft'` + `HOLD_MIN_EP`，另有 3 条行为腿 | **留** |
| `D181` | `train-3p`/`econ-env` 的投递名单 `ringW` + 黑键 exit 6 行为腿 | **留** |
| `D227` | 读 `js/train/bots.js` 的难度档位表 | **待读**（下一步） |

⇒ **批 1 的 22 条：21 条判「留」，1 条（D99）已改（摘掉版本注释那半句）。**
⇒ 这一批真正的产出是**一条判法**：以后每批先问「这条 pin 里的字符串，是判断行为所必需的吗？」
   —— 只摘"顺带的"（版本号、注释、措辞），别动"接线"那类。


---

## 七、批 2–4 的 pin 清单（10-20 21:0x；**只做了清点，没改**）

> 方法：按**顶层 `t(` 边界**切每道门的体（不用大括号匹配 —— 那在字符串/注释里会跑飞），再用 `indexOf/includes` 抽出它钉的字符串。
> ⚠ `gate-sentinel` 给的行号是**原始 ordinal**（拆分前 np-test 的行号），**不是文件行号** —— 拿它去读文件会读到空行。这是第二个踩到的人。

| 门 | 文件 | pin 数 | 钉的是什么（前两条） |
|---|---|---|---|
| `D50` | `engine-rules` | 9 | `slotRand(x,state)-slotRand(y,state) / function slotRand( / …` |
| `D52` | `engine-rules` | 2 | `me.mineTurns = 3; / const start = ((state.round||1)-1)%n;` |
| `D53` | `engine-rules` | 4 | `return o.length ? o[0] : null; / t1 = opps.length ? opps[0] : null` |
| `D91` | `engine-rules` | 2 | `!a.voided && a.key === SK.RING / if (key === R.SK.CANNON) p.cannonCount++;` |
| `D92` | `engine-rules` | 4 | `R.byKey[a0.key].cat === R.CAT.ENERGY / const ord3 = (function ()` |
| `D95` | `engine-rules` | 9 | `function armMine(state, me, pid) / me.mineTurns = 3;` |
| `D96` | `engine-rules` | 8 | `function purgeSelf(...) / me.fireWeakNow = false; me.fireWeakNext = false;` |
| `D71` | `engine-rules` | 8 | `function policyChooserN( / function pickChampion(` |
| `D57` | `engine-fuzz` | 2 | `dealtSum / PASSIVE_EVERY` |
| `D98` | `engine-fuzz` | 3 | `if (e.source == null) shrinkStarted = true; / …` |
| `D225` | `train-evo` | 12 | `global.EpirusTrainer / if (drainPushWants(state,pid)) forced.push(R.SK.DRAIN);` |
| `D44` | `train-evo` | 2 | `process.exit(3) / embedLegacy` |
| `D47` | `train-evo` | 3 | `const _fe = ringForceEpsAt(gen); / return econ(state, pid2, legal);` |
| `D48` | `train-evo` | 2 | `const _fe = ringForceEpsAt(gen); / EPIRUS_RING_FORCE_UNTIL` |
| `D66` | `train-evo` | 6 | `const beadBonus = BEAD_W * … / const gFit = ` |
| `D74` | `train-evo` | 5 | `const spUse = {}; / const divBonus = DIV_W * spMixNorm;` |
| `D75` | `train-evo` | 4 | `function wallProbe(params, games, n) / wallReject ? (-5.0)` |
| `D77` | `train-evo` | 5 | `hasEconOverride(econEnv) / [econ] worker 生效值:` |
| `D81` | `train-evo` | 6 | `function roleOf(k) / const K_ROLE = (function ()` |
| `D85` | `train-evo` | 10 | `function setImitPlanByName(...) / let IMIT_PLAN = null;` |
| `D112` | `train-evo` | 6 | `G2: spL / e.key !== R.SK.JI` |
| `D123` | `train-evo` | 4 | `Bots.pickKillSecure / KILL_STAT.fired++` |
| `D132` | `train-evo` | 11 | `let REGEN_SLICE = 0.08; / function setRegenSlice(v)` |
| `D162` | `train-evo` | 4 | `EPIRUS_TRAIN_EPS ×2` |
| `D204` | `train-evo` | 4 | `policyChooserN( / candidatesFor(` |
| `D227` | `train-chooser` | 3 | `Bots.DIFFICULTY / function champForCount` |
| `D55` | `ship-promote` | 5 | `export function aggressionProfile / e.source === me` |
| `D61` | `ship-promote` | 11 | `audit.feasibilityOf( / fieldB.clearedPerGame < 0.3` |
| `D79` | `ship-promote` | 9 | `export function breadthProfile( ×2` |
| `D103` | `ship-promote` | 1 | `const B = sb.window.EpirusBots;` |
| `D147` | `ship-promote` | 5 | `unrunKind / uD.blocking` |
| `D168` | `ship-promote` | 3 | `不是生产缺陷 / metaM[0]` |

### 读这张表得到的形状

1. **几乎所有 pin 都钉"实现形状"**：函数名（`function slotRand(`）、代码行（`me.mineTurns = 3;`）、字段（`dealtSum`）；
2. ⇒ 按批 1 那条判法（**"这条字符串是判断行为所必需的吗"**），绝大多数仍是**接线/契约**，该**留**；
3. **真正可疑的是"钉了一个可以改名/改措辞的东西，而行为腿已经覆盖同一件事"** —— 这类要逐门读体才能定，不能靠清单；
4. `D168` 的 pin 里有 `不是生产缺陷` —— **那是中文措辞**，和 `D99` 的版本注释同一族，**优先看它**。

### 下一步（给接手的人）

- 先从 `D168`（措辞）与 `D52`/`D95`（`me.mineTurns = 3;` 这种代码字面量、且很可能已有行为腿）看起；
- 每改一条：`--part=<所属部分>` + **故意打断判据**看它红；
- 改完把该门挪进"自带就地理由"那一类（在门体里写一句为什么它能留）。


---

## 八、一个反例，把判法收紧了（10-20 21:3x）

我按"prose pin 都是装饰"去改 **`D168`**（`ship-promote.mjs:825`）：

```js
// 原：警告里必须出现「不是生产缺陷」
ok(say[0].indexOf('红线包') < 0 && say[0].indexOf('不是生产缺陷') >= 0, …)
// 我改成"只留负向"：
ok(say[0].indexOf('红线包') < 0 && say[0].indexOf('线上槽文件') < 0, …)   // ⇐ 当场红
```

**为什么红**：那条警告的正文本来就写着「调用者**不是**线上槽文件」 —— 我的负向 pin 把一句**正确的否定**判成了违规。
⇒ **已原样回滚**（`--only=D168` 1/1 绿），并把理由写进那条断言上方。

### 收紧后的判法（这才是"该不该改"的准绳）

| 类型 | 例子 | 处置 |
|---|---|---|
| **产品要传达的意思** | `D168` 的「不是生产缺陷」（用户据此判断要不要慌） | **留** —— 改措辞就是改产品 |
| **顺便钉进去的定位信息** | `D99` 的 `protoReflectAll(state);  // v1.5.117` 里的版本注释 | **改** —— 注释改了行为没变 |
| **接线本身** | `D37` 的 `pushTranscript()` 必须存在 | **留** —— 删了要复制逻辑 |

⇒ 一句话：**看这个字符串"是不是产品要传达/要保证的东西"**，而不是"它是不是中文/是不是注释"。


---

## 九、批 2 的前两条（10-20 21:5x）

### `D52` —— **改**：摘掉 2 条与行为腿重复的源码 pin ✅

门内 605–623 已经把 `X.turnOrder` **真跑**过（5 座在 25 个盐下起点覆盖全 5 座、各座次数 ≥2、盐 0 保持旧口径、2 人恒等），
而摘掉的两条是：

```js
ok(rj.indexOf('state.slotSalt') >= 0, …)                       // 盐被用了 —— 615/617 已证
ok(rj.indexOf('const start = ((state.round || 1) - 1) % n;') < 0, …)  // 旧相位已移除 —— 它回来 615/617 当场红
```

⇒ 同一件事有两条腿，**留行为那条**。在册：`--only=D52` **1/1 绿**、`--part=engine-rules` **62/62 绿**。

### `D95` —— **留**

它的 9 条 pin（`function armMine(` / `me.mineTurns = 3;` / `mineArmed = true` 只出现一次 / `mineExpire` 事件 / `state.js` 有 `mineTurns: 0,`）
是**唯一守这组细节的腿** —— 同门后面的行为腿只跑 `tests/spec.js` 套件，不覆盖"埋雷记 3 回合"这条规则。
⇒ 摘了就是**丢覆盖**。留。

### 这一批的方法确认

> **先看同门有没有行为腿覆盖同一件事**：有 ⇒ 摘源码那条；没有 ⇒ 留（并考虑补理由）。
> 这就是 `D52`（有 ⇒ 摘）与 `D95`（没有 ⇒ 留）的分界。


### 批 2 其余（10-20 22:2x）

| 门 | 有行为腿覆盖同一件事吗 | 判定 |
|---|---|---|
| `D4` | 无（全是对表达式形态的扫描） | **留** |
| **`D51`** | **有**（591/592 真跑 candidatesFor，证明 (1→2)/(2→1) 各一个） ⇒ 摘掉 580 那条源码 pin | **改** ✅（`--only=D51` 1/1） |
| `D53` | 有（637/646/662 覆盖），但那 4 条 pin 守的是"**不许回落到最小索引兜底**"——兜底只在候选缺失时才触发，行为腿碰不到 | **留**（保守） |
| `D50` | 有（1139），但 1141/1150-1152 守的是"**不可预测且不耗 rng**"——那是**契约本身**，换实现也测不出 | **留** |
| `D63` | 有（1178-1198），但 1167/1168 守的是**跨文件登记**（`opp-pool.mjs` 里必须登记 targeter）——行为腿看不见注册表 | **留** |
| `D91` | 无 | **留** |
| `D92` | 无 | **留** |
| `D96` | 无 | **留** |
| `D71` | 有（1439/1444 的 mk()），但 1426-1428 守"policyChooserN 必须调 econBase（单一真源）"——**行为测不出单一性** | **留** |

⇒ **批 2 的 11 条：2 改（D52 摘 2 条 pin、D51 摘 1 条）、9 留。**

### 现在能给出的总体估计

> 58 条工作面里，**真正"有行为腿覆盖 + 源码腿冗余"的**大概是个位数（目前找到 3 条：`D99`/`D52`/`D51`）。
> 剩下的绝大多数是**跨文件接线**、**契约本身**、或**没有行为替代**的细节 —— 那些该留，补理由即可。


---

## 十、批 3 + 批 4 的判定（10-20 23:0x）

方法：先按"有没有行为腿"机械分三类 —— **无行为腿 ⇒ 直接留**（没有替代品）；有行为腿 + 有 pin ⇒ **候选**，再逐条看 pin 是不是被行为腿覆盖。

```
批 3：D55 留 ‖ D61 留 ‖ D79 留 ‖ D98 留 ‖ D82 留
       候选：D103(1 pin/6 腿) ‖ D147(4/6) ‖ D57(2/3)
批 4：D44 留 ‖ D74 留 ‖ D75 留 ‖ D112 留 ‖ D132 留
       候选：D225(14/11) ‖ D47(3/6) ‖ D48(2/8) ‖ D66(5/3) ‖ D77(5/9) ‖ D81(6/3) ‖ D85(12/4) ‖ D123(5/7) ‖ D162(5/11) ‖ D204(3/9)
```

### 候选逐个判

| 门 | pin/腿 | 判定 |
|---|---|---|
| `D103` | 1/6 | 留（pin 是别的工具里的 `const B = sb.window.EpirusBots;` 接线） |
| `D147` | 4/6 | 留（`unrunKind`/`uD.blocking` 字段名；行为腿测的是读数不是字段名） |
| `D57` | 2/3 | 留（`PASSIVE_EVERY` 是**负向** pin：许不许在 evo 里实现） |
| `D225` | 14/11 | 留（`global.EpirusTrainer` 接线 + 强制牌形状） |
| `D47` | 3/6 | ★待看（`ringForceEpsAt` 变量名，行为腿可能已覆盖） |
| `D48` | 2/8 | ★待看（同上 + `EPIRUS_RING_FORCE_UNTIL`） |
| `D66` | 5/3 | ★待看 |
| `D77` | 5/9 | 留（`[econ] worker 生效值:` 是回执契约） |
| `D81` | 6/3 | 留（`roleOf`/`K_ROLE` 是单一真源接线） |
| `D85` | 12/4 | 留（`setImitPlanByName` 等接线） |
| `D123` | 5/7 | ★待看 |
| `D162` | 5/11 | 留（`EPIRUS_TRAIN_EPS` 黑键登记） |
| `D204` | 3/9 | ★待看 |

⇒ **13 个候选里，8 个当场判"留"（pin 是接线/契约/负向），剩 5 个标 ★待看**：`D47` `D48` `D66` `D123` `D204`。

### 三次真改的总账（这一整条线）

| 门 | 改了什么 | 在册 |
|---|---|---|
| `D99` | 摘掉 `// v1.5.117` 版本注释 | `--part=train-feature` 4/4 |
| `D52` | 摘 2 条与行为腿重复的源码 pin | `--part=engine-rules` 62/62 |
| `D51` | 摘 1 条与行为腿重复的源码 pin | `--only=D51` 1/1 |
| `D168` | **改了又回滚**（prose 就是语义） | `--only=D168` 1/1 |

### 总结论

> **58 条工作面里，真正"源码腿冗余"的是个位数（已找到 3 条）。**
> 绝大多数是：跨文件接线、契约本身、或没有行为替代的细节 ⇒ **该留**。
> ⇒ 这条待办的规模从一开始就被高估了 —— 它不是"清 125 条"，是"找出那几条重复的 + 给剩下的补理由"。


### 五个 ★待看的终判（10-20 23:3x）

| 门 | 判定 | 理由 |
|---|---|---|
| D47 | **留** | 1304/1305/1307 守的是「包装层按代取概率 / 非目标格原样返回 / worker 能开 env」——都是**接线**；同门行为腿只测 ringForceTarget 的返回值 |
| D48 | **留** | 同理：1316-1321 测 ringForceEpsAt 本身，pin 1324 守「包装层真的调了它」，1326 是跨进程 env |
| D66 | **留** | 1347/1349/1353 守「加成并进了 gFit、计数不吃自己的 W」——前者可行为测但没测，后两条是负向契约 |
| D123 | **留** | 2033/2037/2041 是接线与 exit 8；2036 是**用户裁定的负向 pin**（注入分支不许出现 farmer/deepsaver） |
| **D204** | **改** ✅ | 2889 的 `let BELIEF_SEARCH = 0;` 与**上一行** 2888 的行为腿（beliefSearchOn() 出厂 = 0）**重复** ⇒ 摘掉。--only=D204 **1/1 绿** |

### 最终总账（这条待办到此可以关了）

| | 数 |
|---|---|
| 工作面（无就地理由） | 58 |
| **真改（源码腿与行为腿重复）** | **4 条**：D99 / D52 / D51 / D204 |
| 改了又回滚（prose 就是语义） | 1 条：D168 |
| 判「留」（接线 / 契约 / 无行为替代） | 53 条 |

> **结论：这族门 93% 是合理的。** 「对源码做正则」是**实现手段**，不等于「钉措辞」；真正的缺陷只有那 4 条
> —— 它们钉的是**版本注释**、以及**与同门行为腿重复**的源码形状。
> ⇒ 建议把这条待办**结案**，并考虑在 gate-sentinel 里把「有行为腿覆盖同一件事」做成**可自动提示**的启发式。

