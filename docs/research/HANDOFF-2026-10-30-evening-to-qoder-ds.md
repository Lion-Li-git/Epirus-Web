# 交班：10-30 晚（DS → 千问）

> 分支 `research/champion-2.0-repr-2026-10-28`（**144 ahead / 1 behind** main；behind = ZCode 的 K2 确认 `1cb94f4b`，推前先 merge）。
> `js/**` 今天**零改动**；`scratch/` 未入库；`results/` 被 gitignore。
> 白天那份在 `HANDOFF-2026-10-30-to-qoder-ds.md`；本文是**晚上这一段**（18:40–19:35）的成果与待办。

## 一、一句话

**代 2 冷启动链条打通了**：`random → CEM48(12k) → CEM48b(24k) → CEM48c(24k)`，约 **84k 局 / 23 分钟**，
产出两枚**同尺超过 v7** 的代 2 包（s7 夺1 **61.4%**、clean **0.415**；v7 是 42.0% / 0.101），
代价是单卡升到 62%（s11 的 28% 是唯一形状好的）。**下一步 = 形状第四轮 + 产品接线。**

## 二、链条读数（strat=mild，40 局/桌形、最佳温度）

| 阶段 | 地图 | 训练期夺1 | CLI 夺1 | CLI clean | agree | 单卡 |
|---|---|---:|---:|---:|---:|---|
| 随机起点 | — | 11.8~12.3% | 12.3% | −0.356 | 93~97% | — |
| CEM48（12k，random 起） | s7/s11/s13 | 20.5% | 20.0% | −0.190 | 27.3% | reflect 24% |
| CEM48b（24k，从 CEM48-s13） | 3 粒全过 | 29.5% | 30.7% | −0.025 | 11.1% | reflect 38% |
| **CEM48c（24k，从 CEM48b-s13）** | s7 | 54.1% | **61.4%** | **0.415** | **5.6%** | gun 62% |
| | s11 | 55.0% | **54.5%** | **0.292** | 9.7% | snipe 28% |
| | s13 | 36.8% | 34.5% | 0.043 | 9.7% | gun 82% |
| v7 参照 | — | — | 42.0% | 0.101 | 5~7% | — |

## 三、泛化检查（同尺、换场；CEM48c）

| 场 | s7 | s11 | s13 | v7 |
|---|---:|---:|---:|---:|
| mild（训练场）clean / 夺1 | **0.415 / 61.4%** | 0.292 / 54.5% | 0.043 / 34.5% | 0.101 / 42.0% |
| **full（强场）** | **0.635 / 75.9%** | 0.216 / 51.4% | −0.132 / 21.4% | −0.012 / 30.0% |
| 平均场（无 strat） | 0.243 / 48.2% | — | — | 0.204 / 49.1% |

⇒ 不是"只在训练场强"；但 **full 场那格是单批读数，未复核**（见 P1）。

## 四、为什么能成（机制，和白天失败的对照）

1. **优化器换 CEM**（池均值/协方差重拟合）：单桌运气被池均值抹平——白天 ESA pop14 三粒 agree 69~95% 全平、Δ+0.007~+0.012；
2. **pop 14→48**：§E818 的单调杠杆（夺1 随 pop 28.4→47.4%）；
3. **fxGames 16 + 预算 12k/24k**：注意与千问 §七·六补"fx 交换率负"不矛盾——他那批是**固定 6k** 预算、pop 小；这里是**预算与种群一起放大**，176 局/验证才不亏；
4. **链条 > 单轮**：每轮从上一轮最好粒热启动，24k/轮；单轮 12k 只到 20%；
5. **冷启动确实可行**（用户裁定"没有起点就从头开始"）：四段共 ~84k 局。

## 五、代码/开关（今天新增，全部默认关或向后兼容）

