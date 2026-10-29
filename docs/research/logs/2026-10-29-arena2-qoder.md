# 2026-10-29 夜：扩表 arena2 + 第一批臂（千问）

> 上一班（10-28 夜 → 10-29 傍晚）把「强度尺坏了」闭合到三条机制：0 费后手反弹 + 伤害归因 + 全灭按累计伤害判胜（段 29）。
> 用户 10-29 裁 **① 换/扩 arena**，然后「扩 arena 之后再训练一批试试」。
> 本文只回答三问：**扩表能不能把「只一招」从顶格拉下来？拿它当适应度训一批会怎样？旧 arena 的 +9.1pt 到底是什么？**
> 原件：`tools/proto2/arena2.mjs`（新）‖ `tools/probe-cem-arm.mjs`（`--arena2`）‖ `scratch/ARENA2-calib{8,40}.json` ‖ `scratch/arms/A2-s{7,11}.bak` ‖ `scratch/arms/OLD-s7-6k.bak` ‖ 日志 `scratch/A2-s7.log` / `scratch/A2-s11.log` / `scratch/OLD-s7-6k.log`。

## 一、先证明「只扩桌形不够」

三枚 scratch 探针（都不是新尺，只是设计前的对照）：

| 探针 | 格数 × 剂量 | 只反弹 | 参照 v7 | 结论 |
| --- | --- | --- | --- | --- |
| ① 单类对手桌（6 桌形 × 16 类） | 96 格 × 20 局 | 22.3% | 65.5% | 反射被压下去，但这是 **RPS 假象**：`只狙击` 61.0%、`只防御` 14.8%、v7 打「只枪」9%（2P 全是同归于尽平局）⇒ 单类桌只测「这类对手怕什么」，不是强度 |
| ② 混合池桌（10 桌形 × 8 旋转，旧 20 bot 表） | 80 格 × 10 局 | **56.0%** | **40.3%** | 只把人数/血量轴扩到 2/3/5/8/10 **不够**：反射仍高 15.7pt |
| ③ 混合池 + 11 枚单技能（20 bot + 11 固定，混合坐席） | 10 桌形 × 10 局 | **27.0%** | 37.0% | 扩**对手表**才把反射打下来；但新顶格变成 `drain 40.0%`（+3pt，剂量不足） |

⇒ 设计定稿：**扩的是两轴——对手表 + 桌形**；不采用单类桌（会读成 RPS），也不只扩桌形（反射仍顶）。

## 二、arena2 正式尺（`tools/proto2/arena2.mjs`）

- **对手表 51 项**：20 只脚本 bot（`buildPoolSeeded`，种子 20261029，与 profile2/ladder 同源，指纹 `cc652985/20`）+ 30 枚单技能固定打法（`R.skills`，与 ladder 逐字同一候选面 `candidatesFor`+`econBase`+`lastCancelOther`）+ 1 个均匀随机地板。
- **桌形 11 格**：n∈{2,3,5} × multi(hp3)/multi4(hp4)/long(hp5) = 9，加 n=8/10 × multi = 2。
- **坐席**：被测席 + 其余席按 `(局号, 席位, 桌形, 盐)` 确定性轮换对手 ⇒ 所有候选吃**同一批对手、同一批局号**（配对）。
- **货币**：每局 `净胜 = (wv − 1/n)/(1 − 1/n)`（胜 1 / 平 0.5 / 负 0）⇒ 2P 与 10P 可比、平局不冒充失败；同时打印**原始夺1**（与 ladder 同定义）、平局、干净胜（winner=我 且 hp>0）、单卡占比。
- **指纹**：`arena2.v1|pool=cc652985/20|poolSeed=20261029|shapes=…|roster=…`。
- **出生证明**（`--legacy-check=40`）：旧 ladder 16 格 × 40 局/格的 `只反弹` = **66.6%**，与在册 40 局/格 ≈66.6%、120 局/格 65.3% 对上 ⇒ 固定打法构造没有漂。

### 40 局/格标定（440 局/行，`scratch/ARENA2-calib40.json`）

