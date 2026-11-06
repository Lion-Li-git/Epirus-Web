# HANDOFF → ZCode/GLM（千问 · 11-01 白天班）：今天推翻了四条在册结论，含你三条

> 分支 `research/champion-2.0-repr-2026-10-28`，提交范围 `8d29776b → c6f801cc`（16 笔，已推 origin）。未并 main、未 promote、未碰 `js/bundled-champion-pool.js` 与 `champion-map/pool-members.tsv`。
> 账全文：`RESULTS-2026-11-01-DAY-qoder.md`（§一~§十七）。判据六份，全部**先于臂单独提交**（时刻与臂 mtime 可对账）：
> `PREREG-2026-11-01-BREADTH-FLOOR` ‖ `-OPPONENT-FACE` ‖ `-BUCKET-RETRAIN` ‖ `-SELECT-FLOOR` ‖ `-KILL-NARROW`（+ 你那份 REPRO-PRODUCT 的 §一~§三被我按新读数加了勘误引用）。

## 0. 一句话（以及它为什么影响你的账）

**"广度/下限"这件事今天换了三次轴，最后一次是用户定的：线覆盖归池、集中度只记录、训练中途杀超低出手种类。**
⇒ 你夜班三条结论要重标（不是错，是**证据的轴变了**）：① `RB2P-s13 64.0% 超 v7` 仍是产品考卷事实，但它 `raw 出手种类=2`，按新形状判据**不进冠军席**；② `DAgger 稀释稀有类` 的根因不是 DAgger（见 §4）；③ `ring 需手写教师或 bead 富集桌` —— **20 秒就能造**（见 §3 的 `--teacher=ring`）。

## 1. 复核你的夜班（我实跑的，不是读你文档）

- `eval-5p` seed 77000 逐包重跑：v7 **56.9** ‖ RB2P-s13 **64.0** ‖ s41 61.4 ‖ s17 61.0 ‖ s23 60.0 ‖ s7 53.6 ‖ gd3b 43.6 ‖ BROAD-s41 53.1 ‖ BROAD-s7 40.5 —— **与日志逐字同**；`selftest2` 36 腿 ✅、`selftest3` 6 腿 ✅、`browser-parity` P1–P6 ✅。产物 `.bak+meta` 齐。
- 我补的**多骰复测**（4 副骰子 ×9 包，~90 秒，`scratch/dice-probe-1101.txt`）：同 seed 配对差 s13 +7.1/+7.1/+7.3/+9.1、s17/s23/s41 全正、**s7 全负** ⇒ 配方均值只 +3.5pt、SE 2.0（≈1.8σ，未过显著线），64.0 是五粒最大那粒；**3P 落后 v7 是 4/4 骰子一致**。
- 你那批产品卷臂的**泛化性质**要写清：`--arenaPool=product` 的名单就是考卷名单 ⇒ 产品卷读数 = 训练分布内；唯一留出性质读数是研究卷，而 RB2P 从起点 +41.6% **降到 +34.1%**。

## 2. 逐件：原件 + 分母

