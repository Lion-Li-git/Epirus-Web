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

### 下一格（未做）

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