| 行 | 夺1 | 干净胜 | 净胜 | 平局 | 单卡（非ジ） |
| --- | --- | --- | --- | --- | --- |
| 参照 v7 | 46.8% | 42.3% | 0.315 | 6.8% | gun 39.6% |
| **drain（顶格）** | **52.3%** | 52.0% | **0.399** | 5.7% | drain 100% |
| snipe | 47.0% | 46.4% | 0.266 | 2.3% | snipe 100% |
| sword | 42.7% | 38.6% | 0.241 | 2.3% | sword 100% |
| reflect（上代顶格） | **28.0%** | 25.5% | 0.155 | 27.7% | reflect 100% |

**判语 1**：扩表把上代 65.3% 的反弹压到 **28.0%**（−37.3pt）；但**顶格换成 drain 52.3% > v7 46.8%**（+5.5pt，440 局/行、SE≈2.4 ⇒ ≈1.6σ，不是铁证但点估计在参照之上）⇒ 按 `arenaGuardVerdict` 的旧定义，**这套 arena 仍然不能当强度尺**（红）。**干净胜口径也救不了**：drain 52.0 > v7 42.3。

## 三、第一批臂（用户「训一批试试」）

设置：ESA（(1+λ)-ES，pop 14，games=4，`sigmaAdaptive=1`，`fxSelect=1`、`fxGames=8`，`arenaHold=20`），起点都是 `P2-A1-fit2-S1o.bak`（闭式头），结构 S1o（`input=obs3`），`--targetGames=6000`；命令见 §五。

| 包 | 训练货币 | 夺1 | 净胜 | 平局 | 干净胜 | 单卡（非ジ） |
| --- | --- | --- | --- | --- | --- | --- |
| `A1` 起点（闭式头，未训） | — | 18.4% | −0.080 | 13.6% | 13.4% | reflect 26.2% |
| `A3-s7` 旧 arena 1500 局 | shaped fit | 23.4% | 0.084 | 27.5% | 22.0% | **reflect 60.2%** |
| `A3-s11` 旧 arena 1500 局 | shaped fit | 24.1% | 0.094 | 26.8% | 22.7% | **reflect 75.1%** |
| **`A2-s7` 扩表 6000 局** | **net** | **33.4%** | **0.146** | 12.0% | 23.4% | **reflect 69.1%** |
| **`A2-s11` 扩表 6000 局** | **net** | **29.5%** | **0.119** | 15.5% | 27.0% | **reflect 69.9%** |
| `OLD-s7-6k` 旧货币同 6000 局 | shaped fit | 17.7% | −0.002 | 25.7% | 16.1% | reflect 48.6% |
| 参照 v7 | — | 46.8% | 0.315 | 6.8% | 42.3% | gun 39.6% |
| `drain` 固定打法 | — | 52.3% | 0.399 | 5.7% | 52.0% | drain 100% |

（表内 6 枚 2.0 包均为 40 局/桌形 × 11 桌形 = 440 局；原件 `scratch/ARENA2-<包名>.json`。）

### 四条判语

1. **扩表货币确实买到了东西**：两粒种子相对 A1 的 raw 夺1 **+15.0 / +11.1pt**（SE≈2.4pt），净胜 **+0.226 / +0.199**；训练内 holdout（20 局/桌形）与外部 CLI（40 局/桌形）同向（0.144 / 0.103）。
2. **但两粒种子都退化成「只反弹」**：单卡占比 26.2% → **69.1% / 69.9%**；行为剖面是 `reflect 54.9~58.6% ‖ ji 16.2~20.6% ‖ bagua/jinshield/guard 余下`。它们学到的其实是**一枚更好的反弹包**，不是"会看局面"的包。且按净胜它 **0.146 仍略低于手写 reflect rung 的 0.155** ⇒ ES 连这枚退化打法都没超过。
3. **旧 arena 的 +9.1pt 被照出来了**：A3 两粒在旧尺上 29.2%，在扩表上只有 23.4/24.1%，**reflect 占非ジ 60.2/75.1%**；同预算旧货币对照 `OLD-s7-6k` 在扩表上只有 17.7% / −0.002（比 A1 还低）⇒ 旧尺的"进步"主要是**退化被读成了强度**，不是"多训了 4 倍局数"。
4. **2.0 仍远低于 v7**：最好 A2-s7 33.4% vs v7 46.8%（−13.4pt）；逐桌形看，2P/3P 也低于 v7（A2-s7 40.0/37.5/57.5 vs v7 60.0/75.0/62.5；只有 3:long 打平 45.0），8P/10P 是 12.5%/7.5% vs v7 的 20.0%/20.0%。⇒ 表示/训练还有空间，但**当前瓶颈已经不是"尺太窄"这一格**，而是**目标函数本身仍把反弹选出来**。

