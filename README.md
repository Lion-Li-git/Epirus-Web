# 拍手游戏 Epirus — 2~8 人 × 3/4/5 血 对战（网页）

依据国际拍手游戏规则制定协会的规则（[原仓库 Lion-LiHaoyi/Epirus](https://github.com/Lion-LiHaoyi/Epirus)，规则文档 v2.1.0）实现的网页版：2~8 人对局 + 可选的自训练冠军 AI。

> **当前版本：v2.0.6** · 人数 2~8 × 血量 3/4/5 两根独立轴 · 全人数共用一条难度阶梯 · 多人冠军池是 **2.0 代 3** 形状（包版本 `v:92` ‖ arch `S1o` ‖ 7993 参数 ‖ 观测面 `obs3b`），单包回退仍是 v7 容器（`FEAT_S=213` ‖ 5689 参数）
> 规则见 [`docs/RULES-2P.md`](docs/RULES-2P.md) / [`docs/RULES-NP.md`](docs/RULES-NP.md)；逐版改动只记 [`CHANGELOG.md`](CHANGELOG.md)。

- **游戏部分零依赖、纯静态**：双击 `index.html` 即可游玩（推荐 Chrome / Edge），不需要安装、不需要联网。
- **在线版**：<https://lion-li-git.github.io/Epirus-Web/>（发布白名单 `index.html ‖ css/ ‖ js/ ‖ champion-map/`；`docs/` `tools/` `training/` 不发布）。在线只能对局与看冠军查看器；**「训练」需要另起本机服务**。
- **训练部分可选**：另起一个只用 Node 内置模块（`http` / `worker_threads` / `vm`）的本机服务，用于练出冠军 AI。
- 规则的玩家向说明在对局页第三个 tab「📖 规则说明」，三张表由 `js/ui/rules-panel.js` 现读引擎常量渲染。

## 快速开始

1. 双击 `index.html`。默认「**3 人 · 3 血** + 普通难度」直接开打：点技能出招，所有席位同时行动，回合日志逐条结算；技能按钮按当前资源实时置灰（ジ/珠不足或条件不满足直接不可点）。
2. 想打练出来的 AI：双击 `training/start-train-server.cmd` 启动训练服务 → 训练场点「开始训练(Node服务)」→ 页面自动连接并显示进度 → 训练完自动写入内置包并载入内存 → 对局难度切到「困难 · 冠军」。
3. 冠军策略可「导出 JSON」分享，也可「导入」别人的冠军。

> 本机包（`localStorage['epirus.champion']` = 2P ‖ `['epirus.champion3p']` = 多人）**优先于冠军池**；本机包在场时冠军池整桌不生效（判定只在 `js/ui/ui.js` 的 `poolPlan` 一处）。想打「每席随机抽一枚冠军」的桌子，先清掉本机包。

## 功能

### 对局

- 人数 2~8 × 血量 3/4/5 两根独立轴（血量与人数互不牵连：4 血主要多一格血，5 血=长程，回合上限更长并进入终局收缩）；30 张卡中 27 张可用，另 3 张为多人专用（双枪射手 / 镜面反射 / 全息屏障），**当前存活人数 ≤2 时自动置灰**。导入的 **v7 旧包锁在 2~5 人**（`js/ui/ui.js` 的 `V7_MAX_PLAYERS`），6~8 人桌只由 2.0 池装配。
- 难度三档：**简单 · 陪练** ‖ **普通**（默认）‖ **困难 · 冠军**。档表唯一来源是 `js/train/bots.js` 的 `DIFF_TIERS`，页面下拉由它生成。每档有两个正交维度：
  ① **探索剂量**（ε / epsK / 前几回合斜坡，形状统一由 `tierEps` 决定）；
  ② **桌上是谁**：AI 席逐席各抽一枚冠军（多人池 `js/bundled-champion-pool.js` ‖ 2P 原生池 `js/bundled-champion-pool-2p.js`），允许重复、不许整桌同枚；装配与降级规则见 [`docs/POOL-CONTRACT.md`](docs/POOL-CONTRACT.md)。
- 简单档与普通档在此基础上按桌概率掺脚本席：简单档 `p=0.7`、逐席最多 2 席（`st:mix` + `st:toolkit`）；普通档 `p=0.1`、逐席最多 1 席（`st:toolkit`）。推导只在 `js/pool-draw.js` 的 `scriptSeats` 一处。
- 脚本人格共 6 个（`EpirusBots.STYLES`）；其中「杂货铺」带一条显式计划层（攒钱 / 连开聚能环 / 挑目标的大雷 / 贴贴窗口 / 过载炮花费 / 避雷针看威胁）。
- HP（含 0.5 血）、ジ、电/爆能量珠、地雷/符咒/挑衅/梦魇/回魂等状态全部可见；技能按钮悬停显示手势与说明。
- 「悔一步」可退回本回合开始前（每局限用一次）；可导出对局记录。

### 训练场

- 轻量对抗自对战（类 GAN 的对抗思想，无 AI 框架）：候选策略群每代与「当前冠军 + 脚本基准群」对战打分。基准名单两处真源：2P 侧 `js/train/evo.js` 的 `buildOpps`（1 枚冠军 + 19 条脚本基准），多人侧 `training/server/opp-pool.mjs` 的 `OPP_SPECS`（默认取前 9 条，其余是专项压迫线，只在显式实验里按名字加入）。
- 精英保留 + 变异/交叉繁殖；适应度 = 胜负 + 换血 + 拖时长惩罚 + 出招多样性（熵）奖励。
- **冠军按真实胜率挑选**：任一基准不高于 50% 直接失去资格（纯平局 0.5 也不过门），过门后按 `0.5×平均 + 0.5×最差对局` 排序；另有一层「不回归」：把现有冠军已过的基准打回 ≤50% 的候选一律不许当选。
- 训练跑在 Node 多核并行（`worker_threads`）；页面 SSE 实时进度 + 多条种子曲线。
- 多种子 × 多轮 + 种子谱系：轮末保留前 ⌈√n⌉ 名作父代，再按名次分配 n 个新种子；「从头训练」只在第一轮清空旧冠军。
- 导出训练 CSV 为标准长表：`round,global_gen,gen,seed_id,parent_seed_id,best,baseline,champAge,champChanged,sigma`，行序 `[round] → [seed_id] → [gen]`。

### 规则完整性

- **蓄能珠只供下一回合**：蓄能获得的能量珠仅可在下一回合使用，该回合结束未用即清空；同回合重复蓄能只刷新、不叠加。
- 27 个可用技能 + 4 个隐藏技能（铁索连环 / 吸血鬼公爵 / 回魂 / 梦魇——结算触发，不是可点的卡）全部实现。
- 多人桌（2~8 人）另有双枪射手（两个目标）、镜面反射、隐藏技能聚光炮 / 反复横跳 / 合二为一，以及淘汰后自动观战。6~8 人桌已实测：8 人局可完整打完，长短两桌的 8P 考试各 400 局/格通过（均 19.5 ‖ 30.2 回合，决胜率约 100%，终局收缩几乎不触发）。

## 目录结构

每行 = 一个路径 + 一句它干什么的；细节在 `CHANGELOG.md` 与 `docs/`。

```
Epirus-Web/
├─ index.html                    ← 双击即玩（唯一入口；游戏部分零依赖、纯静态）
├─ css/style.css                 样式
├─ js/                           运行时代码（浏览器脚本，无构建步骤）
│   ├─ core/                     规则引擎（改这里 = 改规则，须先改 docs/RULES-*.md）
│   │   ├─ rules.js                技能 / 分类 / 模式数据
│   │   ├─ state.js                状态结构与出招（费用 / 禁用 / 条件；无贷款）
│   │   ├─ resolve.js              回合结算（优先级管线 / 防御矩阵 / 地雷 / 转移 / 隐藏技能）
│   │   └─ play.js                 对局驱动（自动对局 / 合法出招 / 空放兜底）
│   ├─ train/                    AI 与训练器
│   │   ├─ policy.js               策略网络 + 状态特征（v7 容器：FEAT_S=213 ‖ 5689 参数）
│   ├─ policy2.js                2.0 代 3 的读写与校验（`v:92` ‖ arch `S1o` ‖ 7993 参数 ‖ 键层按决策键分组、无价值头）
│   │   ├─ evo.js                  对抗进化 + 冠军出牌口径（policyChooserN / pickChampion）‖ 混合体：产品 AI 面（浏览器 bundle）+ 训练引擎核（Node 沙箱按文本装载同一份）
│   │   ├─ bots.js                 脚本基准 AI 与难度阶梯（DIFF_TIERS 是档位表唯一来源）
│   │   └─ trainer.js              冠军存取（localStorage / 导入导出）+ 训练 CSV
│   ├─ ui/                       界面（ui.js 交互主逻辑 / skill-tip.js / rules-panel.js / bead-choice.js）
│   ├─ champion-pack.js          冠军包读写协议（导入 / 导出 / 校验）
│   ├─ pool-draw.js              冠军池抽签与装配（byTier / compose / scriptSeats）
│   ├─ bundled-champion.js       2 人内置冠军
│   ├─ bundled-champion-3p.js    多人内置冠军（池不生效时的回退包）
│   ├─ bundled-champion-pool.js     多人冠军池 bundle（真源 champion-map/data/page/pool-members.tsv）
│   └─ bundled-champion-pool-2p.js  2P 原生冠军池 bundle（真源 pool-members-2p.tsv）
├─ training/                     ★ 训练侧独立子仓（2026-11-11 起：入口/服务/旋钮册都住这里；产品侧零依赖，详见 training/README.md）
│   ├─ knobs.mjs                   ★ 旋钮单一真源生成器（--check 供 CI 防腐烂；册 = TRAINING-KNOBS.md 唯一配置真源）
│   ├─ train-3p.mjs                ★ 2.0 GA 训练入口（多人臂，obs5 产线主力）‖ train-best/fast = 2 人 v7 旧线 ‖ train-selftest.mjs = 训练侧自检
│   ├─ start-train-server.cmd      双击启动训练服务（训练场 tab 连它）
│   ├─ server/                     训练服务 + 旋钮单一来源（原 server/ 整体迁入）
│   │   ├─ train-server.mjs          SSE 实时进度：/train /champion /reset
│   │   ├─ paralleltrain.mjs         worker_threads 多核并行评估池（EPIRUS_WORKERS）
│   │   ├─ train-worker.mjs          单 worker 评估入口
│   │   ├─ opp-pool.mjs / opp-champs.mjs   对手池 + 「名字→包」唯一入口（考卷也吃它）
│   │   └─ knob-guard.mjs / econ-env / fight-env / train-env   旋钮闸 + 奖励旋钮三份单一来源表
│   ├─ proto2/                     2.0 研究栈（arch2=网络孪生 / pg-lib=重放反传 / supfit-full=蒸馏 / selftest3）
│   └─ recipes/                    命名配方（规划中：替代手抄 env 启动器）
├─ tools/                        量具与门禁（每个 .mjs 都自带头注；这里只列入口）
│   ├─ gate-all.mjs                ★ 一条命令跑完五道门禁（np + spec 并发，浏览器三道随后）‖ --group= 只跑一组 ‖ --auto 按 git status 判断该跑哪几组
│   ├─ np-test.mjs                 ★ 门禁 runner（注册 / 过滤 / 计数 / 收尾；门体不在这个文件里）‖ --group= 累计深度 / --part= 互不相交分区
│   ├─ gates/                      全部门体（按语义族分成若干部分文件；段名与条数现读 `node tools/np-test.mjs --list-parts --json`）
│   ├─ gate-parts-check.mjs        并集守卫：所有段拼回来必须正好等于全量
│   ├─ spec-run.mjs                2 人引擎自测 + 500 局 fuzz
│   ├─ smoke.mjs / battle-test.mjs / np-probe.mjs   CDP 真 Chrome 三台页面仪器
│   ├─ build-pool-bundle.mjs       把池真源烘成页面用的 bundle（派生物不许手改）
│   ├─ eval-5p.mjs / eval-3p.mjs   产品考卷（5 人 / 3 人）
│   ├─ promote-champion.mjs        换包前体检（可行性闸 + G4/G5 + 珠经济闭环；--dry 只体检不写盘）
│   ├─ log-behavior.mjs            真机栏：按席位统计实机对局记录（只读 results/*.txt）
│   ├─ score13.mjs                 13 行「无短板」判语器（伤/平/墙/架/还/座/广/场B/G4/G5/珍/珠/强）
│   └─（训练侧入口/服务/旋钮册全部在 training/ —— 见上）
├─ champion-map/                 冠军演化图 / 谱系图（现行产物 = 单页 index.html，版本切换在页内换投影）
│   ├─ index.html                  ★ 产物（自包含、双击即开；由 viewer.mjs 烘，不许手改）
│   ├─ viewer.mjs                  ★ 烘页面那台：四个视图 + 页内自检
│   ├─ rebuild-map.mjs              ★ 页面唯一入口：批次戳 → build-view(data) → viewer → shot 98/0
│   ├─ data/                        ★ 数据模型 A：registry/rulers/batches/readings/features/projections
│   ├─ pipeline/                    ★ backfill / build-view / validate / rulers / add-point / measure-point
│   ├─ map-table.mjs               ★ 输入表单一入口（resolve/read/write/守卫；selftest 15 条）
│   ├─ attach-exam-stamp.mjs        给 coords 盖 exam 批次戳（A/B/C 六列 + EXAM-BATCHES.tsv）
│   ├─ shot.mjs                    无头复验（截图 / --dump 打逐条自检结果）
│   ├─ coords.tsv                  基础面板（825 枚，一行 = 一份权重；训练与普查的公共底表）
│   ├─ archive/2026-11-11-legacy-data/coords-gen3-1105.tsv  ★ 历史全库源 926 枚（142 列，含 6 列 exam 批次戳）‖ 页面实际吃 data/build/coords-view.tsv
│   ├─ EXAM-BATCHES.tsv            A/B/C 考卷批次戳（fixture/champ + run id；attach-exam-stamp 生成）
│   ├─ lineage.tsv                   谱系图底表（由 lineage.mjs 现算）
│   ├─ pool-members.tsv / -2p.tsv    ★ 冠军池真源（页面 bundle 由它烘）
│   └─ rebuild-coords.mjs            ★ 一条命令重算面板（几何 → Hp → path → dup → 投影 → 盖档 → 折行 → 身份 → kin）
├─ tests/spec.html               引擎自测（浏览器打开即可）
├─ docs/                         长期文档 + 研究流水（两层的规矩见 docs/README.md）
│   ├─ RULES-2P.md / RULES-NP.md     ★ 规则裁定版（R1..R64 + 子证 ‖ N1..N27）—— 要改规则先改这里
│   ├─ POOL-CONTRACT.md              ★ 冠军池契约（装配语义 / 抽签 / 降级）
│   ├─ METHODOLOGY.md                ★ 方法学与口径陷阱
│   ├─ GATE-SHIFTS.md                ★ 班次 → 该跑哪几组门禁
│   └─ research/                     研究流水：logs / handoff / reviews / archive
├─ results/                      用户私人对局记录（不进仓库）
└─ .github/workflows/            CI：gates（plan → 按 --list-parts 现读的 part 矩阵并行 → 聚合判定）‖ pages（白名单发布）
```

## 规则裁定说明

原规则面对真人手势对局，存在若干未写死的细节（判定概率、蓄能珠时效、避雷针反噬归属、天火窗口等）。`docs/RULES-2P.md` 以 **R1..R64 裁决编号 + 子证** 逐条拍板，`docs/RULES-NP.md` 以 **N1..N27** 覆盖多人；引擎代码注释与之一一对应，`tests/spec.js` 覆盖主要裁定。**改规则先改文档再改代码。**

## 自测与门禁

浏览器打开 `tests/spec.html`（通过数 = 用例数）或走命令行：

```bash
node tools/gate-all.mjs --auto   # 本机默认：读 git status 判断该跑哪几组
node tools/gate-all.mjs --np     # 五道全量（np + spec + smoke + battle + 演化页自检）= 本机认证
node tools/np-test.mjs --list-parts --json   # 现读部分清单（CI 矩阵吃这一行）
node tools/np-test.mjs --only=D193           # 单条门：--only= 是子串匹配，不是列表
node tools/spec-run.mjs                      # 2 人引擎用例
node champion-map/shot.mjs "--hash=mode=map&check=1" --dump   # 演化页页内自检（四视图换 mode=）
node tools/score13.mjs --selftest            # 13 行判语器的夹具
node training/train-selftest.mjs             # 训练侧三条凭据
```

⚠ `--group=` / `--part=` / `--only=` 跑出来的都不是整轮认证（工具会自己印「只跑了 N / M 条」）；收工前那一遍要整轮。

## 训练

### 旧入口（v7 / 2P 快速路径）

```bash
node training/train-fast.mjs 500    # 快速 500 代（产物落 docs/artifacts/train-fast-out.js；EPIRUS_PUBLISH=1 才写 js/bundled-champion.js）
node training/train-best.mjs 4 600  # 4 个候选择优（推荐）
node training/train-3p.mjs 60 5 24 24   # 多人：代数 / 人数 / 种群 / 每体局数（用法见 --help）
```

- 评测口径与实战一致：`js/core/play.js` 的 `autoGame` 中双方都基于「行动前状态」决策。
- 绝不空放：`autoGame` 对任何脚本/AI 返回的「买不起或条件不满足」的招一律兜底改按ジ（`policy.js` 另给了 `lastSkill` 的显式「上一招无效」特征）。
- 连招反制训练：池内 `combocounter` 脚本会读对手最近 5 次出招并选克制技，模拟正常对局里被针对的局面；游戏内不再另做运行时连招防护，困难档直接用冠军策略。

### 2.0 网络（obs5 / v92，2026-11-10）

当前多人冠军池仍是 **obs3b 代 3（7993 参数）**；下面的 obs5 是**当前训练面**，尚未入池。三张容器/观测面：

| 面 | 特征维 | 参数量 | 聚合 | 说明 |
|---|---:|---:|---|---|
| v7 | 213 | 5689 | 4 槽 + 单标量头 | 旧线，2P 池仍用 |
| obs3b | 415 | 7993 | `h_self ‖ mean(对手) ‖ max(对手)` | 2.0 第一代，现池 |
| obs4 | 292 | 12969 | 8 个固定槽，无 mean/max | 11-10 原型 |
| obs5 | 292 | 12393 | 1 层自注意力 + PMA 4 seed | **当前训练面** |

obs5 与 obs4 共用同一张 **292 维特征 manifest**：每席 35 维（29 公开 + 5 关系 + 1 isSelf），局面侧 60 维（G5 + 私有 2 + 序列 48 + 合计 1 + 比较 4），合计 292。差别只在聚合段：

- 共享 `seatEnc` 35→24；
- **1 层自注意力**（QKV 各 24×24，活席掩码 softmax，残差直连）；
- **PMA 4 个 seed**（keys/values 读注意力后的语境），输出 pooled 96；
- `xin = [局面 60 ‖ pooled 96] = 156`；
- `actEnc` → 24；`cand` 层把 `[ctx 32 ‖ actH 24 ‖ 两个席位 enc 48]` → `hid2 24`，键层按 `keySplit` 输出；
- 段序 = `seatEnc‖attn‖pma‖actEnc‖ctx‖cand‖head`，查找一律**按段名**（obs5 插段后下标不再可靠）。

结构上的两个性质：**置换不变**（softmax 只作用在“在场席位集合”上，死亡席不编码、不占 softmax）；**跨人数**（K 只经 softmax 归一进入，权重和恒 1，没有 mean 的“除以 N”伪影；init 时注意力 logits≈0，从软均值起步特化）。浏览器侧 `js/train/policy2.js` 与训练侧 `training/proto2/arch2.mjs` 同源；`training/proto2/browser-parity.mjs` 用同一包、同一批决策点逐位对账 logits。

### 2.0 训练流程

```bash
# 一条臂：200 代，5P，每代 24 局，种群 8；具体配方走 EPIRUS_* 环境变量
node training/train-3p.mjs 200 5 24 8

# 多种子轮换 + 按 C 选冠军（3 臂 × 200 代，轮末重测）
node scratch/night-adapt2/msbatch2.mjs --base=201 --rounds=1 --branches=3 --gens=200 --arm=MSB5
```

一条臂里发生什么：

1. **初始化/热启动**：`EPIRUS_HOTSTART=1` + `EPIRUS_SEEDPACK=<v92 包>`；v7 包不能直接热启动（只认 v:92）。
2. **逐代评估**：每个个体跑 `GAMES` 局，`scoreMemberN` 算 fitness；`EPIRUS_MUT_MODE=seg` 做段感知变异/交叉。
3. **逐代排序**：精英/父母抽取、名人堂写入；可选 `EPIRUS_GA_GATE` 每代 top-3 健康读。
4. **终局**：名人堂重验、`SEL_*` 当选面 veto/排序、写 band 候选；产物 = 起点时 §E589 拒绝落盘（exit 9，不是 0）。

2.0 产线当前的训练形状（不是所有键的默认值）：

- **桌形混合**：`EPIRUS_MIX2_EVERY=4`（每 4 局一桌 2P）、`EPIRUS_MIX8=4`（8P）、`EPIRUS_MIXHP_EVERY=2`（3 血 ↔ 5 血），主桌 `EPIRUS_TRAIN_MODE=long`；
- **教练**：`EPIRUS_FIT_CHAMP=<包>` 每 k 局把一席换成真实冠军；`EPIRUS_COURSE_PACK=<包>` 每 k 代把一席换成课程包；v92 走 `Policy2.unpack`，v7 走 legacy unpack；
- **压力源**：脚本池 + 反制原型（`EPIRUS_COUNTER_OPPS`）+ 击杀/经济/防御 credit；具体权重在 `js/train/evo.js`，README 不手抄。

### 主尺与选拔（A / B / C）

- **A 轴**：v2 脚本考卷（9 个脚本两两），衡量“对脚本桌”的强度；
- **B 轴**：冠军桌混合夹具 `KDG-B + FOCUS + Q-s47`（2.0 主力两枚 + 反墙锚），衡量“对会还手的冠军”。⚠ 11-11 代表重测（`scratch/zcode-1111-bretest/`）：夹具新旧是双向扭曲——obs5 冠军链在冠军桌真实负（MSB2-R1 −0.271/−0.089），A 轴选拔 ≠ 冠军桌强度；夹具滚动与 champ 戳入表的调整见交接文档。
- **C = (A+B)/2**：4 个人数格按 `W4 = 2P .15 / 3P .25 / 5P .45 / 8P .15` 加权，再对 multi/long 取均值。

训练 fitness 仍主要是 A 轴；C 是**晋级主尺**。`msbatch2` 每轮用 `exam-4n --dose=page --exam=both` 重测 C，只有超过现冠军 `margin` 才换代。⚠ 只看 A 会被“反射墙”农掉；只看 C 会掩盖 2P 单格（2P 只占 15%）——引用分数必须同时报 A/B/C 和用卡/防御。

> ⚠ **2026-11-11 晚复核**：v7 内 A 升（+0.0096 /100 枚）、B 降（−0.0052），C=(A+B)/2 正好抵消 ⇒ C 走平不是训练停滞。
> 趋势与档位引用必须 A/B 分列；V111 的 B 轴全库最低（1/926），C 第 8 低。详见 docs/research/FINDING-2026-11-11-exam-old-vs-new.md。

**旧 H5 系列 / 当前 F**：H5/Hp5/Hlong5/Hplong5/Flong5 是旧 5P 单卷的参考读数（H5=考卷 ε=0，Hp5=页面剂量），**已冻结、不再更新**；表里的 F/rank 是旧尺出厂账。页面实际用 Fv = X̄₄(C·R) + T·S，名次每次按当前尺重算；新点不再写 H5/F/rank。

**数据模型 / 新点进图（2026-11-11）**：源表在 champion-map/data/（registry/rulers/batches/readings/features/projections/display），页面由 build-view 编译成 coords-view 后交给 rebuild-map。换尺只追加 readings 并切 rulers.tsv 的 current；新点用 pipeline/measure-point.mjs 自动跑四腿+feas+投影，再经 add-point 写入并重烘。

**页面元数据 / 趋势**：lineage/pool/promote/ship/slot/coords 已收进 champion-map/data/page/；A/B/C 趋势页是 champion-map/trends.html（30 枚滑动，按 ts），页面左上角有入口。

### 训练期的门与杀

- `EPIRUS_GA_GATE=<K>`：每代 top-3 健康读，宽粒优先；全代不过线只“饿退”，**不杀**；
- `EPIRUS_STALL_ABORT=<K>`：连续 K 代 `bestFit` 不进步 ⇒ 整臂终止；
- `EPIRUS_SEL_CARDS=<N>`：**终局**用卡数地板（`card-usage` 的 ≥0.5% 份额口径）；
- `EPIRUS_CARD_ABORT=<K>` + `EPIRUS_CARD_MIN=<N>` + `EPIRUS_CARD_ABORT_GAMES=20`：**训练期**连续 K 代 top-1 用卡数 < N ⇒ `exit 13`，不写产物。它用与 `card-usage` 同一把 `cardUsageProfile`，只量 top-1；默认关；
- 注意：`CARD_ABORT` 杀的是“当前 top-1”；若要杀“种群中位/冠军线”，要先改判据主语，别把 top-1 当全部。

### 当前读数（2026-11-11 夜更新）

- **C 尺换代链（msbatch2 轮换 + 2P 谱系晋升，全程 multi/long 双尺重测）**：KDO5C(0.014) → S916R2B(0.0668) → **MSB6-R2S501866988(0.1049)** → charge/bagua 定向线 → **MSB10-R1S1149480262(0.2002，bagua 线终局冠军)**。
- **过 0.079 验收线的 obs5 包一晚 9 枚**（0.08-0.20 带），性格各异：6 卡防御 31%、5 卡防御 30%、9 卡广谱（mine/ring/proto 新技能）……详见 docs/research/PLAN-2026-11-11-skill-coverage-zcode.md。
- ⚠ **墙化警告**：charge 线 R2 的 0.3151 是纯反射墙（reflect 86%）——C 尺（可farm A + 陈旧 B 夹具）在系统选拔墙；反墙席已上训练桌（MSB11 在飞），**反墙能力应入池必量**。
- B 轴夹具重测结论：夹具是双向扭曲（见 FINDING-2026-11-11-baxis-rebretest-zcode.md），滚动夹具 + champ 戳 + 换夹具换列族要三件一起做。

## 已知限制

### 档位读数口径

**5 人桌 · 每局 1 席人类形状原型（轮座）+ 4 席按该档的带逐席抽**（允许重复、禁四席全同；与页面同一份 `js/pool-draw.js`）；普通档每席先按 0.5/0.5 掷 hard/soft 再带内均匀取一枚。每局一个新盐。出手只数 `action/ok`，分母 = 4 个 AI 席的成功出手（含ジ）。尺 = `docs/debug/tier-census.mjs`，读数 = 80 局/格 × 6 seed × 6 人类原型 = 2880 局/档（三档共 8640 局）。

| 档位 | 带 | 掺脚本席 | 均回合 | AI 出手/局 | 种类 | 前 3 | G | 防御类 | 脚本席出手占 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **简单 · 陪练** `lv:sparring` | soft 13 枚 | p=0.7 / 逐席最多 2 席（`st:mix` + `st:toolkit`） | 21.7 | 59.7 | **30** | 66.1% | **7.21** | 16.3% | **47.6%** |
| **普通** `lv:regular` | 两带加权 hard/soft（22 枚） | p=0.1 / 逐席最多 1 席（`st:toolkit`） | 21.1 | 54.9 | **29** | 73.4% | **5.44** | 8.1% | 9.1% |
| **困难 · 冠军** `lv:hard` | hard 带（9 枚） | 不掺 | 19.6 | 51.3 | **19** | 81.2% | **3.76** | 0.9% | — |

**⚠ 上表 = 2026-11-07 午重测**（池 23 枚：hard 10 ‖ soft 13 时的装配量；**现池 22 枚：hard 9 ‖ soft 13**，11-09 `WSEL9-200` 进池；下表读数未重测；`tier-census --games=80 --seeds=90210…90215 --protos=6 --mode=multi`，2880 局/档，原件 `scratch/qoder-1107-census-pool23.json`）。三档台阶**保持**（回合 21.7>21.1>19.6 ‖ top3 66.1<73.4<81.2 ‖ G 7.21>5.44>3.76 ‖ 防御类 16.3>8.1>0.9）；与 11-06 晨那版 20 枚池相比，**困难档防御类 0% → 0.9%**（新入池的 DEF credit 成员把防御族写进了 hard，但仍极低）、种类 20→19。逐局种类（`perGameKinds.all` mean）：简单 12.4 ‖ 普通 8.9 ‖ 困难 7.0。

**⚠ 2026-11-11 下午只读复核（当前池 22 枚 · 不是 2880 局口径）**：`tier-census --games=40 --seeds=90210,90211 --protos=3 --mode=multi`（240 局/档）读数为
**简单 23.4 回合 / 29 种 / 防御类 12.6% ‖ 普通 26.1 / 27 / 15.5% ‖ 困难 29.4 / 15 / 19.8%**；
2P 同口径（360 局/档）为 **14.9 / 15 / 27.3% ‖ 12.4 / 16 / 18.7% ‖ 11.9 / 16 / 20.9%**。
⇒ 上表 11-07 的困难行（19.6 回合 / 19 种 / 防御类 0.9%）已经不能描述现池：困难档现在**更慢、更窄、防御更多**。
正式 2880 局口径重跑前，引用请带批次与样本量，不要把这两组数混读。

带内枚数现读 `champion-map/data/page/pool-members.tsv`。台阶（**11-07 午重测，当时 23 枚池**；8 seed × 1000 局逐局配对，n=5，`--pool=1`）：multi 简单−普通 **+0.95±0.30**（3.2σ，6/8 同向）、普通−困难 **+2.34±0.51**（4.6σ，8/8）；long **+0.97±0.53**（1.8σ，7/8）、**+2.13±0.41**（5.2σ，7/8 另 1 粒并列 0）。原件 `scratch/qoder-1107-ladder-multi.txt` ‖ `…-ladder-long.txt`。
⚠ **这把尺已到分辨力下限**：rand 替身夺冠均值掉到 困难 11.1/11.0 ‖ 普通 13.5/13.2 ‖ 简单 14.4/14.2（multi/long），地板区里幅度读数不稳 ⇒ **换尺待裁（D-28）**；跨批漂移约 1pt，幅度 <1pt 的行只当批条件读数。判宽度用普查的 `perGameKinds`（逐局），不要用并集种类。

> ⚠ **2P 池现状（11-10 复核）**：9 枚成员全是 v7（5689 参数），最后更新 10-21；2.0 统一冠军尚在训练，2P 暂走旧池。2.0 的目标是**一个包按人数自适应**，不再维护独立的 2P 专家池。

**2 人桌**（hard 5 ‖ soft 4，soft 里 2 枚跨人数邀请；普通档按带加权）：台阶 multi 14.36 / 21.18 / 27.11，long 17.78 / 23.55 / 28.69（两级台阶 ≥10σ）。谱（2880 局/档/模式）：

| 档 | 带（枚数） | 种类 m‖l | 前 3 m‖l | G m‖l | 防御类 m‖l | 均回合 m‖l |
| --- | --- | --- | --- | --- | --- | --- |
| 简单 `lv:sparring` | soft 4（2 原生 + 2 跨人数邀请；ε=0.2） | 18‖20 | 74.6%‖76.7% | 5.10‖4.81 | 21.8%‖18.1% | 16.0‖27.0 |
| 普通 `lv:regular` | 两带加权 9 枚（ε=0.1 斜坡） | 22‖23 | 81.6%‖81.1% | 4.41‖4.47 | 12.8%‖13.8% | 15.9‖33.2 |
| 困难 `lv:hard` | hard 5（**11-06 起统一随机度 ε=0.1 斜坡**，见下） | **20**‖**19** | **83.7%**‖**79.7%** | **4.26**‖**4.64** | **10.8%**‖**15.9%** | **15.8**‖**36.2** |

**⚠ 困难行 = 2026-11-06 晨重测**（ε 撤全贪心 + R64 之后；简单/普通两行的随机度没动过，本次重测**逐字复现**旧表 ⇒ 表可信）。统一随机后困难长程**不再退化空转**（42.2→36.2 回合、种类 15→19、G 4.42→4.64）；top3 两桌都与普通档分开（multi 83.7>81.6 ‖ long 79.7<81.1——long 桌上困难档**更分散**不是更弱，档位强度看 `probe-diff-ladder --pool=1` 的配对台阶）。

口径三条：① 简单档的谱是「脚本席 + soft 池」的混合谱，卡表 30 张全部出现过；② ~~2 人桌困难档仍是 ε=0~~ **2026-11-06 起 `eps2:0`（全贪心）已撤**：池形态统一随机度下三档仍分得开（`--pool=1` 1500 局/格 同 seed 配对：multi 困难↔普通 4.13pt ‖ long 4.87pt，≥3pt 地板；旧全贪心臂 14.13/18.67 在册；**单包形态下普通/困难逐位同 = 假档，量 2P 阶梯必须带 `--pool=1`**）——上表谱行仍是 ε=0 时代的读数，重跑前按旧口径读；③ 单枚成员的谱不代表任何一档，单枚请用 `tools/usage-probe.mjs` 并标明它不是档位读数。

### 两张贵卡（大雷 / 摄魂）——2026-11-06 刷新

> 本节旧读数（"大雷在任何剂量下都不赚钱 / 摄魂只有一格为正"）出自 10 月中的卡价 RCT，**已过期**：
> 11 月的 2.0 代 3 训练线里两张卡都被广泛学会且进了带（`RESULTS-2026-11-03-NIGHT-zcode.md`：次级长程 4/4 全学会——charge 9/10 ‖ ring 7/10 ‖ **bigT 9/10** ‖ railgun 8/10；带内 bigT 使用率 9~11/12）。"卡价"与"装配量"是两把尺（见下节），旧结论按当时的桌形与候选池成立，不再描述现在的桌。
- 摄魂的引擎侧现状不变：`drainHpMax` 2 人/3 血/4 血桌 = 1、长程 = 2（`rules.js` MODES；规则页现读）。
- 剂量来源仍只有一处：`js/train/evo.js` 的 `BIGT_PUSH = 12` ‖ `DRAIN_PUSH = 1`（0 = 关）。
- ⚠ 新的按档位装配量读数**待 2.0 分池上桌后用 `docs/debug/tier-census.mjs` 重跑**再挂表（本节旧表数字随旧池作废，先摘不下结论）。

### 三个洞——2026-11-06 刷新

1. ~~对开环的人零反应~~ → **已过期**：2.0 线的包自己会开环也会应对环局（上引 11-03 账：ring 7/10 学会、环强迫探针在册）；"训练池里没有环流对手"的前提已不成立（`st:toolkit` 计划层 P7-断环 + 池内环局）。
2. **贴贴 × 天火在 3 血下算术锁死** → 部分过期：铺符-引爆的经济在 3 血下仍紧（符咒 3 回合过期未变），但池内已出现贴贴/天火使用者（R62 阶梯计价后首下 1ジ），"冠军席连铺符都不发生"不再成立；精确的每档装配量同样等上池后普查。
   **⚠️ R64（2026-11-06 用户裁定）追加**：天火**无自己可引爆符咒时不可发动**（条件不满足，UI 置灰/AI 不再空放）；且 11-06 实测（`scratch/zcode-1106/sticker-waste-1106.txt`，120 局/枚池装配）：池内贴贴大户外 **GD3ALL-NGA2R-s41 贴出 89 枚只引爆 1 次（I/A=0.01）**、G5DEF-s41 48 贴 2 引——"贴而不引"才是主要浪费形态，空放已被 R64 关死（实测 0/4）。逐枚"从未引燃"的精确浪费率需要引擎在 sticker 上打引燃标记（resolve.js = 指纹五件套），挂到下一轮指纹换代。
3. **原型制御墙** → 仍在：冠军是硬打过去，不是会用"地雷/转移"解法。这条不是训练调参能补的，是否为此改动产品待定。
   **⚠️ 2026-11-06 夜复核把这条量细了**（不是调参问题，是**没有任何梯度**）：页面剂量下 2 人困难带打「攒钱+反弹」原型，
   40 局 **26 平**（65%）、828 次攻击里 **710 次是枪**（被 0 费的【防御】整张挡掉）、**坦克 0 次**、狙击 26 次，
   每局只造成 2.25 点伤害 ⇒ 一个只会按防御的玩家能逼平最强 AI，观感是「AI 一直拿同一招撞墙」。
   读数、机理与三个候选方向见 [`docs/research/FINDING-2026-11-06-hard-vs-defense-wall-ds.md`](docs/research/FINDING-2026-11-06-hard-vs-defense-wall-ds.md)；本版**未改**训练默认，只记档。

### 引用这节的数字之前

- 量档位只有一条路：按档位装配量（`docs/debug/tier-census.mjs`）；单枚镜像（`tools/usage-probe.mjs`）只回答「这枚包想用什么」。
- 演化图的壳量的是投影空间（`viewer.mjs` 在 t-SNE 面板上用的是投影坐标 `xt3/yt3/zt3`），不是行为轴；壳的判据是「这一片里过线的占多数吗」，不是「这一枚过不过线」。
- 真机栏 `results/` 不带档位标注，`tools/log-behavior.mjs` 量的是「玩家实际遇到什么」；模拟档位 / 单枚镜像 / 真机三者只许并排读，不许相减。

## 免责声明

游戏规则（CC BY-NC-SA）版权归国际拍手游戏规则制定协会；本实现仅供学习交流，请遵守当地法律与游玩场合礼仪。
