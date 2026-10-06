# 复核：击杀奖励线「训练结果没有变化」的根因 + 当前实现盘点（2026-09-24 · DS）

> 自包含。**只读诊断**：本轮没有改动任何代码、没有 promote、两槽线上包与 `results/*` 一字未动。
> 起点状态：分支 `qoder-killreward-0924` · HEAD `2581961`（v1.5.199）· 领先 `origin/main` **11 个提交** · 工作区干净。
> 结束状态：同上（新落盘仅本文档 + `docs/artifacts/battle-out/` 的 4 张对战截图，均在 `.gitignore` 覆盖范围内）。

---

## 0. 一句话结论

`EPIRUS_KILL_REWARD` **全仓只有一个读取点**（`tools/train-3p.mjs`）。
如果训练是从**任何其它入口**发起的 —— `tools/train-best.mjs`（README 的 2P 推荐）、`tools/train-fast.mjs`、
或页面「训练场」背后的 Node 训练服务 `server/train-server.mjs` —— 这个键会被**静默忽略**，产物与不带它的那次
**逐字节相同**。我用三组实跑把这条钉死了（§2）。

而即便走的是**接对了**的那条路，读数"没有变化"也是**已被 CHANGELOG 结案的预期结果**（§3）：
这条规则在它本来要治的龟缩场里**一次都发不出去**（实测 0.00 次/局），回到现状规则世界里它的增量也被证明
来自"训练桌上有一只龟"，不是来自奖励本身。

---

## 1. 接线面审计（静态 · 可复跑）

```bash
grep -rn "EPIRUS_KILL_REWARD" --include=*.mjs --include=*.js . | grep -v node_modules
# → 只有 tools/train-3p.mjs:65 / :164 / :166（外加 kill-reward-lib.mjs 的注释）
```

| 训练入口 | 读 `EPIRUS_KILL_REWARD`? | 传了不认时会不会响 |
|---|---|---|
| `tools/train-3p.mjs`（N 人 CLI） | **会**（`:164`，非法档 `exit 7`） | **会**（黑键侦测 `exit 6`，`SELF_ENV_KEYS` 在 `:60-70`） |
| `tools/np-test.mjs` | 不读（只跑探针门） | 会（`EPIRUS_ALLOW_DARK`） |
| `tools/train-best.mjs`（2P CLI，README 推荐） | **不会** | **不会**（静默） |
| `tools/train-fast.mjs`（2P 快速训练） | **不会** | **不会**（静默） |
| `server/train-server.mjs` + `train-worker.mjs`（页面训练场） | **不会** | **不会**（静默） |

两个补充事实：

1. **紧邻的上一个同类旋钮是接了的**：`EPIRUS_KILL_FIELD`（v1.5.160）走
   `server/train-env.mjs` → `server/train-worker.mjs`，**server 侧也认**。`EPIRUS_KILL_REWARD`（v1.5.194）
   只做了 CLI 那一条路 ⇒ 这不是"设计如此"，是**接线没铺完**。
2. `server/train-server.mjs:52` 与 `server/train-worker.mjs:46` 的引擎装载循环是
   `for (const f of [...]) vm.runInNewContext(readFileSync(f))` —— **原样装载，没有 `patchResolve/patchPlay`**。
   所以 server 路径连"打上补丁但没人钩"的中间态都不存在，它跑的就是现役引擎。

**规模感**：全仓有 **101 个不同的 `EPIRUS_*` 旋钮名**，其中 45 个至少被一个训练入口提到；
而"传了没人读就响亮拒绝"这道闸**只有 `train-3p.mjs` 和 `np-test.mjs` 有**。这是本仓栽过至少 8 次的同一族病
（`FEAS_N` / `ECON_ENV_KEYS` / `pierceKeys` / `HOLO_GIFT_MAX` / 承诺局 `% 3` / `countBigCards` /
`EPIRUS_PASSIVE_FIELD` / `EPIRUS_DIV_*`），本次是**第 9 例**。

---

## 2. 三组实跑：接对的路会变，没接的路逐字节相同

### 2.1 接对了 —— `tools/train-3p.mjs`（同种子单变量）

