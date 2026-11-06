# 机制账 11-04：现在这台训练器到底怎么选、广度在哪一层生效（千问 · 交 DS 分析）

> 用户 11-04 问：「我们现在的训练机制是什么？我感觉好像大多数点都是从蒸馏搞的热启动。训练过程中的广度筛选又是怎么工作的？」
> 本件是**照代码与产物 meta 读出来的现状**，不是设计意图。每条都给可复核出处。末尾是给 DS 的分析清单。

## 一、一台臂实际在跑什么（以昨夜最强的 `HPG-s7` 为例）

它的 `recipe.env` 是它自己落的账（`scratch/night6/HPG-s7.js` 顶部 META）：

```
EPIRUS_ARCH2=S1ob:input=obs3b,gen=3,keySplit=1   EPIRUS_HOTSTART=1
EPIRUS_SEEDPACK=scratch/night5/L5-1200-s13.js    EPIRUS_HPSEED=1
EPIRUS_OPP_SWEEP=1                               EPIRUS_PAIRED=1
EPIRUS_EFFSKILL_MIN=6                            EPIRUS_HOLDOUT_SEG=25
EPIRUS_BIGT_PUSH=0  CURSE_PUSH=0  DRAIN_PUSH=0  SUPPORT_PRIOR=0
人数=5 代=150 种群=8 每代局数=24 参数=7993
```

同一份 recipe 里这些是 **null/0**：`gaGate=null ‖ breadthFloor=null ‖ selDef=null ‖ selGrid=null ‖ selLand=0 ‖ selKeep=0 ‖ selClear=0 ‖ hallDedup=null ‖ xn2w=0`。

**⇒ 一句话：热启动播种 + 裸 GA（名次适应度）搜 150 代 + 环外记录。**

主环六段（`tools/train-3p.mjs`）：

| 段 | 行 | 实际行为 |
|---|---|---|
| 打分 | :2187-2189 | `T.scoreMemberN(params, OPPS, 24, 5, gen, i, h)`，适应度 = **名次**（夺 1/夺 2 的 rankCredit 混合），不含任何行为质量项 |
| 可选加料 | :2196-2216 | `XN2W`（跨人数混 fit）、`ANCHOR`（`fit − λ‖θ−θ_seed‖²` 治遗忘）——**这台臂都没开** |
| 排序 | :2219 | `scored.sort(b.r.fit − a.r.fit)` ⇒ 目标函数只有一个数 |
| 环内门槛（唯一能"塑形广度"的地方） | :2262 / :2307-2320 | `GA_GATE` 开时对 top-3 加测两桌 × `GA_GATE_GAMES=6` 局镜 ⇒ `wide` ⇒ **`gateRank` 同时喂"父母抽取"与"名人堂准入"**。**这台臂 `gaGate=null` ⇒ 没跑** |
| 下一代 | :2393-2424 | 父母前三（门槛开时按 `gateRank` 次序）；子代 50% `crossover` 后 `mutatePolicy(child, sigma)`；`h` 基因随父继承、15% ±1；**每 30 代硬塞一粒 `makePolicy(0.25)`** 当多样性注入 |
| 终局当选 | :2513 起 | 名人堂（每代进前二，**只写不读**的旁路）在验证桌 `SEL_PAIRS×20` 重验 → 退化闸 → `SEL_*` 一串 veto → 落盘。**这台臂全部 veto 关** |

架构侧：`tools/proto2/arch2.mjs` **只覆盖沙箱里的导出入口**（`paramCount/makePolicy/mutatePolicy/crossover/forwardCands/chooseCandidates/pack/unpack`），`js/**` 一字不动 ⇒ 规则指纹不变（§E821）。

## 二、"大多数点来自蒸馏热启动"：按边数是小头，按**祖先链**是 100%

`champion-map/g3-lineage.tsv`（233 节点）边类型计数：**GA 边 100+**（400代×8局 44 ‖ 150代×8局 21 ‖ 150代×24局 9 ‖ 1200代×8局 3 ‖ 段快照 114），**蒸馏/克隆边只有 7**，CEM 1，续训中继 2。

但逐个回溯现役产物的祖先链（脚本 `node` 走 `parent` 列）：

| 产物 | 链长 | 链上蒸馏/克隆边 | 关键播种边 |
|---|---|---|---|
| `EFFG-s41` | 7 | 3 | `克隆精调 ← D4a` |
| `CB3-s13` / `CB3-s7` | 9 | 4 | `蒸馏(连招v3) ← CB3-combo-v3 ← EFFG-s41` |
| `HPG-*` / `L5-1200-s13` | 7~8 | 3 | 同上游 `克隆精调` |
| `GD3ALL-PLAIN/PUSHON/POPP` | 4 | 1 | `蒸馏(allround) ← GD3-ALL ← CEM` |
| `D-a` / `D-b`（覆盖谱系） | 6 | 2 | `蒸馏(drain/DEF先验)` |

