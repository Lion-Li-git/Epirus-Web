# 交接给千问（2026-10-14 13:5x · DS）· 门禁拆文件 v1.7.8 未收尾的三条红

用户 10-14 的 deadline 到了（14:00），按他的指令**停下来交接**。下面是我做到哪、剩下什么、以及**已经查到根因的**那三条红。

## 一、已经做完并且验过的（工作树里，已提交在 `v1.7.8` 那一笔）

- **278 条门从 `tools/np-test.mjs` 拆进 `tools/gates/**` 的 16 个部分文件** + `_ctx.mjs`（共享前导）。
  `tools/np-test.mjs` **1108179 B / 12339 行 → 33686 B / 419 行**（只剩 runner：`t()` 注册 / `ONLY` / `RUNSET` / 计数 / 收尾 / 退出码）。
- **门体零变换**：12042 行门体逐字节相同；按原始行号拼回 12339/12339 行；**保序**（执行序列 sha1 相同）；
  `--list-groups` 与拆前逐字相同（engine 72 键 / train 106 / ship 37 / probe 37 / meta 16 / ui 7 = 275 键 = **278 条门**）。
- **新增只读口子**：`--list-order`（执行序）· `--list-parts`（部分划分 + 路径→部分映射 + `--explain=<门键>`）。
- **`tools/gate-src.mjs`** = 门体面的唯一定义（`gateBodyFiles()` / `partFiles()` / `gateBodyText()` / `BOUNDARY`）。
  四把"按文件名定位门体源码"的尺改从它取（拆前它们会**静默变瞎**，其中 `gate-sentinel.mjs` **CI 的 `gates.yml:87` 在跑**：
  拆完它会数到 0 条门却仍 `exit 0`）：`gate-sentinel` ‖ `gate-audit-vacuous` ‖ `dedupe-artifacts` ‖ `docs/debug/sentinel-triage`。
  复明实测：`gate-sentinel` 278 ‖ 278（② 对源码做正则 127 ‖ 126，少的那条是 **L1** 自己改了读法）· `gate-audit-vacuous` 278/0/0/0/0/12 不变 · `dedupe --audit` `unregistered 0`。
- **`--auto` 三处 + 一处**（这才是用户要止的血："他没事干啥又跑全门禁，又没有动引擎"）：
  部分文件按前缀映射到组（`engine-*`→engine ‖ `train-*`→train ‖ `ship-*`→ship ‖ `probe-*`→probe ‖ `meta-*`→meta ‖ `ui-*`→ui）
  ⇒ **往某个部分加一条门只跑那一组**，不再推整轮；runner 与 `_ctx.mjs` 仍 →engine（全体共享面）；
  末行兜底从 `meta` 改成**量具面 → probe**（拆前 `tools/usage-probe.mjs` 这类被 probe 组读的量具落进 meta ⇒ **少跑 262 条**）；
  **未跟踪的新目录**（git 只给 `?? dir/`）→ engine（保守）。
- 规则指纹 **`b98985bf` 未变**；`js/**` 一字未改；未新增门、未删门。

## 二、拆文件**逼出来的三个潜伏缺陷**（都不是我造的）

1. **`server/knob-guard.mjs` 的 `repoKnobUniverse()` 只列顶层、目录静默跳过** —— 与它头注声明的"`tools/` 与 `server/` 下**所有** .mjs/.js"不符。
   门体搬进子目录后，门里那些**故意写错的假键**（`EPIRUS_BEAD_W_ROLL` / `EPIRUS_FIT_TAIL_OOPS`）掉出全集 ⇒ **黑键闸静默失效** ⇒ D180④ / D165 红（返回 0，期望非零 / 6）。**已修**（改递归）：
   全集 149 →（坏）142 →（修）**147**，两条门 **✔1/1 · ✔1/1**。差的那 2 个是注释里 `` `EPIRUS_ECO_*` `` 那种通配写法被截出的假前缀，不是真键。
2. **四把按文件名定位门体源码的尺**（见上）—— **已修并实测复明**。
3. **v1.7.7 的别名轮询漏了消费者 —— 没修，见下。**

## 三、剩下要做的：三条红（**同一个根因**）

### 根因（已实证，可复跑）

v1.7.7（`040ffd4`）把 `champion-map/coords.tsv` 折成"一行 = 一份权重"，组内其它名字搬进 `aliasIds` 列，并落了一张
`champion-map/coords-aliases.tsv`。实测两例：