```bash
EPIRUS_SEED=31 EPIRUS_ARM=krab0 EPIRUS_KILL_REWARD=0 node tools/train-3p.mjs 40 3 8 8
EPIRUS_SEED=31 EPIRUS_ARM=krab1 EPIRUS_KILL_REWARD=1 node tools/train-3p.mjs 40 3 8 8   # 同种子
```

| 读数 | KR=0 | KR=1 |
|---|---|---|
| 产物 pack sha1(前12) | `7824a5bf1099` | `db30e8d1ac36` |
| `a[]` 权重 sha1(前12) | `42fa1202f8d1` | `1e86bf8fd78e` |
| **逐参数不同的条目** | — | **5689 / 5689** |
| `meta.recipe.killReward` / `killRewardProbe` | `0` / `-1` | `1` / `1` |
| 3 人实测 1st / top2 | 47.4% / 82.8% | 38.8% / 86.9% |
| 启动横幅 | — | `**击杀奖励规则已下达**：mode=1 … 行为式读回 __krPaid=1` |

⇒ **CLI 这条路是好的**：补丁真打上、钩子真跑过、产物真带配方、同种子下世界确实变了。
（行为式读回 + `meta.recipe` 这两道纪律是 v1.5.194 做对的，值得保留。）

### 2.2 没接的路 A —— `tools/train-best.mjs`（2P，README 推荐入口）

```bash
EPIRUS_SEED=7 EPIRUS_ARM=krb EPIRUS_TB_OUT=docs/artifacts/krb0-out.js EPIRUS_KILL_REWARD=0 node tools/train-best.mjs 2 25
EPIRUS_SEED=7 EPIRUS_ARM=krb EPIRUS_TB_OUT=docs/artifacts/krb1-out.js EPIRUS_KILL_REWARD=1 node tools/train-best.mjs 2 25
```

* 两次 `exit 0`，日志里**一次都没提到**这个键（`grep -c "KILL_REWARD\|killReward\|击杀" = 0`）。
* pack sha1 **`c67521d82ff32d2a` / `c67521d82ff32d2a` ⇒ 相同**；`a[]` 也相同。
* 两个产物文件**去掉 `ts` 时间戳后逐字节相同**。

### 2.3 没接的路 B —— 页面「训练场」的 Node 服务

```bash
EPIRUS_KILL_REWARD=0 EPIRUS_BUNDLE_OUT=docs/artifacts/srv0.js node server/train-server.mjs 8795 &
curl -sN "http://127.0.0.1:8795/train?gens=6&pop=8&gpo=4&n=3&fresh=1&seed=7"
# 换 KR=1 与端口 8796、输出 srv1.js 重跑一遍
```

* 两次都 `done=1`、都跑完 6 代、产物都是 115994 字节、**零 error**。
* pack sha1 **`ad5baadcd32aaec8` / `ad5baadcd32aaec8` ⇒ 相同**。
* 服务的启动自报把**它认的每个旋钮**都印了出来（`[imit]` / `[ringforce]` / `[fight]` / `[eco]`）——
  **"击杀奖励"不在其中**。

---

## 3. 就算走对了路，"没有变化"也是 CHANGELOG 里已结案的预期

CHANGELOG 里这条线是 **v1.5.193 → v1.5.198**，结论方向一致，且能当场复现：

### 3.1 规则本身在目标场景里**结构上发不出去**（v1.5.193 ①，本轮复跑 60 局）

```bash
node tools/probe-kill-reward.mjs --packs=js/bundled-champion-3p.js --fields=guardwall,pool --rules=0,1,2 --games=60
```

| 场 | 规则 | 受评席 1st | 击杀/局 | **奖励发放/局** | 归因伤害/局 | 终场存活 |
|---|---|---|---|---|---|---|
| **guardwall**（4 席只防御不还手） | 0 / 1 / 2 | 0.0% / 0.0% / 0.0% | 5.00 | **0.00 / 0.00 / 0.00** | 0.00 | 0% |
| pool（脚本池） | 0 / 1 / 2 | 8.3% / 13.3% / 10.0% | ~4.0 | 0.00 / **0.98** / **0.90** | ~2.1 | 8~13% |