## 四、下一步（未做，等裁）

三条都在研究侧，**都不动 `js/core/**`**：

- **(a) 干净胜货币**：`净胜` 换成"只算 winner=我 且 hp>0"。40 局/格下干净胜排序：drain 52.0 > v7 42.3 > reflect 25.5；A2-s7 干净胜 23.4 < reflect rung 25.5 ⇒ 那枚退化解**不会被选中**。代价：drain/snipe 仍是单技能顶格，且干净胜仍是"单一技能就能赢"的尺。
- **(b) 多样性感知的当选**（Pareto/并列规则）：冻结验证里同时读净胜与单卡占比，**同分带内选单卡低的**（不是硬罚、不加门）。需要改 `probe-cem-arm` 的承兑那一步；与 10-25「单卡占比只记录不阻断」不冲突（那是产品门，这是训练选择）。
- **(c) 改判胜口径**（hp≤0 不许判胜 / 把反弹伤害从伤害归因剔掉）：**只在你点名时做**，因为它动 `js/core/resolve.js` 的计分。

我的建议：先跑 **(a) 与 (b) 各一粒种子的一变量对照**（同一 A1 起点、同 6000 局、同 temp），不要混在一起；判据仍是 arena2 的 raw/净胜/干净胜/单卡四项并排。若 (b) 能在净胜不掉超过 0.02 的前提下把 reflect 占比压到 <40%，再谈放量；否则说明"反弹是这套规则下的真局部最优"，该回到 (c) 或改规则。

⚠ 另记一条口径债：arena2 的 `maxCardShare` 仍按 **非ジ出手** 定义（与 `degeneracyVerdict` 同），所以 `drain`（大量ジ + 少量摄魂）会被读成 100% —— 它和"每回合都反弹"的 reflect 不是同一种退化。下一版若把单卡占比接进训练选择，需同时打印"非ジ手数"与"全部出手中的占比"，否则会把"只带一枚终结技"误判成"只会一招"。

## 五、原件与可复跑命令

```
# 尺 + 出生证明 + 30 枚固定打法标定（40 局/格 ≈ 52s）
node tools/proto2/arena2.mjs --legacy-check=40 --rungs=all --v7=1 --gamesPerShape=40 --json=scratch/ARENA2-calib40.json

# 扩表臂（种子 7 / 11，各 6000 局；落盘 scratch/arms/A2-s*.bak）
EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa --arena2=1 \
  --start=scratch/arms/P2-A1-fit2-S1o.bak --targetGames=6000 --games=4 --seed=7 --arenaHold=20 \
  --sigmaAdaptive=1 --fxSelect=1 --fxGames=8 --out=scratch/arms/A2-s7.bak

# 旧货币同预算对照（不设 --arena2，其余同 A3 的协议；落盘 scratch/arms/OLD-s7-6k.bak）
EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa \
  --start=scratch/arms/P2-A1-fit2-S1o.bak --targetGames=6000 --games=4 --seed=7 --playtemp=0.15 \
  --sigmaAdaptive=1 --out=scratch/arms/OLD-s7-6k.bak

# 包在同一把扩表上读数（40 局/桌形 = 440 局）
node tools/proto2/arena2.mjs --pack=scratch/arms/A2-s7.bak --gamesPerShape=40
```

- 工具：`tools/proto2/arena2.mjs`（19:59 落盘）‖ `tools/probe-cem-arm.mjs`（`--arena2/--arenaTemp/--arenaHold`，20:03 落盘）。
- 产物：`scratch/arms/A2-s7.bak`（20:04）‖ `A2-s11.bak`（20:05）‖ `OLD-s7-6k.bak`（20:05）；均未跟踪，可重跑。
- `js/**` 未动；没有新增门（arena2 的出生证明与接线自证是工具内自检，不是门禁）。

