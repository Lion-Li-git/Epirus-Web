# 拍手游戏 Epirus — 2~5 人 × 3/4/5 血 对战（网页）

依据国际拍手游戏规则制定协会的规则（[原仓库 Lion-LiHaoyi/Epirus](https://github.com/Lion-LiHaoyi/Epirus)，规则文档 v2.1.0）实现的网页版：2~5 人对局 + 可选的自训练冠军 AI。

> **当前版本：v1.8.43** · 人数 2~5 × 血量 3/4/5 两根独立轴 · 全人数共用一条难度阶梯 · AI 状态特征 v7（FEAT_S=213）
> 规则见 [`docs/RULES-2P.md`](docs/RULES-2P.md) / [`docs/RULES-NP.md`](docs/RULES-NP.md)；逐版改动只记 [`CHANGELOG.md`](CHANGELOG.md)。

- **游戏部分零依赖、纯静态**：双击 `index.html` 即可游玩（推荐 Chrome / Edge），不需要安装、不需要联网。
- **在线版**：<https://lion-li-git.github.io/Epirus-Web/>（发布白名单 `index.html ‖ css/ ‖ js/ ‖ champion-map/`；`docs/` `tools/` `server/` 不发布）。在线只能对局与看冠军查看器；**「训练」需要另起本机服务**。
- **训练部分可选**：另起一个只用 Node 内置模块（`http` / `worker_threads` / `vm`）的本机服务，用于练出冠军 AI。
- 规则的玩家向说明在对局页第三个 tab「📖 规则说明」，三张表由 `js/ui/rules-panel.js` 现读引擎常量渲染。

## 快速开始

1. 双击 `index.html`。默认「**3 人 · 3 血** + 普通难度」直接开打：点技能出招，所有席位同时行动，回合日志逐条结算；技能按钮按当前资源实时置灰（ジ/珠不足或条件不满足直接不可点）。
2. 想打练出来的 AI：双击 `tools/start-train-server.cmd` 启动训练服务 → 训练场点「开始训练(Node服务)」→ 页面自动连接并显示进度 → 训练完自动写入内置包并载入内存 → 对局难度切到「困难 · 冠军」。
3. 冠军策略可「导出 JSON」分享，也可「导入」别人的冠军。

> 本机包（`localStorage['epirus.champion']` = 2P ‖ `['epirus.champion3p']` = 多人）**优先于冠军池**；本机包在场时冠军池整桌不生效（判定只在 `js/ui/ui.js` 的 `poolPlan` 一处）。想打「每席随机抽一枚冠军」的桌子，先清掉本机包。

## 功能

### 对局

- 人数 2~5 × 血量 3/4/5 两根独立轴；30 张卡中 27 张可用，另 3 张为多人专用（双枪射手 / 镜面反射 / 全息屏障），**当前存活人数 ≤2 时自动置灰**。
- 难度三档：**简单 · 陪练** ‖ **普通**（默认）‖ **困难 · 冠军**。档表唯一来源是 `js/train/bots.js` 的 `DIFF_TIERS`，页面下拉由它生成。每档有两个正交维度：
  ① **探索剂量**（ε / epsK / 前几回合斜坡，形状统一由 `tierEps` 决定）；
  ② **桌上是谁**：AI 席逐席各抽一枚冠军（多人池 `js/bundled-champion-pool.js` ‖ 2P 原生池 `js/bundled-champion-pool-2p.js`），允许重复、不许整桌同枚；装配与降级规则见 [`docs/POOL-CONTRACT.md`](docs/POOL-CONTRACT.md)。
- 简单档与普通档在此基础上按桌概率掺脚本席：简单档 `p=0.7`、逐席最多 2 席（`st:mix` + `st:toolkit`）；普通档 `p=0.1`、逐席最多 1 席（`st:toolkit`）。推导只在 `js/pool-draw.js` 的 `scriptSeats` 一处。
- 脚本人格共 6 个（`EpirusBots.STYLES`）；其中「杂货铺」带一条显式计划层（攒钱 / 连开聚能环 / 挑目标的大雷 / 贴贴窗口 / 过载炮花费 / 避雷针看威胁）。
- HP（含 0.5 血）、ジ、电/爆能量珠、地雷/符咒/挑衅/梦魇/回魂等状态全部可见；技能按钮悬停显示手势与说明。
- 「悔一步」可退回本回合开始前（每局限用一次）；可导出对局记录。

### 训练场

- 轻量对抗自对战（类 GAN 的对抗思想，无 AI 框架）：候选策略群每代与「当前冠军 + 脚本基准群」对战打分。基准名单两处真源：2P 侧 `js/train/evo.js` 的 `buildOpps`（1 枚冠军 + 19 条脚本基准），多人侧 `server/opp-pool.mjs` 的 `OPP_SPECS`（默认取前 9 条，其余是专项压迫线，只在显式实验里按名字加入）。
- 精英保留 + 变异/交叉繁殖；适应度 = 胜负 + 换血 + 拖时长惩罚 + 出招多样性（熵）奖励。
- **冠军按真实胜率挑选**：任一基准不高于 50% 直接失去资格（纯平局 0.5 也不过门），过门后按 `0.5×平均 + 0.5×最差对局` 排序；另有一层「不回归」：把现有冠军已过的基准打回 ≤50% 的候选一律不许当选。
- 训练跑在 Node 多核并行（`worker_threads`）；页面 SSE 实时进度 + 多条种子曲线。
- 多种子 × 多轮 + 种子谱系：轮末保留前 ⌈√n⌉ 名作父代，再按名次分配 n 个新种子；「从头训练」只在第一轮清空旧冠军。
- 导出训练 CSV 为标准长表：`round,global_gen,gen,seed_id,parent_seed_id,best,baseline,champAge,champChanged,sigma`，行序 `[round] → [seed_id] → [gen]`。

### 规则完整性

- **蓄能珠只供下一回合**：蓄能获得的能量珠仅可在下一回合使用，该回合结束未用即清空；同回合重复蓄能只刷新、不叠加。
- 27 个可用技能 + 4 个隐藏技能（铁索连环 / 吸血鬼公爵 / 回魂 / 梦魇——结算触发，不是可点的卡）全部实现。
- 多人（3~5 人）另有双枪射手（两个目标）、镜面反射、隐藏技能聚光炮 / 反复横跳 / 合二为一，以及淘汰后自动观战。6 人以上引擎支持任意 N，但性能与平衡未测。

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
│   │   ├─ policy.js               策略网络 + 状态特征（FEAT_S=213 / v7）
│   │   ├─ evo.js                  对抗进化 + 冠军出牌口径（policyChooserN / pickChampion）
│   │   ├─ bots.js                 脚本基准 AI 与难度阶梯（DIFF_TIERS 是档位表唯一来源）
│   │   └─ trainer.js              冠军存取（localStorage / 导入导出）+ 训练 CSV
│   ├─ ui/                       界面（ui.js 交互主逻辑 / skill-tip.js / rules-panel.js / bead-choice.js）
│   ├─ champion-pack.js          冠军包读写协议（导入 / 导出 / 校验）
│   ├─ pool-draw.js              冠军池抽签与装配（byTier / compose / scriptSeats）
│   ├─ bundled-champion.js       2 人内置冠军
│   ├─ bundled-champion-3p.js    多人内置冠军（池不生效时的回退包）
│   ├─ bundled-champion-pool.js     多人冠军池 bundle（真源 champion-map/pool-members.tsv）
│   └─ bundled-champion-pool-2p.js  2P 原生冠军池 bundle（真源 pool-members-2p.tsv）
├─ server/                       可选训练服务（Node，内置 http / worker_threads / vm）
│   ├─ train-server.mjs            SSE 实时进度：/train /champion /reset
│   ├─ paralleltrain.mjs           worker_threads 多核并行评估池
│   ├─ train-worker.mjs            单 worker 评估入口
│   └─ opp-pool.mjs / opp-champs.mjs   对手池 + 「名字→包」唯一入口
├─ tools/                        量具与门禁（每个 .mjs 都自带头注；这里只列入口）
│   ├─ gate-all.mjs                ★ 一条命令跑完五道门禁（np + spec 并发，浏览器三道随后）‖ --group= 只跑一组 ‖ --auto 按 git status 判断该跑哪几组
│   ├─ np-test.mjs                 ★ 门禁 runner（注册 / 过滤 / 计数 / 收尾；门体不在这个文件里）‖ --group= 累计深度 / --part= 互不相交分区
│   ├─ gates/                      全部门体（按语义族分成若干部分文件；段名与条数现读 `node tools/np-test.mjs --list-parts --json`）
│   ├─ gate-parts-check.mjs        并集守卫：所有段拼回来必须正好等于全量
│   ├─ spec-run.mjs                2 人引擎自测 + 500 局 fuzz
│   ├─ smoke.mjs / battle-test.mjs / np-probe.mjs   CDP 真 Chrome 三台页面仪器
│   ├─ train-3p.mjs / train-best.mjs / train-fast.mjs   训练入口（多人 / 2 人多种子择优 / 快速）
│   ├─ build-pool-bundle.mjs       把池真源烘成页面用的 bundle（派生物不许手改）
│   ├─ eval-5p.mjs / eval-3p.mjs   产品考卷（5 人 / 3 人）
│   ├─ promote-champion.mjs        换包前体检（可行性闸 + G4/G5 + 珠经济闭环；--dry 只体检不写盘）
│   ├─ log-behavior.mjs            真机栏：按席位统计实机对局记录（只读 results/*.txt）
│   ├─ score13.mjs                 13 行「无短板」判语器（伤/平/墙/架/还/座/广/场B/G4/G5/珍/珠/强）
│   ├─ train-selftest.mjs          训练侧自检（回执往返 / 出厂默认清单 / econ 往返）
│   └─ start-train-server.cmd      双击启动训练服务
├─ champion-map/                 冠军演化图 / 谱系图（产物只有 index.html）
│   ├─ index.html                  ★ 产物（自包含、双击即开；由 viewer.mjs 烘，不许手改）
│   ├─ viewer.mjs                  ★ 烘页面那台：四个视图 + 页内自检
│   ├─ shot.mjs                    无头复验（截图 / --dump 打逐条自检结果）
│   ├─ coords.tsv                  ★ 面板：一行 = 一份权重
│   ├─ lineage.tsv                   谱系图底表（由 lineage.mjs 现算）
│   ├─ pool-members.tsv / -2p.tsv    ★ 冠军池真源（页面 bundle 由它烘）
│   └─ rebuild-coords.mjs            ★ 一条命令重算面板（几何 → Hp → path → dup → 投影 → 盖档 → 折行 → 身份 → kin）
├─ tests/spec.html               引擎自测（浏览器打开即可）
├─ docs/                         长期文档 + 研究流水（两层的规矩见 docs/README.md）
│   ├─ RULES-2P.md / RULES-NP.md     ★ 规则裁定版（R1..R61 + 子证 ‖ N1..N27）—— 要改规则先改这里
│   ├─ POOL-CONTRACT.md              ★ 冠军池契约（装配语义 / 抽签 / 降级）
│   ├─ METHODOLOGY.md                ★ 方法学与口径陷阱
│   ├─ GATE-SHIFTS.md                ★ 班次 → 该跑哪几组门禁
│   └─ research/                     研究流水：logs / handoff / reviews / archive
├─ results/                      用户私人对局记录（不进仓库）
└─ .github/workflows/            CI：gates（plan → 按 --list-parts 现读的 part 矩阵并行 → 聚合判定）‖ pages（白名单发布）
```

## 规则裁定说明

原规则面对真人手势对局，存在若干未写死的细节（判定概率、蓄能珠时效、避雷针反噬归属、天火窗口等）。`docs/RULES-2P.md` 以 **R1..R61 裁决编号 + 子证** 逐条拍板，`docs/RULES-NP.md` 以 **N1..N27** 覆盖多人；引擎代码注释与之一一对应，`tests/spec.js` 覆盖主要裁定。**改规则先改文档再改代码。**

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
node tools/train-selftest.mjs                # 训练侧三条凭据
```

⚠ `--group=` / `--part=` / `--only=` 跑出来的都不是整轮认证（工具会自己印「只跑了 N / M 条」）；收工前那一遍要整轮。

## 训练（Node 并行）

```bash
node tools/train-fast.mjs 500    # 快速 500 代（产物落 docs/artifacts/train-fast-out.js；EPIRUS_PUBLISH=1 才写 js/bundled-champion.js）
node tools/train-best.mjs 4 600  # 4 个候选择优（推荐）
node tools/train-3p.mjs 60 5 24 24   # 多人：代数 / 人数 / 种群 / 每体局数（用法见 --help）
```

- 评测口径与实战一致：`js/core/play.js` 的 `autoGame` 中双方都基于「行动前状态」决策。
- 绝不空放：`autoGame` 对任何脚本/AI 返回的「买不起或条件不满足」的招一律兜底改按ジ（`policy.js` 另给了 `lastSkill` 的显式「上一招无效」特征）。
- 连招反制训练：池内 `combocounter` 脚本会读对手最近 5 次出招并选克制技，模拟正常对局里被针对的局面；游戏内不再另做运行时连招防护，困难档直接用冠军策略。

## 已知限制

### 档位读数口径

**5 人桌 · 每局 1 席人类形状原型（轮座）+ 4 席按该档的带逐席抽**（允许重复、禁四席全同；与页面同一份 `js/pool-draw.js`）；普通档每席先按 0.5/0.5 掷 hard/soft 再带内均匀取一枚。每局一个新盐。出手只数 `action/ok`，分母 = 4 个 AI 席的成功出手（含ジ）。尺 = `docs/debug/tier-census.mjs`，读数 = 80 局/格 × 6 seed × 6 人类原型 = 2880 局/档（三档共 8640 局）。

| 档位 | 带 | 掺脚本席 | 均回合 | AI 出手/局 | 种类 | 前 3 | G | 防御类 | 脚本席出手占 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **简单 · 陪练** `lv:sparring` | soft 16 枚 | p=0.7 / 逐席最多 2 席（`st:mix` + `st:toolkit`） | 19.1 | 55.1 | **30** | 72.5% | **6.01** | 14.2% | **48.0%** |
| **普通** `lv:regular` | 两带加权 hard/soft | p=0.1 / 逐席最多 1 席（`st:toolkit`） | 20.2 | 56.2 | **30** | 75.5% | **5.03** | 8.2% | 8.2% |
| **困难 · 冠军** `lv:hard` | hard 带（13 枚） | 不掺 | 20.4 | 56.4 | **26** | 75.8% | 4.73 | 7.1% | — |

带内枚数现读 `champion-map/pool-members.tsv`。台阶（8 seed × 1000 局逐局配对，n=5）：multi 简单−普通 +1.08±0.43（2.5σ）、普通−困难 +2.08±0.41（5.1σ）；long +1.35±0.36、+2.30±0.47。跨批漂移约 1pt ⇒ 幅度 <1pt 的行只当批条件读数。判宽度用普查的 `perGameKinds`（逐局），不要用并集种类。

**2 人桌**（hard 5 ‖ soft 4，soft 里 2 枚跨人数邀请；普通档按带加权）：台阶 multi 14.36 / 21.18 / 27.11，long 17.78 / 23.55 / 28.69（两级台阶 ≥10σ）。谱（2880 局/档/模式）：

| 档 | 带（枚数） | 种类 m‖l | 前 3 m‖l | G m‖l | 防御类 m‖l | 均回合 m‖l |
| --- | --- | --- | --- | --- | --- | --- |
| 简单 `lv:sparring` | soft 4（2 原生 + 2 跨人数邀请；ε=0.2） | 18‖20 | 74.6%‖76.7% | 5.10‖4.81 | 21.8%‖18.1% | 16.0‖27.0 |
| 普通 `lv:regular` | 两带加权 9 枚（ε=0.1 斜坡） | 22‖23 | 81.6%‖81.1% | 4.41‖4.47 | 12.8%‖13.8% | 15.9‖33.2 |
| 困难 `lv:hard` | hard 5（ε=0 ⇒ 每手最优） | 14‖15 | 85.4%‖81.5% | 4.05‖4.42 | 10.4%‖15.2% | 16.3‖42.2 |

口径三条：① 简单档的谱是「脚本席 + soft 池」的混合谱，卡表 30 张全部出现过；② 2 人桌困难档仍是 ε=0，谱最窄是产品事实；③ 单枚成员的谱不代表任何一档，单枚请用 `tools/usage-probe.mjs` 并标明它不是档位读数。

### 两张贵卡（大雷 / 摄魂）

- 大雷在任何剂量与机制下都不赚钱（最温和的软档仍 −1.0 ~ −1.6pt）。
- 摄魂只在「自己 HP≤1 且 3 血桌」这一格为正（+1.39±0.26；换一批桌子 +1.26）；为此换代动 `policy.js`（规则指纹 + 两槽重测）当前不值，概率下界从 0.6 抬到 1.0 只多 +0.18pt。
- 现值只有一处来源：`js/train/evo.js` 的 `BIGT_PUSH = 12` ‖ `DRAIN_PUSH = 1`（0 = 关）。读常数读不出剂量——玩家实际多久见一次按档位装配量：池装配下大雷 简单 0.11 / 普通 0.43 / 困难 0.21 张/局，摄魂 0.15 / 0.13 / 0.09 张/局（5 人 3 血，2880 局/档）。

### 三个未修的洞

1. **对开环的人零反应**：对手连开聚能环时冠军不惩罚（训练池里没有环流对手；环在 3 血赛程里回不了本）。简单档的脚本席自己会连开环，但这一格判的是冠军。
2. **贴贴 × 天火在 3 血下算术锁死**：冠军会互相贴符咒但从不引爆；池装配下贴贴 简单 0.58 / 普通 0 / 困难 0 次/局，天火 简单 0.03 / 普通 0 / 困难 0 ⇒ 冠军席连铺符都不发生。
3. **原型制御墙只能靠地雷/转移绕过**：冠军是硬打过去，不是会用解法（候选里从未进过前 3）。这条不是训练调参能补的，是否为此改动产品待定。

### 引用这节的数字之前

- 量档位只有一条路：按档位装配量（`docs/debug/tier-census.mjs`）；单枚镜像（`tools/usage-probe.mjs`）只回答「这枚包想用什么」。
- 演化图的壳量的是投影空间（`viewer.mjs` 在 t-SNE 面板上用的是投影坐标 `xt3/yt3/zt3`），不是行为轴；壳的判据是「这一片里过线的占多数吗」，不是「这一枚过不过线」。
- 真机栏 `results/` 不带档位标注，`tools/log-behavior.mjs` 量的是「玩家实际遇到什么」；模拟档位 / 单枚镜像 / 真机三者只许并排读，不许相减。

## 免责声明

游戏规则（CC BY-NC-SA）版权归国际拍手游戏规则制定协会；本实现仅供学习交流，请遵守当地法律与游玩场合礼仪。