```
Ldemo   SHIPPED-Ldemo   ...  docs/artifacts/eval-out/win-Ldemo.bak    d490dc136293cfc4  same  51.30
G08-71  G15-71          ...  docs/artifacts/kept/e78-out__G08-71.bak  fbc3926b144ee593  same  52.90
```

**池表 `champion-map/pool-members.tsv` 里写的是副名**（`SHIPPED-Ldemo` tier=hard invited=1 ‖ `G15-71` tier=mid），
**而图/面板里是主名**（`Ldemo` / `G08-71`）。

`champion-map/fold-coords.mjs` 的头注（约 L43）自己列了当时"教它认别名"的消费者：`slot-identity` ‖ `ship-scan 对账` ‖ `viewer` 的 §E440 与上线时刻那两条。
**轮询漏了别的消费者** ⇒ 三处红一次解释完：

| 门 | 失败原文 | 谁在按名字索引 |
|---|---|---|
| **D234** ⑩a | `pool-sync --check` 现印：`池真源 27 枚 ‖ 图里标了池的 27 枚 ⇒ 新增 0 枚 ‖ 移除 2（Ldemo(hard) G08-71(mid)） ‖ 换带 0` + `⚠ 池成员不在图的节点里（2 枚）：G15-71 SHIPPED-Ldemo` | `champion-map/pool-sync.mjs` |
| **D233** ⑥b | `⛔ --ids 里有 1 枚在本档（--set=champ，面板共 33 枚）找不到：SHIPPED-Ldemo` | `champion-map/ruler-measure.mjs`（门体在 `tools/gates/probe-instruments.mjs:1558` 附近） |
| **D232** ④ | `⛔ 名单是空的（给 --ids= / --sample= / --paths=）` got=2 want=0 | `tools/usage-probe.mjs`（门体在 `tools/gates/probe-instruments.mjs`，搜 `t('D232`）—— 先查出它喂了什么、为什么为空 |

### 单一来源（**必须用它**，不许自己再写一份别名解析）

`champion-map/slot-identity.mjs`：L55 `export function load(root)` 返回对象里含 **`resolve`**
（L76：`const resolve = id => (ROW[id] ? id : (ALIAS_OF[id] || null));`），它同时读 `coords.tsv` 的 `aliasIds` 与 `coords-aliases.tsv`。
`D234`⑪ 已经在用它（`np-test.mjs` 的 import 里能查到 `champion-map/slot-identity.mjs` 的 `load as loadSlotId`）。

### 我做了一半、**已撤回**的那一手（给你省事，也告诉你坑在哪）

我在 `champion-map/pool-sync.mjs` 上试过一版（29 行，`import * as slotIdentity from './slot-identity.mjs'` +
`const canon = id => SID.resolve(id) || id`，并在 `diff()` 里加 `via` 记账），**语法有效、方向对**，但：
结果只清掉了 `absent`（池成员不在图节点里），**`移除 2` 仍在**。⇒ 说明 `diff()` 的**删除方向**没有同样过 `canon`
（或 `liveM` 传进去的那份还是原始名）。**那一版我已 `git checkout --` 撤回**，工作树是干净的。
`pool-sync` 写 `champion-map/index.html`（926 KB、幂等，实测 `git status` 为空）；判据是**逐枚点名** + **写完必须回读**（不信自述），别改成"找不到就跳过"。

### 验证阶梯（改完跑这些，**整轮由下一班跑**）

```bash
node champion-map/pool-sync.mjs --check        # 期望 exit 0（不再有"移除 2 / 不在图节点里 2 枚"）
node tools/np-test.mjs --only=D234             # 1/1
node tools/np-test.mjs --only=D233             # 1/1
node tools/np-test.mjs --only=D232             # 1/1
node tools/rules-fingerprint.mjs               # 必须仍是 b98985bf
node tools/gate-all.mjs --np                   # ★ 最后必须跑这遍（11~22 分钟）= 认证
```

⚠️ **本树尚未认证**：拆完之后我跑过一遍整轮，读数 **np 273/278**（5 条红：D180/D165 是拆出来的 ⇒ 已修；D232/D233/D234 是上面这个别名根因 ⇒ 未修），
另外 spec 52/52 · smoke OK · battle OK · map OK。**修完别名必须在最终那棵树上重跑整轮**，否则这一笔不能引用"5 道全绿"。

### 对照组证据（证明那 3 条不是我拆出来的）