Δ vs 现状：guardwall **+0.0pt**（三档逐位相同）· pool 规则1 **+5.0pt ± 7.3（噪声内）**、规则2 +1.7pt ± 5.7。

⇒ 龟缩场里每局有 5 次死亡，但**一次"有来源"的伤害都没有**（全是终局收缩 `source:null` 清场）
⇒ 任何"按击杀归因"的奖励都碰不到它。**"没有变化"在这一格里不是"没效果"，是"根本没触发"。**

### 3.2 规则之外，"上桌"才是真因（v1.5.194 ② / v1.5.195 §② / §K-3）

* 回到现状规则世界，学过规则的包**不比对照臂强**（§K-2 表：对照 `kr0s2` 头对头 36.7%，比所有规则臂都猛）。
* §K-3 自己的更正：把"会破防"训出来的是**训练桌上放了一只龟**（`EPIRUS_COUNTER_OPPS=1`，7/9 能破防），
  **不是击杀奖励**（规则1 5/6）。
* **加了规则不再有增量**：`cr1`（上桌+规则1）5/9 < `co1`（只上桌）7/9，头对头中位 24.6% < 32.1%。
  ⇒ §K-3 原话："两条击杀规则这条线到此可以结案"。
* v1.5.197 §④ 又给这条线降了一次温：**"1 席 vs 4 只龟"那面墙在产品里搭不出来**（现役包设防率恒 0%），
  所以这条线交付的是**鲁棒性 + 一把新量具**，不是"治好了产品里的龟缩"。

**⇒ 所以"结果没有变化"有三种可能，请按下面一行自查是哪种：**

| 情形 | 判据 | 是不是病 |
|---|---|---|
| 走了 `train-best` / `train-fast` / 页面训练服务 | 产物里**根本没有** `meta.recipe` 这个字段 | **是**（静默空转，§2.2/2.3） |
| 走了 `train-3p`，但产物 `meta.recipe.killReward = 0` | 字段在、值是 0 | **是**（键没传进那次进程） |
| 走了 `train-3p`，`meta.recipe.killReward` 非 0 | 字段在、值 = 1 或 2 | **不是**，是 §3.1/§3.2 的预期结果 |

一条命令就能查（**已实测可用**；用它读**任何** `.bak` / `.js` 产物）：

```bash
node -e 'const fs=require("fs"),vm=require("vm");const sb={console};sb.window=sb;vm.runInNewContext(fs.readFileSync(process.argv[1],"utf8"),sb);const m=sb.EPIRUS_CHAMPION_3P_META||sb.EPIRUS_CHAMPION_META;console.log((m&&m.recipe)||"(无 recipe 字段)")' <你的产物>
```

> ⚠️ **不要用 `JSON.parse` 读这些包**（包括本仓自己的 `server/train-server.mjs:815`）—— 见 §6-P2-12：
> 包里的 meta 是**对象字面量**而不是严格 JSON，`JSON.parse` 必然抛。

---

## 4. 当前实现盘点（实测，不是读文档）

### 4.1 规则引擎 —— 小而干净

| 文件 | 行 | 职责 |
|---|---|---|
| `js/core/rules.js` | 188 | 卡表 / 分类 / 三种模式（`standard` / `multi` / `long`），`byKey` 30 张 |
| `js/core/state.js` | 242 | 状态结构 / `computeCost` / `attemptAction`（无贷款） |
| `js/core/resolve.js` | 1412 | 结算引擎（优先级管线 / 防御矩阵 / 地雷 / 转移 / 隐藏技能） |
| `js/core/play.js` | 120 | 对局驱动 `autoGame` / `autoGameN` / `legalActions` |

**零依赖、零构建、无 `package.json`、无 CI** —— `index.html` 双击即玩。引擎合计约 **1962 行**。

### 4.2 训练与度量 —— 与引擎 15:1 的体量比

`js/train/evo.js` 2715 · `js/train/bots.js` 973 · `js/train/policy.js` 819 · `server/*` 1730 ·
**`tools/*` 19411 行**（其中 `tools/np-test.mjs` 一个文件 5868 行）。
编号门 **D1 – D142**。

### 4.3 门禁现状（本轮实跑）