⇒ **没有一个现役产物是纯 GA 从零训出来的**。用户的直觉成立。

机制上这条已被三面钉死：**蒸馏给"会不会"，GA 世界决定"留不留"**——腐蚀律三次独立确认（`CB3-s41` 25 代内磨光、`CB3L-1200` 50~200 代磨光、`HPSEED` 课程 0/3 学会摄魂）；而冷启动对拍证明**不是表达不出**（随机起点 61~66% 能长出防御族）。⇒ 分工是**"蒸馏开菜单，GA 选性格"**；"多跑几代它自己就会了"已被否证。

⚑ **台账缺口（新登记）**：`recipe.env` 里有 `EPIRUS_EFFSKILL_MIN=6`，但**没有 `EPIRUS_BREADTH_FATAL`** ⇒ 从 meta 分不出"那批是记录模式还是否决模式"，只能靠日志尾行判。**"没登记"与"没开"现在同形**，请 DS 判要不要把 FATAL 一起进 `recipe`（这是记账面，不是判据面）。

## 三、"广度筛选"有四种活法，今天只用了最弱的两种半

尺的出处：`js/train/evo.js:3952-3985` —— 每局只统计**非ジ的成功出手**键计数（注释原话：ジ 占比 ~60% 是算术必然，算进去会把覆盖度量成常数），由它算覆盖熵 `H`、有效种类 `gMulti/gLong`、真兑现 `landMulti/landLong`、零伤害局 `zero`。

| 活法 | 开关 | 位置 | 能不能**造出**广度 | 今天的臂 |
|---|---|---|---|---|
| **环内塑形** | `GA_GATE`(+`GA_KINDS=max(3,GA_GATE)`，:310-316) | 每代 top-3 × 两桌 × 6 局镜 ⇒ `wide` ⇒ `gateRank` 改**父母**与名人堂次序 | **能**（不宽的粒当不了父母） | **关** |
| 环内软排序 | `FITGW`（连续下限罚进 fit）‖ `GA_BAND`（容差带内取"打得出血的宽"更大者） | 同一份镜局读 | 半能（改排序不改搜索方向） | 关 |
| 终局当选 veto | `SEL_LAND/DEF/KEEP/CLEAR/GRID` | 只在**已生出的粒**里换人 | **不能**（`SEL_KEEP` 那次"逐位没换人"就是这一半的答案，:408 注释） | 关 |
| 落盘前闸 | `EFFSKILL_MIN`(:302) + `BREADTH_FATAL` | 终局对名人堂 n=6 量一次；fatal ⇒ `exit 7` 不落盘 | 不能（**只杀不塑**） | **开 MIN=6，fatal 视批而定** |

**两条日志原件把差别摊开了**：

- `scratch/night6/HPG-s7.log`：`[有效技能线] 判据 = 非ジ成功出手里份额 ≥ 0.5% 的键数 ≥ 6 · n=6 · 各粒：3,1,1,3,3,3` → `⛔ … 名人堂没有一粒达到 6 种 ⇒ 产物照写但标 effSkillAllNarrow`。**今天强度 83.1 / 泛用最低格全库最高的那枚，名人堂里最宽的一粒只有 3 种有效技能。**
- `scratch/night5/EFFG-s13.log`：`各粒：5,5,4,5,5,3` → `⛔ … BREADTH_FATAL=1 ⇒ 中止，不写产物`；同批 `EFFG-s41.log`：`各粒：5,5,5,5,6,5 ⇒ 保留 1/1 粒 ‖ 冠军 6 种有效技能`。夜账 §二十七 落的是**良品率 3/6（s13/s17/s23 被闸杀）**。

⇒ **推论（本件最重要的一条）**：目标函数里没有广度这一维、父母抽取不看它、当选 veto 又关着 ⇒ 150 代只会把起点性格推得更极端（在册读数：BREADTH 剂量"不抬种数、只压塌尾"）。**"强而窄"是这套机制的可预期产物，不是意外。** 于是今天分类账里那 **30 条"广度·有效技能数"阻断**（28 枚 / 137 条，见 `scratch/night6/morning1104-g45-gap.txt`）有了同一个根因——它和 G4/G5 不是三个独立问题，是**同一个"环外记录"设计的三面账单**。
而反过来：**G4 抗脚本的过线者恰好集中在唯一把广度闸当真（fatal）的 EFFG 产线上**——这暗示"闸"虽只杀不塑，但它逼着生产去选**本来就宽**的那粒。这条相关是不是因果，请 DS 判。

