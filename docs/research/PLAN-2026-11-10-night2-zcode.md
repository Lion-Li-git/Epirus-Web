# 夜计划 v2 · 2026-11-10 深夜（ZCode 班）——训练侧独立子仓 + 旋钮爆破

> 用户令（23:4x/23:5x）：①先推（✓）②席位配比放开重点看效果 ③问题集中在训练侧膨胀
> ④**一大目标：整理整个仓库，所有接线旋钮明确；训练侧单独开文件夹（类似 champion-map），自己的 README
> 和门禁放进去，产品侧不跑训练门禁；不注重兼容性（个人仓库，重点在以后）；无用的旋钮要么合并要么删**
> ⑤评审 Gemini 重构建议，先改计划不动工。
> v1 计划（A 整理/B 效果双线）作废重写——Gemini 建议 + 独立子仓裁定改变了 A 线的形状与 B 线的时序。
> 开工前已做（如实）：推日班 5 笔 ✓ ‖ knob-registry 生成器首跑 ✓（245/223 在用/21 暗键）‖ 计划文书提交 ✓。

## 一、Gemini 建议评审（逐条裁定，带仓内事实）

| Gemini 提案 | 裁定 | 事实修正 |
|---|---|---|
| 铁律写进 AGENTS.md（旋钮冻结/加一删二/禁静默兜底/授权破坏性替换） | **采纳** | 仓里没有 AGENTS.md；30 天 +106 根旋钮就是无铁律的结果。落点：根 `AGENTS.md`（agent 面向）+ `training/README.md` 引用 |
| 禁 `env \|\| 默认` 静默兜底 | **采纳但收窄** | `\|\| 默认` 是旋钮契约本身（默认值≠兜底）；禁的是**错误吞咽与 fallback 链**（`--mode=` 空值解析成 mode=1 那个形状），缺关键配置必须 fail-fast |
| 禁向后兼容，破坏性替换 | **采纳，加一条实验例外** | 在跑的对照实验**两侧不删**（obs4 对照面留到判定归档；EXAM_POOL v1 已退役可直接删）——否则是删自己的对照组 |
| 195 个单入口旋钮全部下放为局部常量 | **修正为按使用证据分三档** | 单入口≠无用：KILL_REWARD/COUNTER_OPPS/WIDTH_W 等只被 train-3p 读但是现役实验面（轮换驱动器就在 set）。分档判据 = 近期启动器 set + 接力文档引用 + 提交时间（见 §四） |
| 41 个 SEL_* 全部裁撤 | **修正为证据裁撤** | SEL_COUNTER 在现役配方里（今晚 6 臂都在用）⇒ 预计裁 2/3、留现役；默认关 + 无 set + 无引用的连分支代码物理删 |
| 121 份手抄 env → 单一配置/Schema | **采纳（"集中可调"的正解）** | `training/recipes/*.mjs` 命名配方；启动器只传 `--recipe=名`；121 份多为一次性夜臂，死启动器顺手删 |
| KPI = 负 LOC（245→<30） | **采纳，目标定为 ≤40** | 40 = Tier0 现役面清单；删除行 > 新增行；每批提交附前→后计数（生成器 stdout 即计数器） |
| 砍看门工具自我繁衍 | **采纳且自我适用** | 今晚我写的 knob-registry + 千问 census + knob-guard 三件重叠 ⇒ **census 删（registry 吸收）、registry 是唯一治理件、knob-guard 只留运行时库职责**（enforceKnobs 是 train-server 的运行时代码）；**不做 doc-structure-guard** |
| 文档 SSOT 四删三 | **修正范围** | **旋钮/配置事实**唯一真源 = `training/TRAINING-KNOBS.md`（其余文档的参数表物理删除改指针）；HANDOFF/LIVE-LINES 是接力体制的史册/看板——保留，但配置陈述只许引用不许复抄 |

## 二、目标结构：training/ 独立子仓（类似 champion-map）

```
training/
  README.md            ← 训练侧 README（结构/流程/门禁/旋钮册指针/孪生账/铁律引用）
  knobs.mjs            ← 旋钮生成器+--check（自 tools/knob-registry.mjs 迁入）
  TRAINING-KNOBS.md    ← 生成册（唯一配置真源）
  recipes/*.mjs        ← 命名配方（新建机制，替代手抄 env）
  gates/               ← 训练侧门禁（从 np 体系分家，见 §三）
  proto2/              ← 2.0 研究栈（自 tools/proto2 迁入）
  train-3p.mjs 等      ← 训练入口（自 tools/ 迁入）
  server/              ← 2P 训练服务（自 server/ 迁入）
```