| 门 | 读数 |
|---|---|
| `node tools/spec-run.mjs` | **52 / 52** |
| `node tools/np-test.mjs` | **188 / 188** ✔（见下方注） |
| `node tools/rules-fingerprint.mjs` | **`ebdbff36`**（未换代 ⇒ 引擎本轮确实没被碰） |
| `git status --porcelain` | 空（干净） |

> 注：我第一次跑 np-test 时是 **187/188**，红的是 **D82**（24h 内落盘的 `.bak` 必须在 CHANGELOG 点名）——
> 点名的是**我自己那 14 个实验残留**（`krab0/krab1/krb-band*.bak`）。删掉残留后复跑 **188/188**。
> 这条**不是缺陷，是门在正常工作**，记录在此以免被误读成"HEAD 是红的"。

### 4.4 两槽线上包（未动）

* **2P 槽** `js/bundled-champion.js`：`examScoreAtBuild 0.99` · 最差基准 **82.5%** · 20 个基准全过 ·
  指纹 `ebdbff36` · `shippedAs: 2P 默认冠军`。
* **多人槽** `js/bundled-champion-3p.js`：`shippedAs: v7cmin4-31` · A 考卷 **54.4%** ·
  `feasibility.ok: true` · `G = 4.44` · 反弹墙主动伤害 21/局 · 指纹 `ebdbff36`。

---

## 5. 对战实测（真浏览器 + 引擎内评测）

### 5.1 真 Chrome 3 人对局（`tools/battle-test.mjs`，页面 v1.5.199）

```
SUMMARY: BATTLE OK      JS errors: (none)
13 回合：P3 获胜（HP 2），P2 第 10 回合阵亡、P1 第 13 回合阵亡
截图 → docs/artifacts/battle-out/battle-0{1..4}-*.png
```

**肉眼复核**（`battle-03-end.png`）：标题栏「拍手游戏 Epirus · v1.5.199」、结算浮层「玩家3 获胜 ·
共进行 13 回合 · 玩家1 HP 0 · 玩家2 HP 0 · 玩家3 HP 2」、技能按钮按资源置灰、`查看本局复盘 / 再来一局`
可点 —— **与日志逐项吻合，UI 侧没问题**。

**日志里读出的行为特征**（这一局）：第 1/3/5/9 回合是**全桌ジ**（纯蓄钱、零交互），第 2/4 回合是
**枪-枪-枪互相相抵**（三份攻击全废）。13 局里有 4 个"空转回合"，是"打法窄 + 爱蓄钱"的直观体现。

### 5.2 引擎内评测

| 评测 | 读数 |
|---|---|
| `tools/eval-3p.mjs 10 3`（3 人，36 对 × 10 局，座位轮换） | **1st 48.6% / top2 86.4%**（随机基线 33.3 / 66.7）· 各座位 48 / 44 / 55% |
| 同上出招分布（5740 次） | ジ **59.1%** · 枪 **22.2%** · 蓄能 8.8% · 狙击枪 8.3% · 电磁炮 1.3% · 激光剑 0.3% · 聚能环 0.0% · 全息屏障 0.0% · 双枪/镜面 **0.00%** |
| `tools/eval-3p.mjs 10 2`（同一只包打 2 人局） | 1st 54.2% · ジ **52.3%** + 枪 **46.0%** = **98.3%** |
| `probe-kill-reward --fields=mirror`（5 席同包 = **产品里 AI 互打的真实装配**） | 受评席 1st **17.5%**（5 席均分 20%）· 平局 **18%** · 局长 30.3 ⇒ **镜像没有退化**（这是好消息，v1.5.197 里"镜像必平"的那批候选死因在这只包上不成立） |

**⇒ 现役包"强但窄"**：三张卡（ジ/枪/狙）≈ 90%，2 人局更是 98% 只靠两张卡；
`聚能环 / 全息屏障 / 双枪射手 / 镜面反射` 四张卡**完全为 0**。这与 README「已知限制」的方向一致。

---

## 6. 问题清单（按严重度）

### P0 —— 会静默浪费整臂的（本轮新发现）

