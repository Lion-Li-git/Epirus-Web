# 交接 · 2026-11-11 夜班 → 早班（ZCode，00:0x–09:00，分支 feat/obs4）

> 用户令（00:0x，五条）：①训练场 tab 不能独立开训练 ⇒ **把实际用于训练的东西搬进 training/，浏览器留调用接线**
> ②开训练尽量**提高性能利用** ③**中途节点保存**等提效率 ④重构完**改主 README 目录** ⑤好包出来**尽早重测 B 轴 + 评分再调整**（图上刷分夸张没法看）。做到早上九点。
> 前置：夜计划 v2（`PLAN-2026-11-10-night2-zcode.md`）已获批；本班 = v2 地基批 + 上述五条的执行。

## 一、完成清单（按提交序）

| 提交 | 内容 | 验证 |
|---|---|---|
| `8f55eb03` | SELF_ENV_KEYS **+68 条补登记**（在用未登记 68→0；37 条有单一来源表管辖不计）‖ 生成器判据修正（单一来源表=有家）‖ exam-4n 夹具登记表补 2.0 现役四包 ‖ **B 轴代表重测 24 跑入库** | train-3p 语法 ✓；重测确定性对账逐位过 |
| `5e4fae23` | **训练侧独立子仓落地**：server/ 全部 11 件 → `training/server/`（产品零 import）‖ tools/{train-3p,best,fast,selftest,start-train-server.cmd} → `training/` ‖ tools/proto2 → `training/proto2/` ‖ knob-registry → `training/knobs.mjs` + TRAINING-KNOBS.md 迁址 ‖ 路径修补 107 文件组 + round2 ‖ CI 加 `training/knobs.mjs --check` ‖ **AGENTS.md 铁律 v1** | train-3p 1 代真跑通（band-save/终评/E589 全工作）；exam-4n 链路通；旋钮册 245/223/未登记 0 与搬家前逐位同 |
| （门钉批） | 门体四条源码钉跟上：D116/D124（import 串）/D125（readdirSync server）/D228⑧（spawn 计数正则） | ship-feas 14/14 · ship-promote 20/20 |
| （D158 批） | probe-instruments 的 readKeysOf entry 钉跟上 | 33/33 |
| （UI 批） | index.html ×3 + ui.js ×2 启动器指向 → training/ | ui-contract 8/8 |
| （README 批） | 主 README 目录结构 server/→training/ 块 + 训练命令路径 + 主尺段补 11-11 重测注 ‖ **training/README.md v1**（结构/边界表/流程速查）‖ recipes/ 占位 ‖ pages.yml 注释 | — |
| （registry 批） | **旋钮册第五入口（promote-champion）**：NO_*/GAMES 体检族 12 根从"暗键误判"转正在用（注解入 SELF_ENV_KEYS）‖ 在用 223→235 ‖ 暗键 21→9 | knobs --check ✓ |
| （stale 批） | scratch/{gen1-tree(1417),hc3(244),preDispatch(228),mutgrid(10)} = tools 旧副本 **1899 文件 git rm**（v2 计划已授权面；零活代码引用，仅史册三处提及） | grep 核查在案 |
| （仪器批） | exam-4n-full **行补 pool 戳（真 bug：19 格对 20 列表头，历史批表 sec 全串进 pool 列）**+ 新增 champ 夹具列 ‖ exam4-attach 加夹具校卫 | node --check + smoke |

门禁状态：11 个 part 里 9 个已本机复绿（meta-repo 13/13、probe-libs 4/4、ship-promote 20/20、ship-feas 14/14、meta-lint 3/3、probe-instruments 33/33、ship-pool 1/1、ship-artifact 1/1、ui-contract 8/8）；engine-rules/engine-fuzz 未跑（只读 js/core 与 tests，未动）。

## 二、B 轴重测（用户令⑤的主交付）

全文见 **`FINDING-2026-11-11-baxis-rebretest-zcode.md`**（数据 `scratch/zcode-1111-bretest/b-retest.tsv`）。三条结论：

