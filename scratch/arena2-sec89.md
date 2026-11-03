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

### 四条判语

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
