# 交接（2026-11-08 晚 ZCode → 下一班）

> **深夜补记（六臂全落地后）**：详见 RESULTS §十二。要点：① **KDG-B-Q-s13 已进图+进池硬带**
> （X̄₄ 0.364/0.399 池内新高、农民 100%、缺 1 型门=场B——池 17 硬 10）；② KDG-B-Q-s41（0.464/0.505 但缺 2 门）
> 是"场A 修复臂"候选种子：**SEL_COUNTER 单开、不加 COUNTER_OPPS**（教训 3：两者同开会把农民练丢）；③ 场B=种子性状，
> 想让 KDG 线收场要么换种子要么换蒸馏教师（方向②的场B 键过采样实验待做：`--wKey` 已支持任意键）；
> ④ ruler-measure 对**图外包**要用 `--set=champ --extra=<表> --ids=<id> --out=<新文件>`（9 秒/枚），
> 别用裸 `--extra`（默认 --set=all 会重测全库几小时）。

## 一、在飞（你接手时大概率已落地）
**4 条 150 代臂**（11-08 晚 ~发射，n3 g24 pop8，全部 `EPIRUS_TRIPLET=1`，台账追加 `scratch/night-adapt2/triplet-ledger.tsv`，产物 `docs/artifacts/night-adapt/`）：

| 臂 | 种子 | 假设 |
|---|---|---|
| STR-C-Q-s7 / STR-C-Q-s41 | STR-B-Q-s13 | STR-B 全配方 + `EPIRUS_SEL_CLEAR=0.3`（§E787 当选面清场 veto 首次上臂） |
| KDG-B-Q-s13 / KDG-B-Q-s41 | **KD-G2**（gun 修复种子，`scratch/night-adapt2/KD-G2.bak`） | gun 保真修复顺链传导 |

发射模板（STR-B 全配方 = 已验证最优）：
```
EPIRUS_SEED=<s> EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=<种子> EPIRUS_T3P_OUT=<产物> \
EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1" \
EPIRUS_KILL_REWARD=2 EPIRUS_KILL_FIELD=1 EPIRUS_WIDTH_W=0.5 \
EPIRUS_MIX2_EVERY=4 EPIRUS_MIX8=4 EPIRUS_MIXHP_EVERY=2 \
EPIRUS_COURSE_EVERY=1 EPIRUS_COURSE_BOT=pickFarmer EPIRUS_SEL_CLEAR=0.3 \
EPIRUS_TRIPLET=1 EPIRUS_TRIPLET_LOG=D:/code/Epirus-Web/scratch/night-adapt2/triplet-ledger.tsv \
node tools/train-3p.mjs 150 3 24 8
```

**产物验收**（按池 v2 门槛，别裸看 X̄₄）：exam-4n 三件套（triplet 台账有）→ `promote-champion.mjs <包> --dry` → `tools/exam-fb.mjs` 第 5 格
（**农民 ≥ 拿得出手才算干净包**，参照 CTRL2-Q-s7 0.427 教训）→ 缺门 ≤1 → 进图走 146 三步 → 池程序。
KDG 系对照组 = STR-B 三 seed 均值 0.247/0.292。

**臂1 已落地（STR-C-Q-s7）**：§E589 拦截 = 产物与种子逐位相同（150 代无候选赢过起点）⇒ STR-B 收敛再确认，无产物；
**SEL_CLEAR=0.3 没咬到**（6/6 候选清场 ≥2.48，守卫原话"这根在本臂等于没开"）——要它有筛选力线得抬 3.5+。
band1-6（trainFit 1.603~1.514，输在 4-8 粒重验）落盘 `docs/artifacts/night-adapt/STR-C-Q-s7-band*.bak`，可后续 exam-fb 挖矿。
臂2 同配方预计同结局；真正的变量在 KDG 两臂（种子换了）。

## 二、今晚三件事（详见 RESULTS-2026-11-08 §十一）
1. **门禁覆盖清零**：全图 893 枚 okShort/okLong 双桌 100% 有读数（审计工具 `scratch/night-adapt2/gate-audit.mjs`，
   可随时重跑复查；池 15 全裸 + 其余 47 枚当日补量）。
2. **池 18 → 16（硬 9 / 软 7）**：踢 G5DEF-s41（三维全废）/ POPP-s17 / DSTR4-s13（缺 2 型门）；降软 L5-1200 / PUSHON-s41 /
   POPP-s41 / COMBO-s13；**ADAPT2-Q-s7 用户点名进硬带**（invited=1；农民盲 caveat 在册——P2 0.606 全图最强但场B 0/农民 5%）。
   `EFFG-s5` 补量后其实**画像全绿**（双桌 0 缺门 + 场A 27.5% + 场B 3.98），别按旧印象当垃圾。
   bundle 已重建（2514 KB）+ pool-sync 16/16 + 重烘。
3. **gun 保真根因修复**：`supfit-full.mjs` 新增 `--wKey=<键>:<权重>` 键过采样（只在 --balance=0 档生效；META 记 wkey）。
   KD-G1（×5）/KD-G2（×10）：gun 保真 15%→67%/71%，**克隆农民 0%→100%**——农民盲的源头（蒸馏步）已拔。
   KD-G1/KD-G2 都在 `scratch/night-adapt2/`，可直接当 2.0 种子（v:92 格式）。

## 三、注意
- 反射墙族按用户 11-08 晚裁**不进硬带**（"反弹墙族差太多了"）；方向 ④（反射墙留软带做多样性）作废。
- 池入池硬口径 = **feas 双桌缺门 ≤1（同门跨两桌算一门）**——已写进 POOL-CONTRACT §池v2。
- SEL_CLEAR 语义 = 当选面**地板 veto**（场B < 0.3/局的候选剔出当选，不进 fit）；若打印 selClearAllDropped = 阈值定太高。
- ADAPT2 的"反倒"含义 = 2p 专精位（P2 0.606），它的农民盲没修——别拿它当清场强包宣传。
- 全图门禁读数是 11-08 晚的快照；新包进图仍须走"先量门再进图"（用户令）。