1. **obs5 冠军链在冠军桌真实负**（MSB2-R1 最好情形 −0.089 含自打；G5J-50 同桌 +0.54）——A 轴选拔 ≠ 冠军桌强度，玻璃炮判定坐实。
2. **夹具双向扭曲**：旧夹具 2P 高估农夫型；现役夹具（含玻璃炮）3P+ 反而抬所有老包。**换夹具本身也会刷分** ⇒ 滚动夹具 + champ 戳入表 + 换夹具换列族要三件一起做。
3. 图顶 C（G5J/G5C 0.7-0.8）= 旧夹具 + 可farm A 轴叠加的历史格局；obs5 链根本不在图上。

已落地：champ 列 + attach 校卫（上表仪器批）。**未落地（下一班）**：夹具滚动制、B 轴 --dose=exam 对照、msbatch2 measure() 跟随当期夹具。

## 三、在飞：MSB6（01:04 发射）

```
node scratch/night-adapt2/msbatch2.mjs --base=401 --start=docs/artifacts/night-adapt/S916R2B-R1S685223462.js \
  --rounds=2 --branches=8 --gens=200 --arm=MSB6 --margin=0.03
```

- **起点 = S916R2B-R1S685223462（C 0.0668）**——千问 11-10 傍晚 8 臂轮换的终局冠军，**当前 C 尺最强**（MSB4 0.029 < 它；MSB2-R1 的 +0.2925 是 A 尺读数，C≈0）。选它不选 MSB2-R1 是按 D-33 主尺口径。
- 配方 = S916 同款纯轮换（RECIPE_ENV 未动）+ **`EPIRUS_HOLDOUT_SEG=50`（新开的中途节点）**；判据：换代 margin 0.03（C 尺），验收线沿用 **C ≥0.079 且用卡 ≥4、防御 ≥5%**。
- 日志 `scratch/night-adapt2/msbatch2.log`；**断点**：`--resume` 读 `msbatch2-state.json`（每轮收尾写；臂内更细恢复用 `<ARM>-seg<k>.bak` 快照热启动）。
- 预计 02:2x 收 2 轮；若第 1 轮就出 C≥0.079 的臂，按 margin 换代后第 2 轮继续。
- **起点验收基线（01:2x 实测，card-usage 40 局 long）**：现冠军 S916R2B-R1S685223462 **用卡 7（≥4 ✓）、防御 10%（≥5 ✓）**、谱 ji53/gun25/snipe10/reflect6/bagua4/guard1/sword1——千问 ADAPT-DEF 种子已治好玻璃炮；验收线只差 C 0.0668→0.079。

### 在飞追加：MSB7（01:12 发射，B 线课程轮）

```
MSB_COURSE_PACK=scratch/ds-1109/G5J-50.js  MSB_FIT_CHAMP=scratch/ds-1109/G5C-100.js  MSB_FIT_EVERY=2 \nnode scratch/night-adapt2/msbatch2.mjs --base=451 --start=docs/artifacts/night-adapt/S916R2B-R1S685223462.js --rounds=2 --branches=4 --gens=200 --arm=MSB7 --margin=0.03
```

- 问题 = FINDING §五：把冠军桌最强（G5J-50 C 尺 +0.54）放上课程席、G5C-100 上 fitness 席——「对着验收标准训」能否比纯轮换更快抬 C。两枚 G5 都是 v92（obs3b），policyChooserN 直接收。
- 对照组就是 MSB6（同起点、同预算、纯轮换）——两轮同飞天然成对。
- msbatch2 的 state/summary 已按 ARM 分家（msbatch2-<ARM>-state.json），两个驱动器并行互不踩；启动配方已打进日志。
- 判读：同 margin 换代；若 MSB7 的 C 明显高于 MSB8 同位臂 ⇒ 课程方向有效，写进 recipes。

## 四、性能与效率（用户令②③的交付）

- **臂并行本来就有**（Promise.all；千问的 S916R2B 已跑过 12 臂并发）——18 核的吞吐瓶颈在**轮末重测**：4 包×2 尺串行 ≈8min/轮 ⇒ 本次改并发 ≈2min。
- **中途节点**：`EPIRUS_HOLDOUT_SEG=50` 进 RECIPE_ENV（每 50 代快照当代最优粒，当场落盘——11-03 已修过"只攒内存"的蒸发坑）。
- **断点续跑**：`--resume`（state 形状逐字校验，换参拒绝——种子流会错位）。
- 指南：18 核 branches ≤8（留核给重测的并发 exam-4n）。臂内 GA 单线程化是下一个大杠杆（worker 化 fitness），工程量大，未动，见 §五.3。

