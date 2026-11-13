# 拍手游戏 Epirus — 2–8 人 × 3/4/5 血 对战（网页）

依据国际拍手游戏规则制定协会的规则（[原仓库 Lion-LiHaoyi/Epirus](https://github.com/Lion-LiHaoyi/Epirus)，规则文档 v2.1.0）实现的网页版：2–8 人对局 + 可选的自训练冠军 AI。

> **当前版本：v2.0.7** · 人数 2–8 × 血量 3/4/5 两根独立轴 · 全人数共用同一套分级冠军池（2.0 包版本 `v:92` ‖ arch `S1o` ‖ `obs3b` / `obs5`），单包回退使用 `v7` 容器（`FEAT_S=213` ‖ 5689 参数）
> 规则见 [`docs/RULES-2P.md`](docs/RULES-2P.md) / [`docs/RULES-NP.md`](docs/RULES-NP.md)；版本历史与实验记录见 [`CHANGELOG.md`](CHANGELOG.md) 与 `docs/research/`。

- **游戏部分零依赖、纯静态**：双击 `index.html` 即可游玩（推荐 Chrome / Edge），不需要安装、不需要联网。
- **在线版**：<https://lion-li-git.github.io/Epirus-Web/>（发布白名单 `index.html ‖ css/ ‖ js/ ‖ champion-map/`；`docs/` `tools/` `training/` 不发布）。在线只能对局与看冠军演化图；**「训练」需要另起本机服务**。
- **训练部分可选**：通过 `training/` 脚本或只用 Node 内置模块（`http` / `worker_threads` / `vm`）的本机服务训练冠军 AI。
- 规则的玩家向说明在对局页第三个 tab「📖 规则说明」，由 `js/ui/rules-panel.js` 现读引擎常量渲染。

## 快速开始

1. 双击 `index.html`。默认「**3 人 · 3 血** + 普通难度」直接开打：点技能出招，所有席位同时行动，回合日志逐条结算；技能按钮按当前资源实时置灰（ジ/珠不足或条件不满足不可点）。
2. 想自训 AI：运行 `training/train-3p.mjs`（2.0 `obs5` 主线）或双击 `training/start-train-server.cmd` 在页内「训练场」连接 `v7` 本机服务。
3. 冠军策略可「导出 JSON」分享，也可「导入」别人的冠军包。

> 本机包（`localStorage['epirus.champion']` = 2P ‖ `['epirus.champion3p']` = 多人）**优先于冠军池**；本机包在场时冠军池整桌不生效（判定只在 `js/ui/ui.js` 的 `poolPlan` 一处）。想打「每席随机抽一枚冠军」的桌子，先清空本机包。

## 功能

### 对局

- **人数与血量正交**：支持 2–8 人 × 3/4/5 血（4 血多一格血，5 血 = 长程，回合上限更长并进入终局收缩）；30 张卡中 27 张全人数可用，另 3 张为多人专用（双枪射手 / 镜面反射 / 全息屏障），**当前存活人数 ≤2 时自动置灰**。导入的 **`v7` 旧包限定 2–5 人**（`js/ui/ui.js` 的 `V7_MAX_PLAYERS`），6–8 人桌只由 2.0 池装配。
- **难度三档**：**简单 · 陪练** ‖ **普通**（默认）‖ **困难 · 冠军**。档位表唯一来源是 `js/train/bots.js` 的 `DIFF_TIERS`，下拉由它生成，包含两个维度：
  ① **探索剂量**（`eps` / `epsK` / 前几回合斜坡，形状统一由 `tierEps` 决定）；
  ② **桌上是谁**：2–8 人统一从 `js/bundled-champion-pool.js` 逐席抽取对应带位成员（允许同席型重复、不许整桌全同；装配与降级规则见 [`docs/POOL-CONTRACT.md`](docs/POOL-CONTRACT.md)）。
- **脚本掺席与风格**：简单档按桌概率掺脚本席（`p=0.7`、逐席最多 2 席：`st:mix` + `st:toolkit`）；普通档 `p=0.1`、逐席最多 1 席（`st:toolkit`），推导仅在 `js/pool-draw.js` 的 `scriptSeats` 一处。脚本风格共 6 种（`EpirusBots.STYLES`），其中「杂货铺」带显式计划层。
- **对局信息与辅助**：HP（含 0.5 血）、ジ、电/爆能量珠、地雷/符咒/挑衅/梦魇/回魂等持续状态全部可见；技能按钮悬停显示手势与说明；支持每局一次「悔一步」与导出对局记录。

### 训练场

- 对抗自对战进化（无第三方 AI 框架）：候选策略群每代与「当前冠军 + 脚本基准群」对战打分，基准定义在 `js/train/evo.js` 的 `buildOpps` 与 `training/server/opp-pool.mjs` 的 `OPP_SPECS`。
- 精英保留 + 段感知变异/交叉繁殖；结合胜负、换血、拖时长惩罚与出招多样性（熵）综合评估，并通过独立重测门限择优防回归。
- 运行在 Node `worker_threads` 多核并行池，页内训练场支持 SSE 实时进度、多种子/多轮谱系展示及标准长表 CSV 导出。

### 规则与结算机制

- **优先级与声明/结算区分**：管线按 `5 → 4 → 3 → 2 → 1 → 0` 逐层结算（大雷、攻击交锋、激光眼破防按层入口快照判定）；`地雷` 声明与武装在 `pri 3`、引爆结算在 `pri 0` 最末；`转移伤害` 声明在 `pri 3`、覆盖窗口 `3–1`；`镜面反射` 在 `pri 3` 声明，生效后完整按所复制技能的优先级与全部规则结算。
- **回合末统一判定死亡**：同回合内只要行动合法且未被小雷/大雷/反制/相抵无效化，不因中途先被击倒而作废出手；`净化`（`pri 1`）晚于 `天火`（`pri 3`）出伤，但移除符咒带来的回血若使 `HP > 0` 可救回同回合致命伤。
- **蓄能珠时效**：蓄能获得的电/爆能量珠仅可供下一回合使用，该回合结束未用即清空；同回合重复蓄能只刷新不叠加。
- **隐藏技能与多人机制**：2 人/多人隐藏技能（铁索连环 / 吸血鬼公爵 / 回魂 / 梦魇 / 反复横跳 / 聚光炮 / 合二为一）全部实现，淘汰后自动进入观战直至终局。

## 目录结构

每行只列路径与当前职责；细节见 [`docs/README.md`](docs/README.md) 与 `training/README.md`。

```
Epirus-Web/
├─ index.html                    ← 双击即玩（唯一入口；游戏部分零依赖、纯静态）
├─ css/style.css                 样式
├─ js/                           运行时代码（浏览器脚本，无构建步骤）
│   ├─ core/                     规则引擎（改这里须先改 docs/RULES-*.md）
│   │   ├─ rules.js                技能 / 分类 / 模式数据
│   │   ├─ state.js                状态结构与出招合法性（费用 / 禁用 / 条件；无贷款）
│   │   ├─ resolve.js              回合结算（优先级管线 / 镜面 / 防御矩阵 / 地雷 / 转移 / 隐藏技能）
│   │   └─ play.js                 对局驱动（自动对局 / 合法出招 / 兜底）
│   ├─ train/                    AI 与训练器
│   │   ├─ policy.js               v7 策略网络 + 状态特征（FEAT_S=213 ‖ 5689 参数）
│   │   ├─ policy2.js              2.0 网络（`v:92` ‖ arch `S1o` ‖ obs3b/obs4/obs5）解码与校验
│   │   ├─ evo.js                  对抗进化 + 在线推理与探索层（浏览器与 Node 沙箱共用）
│   │   ├─ bots.js                 脚本基准 AI 与难度阶梯（DIFF_TIERS 唯一来源）
│   │   └─ trainer.js              冠军存取（localStorage / 导入导出）+ 训练 CSV
│   ├─ ui/                       界面（ui.js / skill-tip.js / rules-panel.js / bead-choice.js）
│   ├─ champion-pack.js          冠军包读写协议（导入 / 导出 / 校验）
│   ├─ pool-draw.js              冠军池抽签与装配（byTier / compose / scriptSeats）
│   ├─ bundled-champion.js       2 人内置单包冠军（池失效时回退）
│   ├─ bundled-champion-3p.js    多人内置单包冠军（池失效时回退）
│   └─ bundled-champion-pool.js  全人数统一冠军池 bundle（真源 champion-map/data/page/pool-members.tsv）
├─ training/                     训练侧独立子仓（入口 / 服务 / 旋钮真源；产品侧零依赖）
│   ├─ knobs.mjs                   旋钮单一真源生成器（--check 拦截未登记/无注解键）
│   ├─ TRAINING-KNOBS.md           旋钮唯一配置真源手册
│   ├─ train-3p.mjs                2.0 GA 训练主入口（多人/混合桌）‖ train-best / train-fast（v7 2P）‖ train-selftest
│   ├─ start-train-server.cmd      一键启动页面本地训练服务
│   ├─ server/                     训练服务 + 并行 worker + 对手池 + 旋钮来源表
│   └─ proto2/                     2.0 网络与训练栈（arch2 与 js/train/policy2.js 为双胞胎实现）
├─ tools/                        量具与门禁
│   ├─ gate-all.mjs                五道门禁总入口（--auto 按 git status 选组 ‖ --np 全量认证）
│   ├─ np-test.mjs                 门禁 runner（门体按语义族位于 tools/gates/）
│   ├─ spec-run.mjs                核心规则单元测试 + 500 局 fuzz
│   ├─ smoke.mjs / battle-test.mjs / np-probe.mjs   CDP 真 Chrome 页面验证仪器
│   ├─ build-pool-bundle.mjs       把 pool-members.tsv 烘成 js/bundled-champion-pool.js
│   ├─ exam-4n.mjs / eval-5p.mjs / eval-3p.mjs      A/B/C 与分桌考卷评测
│   ├─ promote-champion.mjs        入池/换包体检与写入工具
│   └─ score13.mjs / log-behavior.mjs               多维判语与真机对局统计
├─ champion-map/                 冠军演化图 / 谱系图（单页自包含可视化）
│   ├─ index.html                  ★ 产物（双击打开；由 viewer.mjs 烘焙，不许手改）
│   ├─ viewer.mjs                  ★ 生成器与 99 项页内自检（tree / 1d / 3db / 3d / map）
│   ├─ rebuild-map.mjs             一键重算编译并烘焙 index.html
│   ├─ shot.mjs                    无头 Chrome 截图与自检跑手（--hash=... --dump）
│   ├─ data/                       数据模型真源（registry / batches / rulers / readings / projections / page/pool-members.tsv）
│   ├─ pipeline/                   build-view / backfill / validate / measure-point / add-point
│   └─ pool-members-2p.tsv         2P 训练对手名册（已退役出页面池，仅作训练对照池）
├─ tests/spec.html               规则自测网页入口（对应 tests/spec.js）
├─ docs/                         长期文档与研究归档（约定见 docs/README.md）
│   ├─ RULES-2P.md / RULES-NP.md     ★ 规则裁定正文（R1..R70 ‖ N1..N28）—— 改规则先改这里
│   ├─ POOL-CONTRACT.md              ★ 冠军池抽签与降级契约
│   ├─ METHODOLOGY.md                ★ 评测方法学与口径规范
│   ├─ GATE-SHIFTS.md                ★ 门禁分组表
│   └─ research/                     交接状态、发现记录与待办（如 TODO-2026-11-13-repo-audit.md）
├─ results/                      个人对局记录（不入仓）
└─ .github/workflows/            CI（gates.yml ‖ pages.yml）
```

## 规则裁定说明

原线下规则存在若干未写死的细节（判定概率、蓄能珠时效、避雷针均分、镜面执行、回合末死亡判定、净化顺序、天火条件等）。[`docs/RULES-2P.md`](docs/RULES-2P.md) 以 **R1–R70**、[`docs/RULES-NP.md`](docs/RULES-NP.md) 以 **N1–N28** 逐条裁定，引擎注释与之一一对应，`tests/spec.js` 与 `tools/gates/engine-rules.mjs` 负责守门。**改规则先改文档再改代码。**

## 自测与门禁

```bash
node tools/gate-all.mjs --auto   # 日常提交前：按 git status 自动判定门禁分组
node tools/gate-all.mjs --np     # 整轮五道全量认证（np + spec + smoke + battle + map）
node tools/np-test.mjs --list-parts --json   # 列出全部门禁分区
node tools/np-test.mjs --only=D193           # 按名称子串复跑单条门
node tools/spec-run.mjs                      # 核心规则用例与 fuzz
node champion-map/shot.mjs "--hash=mode=map&check=1" --dump   # 演化页自检（可换 tree/1d/3db/3d/map）
node training/train-selftest.mjs             # 训练侧凭据自检
```

⚠ `--group=` / `--part=` / `--only=` 只作局部排查，不构成整轮认证；完整校验以 `gate-all.mjs --auto` 或 `--np` 为准。

## 训练

### 入口

```bash
# 2.0 多人/混合桌 GA 主入口（参数与配方旋钮见 training/TRAINING-KNOBS.md）
node training/train-3p.mjs 200 5 24 8

# 旧版 v7 2P 快速训练
node training/train-fast.mjs 500
node training/train-best.mjs 4 600
```

- **真实评测口径**：`js/core/play.js` 的 `autoGame` 中各方均基于行动前状态同时决策；任何非法或买不起的动作兜底为 ジ。
- **全部旋钮定义与缺省值**：一律以 [`training/TRAINING-KNOBS.md`](training/TRAINING-KNOBS.md) 为单一真源，可用 `node training/knobs.mjs --check` 校验新鲜度。

### 2.0 网络家族（`v:92`）

| 观测面 | 特征维 | 参数量 | 聚合方式 | 当前用途 |
|---|---:|---:|---|---|
| `v7` | 213 | 5689 | 4 槽 + 单标量头 | 旧线单包回退、`2–5` 人页内训练服务 |
| `obs3b` | 415 | 7993 | `h_self ‖ mean(对手) ‖ max(对手)` | 现役冠军池成员主力 |
| `obs5` | 292 | 12393 | 1 层自注意力 + PMA 4 seed | 当前训练产线与池内成员（置换不变、跨 `2–8` 人） |

浏览器推理侧 `js/train/policy2.js` 与训练侧 `training/proto2/arch2.mjs` 保持双胞胎同步，结构按段名检索；可通过 `training/proto2/browser-parity.mjs` 验证逐位 logits 对齐。

### 选拔主尺（A / B / C）

- **A 轴**：脚本考卷，衡量对脚本组合的稳定压制能力；
- **B 轴**：现役冠军夹具对局，衡量对会还手的真实冠军策略的强度；
- **C 轴**：`C = (A + B) / 2`，覆盖 `2P / 3P / 5P / 8P` 与 `multi / long` 双桌形。

## 当前已知限制

- **页内训练服务仍接旧 `v7`**：页面「训练场」与 `training/server/train-server.mjs` 仅支持 `2–5` 人 `v7` 训练，尚未接入 `2.0 / obs5`（`2–8` 人）产线。
- **`v7` 导入旧包限 `2–5` 人**：旧版 `v7` 策略在 `6–8` 人桌被 `V7_MAX_PLAYERS = 5` 锁定禁用，`6–8` 人局只由 `2.0` 冠军池或 `2.0` 策略装配。
- **蓄能选珠由界面层代行**：当前网络动作输出不含电珠/爆珠选择，`js/ui/bead-choice.js` 按手头持珠差值交替决定。
- **新规则 `120fca4d` 下的冠军池复检待完成**：核心战斗规则重构后，[pool-members.tsv](champion-map/data/page/pool-members.tsv) 的 `seatKill` 统计、反单一脚本（如 `reflectspam`）抗性及 30 卡覆盖度待按 [`docs/research/TODO-2026-11-13-repo-audit.md`](docs/research/TODO-2026-11-13-repo-audit.md) 重测收口。
- **启发式先验与旋钮债务**：推理层 `js/train/evo.js` 仍包含若干部署先验开关（如 `BIGT_PUSH` / `DRAIN_PUSH` / `SUPPORT_PRIOR`），训练环境变量总量亦尚在向 KPI `≤ 40` 压减中。
- **多把评测尺不可混减**：按档位装配量、单枚镜像探测与 `results/` 真机日志三者分母与采样对象不同，只可并排对照。

## 免责声明

游戏规则（CC BY-NC-SA）版权归国际拍手游戏规则制定协会；本实现仅供学习交流，请遵守当地法律与游玩场合礼仪。