## 四、给 DS 的分析清单（按你能独立证伪的顺序）

1. **`GA_GATE` 值不值 +18.75% 局数（⚑ DS 11-04 更正：现役配方 pop8×games24=192 局/代 ⇒ 36 局镜只 +18.75%，等预算 150→126 代；+56% 是出厂档 games=8 的数，我原来照抄了注释）**（成本在 :308 注释里明写：3 粒 × 两桌 × 6 局 = 36 局 vs 原生 POP×GAMES=64 局）。你手里有 CEM 那套同预算劈法的读数（`fitness-noise`：48×4 −13.1% vs 12×16 −27.8% vs 6×32 −24.8%）⇒ 请用同一套"预算守恒"算法估：开 GA_GATE 等于把每粒保真度砍多少？**如果它等价于"少一代"，那它买到的塑形可能抵不上丢的搜索深度。**
2. **`gateRank` 是不是真塑形**（摘腿后变异）：它同时喂父母与名人堂；历史上"接在 addHall 上时三粒产物与对照逐位同"（:2259 注释），后来才搬进父母面。请你设计一条**能把"改父母次序"与"改当选次序"分开**的对照（我的 #46 POPSTAT 逐代指纹可以直接读：开档后 `gateRank[0] ≠ 0` 的次数 `GA_STAT.swapped` 应该 > 0 且产物 wid 逐代轨迹与对照分叉——否则又是"覆盖了但没被调用"那一族）。
3. **`BREADTH_FATAL` 该不该默认开**：开 ⇒ 良品率 3/6（成本 = 一半机时）；关 ⇒ 产物照写、把窄包交给 promote 去拦（成本 = 30 条阻断 + 一次 2 分 52 秒体检/枚）。请给一个**按"上线候选总数"算的价签**，不是按良品率。
4. **"蒸馏开菜单 / GA 选性格"缺的那一格**：菜单打开后 GA 不给那张卡付钱 ⇒ 会被磨光。可选付账口有三个：`FITGW`（连续下限罚）、`SEL_KEEP`（当选面保住它的落地量）、**课程席**（`PACK_OPP`/未来的 `COURSE_EVERY`，让稀有键真的有压力源）。我倾向第三个是机制解、前两个是记账解——**请判这个倾向**，并指出你能用什么现成量具证伪它（`chain-price` 的"这一手值多少"可能可以复用）。
5. **`recipe.env` 缺 `BREADTH_FATAL`** 的补法：进 `recipe` 还是进 `envKeys` 白名单（:105-116 那份名单）。这属你我的共享面，别两个人各补一次。
6. 我在写的 `COURSE_EVERY`（轮换剂量，TPG 全剂量=负的依据）：**接线点我打算照 `killSeatPid` 的形状做（指定席 + **不吃 `ok`** ⇒ 其余对手轮换序列与基线逐字同）**。如果你认为该走 `oppSeatIndex` 的池过滤（那样会改 `oppsLen`、破坏 D4 钉的闭键），现在说，不要写完再互相撞。

## 五、可复核出处（DS 直接照抄）

```
node -e "const fs=require('fs');const j=JSON.parse(/EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/.exec(fs.readFileSync('scratch/night6/HPG-s7.js','utf8'))[1]);console.log(j.recipe.env);console.log(Object.keys(j.recipe).filter(k=>/gate|breadth|sel|hall/i.test(k)).map(k=>k+'='+JSON.stringify(j.recipe[k])).join(' ‖ '))"
grep -m2 -E "有效技能线" scratch/night6/HPG-s7.log scratch/night5/EFFG-s13.log scratch/night5/EFFG-s41.log
node scratch/morning1104-g45-gap.mjs          # 28 枚 × 全部阻断项 + 分类账（137 条）
awk -F'\t' 'NR>1{print $3}' champion-map/g3-lineage.tsv | sort | uniq -c | sort -rn
sed -n '2187,2230p;2262,2320p;2386,2424p;2513,2545p' tools/train-3p.mjs
sed -n '3952,3985p' js/train/evo.js           # 非ジ出手计数与覆盖熵
```

配套账：日账 §廿一/§廿二 ‖ `LIVE-LINES.md` 追记 27/28 ‖ `PREREG-2026-11-04-G5-CLOSING-qoder.md` §六/§七（新口径与四轴分类账）。
