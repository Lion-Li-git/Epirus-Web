# RESULTS · 2026-11-08 · 2.0 线「强 vs 过线」的诊断（DS 白班）

> 分支 night-1107-adapt。读数可复现：命令与产物路径逐条写在下面。
> 一句话：**2.0 线现阶段的高分是反射墙刷出来的**；12 线门拒收它是对的。要把「强度」和「过线」同时拿到，
> 缺的不是再叠旋钮，而是（a）考卷要能看见「不还手」、（b）克隆保真闸要含行为项、（c）训练要覆盖「清被动桌」。

## 一、结论（按证据强度）

1. **v7 强包两样都有**：Q-s47（X̄₄ 0.349）12 线 **nFail=0**，场A 34.8%、场B 2.91/局；T8-s114（0.284）同样 nFail=0。
2. **2.0 的高分与「会打」反相关**：CTRL2-Q-s7（0.427）对 4 个只攒钱脚本 **reflect 91%、伤害 0.30/局、清场 0.00**；
   PASS2C-Q-s13（**0.523**，全库最高）**伤害 0.00/局**、47 回合五人一起被终局收缩磨死判平。
3. **池里 23 枚只有 4 枚过线，且都是弱的那批**（X̄₄ 0.117~0.181）；强的（DSTR4 0.215 / POPP 0.214 / PUSHON 0.197）
   卡在**广度 G（1.0~1.9）**，不是卡在场A/场B。
4. **蒸馏就把「还手/收人」丢了**：KD-Qg（Q-s47 的蒸馏种子、未 GA）场A 34.8%→**18.6%**、场B 2.91→**0.00**。
   逐键保真：sword 72~93%、guard 53~85%、ji 62~66%、**gun 15%（400 步）→ 50%（2000 步）** —— 最该学会的「开枪」最难学。
5. **击杀奖励能把场A 修回来**：KRP-Q-s13 场A 12.7%→**28.7%**；农民课程再把场B 从 0.00 抬到 **0.09/局**（KRF）。
   但 long 桌（5 血）的场B 仍离 0.3 差三倍 —— 它清得动 3 血农民（multi 0.64），清不动 5 血。

## 二、四臂矩阵（同一把尺：R=100 页面剂量 + 12 线门 + 第 5 格）

| 臂 | 种子 | 关键旋钮 | X̄₄ 短 | X̄₄ 长 | 场A | 场B(long) | G | 12 线 |
|---|---|---|---|---|---|---|---|---|
| CTRL2-Q-s7 | KD-Qg | 裸 GA 150 代 | 0.427 | 0.459 | 10.4% | 0.00 | 3.4 | ✘2 |
| PASS2C-Q-s13 | CTRL2-Q-s7 | 课程+KILL_FIELD+WIDTH_W | **0.523** | **0.564** | 12.7% | 0.00 | 3.6 | ✘2 |
| GATE3C-Q-s13 | PASS2C | +COUNTER_OPPS+SEL_COUNTER | 0.422 | 0.412 | 13.3% | 0.00 | 4.0 | ✘2 |
| KRP-Q-s13 | KDQ3-l（2000 步蒸馏） | +KILL_REWARD=2 | 0.198 | 0.281 | **28.7%** | 0.00 | 3.6 | ✘1 |
| **KRF-Q-s13** | KRP | +COURSE_BOT=pickFarmer | 0.252 | 0.313 | **29.3%** | **0.09** | 4.2 | **✘1** |
| （参照）PASS2-Q-s13 | KD-Qg | 课程+KILL_FIELD+WIDTH_W | 0.240 | 0.279 | 32.4% | 4.00(multi) | 3.4 | **✔0** |
| （参照）Q-s47 / T8-s114 | v7 | — | 0.349 / 0.284 | 0.43 / — | 34.8 / 39.4% | 2.91 / 3.84 | 6.8 / 5.8 | ✔0 |

**前沿判断**：现在离「既过线又强」最近的是 **PASS2-Q-s13**（12 线全过、X̄₄ 0.24）；KRF 把场A 补上、
强度略高（0.252/0.313），但 long 桌场B 0.09 仍差线。**下一步首选：以 PASS2-Q 为种子 + KILL_REWARD=2 + long 课程冲强度**
（它场A/场B 天然合格，缺的只是 X̄₄）。

## 三、新增/修好的测量

1. **tools/exam-fb.mjs（考卷第 5 格）**：场A 还手 / 场B 清场 / 对农民桌胜率，判据与 feasibilityOf **同源**
   （直接调 aggressionProfile）。用法 --packs=a.js,b.bak [--games=100] [--mode=multi|long]。
2. **口径**：门里的场A/场B 实际在 **long 桌**上量；--mode=long 时工具与门逐位一致（KRF：29.3% / 0.09）。
   multi 桌读数更贴近产品桌（KRF 0.64），两者都要看，不许混用。
3. **进图三步**（METHODOLOGY 146）：侧车 lineage-g3 → 全表 proj-tsne 重投影 → attach-projcols + viewer 重烘。
   本次照此把 KD-Qg / KD-K2-l / KD-K2 三枚进图（N=890，kNN@10 0.459）。
4. **保真闸加行为项**（METHODOLOGY 147）：分数 ‖ 防御占比 ‖ 场A/场B/农民桌胜率各 ≥0.8×教师。

## 四、复现命令

    node tools/exam-4n.mjs 100 77000 <包> --dose=page [--mode=long]
    node champion-map/feas.mjs --table=<roster.tsv> --out=<x.tsv> [--allLong=1]
    node tools/exam-fb.mjs --packs=<包> --games=100 --mode=long
    node tools/proto2/supfit-full.mjs --up=scratch/arms/KD-V7.bak --out=<出> --teacher=<v7 包> --balance=0 --collect=teacher --mode=long --steps=2000
    EPIRUS_SEEDPACK=<种子> EPIRUS_HOTSTART=1 EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1" EPIRUS_KILL_REWARD=2 EPIRUS_COURSE_EVERY=2 EPIRUS_COURSE_BOT=pickFarmer EPIRUS_KILL_FIELD=1 EPIRUS_WIDTH_W=0.5 node tools/train-3p.mjs 150 5 24 8

## 五、产物

- 包：scratch/ds-1108/{PASS2C,GATE3C,KRP,KRF}-Q-s13.js、scratch/ds-1108/{KDQ2,KDQ2-l,KDQ3-l}.bak
- 读数：scratch/ds-1108/*-feas-{multi,long}.tsv、fb-cell.tsv、pool-feas-multi.tsv
- 图：champion-map/coords-gen3-1105.tsv（890 行）、champion-map/lineage-g3.tsv（fam 15/16 补行）

## 六、待办（下一班）

1. **PASS2-Q + KILL_REWARD + long 课程** 一臂（冲 X̄₄ ≥0.35 且保 12 线）。
2. KRF 的 **long 桌场B**：课程频率 1/1 + 农民席，目标 ≥0.3/局。
3. **池 v2 标准**（POOL-CONTRACT 待批）把「第 5 格」纳入门槛。
4. 门里的 legsMode 标签写着「场A/B=multi」而实测在 long 上 —— 改注释或改口径，二选一（**已记档，未动代码**）。