## 六、A/B 两条单变量臂（10-29 21:2x）：干净胜货币 ‖ 多样性当选

两条都从 `P2-A1-fit2-S1o` 起点、种子 7、6000 局、同一 temp/fxSelect/arena2 档；与已有 `A2-s7`（净胜货币、无多样性）只差一个变量。CLI 40 局/桌形 = 440 局/包；原件 `scratch/ARENA2-clean-*.json`。

| 包 | 货币/当选 | 夺1 | 净胜 | 干净净胜 | 干净胜 | 平局 | 单卡（非ジ） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 起点 | — | 18.4% | −0.080 | −0.269 | 13.4% | 13.6% | reflect 26.2% |
| A2-s7 基线 | net | 33.4% | 0.146 | −0.108 | 23.4% | 12.0% | reflect 69.1% |
| **CLEAN-s7 (a)** | clean | 33.0% | 0.075 | **+0.002** | **28.9%** | 1.8% | **guard 49.1%** |
| **DIV-s7 (b)** | net+div | **44.8%** | **0.281** | **0.096** | **36.4%** | 7.7% | **reflect 76.1%** |
| A3-s7（旧 arena） | shaped | 23.4% | 0.084 | −0.180 | 22.0% | 27.5% | reflect 60.2% |
| v7 参照 | — | 46.8% | 0.315 | 0.194 | 42.3% | 6.8% | gun 39.6% |
| drain 固定打法 | — | 52.3% | 0.399 | 0.334 | 52.0% | 7.0% | drain 100% |
| reflect 固定打法 | — | 28.0% | 0.155 | **−0.129** | 25.5% | 27.7% | reflect 100% |

### 判语

1. **干净胜货币把「反射通道」堵住了**：reflect rung 的干净净胜 = **−0.129**（低于机会线），它的净胜 +0.155 靠的正是 27.7% 平局/死者胜那一截；CLEAN-s7 的 reflect 只剩全部出手的 8.6%（单卡变 guard 49.1%），干净净胜从起点 −0.269 回到 **+0.002**、干净胜 13.4%→28.9%、平局 13.6%→1.8%。代价：净胜 0.146→0.075、raw 33.4%→33.0%（raw 在噪声内，净胜让了 0.071）⇒ 这是一笔**明码交换**，不是免费涨。
2. **多样性当选按 spec 没咬住**：(b) 只按多样性接受了 **1 次**（按净胜 10 次；探针 47 次），父代单卡终值 77.2%、reflect 76.1% ⇒ 未达到"reflect <40%"的预登记线。机制写清：触发只在父代 >0.5、带 ±0.02、每 10 个子代才探一次；净胜的严格改进每次都把父代推回反射。
3. **(b) 的副作用反而给出最强 2.0 包**：47 次探针 = 47 × 88 局额外冻结验证 ⇒ 接受次数从 3 提到 10，DIV-s7 夺1 **44.8%**、净胜 **0.281**、干净净胜 0.096，已接近 v7（46.8 / 0.315 / 0.194），但仍是 reflect 76% ⇒ **"多验"买到力量，"多样性"没买到形状**。
4. **clean 口径下顶格仍是 drain**：干净净胜 drain 0.334 > snipe 0.243 > v7 0.194 > sword 0.132 > reflect −0.129 ⇒ `arenaGuardVerdict` 在 clean 货币下也仍红；它只把"反射"这条通道关掉，没把"单技能"整族关掉。
5. 2.0 在干净净胜上的最好值是 DIV-s7 **0.096**，仍低于 v7 0.194 与 drain 0.334；CLEAN-s7 的 0.002 是**第一枚非负**的 2.0 包，但绝对高度还低。

### 组合的下一格（未做）