**搬移风险表（逐项定案，执行分批）**：

| 资产 | 耦合面 | 裁定 |
|---|---|---|
| `js/train/*`（5 文件） | **浏览器 bundle 加载（训练场 tab 是产品 UI）+ D234 烘培输入** | **不搬**——搬=连 UI/烘培/D234 一起动，收益低风险高；README 记"js/train 是训练侧的产品面延伸" |
| `tools/proto2/*`（2.0 栈） | supfit/selftest3/门禁/驱动器引用 | 搬 `training/proto2/`（引用面可控：门禁文件+驱动器批量改路径） |
| `tools/train-{3p,best,fast}.mjs` | 121 启动器 + np 门体 | 搬 `training/`（启动器本就要被 recipes 淘汰） |
| `server/train-{server,worker}.mjs` | 2P 服务现役低频（最近实质改动 11-06） | 搬 `training/server/` |
| `scratch/{gen1-tree,hc3,preDispatch,mutgrid}` | 4 份 tools/ 旧副本 646 文件（grep 污染源） | 引用核查后 **git rm**（不可逆面已授权） |

## 三、门禁分家（产品侧不跑训练门禁）

- 现状：gates.yml 每 push 全跑 16 部件，train-runner(460s)+train-evo(275s)=78% 墙钟——产品推送在替训练实验买单。
- 目标：**产品门禁**（engine/spec/meta/ship/ui/probe）每 push 必跑；**训练门禁**（train-* 组）只对 `training/**`、`js/train/**` 变更跑（paths 过滤）+ workflow_dispatch 手动档。
- np 体系的并集守卫同步改造（部分文件搬家后名单来源跟着改）；**np 门体切片制本身的改革排最后**（它在承重，先分家再动制度）。

## 四、旋钮爆破分档（执行作业单）

| 档 | 判据 | 处置 | 预估 |
|---|---|---|---|
| Tier0 | 现役面：近 14 天配方/驱动器/接力文档引用 | 保留为 env，注解必填 | ~35-40 根 |
| Tier1 | 单入口读 + 30 天无 set + 无文档引用，但代码路径还活着 | 下放为 recipes 字段或模块内常量 | ~80-100 |
| Tier2 | 默认关 + 无 set + 无引用 + 与在跑实验无关（含 SEL_* 族 2/3） | **连分支代码物理删除** | ~60-80 |
| 暗键 21 | 四入口都不读 | 启动器核查后删 | 21 |
| KPI | env 总数 245→**≤40**；删除行 > 新增行；census 删除 | 每批提交附前→后计数 | — |

## 五、执行顺序（今晚只交本计划与地基件，爆破分批）

- **今晚剩余**：① 根 `AGENTS.md`（铁律）② `training/README.md` v1 + `training/TRAINING-KNOBS.md` 迁址 + CI --check 步骤改路径 ③ 39 条补登记（在新址做）④ stale 副本删除 ⑤ B 线冻结（见下）
- **下一批起**：proto2/train-* 搬家（门禁/驱动器路径同步）→ recipes 机制 → 旋钮三档爆破（每档一批，附计数）→ 门禁分家 → np 制度改革（最后）
- **B 线（objective 对齐 C）冻结到结构地基完成**：在旧路径上开新实验 = 实验引用刚搬走的文件；MSB5 的 2 冠军+2 脚本方向保留，判据不变（C ≥0.079 且用卡 ≥4、防御 ≥5%），在新结构 recipes 下开跑
- 红线沿用 v1（A/B/C 三列同看 / 不跑整轮门禁 / 不可逆面先提案）+ 新增：**铁律写进 AGENTS.md 后，本仓 agent 的旋钮新增违规由 --check 直接红**

## 六、判据与止损

- 整理批的验收 = 硬数字：env ≤40、暗键 0、census 已删、`training/` 自洽（README/门禁/旋钮册齐）、产品 CI 墙钟下降（16 部件 → 产品件）
- 止损：若搬家批门禁红连锁超过 2 小时修不完 ⇒ 回退该批（git revert 单批），拆小重排
- B 线止损沿用 DS 计划：判据不达 ⇒ 回滚 objective 转种子端，不再单旋钮微调