| 件 | 读数（带分母） | 原件 |
|---|---|---|
| 仪器 4 处 | 桌形/席位分母印错（七处用研究卷 11 格当实际值）、`--arenaShapes` 被静默吞、产品名单两处重复→`roster-lib` 单源+`names:` 档、新尺 `breadth2` | `scratch/dagger-fix-check.out`（回归腿）‖ `--arenaPool=product` 指纹与你的 RB2P meta **逐字符同** |
| 对手面审计 | `OPP_SPECS` 24 名，两个训练池都没用过的 **15 个**（含 `targeter`/`gunspam`）；`focusfire/minespam/cursestorm` 住 `eval-5p` 的 `EVAL_ONLY`（"故意不进训练池"） | `scratch/field-probe-1101.log`（13 场 ×5 包 ×40 局） |
| RICH vs CTRL | **`gunwall` 0%→60~100%**（两种子 ×4 副骰子；v7 均值 3.8%、CTRL-b41-s13 全 0）‖ `targeter` 32.5→62.5 ‖ 5P 58.1（**没训过的 7 席考卷**）‖ 3P **75.7 > v7 71.2** | `scratch/eval-rich-1101.log` ‖ `scratch/cap-eval.out` |
| 桶线病因 | 激光眼要**爆珠**（现役包珠账本"电 971/爆 0"）⇒ 从没进菜单；大雷要 **ep≥5**（链每拍先兑现电珠）⇒ 出手账 0.0/局 | `scratch/mastery-GD3-*.log` |
| 环=经济底座 | `--teacher=ring`（教师自己肯开环）**没教过大雷**却：环 ✔300 段三连 ‖ 大雷 ✔3.525/局；`--teacher=bigt`（纯攒不开环）留出标签 100% 拟合却 **0.0/局** | `scratch/ring-wave4.out` ‖ `GD3-RING.bak` |
| 配给教师 | `--teacher=ration` 第一次**三线同时过**：环 ✔73 ‖ 大雷 ✔**0.825/局** ‖ 炮 ✔3.400、浪费 0%、花珠 97.4% | `scratch/mastery-GD3-RATION.log` |
| 中途淘汰 | `--killKinds=4 --killStreak=5`：一维起点**第 5 代被杀花 280 局（1.2%）** ‖ **配给起点第 9 代被杀（种类塌到 1）** ‖ 多线起点存活 ‖ 幸存者 5P 与不开线同种子一致 | `scratch/killkinds-check.out` |
| 池剖面（30 枚在册成员，同尺） | raw 出手种类 最小 5 ‖ 中位 10；**落地份额 P10 57.6/中位 62.9/P90 66.3%**；ρ(线数,1st)=+0.42、ρ(最大单键,1st)=−0.36；`K2` 59.8% 落地来自大雷而最大出手占比只 19.3% | `scratch/poolprofile-1101.tsv` ‖ `scratch/EFFKINDS-1101.json` |

## 3. 新旗标与教师（你可以直接用的）

`supfit-gd --teacher=`：`chain`（默认，md5 回归腿未变）‖ `v7mix` ‖ `toolkit` ‖ `chainmix` ‖ `minit` ‖ **`bigt`**（`saveBigT` 口径）‖ **`lasereye`**（没爆珠这一拍就攒爆珠；v2=没人防御就不放）‖ **`ring`**（教师自己肯开环）‖ **`ringchain`** ‖ **`ration`**（每线剂量上限，超了把地盘还给兑现链）；名单不认的**当场拒**（原先静默落回 `chain`）。
`probe-cem-arm`：`--arenaPool=product|names:<在册对手>` ‖ `--arenaShapes=`（与换池正交，不再被吞）‖ `--selCap=`（**已降级为只记录**）‖ **`--killKinds` / `--killStreak`**（中途淘汰，默认关）‖ `--arenaDivK`（你的）。
`pool-check`：新增 `落地份额` 列与 `广度下限 B-1` 计数；**分母为 0 记"读不出"不算过线**（我第一版把 GD3-LASER2 的 0 落地判成过线，已修并有牙测）。

## 4. 验牙状态（哪条有独立价值、哪条是我自己误判）

- **`--dagger` 会整轮空转**（我的错，已修）：`adamFit` 内部按 train ll 选粒，r≥1 的哨兵却传 `like(pvCur,test).ll` ⇒ 起点粒子在 test 上已≈0，能不能越过全凭巧合。实测 `GD3-BIGT`(dagger=0) 与 `GD3-BIGT2`(dagger=2) 产物 **md5 逐位相同**；而你昨夜 `mt-dag` vs `mt-OB3S-rich` 的 md5 **不同**（那次教师留出只 97.8%，侥幸越过）⇒ **同一旗标有时生效有时空转**。
  ⇒ 你那句"DAgger 稀释稀有类"来自真生效那一支，结论仍可用，但根因其实是 `rareOnly` 的筛带 `srcParams == null` 条件（**学生轮不受筛**）——这条我按代码重读后改判了。**顺带：你 §九 的 miniT 稀有事件墙值得用同一个视角重看一遍**（是不是"教师自己不出这一手"而不是"样本不够"）。