- **组合 (a)+(b)（推荐先跑）**：clean 货币 + 更强多样性（探针每 3 个 / 带 ±0.05 / 或罚项），起点换 `CLEAN-s7`，两粒种子；判据：干净净胜 ≥0.002、单卡 <60%、干净胜 ≥28.9%、reflect 占比 <40%。
- **单独强化 (b)**：`--divEvery=3 --divTol=0.05` 在 net 货币下重跑，先判"能否把 reflect 压到 <40% 而 net 掉 ≤0.02"；这是 (b) 的第二次机会。
- **规则侧**仍等点名（不动 `js/core` 就不做）。

## 七、A/B 可复跑命令

```
# (a) 干净胜货币
EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa --arena2=1 --arenaCur=clean \
  --start=scratch/arms/P2-A1-fit2-S1o.bak --targetGames=6000 --games=4 --seed=7 --arenaHold=20 \
  --sigmaAdaptive=1 --fxSelect=1 --fxGames=8 --out=scratch/arms/CLEAN-s7.bak

# (b) 净胜 + 同分带选单卡低的（Pareto；探针每 10 子代一次，带 ±0.02，单卡需降 ≥0.10）
EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa --arena2=1 --arenaCur=net --arenaDiverse=1 \
  --divEvery=10 --divTol=0.02 --divDelta=0.10 \
  --start=scratch/arms/P2-A1-fit2-S1o.bak --targetGames=6000 --games=4 --seed=7 --arenaHold=20 \
  --sigmaAdaptive=1 --fxSelect=1 --fxGames=8 --out=scratch/arms/DIV-s7.bak
```


## 八、组合 a+b（10-29 21:4x）：clean 货币 + 更强多样性

组合定义：`--arenaCur=clean --arenaDiverse=1 --divEvery=3 --divTol=0.02 --divTrigger=0.40`；其余与 A/B 同（A1 起点、种子 7/11、6000 局、arenaHold=20、fxSelect=1）。另跑二阶段对：从 `CLEAN-s7` 再训 6000 局，clean-only（`CLEAN2-s7`）与 clean+多样性（`COMBO2-s7`）。CLI 40 局/桌形 = 440 局/包；原件 `scratch/ARENA2-clean-COMBO*.json`。

| 包 | 起点 | 夺1 | 净胜 | 干净净胜 | 干净胜 | 平局 | 单卡（非ジ） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | — | 18.4% | −0.080 | −0.269 | 13.4% | 13.6% | reflect 26.2% |
| CLEAN-s7（a 单独） | A1 | 33.0% | 0.075 | 0.002 | 28.9% | 1.8% | guard 49.1% |
| **COMBO-s7（a+b）** | A1 | 33.4% | 0.086 | **0.057** | **32.5%** | 2.5% | **guard 25.4%** |
| **COMBO-s11（a+b）** | A1 | **40.9%** | **0.189** | **0.135** | **38.2%** | 2.0% | **gun 59.5%** |
| CLEAN2-s7（二阶段 clean-only） | CLEAN-s7 | 33.6% | 0.099 | 0.006 | 28.6% | 2.5% | reflect 33.6% |
| COMBO2-s7（二阶段 a+b） | CLEAN-s7 | 39.3% | 0.182 | 0.134 | 37.5% | 2.7% | **gun 78.4%** |
| v7 参照 | — | 46.8% | 0.315 | 0.194 | 42.3% | 6.8% | gun 39.6% |
| drain 固定打法 | — | 52.3% | 0.399 | 0.334 | 52.0% | 7.0% | drain 100% |
| reflect 固定打法 | — | 28.0% | 0.155 | −0.129 | 25.5% | 27.7% | reflect 100% |

### 组合的四条判语

