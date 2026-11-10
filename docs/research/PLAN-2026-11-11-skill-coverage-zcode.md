# 研究计划 · 2026-11-11 深夜（ZCode）——obs5 入池的技能覆盖路线

> 用户令（01:3x）：「后面有空可以多跑一些研究，单包基础可用之后就可以研究不同技能的覆盖。反正时间还早，
> 要把池换成 obs5 只靠一两个包是不够的。」
> 数据：`scratch/zcode-1111-coverage/cov-{s916,msb,ref}.tsv`（29 包 × 30 局 × long，card-usage）。

## 一、覆盖矩阵结论（谁会什么）

**obs5 世代（S916R2B 12 枚 + MSB/OBS5 9 枚）的谱：** ji 38-65% 压倒，gun 7-48%，snipe 0.4-24%，
sword 0.1-12.5%，**guard 0-2%（冠军线）**、bagua 0-4%、reflect 0-5%、defShare 多数 0-11%。

**obs3b 现池（要被替换的）的谱：** G5J-50 9 卡 defShare 41%（reflect 23/guard 16/sword 13）、
G5C-100 10 卡（railgun 3.6/charge 6）、CTRL2 10 卡 defShare 45%（reflect 37/bigT 2.5）、
WSEL9（bagua 11/gun 13）、KDG-B（sword 17/guard 10.7）。

**obs5 种群的洞（obs3b 池有而 obs5 没有的）：**

| 技能 | obs5 现状 | obs3b 参照 | 定向素材 |
|---|---|---|---|
| **bigT（大雷）** | **0%（全种群）** | CTRL2 2.5% | BIGCARD_W 奖励 + 8P 桌（地雷在 8P 高性价比——MIX8 注释在册） |
| **holo（摄魂）** | ≈0%（≤0.6%） | CTRL2 1.3% | HPSEED 残血开局 + CTRL2 课程 |
| **railgun（轨道炮）** | **0%** | G5C 3.6% | STYLE_TABLE=railgun FRAC=0.3 + G5C 课程 |
| **ring（聚能环）** | **0%** | Q-s47 0.6%（v7） | RING_W 奖励（无 v92 示范包，纯奖励探针） |
| **guard（防御）** | 0-2%（F 线 11%、KDO5C 9% 例外） | G5J 16% | GUARD_HIT_W + KDG-B 课程 |
| **sword** | 0.1-12.5% | KDG-B 17% | STYLE_TABLE=sword + KDG-B 课程 |
| **bagua** | 0-4% | WSEL9 11% | WSEL9 课程 |
| **reflect** | 0-5%（冠军 5-12%） | G5J 23% / CTRL2 37% | REFLECT_W + G5J 课程 |

**defShare（防御占比）是结构性的洞**：obs5 冠军线 0-11% vs obs3b 池 17-45%——只换包不补防御，
池的整体防御性格会塌。

## 一′、合同口径基线（01:5x 重测，multi/60/镜像 5P = POOL-CONTRACT v2.1 的尺）

| 包 | 用卡 | 三件全开（guard/reflect/bagua） | 防御总占比 | 对 v2.1 判据 |
|---|---:|---|---:|---|
| S916R2B 冠军 | 7 | guard 1 ✓ / reflect 6 ✓ / bagua 4 ✓ | 11% ✓ | 用卡 <9 ✗ ⇒ 2/3 |
| S916R2B-S2000717743 | 8 | guard 0 ✗ | 3% ✗ | 0/3 |
| S916R2B-S1408282248 | 7 | guard 0 ✗ | 5% ✗ | 0/3 |
| OBS5-F-s41 | 5 | 无 bagua/reflect | 12% ✓ | 1/3 |
| KDO5C（种子） | 6 | 10/8/9 全 ✓ | 27% ✓ | 用卡 ✗ |
| **v7 参照（线来源）** | **11/10/9** | 全开 | 32/7/33% | — |

**合同尺上的主缺口 = 用卡数（obs5 群 5-8 vs 线 9）**；三件全开与防御占比冠军线已过。
⇒ MSB8 定向轮的验收翻译：**steering 要把 distinct 抬到 ≥9 且 C 不塌**——8 个定向技能
（bigT/holo/railgun/ring/guard/sword/bagua/reflect+charge）每吸收 1-2 张就是 +1 用卡。

`cov-contract.tsv`（本尺）与 `cov-{s916,msb,ref}.tsv`（long/30 普查尺）**是两把尺**，引用时注明。

## 二、MSB8 定向轮设计（每技能一臂，cohort 研究）

驱动器机制：branches 共享一份配方 ⇒ 每技能一个**独立驱动器**（--branches=1 --arm=MSB8-<技能>，
state/log 天然分家），8 个并行；起点 = 当时的 C 冠军；base=501..508；rounds=1 × 200 代；
配方 = `--recipe=rotation-obs5` + 每臂技能覆盖 env（表如上）；臂自带 triplet 台账，轮末自动 C 重测。

判读（cohort 不是选拔）：
- 每臂出包后跑 card-usage——**定向技能的使用率是否从 0 抬起来**（steering 有效性的直接读数）；
- C 是否保住（margin 换代照常）——steering 的代价读数；
- 有效的方向（技能抬升且 C 不塌）进 round 2 / 进 recipes；无效的写死否证。

## 三、obs5 入池的路线图（本研究的终点）

1. **单包基础可用** ✓（S916R2B-R1S685223462：C 0.0668、用卡 7、防御 10%——差 0.079 一步）
2. **覆盖补洞**：MSB8 cohort（本计划）→ 期望产出 4-6 枚"各守一个技能"的 C 合格包
3. **种群成型**：冠军线（S916 系）+ 定向包 + 多样性互测（池内 H2H）⇒ 8-12 枚的候选池
4. **正式入池**：按 POOL-CONTRACT 的门（可行性/12 线/卡谱）走 promote 流程——那是白天班的事，
   本夜只交 cohort 与读数。
   ⚠ **12 线闸的校准问题（02:0x 实测）**：score13 对现冠军判 **0/13 绿**（红：座/伤/平/架/白防/还/广/墙/场B/强，
   G4/G5/珠量具没给）——而 11-08 裁定「进池最多缺一个门」+ 11-09「场B 降记录项」。现役池 23 枚自己也没量过 12 线
   （合同 §池 v2 第 2④ 条原文承认）⇒ **线的现实档位没人知道**。obs5 换池前必须先给现役池量一遍 12 线做基线，
   否则"最多缺一个门"是句没法执行的空话。这需要用户裁（量哪些、容忍几个），白天班提案。

## 四、与 B 轴研究的合流

定向包的课程席素材（G5J/G5C/KDG-B/CTRL2/WSEL9）本身就是 FINDING §五 说的"好考卷辅助训练"——
冠军桌夹具滚动制落地后，这批定向包反过来成为**下一版 B 夹具的候选对手席**（obs5 自己的反墙/防御包
顶掉 Q-s47 锚的那天，就是 B 夹具纯 2.0 化的节点）。