- 我引错过的两把尺，已在册加注：`longrange-offer` 的**提供率不是包级读数**（夹具由旋转键 chooser 生成，4 枚不同包逐格相同 ⇒ 尺已把自己的条款印进输出）；`breadth2` 的落地份额**对高价单卡系统性不公平**（三次复现）。
- 命名：我此前混用"v7"三层意思，且把 `js/bundled-champion-3p.js` 当独立对象——它与池成员 **`T8-s114` 权重逐位相同**。今后：`线上冠军`(=bundled-3p=`T8-s114`) ‖ `池成员`(30 枚，容器 v7) ‖ `代 3`(v:92)。
- 回归腿：默认关的 `--killKinds`/`--selCap` 重跑你的 RB2P-s13 原命令 ⇒ 产物 `4baad3d5…` **逐字节同**（任何人可复现）。

## 5. 我没做 / 留给你的原因

- **Stage C（obs3 面退役 + 删 `supfit-gd` 跨代搬运）**：用户裁"不死守旧包"⇒ 搬家账作废，删除支路已判废但**没动手**（避免与读数改动同批）。
- **`--killKinds` 只做了臂级早停**，没做粒子级 veto（`--vetoKinds`）——等下一波看要不要。
- **有效种类的终判阈值**（建议 t=1% ≥4）只登记未实装成筛子；t=5% 会误杀 2 枚现役成员，已在册。
- **`EVAL_ONLY` 三席进不进训练池**、**广度下限压不压桶专家**、**RB2P 算桶专家还是冠军候选**、**引擎参数（大雷伤害规模/环费用）要不要权衡**——都等用户裁，我没擅自破。

## 6. 请你分析的三件事（都可独立执行，边界同上）

1. **优化器形状 vs 目标面**：`first` 货币下"种类"塌得极快（一维起点 5 代、配好包 9 代塌到 1，只花 1~2% 预算），而池里那三枚 4 线 hard 全是 **GA 长跑**（`T8-s114` gens 400、`K2` gens 1200，均 pop 8 × games 8，且 `breadthFloor=null/selLand=0`——**没开过任何广度旋钮**）。
   ⇒ 请用 `tools/train-3p.mjs` 的 GA 路 + `EPIRUS_ARCH2=S1ob:input=obs3b,gen=3,keySplit=1` 跑一次同形状小复现（pop 8 × gens 400 × games 8 ≈ 25.6k 局），看"多线不掉分"是否随**优化器形状**回来；若回来，结论就不是"继续调 CEM 旋钮"。判据请自己先立（我建议至少报：raw 种类、有效种类 t=1%、5P、`gunwall`）。
2. **重新审视 `--arenaDivK`**：它奖励的是**非ジ出手键数**，而今天已证"出手宽与落地塌缩可同时成立"（`tk-OB3CH` 12 键 / 91.9% 落地来自炮；`RICH-b41-s13` 10 键 / 80.5% gun）
   ⇒ 你的 DivK 与新的 `kindN` 是不是同一处该改？还是该换成"有效种类（占比 ≥1% 的键数）"？给出实测对照，不要停在推理。
3. **miniT 与 ring 用同一把手术刀**：`--teacher=ring` 证明"教师自己不出这一手"是墙的真身。miniT 的墙（你 §九：教师态 100% / 自访 8.3%）是不是同一类？
   现在有了 `rareOnly` 作用于学生轮的修法（我改的那一行）+ `ration` 的剂量写法，值得一发臂把它判清；判据请先写进 `PREREG-2026-11-01-*` 的续节。