1. **COMBO-s7 是四项全过的第一枚**：干净净胜 **0.057**（起点 −0.269）、干净胜 **32.5%**（CLEAN-s7 28.9%）、单卡 **guard 25.4%**、reflect 仅 0.9% 的全部出手。行为剖面 `ji 56.9% ‖ guard 10.9% ‖ transfer 10.2% ‖ taunt 9.9% ‖ curse 6.2%` —— 这是 2.0 里第一枚**真的在多技能上分布**的包，不是"换个单卡"。但它仍低于 v7（干净净胜 0.194 / 干净胜 42.3%）。
2. **COMBO-s11 是 2.0 最强、但压在单卡线上**：干净净胜 **0.135**、干净胜 38.2%、夺1 40.9%，逼近 v7（0.194 / 42.3 / 46.8）。单卡 **gun 59.5%（非ジ）**，比 60% 阈值低 0.5pt；而训练内 20 局/桌形读的是 **61.4%** ⇒ **同一枚包跨剂量能翻过线**，不要把它写成"非退化"。按全部出手它是 `ji 38.2 ‖ gun 36.7 ‖ reflect 12.5 ‖ guard 10.9`，不是"只会枪"。
3. **二阶段从 CLEAN-s7 再训会塌向 gun**：`COMBO2-s7` 干净净胜 0.134、干净胜 37.5%，但非ジ gun **78.4%**（全部出手 gun 42.4 + ji 45.9）⇒ 通过 `maxCard <60%` 的判据失败。同预算的 clean-only 对照 `CLEAN2-s7` 则是平台：干净净胜 0.002→0.006、干净胜 28.9→28.6（掉 0.3pt）⇒ **"多训 6000 局"本身没买到东西**，是多样性探针带来的额外冻结验证把它推向 gun。
4. **多样性规则本身仍没咬住**：COMBO-s7 探针 3 次、多样性接受 **0** 次（净胜接受 4 次）；COMBO-s11 探针 58 次、多样性接受 **1** 次。通过的种子靠的是 **clean 货币 + 额外冻结验证**（CLEAN-s7 只接受 2 次），不是 Pareto 带。原因：clean 货币把单卡压到触发阈以下（COMBO-s7 父代终值 25.3%），探针根本没机会；二阶段父代 49% 时探针开了，但 gun 的严格净胜改进每次都赢过多样性。
5. **高人数缺口还在**：COMBO-s7 2P/3P 强（57.5~67.5 / 35~40），5P 10~25，8P **7.5**，10P **2.5**；COMBO-s11 8P/10P **12.5 / 12.5**，仍低于 v7 的 20 / 20。⇒ 2.0 的表征/训练在 2~3 人已能打，8~10 人仍是短板。

### 下一格（未做）

1. **第三粒种子（13）+ 高剂量复核**：同一 A1 起点、同 6000 局、同组合参数，种子 13；并用 `--gamesPerShape=80` 复核 COMBO-s7 / COMBO-s11 的单卡（把 59.5/61.4 那条剂量歧义钉死）。若种子 13 也四项全过，才有资格说"组合配方稳定"。
2. **旧尺对照**：`profile2`（16 格 × 24 局）与 `matrix2`（36 格）跑 COMBO-s7 / COMBO-s11，给旧读数一个连续点（预期 profile2 的夺1 低于 arena2，因为旧尺奖励反射）。
3. 规则侧仍等点名。

## 九、组合臂可复跑命令

```
# A1 起点 + clean + 多样性（种子 7/11；本表用种子 7）
EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa --arena2=1 --arenaCur=clean \
  --arenaDiverse=1 --divEvery=3 --divTol=0.02 --divTrigger=0.40 \
  --start=scratch/arms/P2-A1-fit2-S1o.bak --targetGames=6000 --games=4 --seed=7 --arenaHold=20 \
  --sigmaAdaptive=1 --fxSelect=1 --fxGames=8 --out=scratch/arms/COMBO-s7.bak

# 二阶段（从 CLEAN-s7 再 6000 局）：clean-only 对照 / clean+多样性
EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa --arena2=1 --arenaCur=clean \
  --start=scratch/arms/CLEAN-s7.bak --targetGames=6000 --games=4 --seed=7 --arenaHold=20 \
  --sigmaAdaptive=1 --fxSelect=1 --fxGames=8 --out=scratch/arms/CLEAN2-s7.bak

EPIRUS_ARCH2=S1o:input=obs3 EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs --mode=esa --arena2=1 --arenaCur=clean \
  --arenaDiverse=1 --divEvery=3 --divTol=0.02 --divTrigger=0.40 \
  --start=scratch/arms/CLEAN-s7.bak --targetGames=6000 --games=4 --seed=7 --arenaHold=20 \
  --sigmaAdaptive=1 --fxSelect=1 --fxGames=8 --out=scratch/arms/COMBO2-s7.bak
```