- `probe-cem-arm` meta 新增 **`lineage`**：`parent / parentHash / outHash / gen / seed / recipe`（供演化图）；
- `arena2` 新增 **`scoreFirst` / `cur=first`**（夺1 货币）；`probe --arenaCur=first`（地板按 firstScore）；
- 形状族（白天）：`--arenaShapeCap/ShapeTemp/ShapeGames/DefCap/JiCap`、`--arenaShapePick`、`--arenaWarmShape/WarmTol`、`--arenaShapeRel*`、`--arenaPerN`；
- 估时模型（`ESTIMATES-2026-10-30-ds.md`）：`T ≈ 3 + Σ(2 + 局数/1000 × a) + 15×包数`，a=4.6（ESA）/ 4.1（CEM）。

## 六、待办（按顺序，判据先写死）

**P0 形状第四轮（我建议先做，est ≈6 min）**
- 起点 `scratch/arms/CEM48c-s7.bak`（夺1 61.4、clean 0.415、gun 62%）；
- `--mode=cem --pop=48 --fxGames=16 --targetGames=24000 --arenaShapeCap=0.45`（或 `--arenaShapePick=1`）；
- 判据：夺1 ≥55%、clean ≥0.30、**单卡 ≤45%**（2/3 过即可）、agree <60% 3/3。

**P1 复核 full 场（est ≈2 min）**
- s7 的 full 0.635/75.9 用 40 局/桌形 + 另一批种子重跑；若成立，记"跨场强"；若不成立，写明"mild 场专用"。

**P2 多种子扩批（est ≈12 min）**
- CEM48c 只 3 粒，s13 掉队（34.5/0.043）；跑 6~9 粒，统计分布；决定是否"每轮取 top-2 续训"（现在是单起点链）。

**P3 产品接线（需用户点头；`js/**` 改动）**
- `v:91` 解码分支、池契约（成员 path 必须在 `git ls-files`）、`np-test` 产品门；代 2 包现在用户看不见。

**P4 代 2 判语器**
- `score13.mjs` / `promote-champion --dry` 目前按 v7 包写，需确认能否吃 v:91；若不能，先做"代 2 版 12 行 + 行为表"判语。

**P5 演化图**
- `lineage` 已全；写一个脚本读 `scratch/arms/*.meta.json` 的 `parent/outHash/seed/recipe`，画树/时间线（含代 1 史前段：`results/` 与旧 docs）。

## 七、坑与纪律（今天踩过的）

1. **跑批时不要改共享模块**：我在 CEM48c 前改 `arena2` 把 `G2c-s13` 崩了（后来补跑）；改完 `node --check` 再发批；
2. **估时用模型**，先量一臂；我之前 5 批估计偏高 2.2~4.7 倍（`ESTIMATES-2026-10-30-ds.md`）；
3. **代 1 包被代闸拒读**（`packCfgExit` 报"这是代 1 的产物"）——这是设计，数据留着做演化图史前段；
4. **夺1 货币单独用会掉**（24k：夺1 15.9/11.8/10.9、clean −0.24~−0.32）——别当主货币，需要时用双键（夺1 第一、clean 第二）；
5. **CEM48 的"每轮 24k"是链条的一部分**，不要拿单轮 12k 的读数直接比 v7（总预算不同）；
6. **full 场 0.635 未复核**，别先写进结论；
7. 加"只选择不约束"的开关必须 md5 自证（白天 `--arenaShapePick` 假执行就是 md5 抓到的）。

## 八、文件清单

- **结果/预登记**：`PREREG-2026-10-30-CEM48-ds.md`、`RESULTS-2026-10-30-CEM48-ds.md`、`PREREG/RESULTS-...-CEM48-R2-ds.md`、`PREREG/RESULTS-...-CEM48-R3-ds.md`、`PREREG/RESULTS-2026-10-30-FIRST-ds.md`、`PREREG-2026-10-30-WARM-ds.md`、`PREREG/RESULTS-2026-10-30-PICK*.md`、`PREREG/RESULTS-2026-10-30-SHAPECAP*.md`、`PREREG/RESULTS-2026-10-30-PERN-ds.md`、`ESTIMATES-2026-10-30-ds.md`；
- **产物**：`scratch/arms/CEM48*-s{7,11,13}.bak`（+meta/log）、`scratch/CLIS-CEM48*.json`、`scratch/CLIS-FULL-*.json`；
- **白天交班**：`HANDOFF-2026-10-30-to-qoder-ds.md`。