## 五、下一班事项（按序）

1. **MSB6 收尾判读**：轮链/换代记录在 msbatch2.log + state.json；过 0.079 线的臂跑 `tools/card-usage.mjs` + 防御探针核验收线；达标包走 triplet 台账 + C 三列同看再谈进池。
2. **B 夹具滚动制落地**（FINDING §四.2-4）：定「当期 C 前三 + 反墙锚」名单机制 + 列族策略；这是**在册尺变更，动手前把方案给用户点头**。
3. **evo.js 产品面/训练面物理拆分**（已研究未执行）：
   - 事实：4279 行单闭包 IIFE；产品真调的全局只有 ~8 个（pickChampion/correctedWinRate/mulberry32/setSupportPrior*/setBeliefSearch*/wrapBigTPush），Node 训练沙箱按文本装载同一文件；产品依赖训练侧的模拟核（oneGame），训练侧的奖励计数器又被 oneGameN 调用——**拆分必须经全局对象回呼重接 ~200 个调用点**。
   - **钉面实测（01:2x）**：门体对 js/train/evo.js 的源码钉共 18 处 / 8 个部分文件（_ctx 沙箱清单 + meta-repo×4 + engine-rules×2 + engine-fuzz×1 + ship-promote×2 + ship-feas×3 + probe-libs×2 + ui-contract×2 + np-test 分类），其中相当一部分钉的是训练机器内部函数（trainChooser / mirrorHealth / epsMode soft 档）——正是要搬走的段落 ⇒ 拆分总成本 = ~200 调用点重接 + 18 处门钉逐条跟上，估 3-5 小时高风险。
   - 建议：先做「读集收缩」版——evo.js 保持单文件，但把 GA 机器（makeTrainer/step/finishStep/evalN/奖励 setter 族）标记为训练区段并从浏览器侧的死代码里确认无人调用（ui.js 已确认 0 处 makeTrainer/step）；物理拆分等有整段白班再做，拆完必须过 smoke+battle+ui-contract 三道。
4. **旋钮 Tier2**：暗键剩 9 根（BATCH_MAX/CHROME/DEBUG_CDP/INSTR/REPO = 浏览器仪器家；SELF_TEACHER/TEACHER_GATE* = supfit-gd 一次性研究脚本家）——处置=物理删 supfit-gd 族或把 supfit-gd 转正为入口，先给方案再动。Tier1（单入口下放）与 recipes 机制照 v2 计划。
5. **门禁分家**（v2 §三）：产品 CI 不跑训练门禁——paths 过滤 + workflow_dispatch 手动档；np 并集守卫同步。
6. stale 副本已删 1899 文件；scratch 其余为现役实验区，不清理。

## 六、注意事项（给下一班的钉子）

- **历史批表（exam4-*-1110.tsv 等）sec 列在 pool 列名下**——exam-4n-full 的老 bug，本次修的是新表；引用旧表 pool 列时记得它其实是 sec。
- exam4-attach 的 champ 校卫对**旧表**（无 champ 列）只点名不拦——旧表混夹具风险要人肉看。
- `training/knobs.mjs --check` 已进 CI；**改 env 读取或注解必须重生成册随改动提交**，否则 CI 红（这是故意的）。
- promote-champion 现在是旋钮册第五入口：给它加旋钮同样要走 SELF_ENV_KEYS 注解（AGENTS.md 铁律 1）。
- MSB6 若中途被杀：`--resume` 原样重启（base/start/形状不能变）；臂级 seg 快照在 `docs/artifacts/<ARM>-seg<k>.bak`（BAND_DIR 缺省=docs/artifacts 根，不在 night-adapt/；01:2x 实测 MSB6/MSB7 各臂 seg1-2 已在落）。
- B 重测的 N 夹具读数**不是**新在册尺——图上 P2B 还是旧夹具；对比新旧夹具读数时引用 FINDING 的表，别直接改图。
- 时间线：本班实际开工 00:07；用户 00:0x 下令；全文书提交在 00:3x 前，搬家批 00:4x，性能批 01:0x，MSB6 01:04 发射。