1. **旋钮接线不覆盖入口**（§1/§2）：101 个旋钮，只有 2 个入口会"响亮拒绝"。
   `EPIRUS_KILL_REWARD` 是第 9 例；`train-best` / `train-fast` / 页面训练服务对**任何**非自己闭集的键都是静默忽略。
   *最小修法*：把 `train-3p.mjs:60-110` 那段"黑键侦测 + `exit 6`"抽成 `tools/knob-guard.mjs` 单一来源，
   `train-best` / `train-fast` 载入即挂；server 侧在 `train-env.mjs` 加同形判定。

2. **`EPIRUS_WALL_MS=0` 的语义与注释相反**（本轮实测踩到）：
   `server/train-server.mjs:249` 与 `:478` 是 `const cap = Number(env == null ? 1800000 : Number(env))`，
   而 `:291` 与 `:562` 的判定是 `if (Date.now() - t0 > cap)` —— **没有 `cap > 0` 这一半**。
   于是注释里写的「`EPIRUS_WALL_MS=0` **关闭**（纯按代数收敛）」（`:247` / `:476`）实际行为是
   **第一次检查就超时、训练立刻中止**（返回 `训练超时上限（30 分钟）`）。
   我这次就是用它把两轮 server 实验跑成了空炮，直到读代码才发现。
   *最小修法*：两处判定改成 `if (cap > 0 && Date.now() - t0 > cap)`，并补一条门（"0 必须等于关闭"）。

### P1 —— 判据层面的已知缺口（CHANGELOG 自己记着，没人裁定）

3. **G4/G5 默认 `n=60` 而阈值是 25%/60%** ⇒ SE 与阈值同量级，"PASS/FAIL 在临界包上是掷硬币"
   （v1.5.196 ④ 的实测：同一粒 `co1s8-band1` 在 n=60 判 28% FAIL、n=300 复测 22% PASS）。**至今未改**。
4. **镜像格不在任何门里**，而镜像就是产品装配（AI 全用同一包）⇒ v1.5.197 里 6 粒候选死在这一栏，
   G4/G5 一格都没看见。
5. **"当选面"缺一整项**：`min-over-counters`（通吃最弱格）与"对面不打你时你会不会收尾"（破龟群幅值）
   都是"目标函数里没有这一栏"，而 §K-10 已经证明**筛池子筛不出来**。v1.5.196 ④ 建议把它做成
   **训练内第二排序键**（与 `EPIRUS_SEL_LAND` 同形）—— 属判据改动，**等用户裁定**。
6. **产品级 AI 的"恒亏动作"档案还没关**：空净化（v1.5.199 刚补上菜单闸门）、
   空蓄能/珠经济（v1.5.199 §② 明确"不动，等裁定"）、疯狂防御（判据把"威胁"定义成 `对手 ep≥5`，
   与"对面一直有钱我就一直防"这个真实场景**正交**）。
7. **对开环人类零反应**：README「已知限制」自陈 —— 对手连开 9 回合聚能环，AI 四个座位一次都没惩罚，
   根因是**训练池里默认没有环流对手**（`ringspam` 只是 `?opps=` 旋钮）。

### P2 —— 卫生/账目

8. **`tools/battle-test.mjs` 的截图点名不副实**：本轮 `battle-02-mid.png` 与 `battle-03-end.png`
   **sha256 完全相同**（`b4359c7d…`）—— 所谓"中局截图"其实是在终局浮层出现之后拍的。
   断言（`P0 能持续出招 17 回合`）是对的，但它**没有留下中局的视觉证据**。
9. **README「已知限制」数字已漂**：写的是"ジ 59% / 枪 20% / 狙击枪 13%（三张卡≈92%）、**电磁炮与激光眼 0%**、
   自对局有效技能数 **G=3.03**"；本轮实测多人包 3 人局 `电磁炮 1.3%`、`激光剑 0.3%`，
   而包内 `G=4.44`（出手）/ `2.66`（净兑现，3 种）。口径与数值都需要重新对齐（或写明是哪只包、哪种口径）。
10. **`docs/artifacts/` 里 84 个文件进了仓库、工作区 307MB**；D82 要求 24h 内新落盘的 `.bak` 必须点名，
    也就是说**任何一次实验跑都会让门变红直到记账**（本身是好设计，但门槛高，容易被当成"门坏了"）。
