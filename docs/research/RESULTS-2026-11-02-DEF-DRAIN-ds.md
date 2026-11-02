# 结果：多血防御/残血摄魂奖励（DS · 2026-11-02）

> 预登记：`PREREG-2026-11-02-DEF-DRAIN-ds.md`。
> 用户口径：「残血不用防御是正常的（残血威胁低、打他浪费伤害）；**多血时要适度防御，残血要学会摄魂**」。
> 配方 = GATE4b 原样（GD3-SWORD 热启动、GATE=3 GAMES=6 BAND=0.13、WIDE_FINAL、HALL_TRACE、BIGT_PUSH=12、400 代 × 3P × 8 局 × pop8）；5P/8P 干净口径（`--shipbigt=0 --shipdrain=0`）。

## 一、总表（夺1 %，5P / 8P，12 臂）

| 组 | 奖励 | s13 | s41 | s7 | 防御族占比 | 白防率 |
|---|---|---|---:|---:|---|---:|
| **C 对照** | 无 | **48.6 / 40.9** | **48.1 / 44.0** | 7.9 / 8.3 | 0%（强粒）/ 72%（s7） | — / 91~94% |
| **W** | DEF_ADAPT 0.3 + DRAIN 0.4 | 7.6 / 9.1 | 10.0 / 9.7 | 15.7 / 9.1 | 68~79% | 91~94% |
| **P** | DEF_ADAPT 0.3 + 白防罚 0.6 | 8.1 / 8.0 | 11.7 / 10.6 | 11.9 / 7.4 | 71.6~79.6% | 90~94% |
| **D** | DRAIN_HEAL 0.4 | 8.1 / 8.0 | 8.3 / 8.3 | **21.7 / 20.6** | 71.6%（s13/s41） | 91~94% |

（D-s13 与 P-s13 的 trace/白防读数逐数相同：同一个"永远防御"退化极点；C-s7 无奖励也落到该极点。）

## 二、为什么奖励没用（机制）

1. **这张场里防御几乎总是白防**：满血（HP≥3）232 个决策里挨打 **0 次**；残血（HP≤1）18/113；防御族 90~94% 的手是空挡。
   ⇒ 强包（C-s13/C-s41）**完全不防**是正确行为；任何"按挡下付钱"的奖励只能学到"多刷手数撞那 6~9%"。
2. **白防罚（-0.6，按手数）也没压住**：防御零费、且"活得久"本身有收益 ⇒ 罚 0.6 没跑赢。
3. **配方本身有吸引子**：C-s7（无任何奖励）同样塌成架势机器人（防御 72%、5P 7.9）⇒ 不是奖励独有的病；奖励只是让 s13/s41 也掉进去。

## 三、摄魂：出得起，但没动机

- 强包在 HP≤1 时 **ep≥3 占 50.8%**（64/126）⇒ 摄魂（3 ep）**出得起**；
- 但 **0 次选择**；塌掉的包里 ep 被防御/环吃掉，出得起比例 0~5.2%。
- ⇒ 摄魂是"**残血前留 3 ep**"的顺序问题，单步奖励拉不动。

## 四、判据（预登记）

| 判据 | 要求 | 结果 |
|---|---|---|
| ① HP≥3 防御 ≥5% 且总占比 ≤15% | 是 | ✘（W/P 总占比 68~79%，且全是白防） |
| ② HP≤1 摄魂 ≥20% | 是 | ✘（12 臂全 0%） |
| ③ 5P clean ≥ 对照 −3pt | 是 | ✘（48.6 → 7.6~21.7） |
| ④ 8P ≥ 对照 −3pt | 是 | ✘（40.9 → 8~20.6） |

## 五、结论

- **奖励路线判死**（三组设计、12 臂）：DEF_ADAPT / +白防罚 / DRAIN_HEAL 都买不到"适度防御/残血摄魂"，只买出架势机器人（最好的一粒 D-s7 也只有 21.7/20.6，远低于对照 48.6/40.9）。
- 「多血适度防御」在这张场**没有需求**（满血没人打），不是学不会；要谈它得换"攻击频繁且可预测"的场，或改目标/表示。
- 「残血摄魂」要的是**留 ep 的顺序**，不是单步奖励。

## 六、可选下一步（需用户裁）

1. **接受为产品事实**（连 v7 也残血 0% 防、从不摄魂），写进档案，停这条线；
2. **换场**（guardSpam/reflectWall 等"会打满血"的席位）再谈适度防御；
3. **选择侧硬帽防塌**（防御占比 >15% 或白防 >50% 的候选直接拒）——救 C-s7 那类种子，比奖励便宜；
4. 摄魂要改目标/表示（低血保留 ep 的序列信号），不是本班范围。

## 七、可复现命令（摘）

```bash
# 训练（W 组为例；P 组把 DRAIN 换 0、加 EPIRUS_DEF_IDLE_W=0.6；D 组只留 DRAIN）
EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1 \
  EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak \
  EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver' \
  EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13 EPIRUS_WIDE_FINAL=1 EPIRUS_HALL_TRACE=1 EPIRUS_BIGT_PUSH=12 \
  EPIRUS_DEF_ADAPT_W=0.3 EPIRUS_DRAIN_HEAL_W=0.4 \
  EPIRUS_ARM=DD-W-s13 EPIRUS_SEED=13 EPIRUS_T3P_OUT=scratch/ga-arms/DD-W-s13.js \
  node tools/train-3p.mjs 400 3 8 8
# 考试
node tools/eval-5p.mjs 12 5 77000 <包> --shipbigt=0 --shipdrain=0
node tools/proto2/def-drain-trace.mjs --pack=<包> --table=strat --games=20
node scratch/def-quality-gen3.mjs --pack=<包> --games=20
```