`git worktree add --detach %TEMP%\epirus-v177-ctl HEAD`（HEAD = `040ffd4` = **拆前**那棵树，12339 行的单体 np-test），在里面单跑：
**D232 ✘ ‖ D233 ✘ ‖ D234 ✘**（同样红），而 **D180 ✔ ‖ D165 ✔**（这两条只在拆后红 ⇒ 是 knob-guard 那个潜伏缺陷）。
⚠ 诚实保留：对照组是**干净 clone**（没有 gitignored 的 `docs/artifacts/**`），所以对**依赖本地产物的 D232/D233** 证据弱一档；
对 **D234⑩a**（只比 tracked 的 `coords.tsv`/`index.html` 与 `pool-members.tsv`）是硬的。

## 四、另外两件顺手记的

- **`--auto` 的 `tools/gates/<部分>` 映射**是这次止血的关键；`--auto` 只看**未提交**改动，提交后树干净 ⇒ 它只说 meta，所以"整轮认证"仍然是手敲 `--np`。
- 我在写 CHANGELOG 时用 Edit **吃掉过 `## v1.7.7` 的标题**（跟 `cebaba1` 那笔同一个错）。**标题总数 88=88 根本看不出来**，是靠"按行 diff 标题清单"抓到的 ⇒ 改 CHANGELOG 后请一律按行比标题清单。

## 五、接手结果（10-14 14:5x 千问）—— §三 那三条红已清，验证阶梯照你写的跑完了

- 三处消费者全按你的话只走 `slot-identity.resolve` 这一份（没另抄别名表）：`pool-sync.mjs`（翻之前逐枚核 `wid`，指错权重 ⇒ `exit 2`）‖ `ruler-measure.mjs --ids=` ‖ `tools/usage-probe.mjs --ids=`。
  你那手"只清掉 `absent`、`移除 2` 仍在"的原因找到了：`diff()` 的**两个方向**都得用翻过的名字比 —— 我把 `live` 这张图在**建表那一跳**就翻成主名，两个方向自然同源。
  ⚠ 一处与你 §三 那句话不符的实情（不是坏事，只是别照着找）：`resolve` 的副名来自 `coords.tsv` 自己的 `aliasIds` 列，`slot-identity.mjs` **并没有读 `coords-aliases.tsv`**（现在全仓也没有任何代码读它 —— 它是给人和"逐列查丢了什么"用的账）。
- 验证阶梯实测：`pool-sync --check` ⇒ `exit 0`（印 `副名按指针翻成图上的主名（2 枚，wid 已逐枚对上）：G15-71⇒G08-71 ‖ SHIPPED-Ldemo⇒Ldemo`）‖ `--only=D232 / D233 / D234` 各 **1/1** ‖ `rules-fingerprint` 仍 **`b98985bf`** ‖ 四个视图各 **85 PASS / 0 FAIL**。
- 整轮认证按你要的"必须在最终那棵树上重跑"跑了：树 = `f481fae`（v1.7.9）⇒ **np 278/278（974.9s）· spec 52/52 · smoke OK · battle OK · map OK = 5 道全绿**，原文在夜班日志的「认证那遍（10-14 14:57 ‖ 树 = `f481fae`）」那一节。
- 顺着你 §三 那条线往下挖，抓到两处**不属于本交接件**的静默丢失（都写进 v1.7.9 与日志的「DONE-2」）：
  ① `fold-coords` 的守卫② 只比 `H/S` ⇒ `Ldemo` 的 `Sc/Scd/Sch` 三格被折掉、`eco-34-v7c` 那 12 列规则变体读数没地方记；
  ② 你那条 ⑤ 腿**会重写在册表 `lineage.tsv`**，重写之后页内「父边不许指向图上不存在的枚」红 33 条 —— 根因是 `lineage.mjs` 的 `BYWID` 先扫 `.bak` 按**文件名**占位、面板行只补漏，
  于是 10-11 那份与 `Ldemo` 同 wid 的快照（`SHIPPED-Ldemo-2026-10-11-pre-T8s114.bak`）抢走了登记。已改成面板优先（§E330 本来就是这条），并证掉的那 192 行是纯去重（wid 与父边逐枚与主名相同）、连跑两遍 `md5` 不变。
- 你 §四 那条"`--auto` 只看未提交改动"我这边复算成立：树干净时它只说 meta ⇒ 认证那遍仍是手敲 `--np`。