11. **整个仓库没有 CI / 没有 `package.json`**：142 条门全靠人手跑。本轮正好演示了后果的另一面 ——
    门是活的、抓得住残留，但**没人跑的时候它就不存在**。
12. **线上包的 meta 不是严格 JSON ⇒ 页面拿不到多人冠军的元信息**（本轮实测）：
    两个内置包的 meta 行里都有**一个没加引号的键** `fingerprintRefresh:`（`,\s*[A-Za-z_][A-Za-z0-9_]*:` 全仓只此一处），
    于是
    * `JSON.parse(meta)` 必然抛：`js/bundled-champion-3p.js` → `Expected double-quoted property name … position 311`；
      `js/bundled-champion.js` → `… position 453`；
    * `server/train-server.mjs:815` 是 `try { … JSON.parse(m[1]) } catch (e) { return null; }` ⇒ **静默拿到 null**。
    实测 `GET /champion?n=3` 返回 **`{has:true, n:3, gen:null, meta:null}`**（`n=2` 那条路不解析 meta，正常）。
    *影响*：多人模式下页面「当前冠军」的代次/元信息一直是空的（不是崩，是**静默变空**）。
    *最小修法*：写侧统一 `JSON.stringify`（或把那一个键补上引号），读侧换成 §3 那条 JS-eval 读法；
    并对"读失败"与"没有 meta"给出不同状态（本仓 L2 那条"把读不出当成没有"的老毛病）。

---

## 7. 建议（都属"需要你点头"的范畴，我一条都没做）

1. **先回答"那次是怎么跑的"**（§3 的表）：翻一下产物有没有 `meta.recipe.killReward`。
   如果是 0 或没有这个字段 ⇒ 那次实验**根本没进击杀奖励世界**，重跑才有意义。
2. **决定击杀奖励线的归宿**：v1.5.195/§K-3 已经结案（作为上线规则结构失效、作为课程也被"上桌"替代）。
   要么在 CHANGELOG 里明文标注"这条线已结案、键仅 `train-3p` 可用"，
   要么把 `kill-reward-lib.mjs` 的接线铺到 `train-best` + server（否则它会继续以"能调"的样子骗人）。
3. **把黑键闸抽成单一来源并铺到所有训练入口**（P0-1）。这是本轮性价比最高的一条：
   它一次性消灭"整个臂静默空转"这一族，而这一族在本仓已经吃掉至少 9 次实验。
4. **修 `EPIRUS_WALL_MS=0`**（P0-2）并补门。
5. **旧账三选一**：G4/G5 的 `n=60→300`（或门里印 ±1.96SE）· 镜像退化进不进门 · 
   "破龟群幅值 / 通吃最弱格"做成当选第二排序键。这三条都是**判据改动**，按本仓规矩要你裁定。
6. 若继续留在 `qoder-killreward-0924`：它领先 `origin/main` **11 个提交**（v1.5.194→v1.5.199 全部工作），
   两槽线上包与 `results/*` 一字未动 —— **合并或弃用都只差你一句话**。

---

## 附：本轮我做过的全部动作（可审计）

* 只读：`git status/log/reflog` · `grep` 接线面 · 读 `play.js` / `kill-reward-lib.mjs` / `train-3p.mjs` / `train-best.mjs` / `train-server.mjs`。
* 实跑（全部在**未接线入口**上，产物落 `docs/artifacts/` 与 `/tmp`，**已删除**）：
  `train-3p` ×2（40 代）· `train-best` ×2（2 候选 × 25 代）· `train-server` ×4（其中 2 次被 §6-P0-2 的 bug 打成空炮）。
* 实跑（只读探针）：`eval-3p` ×2 · `probe-kill-reward` ×2 · `spec-run` · `rules-fingerprint` · `battle-test`（真 Chrome）×1 · `np-test` ×2 ·
  `train-server` 起停一次作 `GET /champion?n=3` 与 `?n=2` 的对账（§6-P2-12）。
* **没有**修改任何 `.js` / `.mjs` / `.html` / 线上包；**没有** promote；工作区结束时干净（`git status --porcelain` 为空）；
  本文档是唯一新增文件（未跟踪，可随时删除）。
