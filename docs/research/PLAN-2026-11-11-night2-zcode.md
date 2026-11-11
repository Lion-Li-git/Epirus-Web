# 今晚计划（2026-11-11 深夜班 · ZCode）

> 用户 23:3x 两令：①继续训练各种**长程技能**，不许再出"电磁炮包实际不用电磁炮"；②搞好更能反映实际强度的 **B 轴夹具**，
> 包括体测 DS 的"规则理解·自适应"类人席、自己研究技能表+对局后也写一个类人脚本，
> 目标回答"**B 轴风格倾向太明显，怎么做一把少风格倾向的 B 轴**"。
> 背景输入：单技能包扫描（FINDING-single-skill）证明 B 轴夹具对"穿反弹芯片伤"特防偏低；
> MSB14-railgun 三桌电磁炮用量 **0%** 实测（本次开工复核，用户判断实锤）。

## 0. 开工即修（00:1x）

F2 夹具成员 `MSB10-R1S1149480262.js` 在盘上丢失（registry/CHAMP_PATHS/池表仍登记 ⇒ exam-4n B 轴 ENOENT）。
用登记过的同 wid 副本 `MSB10-R1S1149480262-band1.bak` 恢复，冒烟过；18 枚夹具 + 14 枚池成员复查全在。

## 1. 工作面一：长程技能训练臂（真实出手自证）

**机理依据**：夜里已证"稀疏奖励不可达"（SEQ 只付完成的链，GA 凑不出蓄→放）⇒ 正路 = **第一步可达**（基座自带该行为或部署档注入）+ 完成奖励 + 开火计数自证。
电珠=蓄能产出、只留一回合 ⇒ 电磁炮链 = "蓄能→次回合电磁炮"两步。

**用户 00:2x 原则（写死在判据里）**：**单包技能上限只能在环境矩阵里测出来**——同环境塌缩是自然行为不是病
（5 同座自对局把 distinctKeys 压到 1~3 就是例证）；多技能的目的 = **跨环境适应性 + 多样的可玩性**。
⇒ "11 技能单包"的验收尺 = **环境矩阵并集**（§1.1 探针），不是任何单一桌的 distinctKeys；
训练侧现成旋钮里 EFFSKILL_MIN/mirrorHealth 是同环境口径 ⇒ 只当软线（不 fatal），真判据走矩阵并集。

### 1.0 臂清单（7 驱动器 10 臂，00:1x–00:3x 分两批发射）

| 臂 | 基座 | 注入/课程 | 判据 |
|---|---|---|---|
| **MSB15-elec** (b2,r6) | MSB8-charge（蓄能在 repertoire ⇒ 链第一步可达） | `SEQ_W=5 KIND=elec` | 矩阵里 elec 占比 >5% ≥2 环境；结账行每股 ≥0.1 |
| **MSB15-ring** (b2,r6) | MSB13 | `RING_FORCE_EPS=0.5 UNTIL=100 RING_OPPS=1` | 矩阵 ring 占比 >5% ≥2 环境 |
| **MSB15-drain2** (b2,r6) | MSB13 | `HPSEED=0.5`（残血开局造 HP≤1 窗） | 矩阵 drain 占比 >0 |
| **MSB15-breadth** (b1,r5) | MSB13 | `GA_GATE=4`（GA 内门+带内覆盖熵 tie-break）+ `EFFSKILL_MIN=6`（软线，BREADTH_FATAL 关） | 矩阵并集 ≥11 种；自对局口径 ≥6 |
| **MSB15-laser** (b1,r5) | MSB13 | `SEQ_KIND=boom SEQ_W=5 LASER_W=2`（蓄爆珠→激光眼链+命中奖励） | 矩阵 laserEye 占比 >0 |
| **MSB15-curse** (b1,r5) | MSB13 | `CURSE_PUSH=2`（诅咒软注入） | 矩阵 curse 占比 >0 |
| **MSB15-bigt** (b1,r5) | MSB8-charge（5ジ可达） | `BIGT_PUSH=6`（注入加倍）+ `SEL_BIGT=1`（贵卡带内选人） | 矩阵 bigT 占比 >0 且 C 不掉线 |

环境掺杂说明：rotation-obs5 配方自带 `MIX8=4 / MIX2_EVERY=4 / MIXHP_EVERY=2`（每 4 局 8P、每 4 局 2P、每 2 局换 3/5 血对偶桌）
⇒ 十臂全部自带跨人数/跨血量课程，符合用户"掺杂不同环境"令；收获时从产物 meta 核 requested/effective 回执。

### 1.1 环境矩阵并集探针（新量具，本班落）

`scratch/zcode-1111-single-skill/env-matrix.mjs`：桌形 = {自对局5座 ‖ 脚本混桌 ‖ F2 冠军桌 ‖ 农民桌 ‖ 反射墙桌 ‖ 激进桌}
× 模式 = {multi, long}，每格数逐卡成功出手占比 ⇒ 每包报 **逐环境种数 + 跨环境并集种数（非ジ、份额≥1%）**。
先对现役池 14 枚 + 7 枚 MSB 冠军跑基线普查（"现役包的跨环境技能上限"第一次有账）；
臂收官后同一把尺收账。soup 产物（§1.2）同尺验收。

### 1.2 融合线：同网络 soup → 11 技能单包（01:0x–01:3x，已出中间账）

- **工具补丁**：soup-pack 只认 v7 外壳 ⇒ 2.0/v92 材料融出来 unpack 拒收（实测第一锅"不兼容"）。已修：
  mix 产物补挂 `p2` 布局（门查**来源粒**——mix 自己必丢 p2，查自己永远不成立）、写包走 `EpirusPolicy2.pack`
  + arch/dims/layout 逐字抄第一粒。self-test 全绿。
- **三锅结果**（gen3 组 7 枚可用；DSTR4/KDG-B/WSEL9 是 7993 维旧组，进不了）：
  - soup-15a（7 料等权）：并集 **7 种**（洗掉一半）‖ A 0.253 / B −0.253 完全对称 ⇒ 等权平均出"中庸策略"
  - **soup-15b（beadplan 0.6 + MSB8-charge 0.2 + MSB11-R1 0.2）：并集 13 种**（dualGun/jinshield/transfer 等冷卡真出手）
  - soup-15c（+railgun 0.2 四料）：并集 12 种（bagua/charge 回来了）
  - ⇒ **权重偏宽料是关键**：0.6 主料保住决策主干，0.2 副料把冷卡面拉过 1% 份额线
- **强度短板**：soup-15b C≈0.052/0.066（A 0.271 / B −0.168，对 F2 冠军 5P 夺1率 3.6%）——融合给广度不给强度
- **对策已发射**：MSB15-soupb 巩固臂（soup-15b 热启动 + GA_GATE=4 广度门 + 混合环境课程，4 轮 ≈3h）
- **后续合并料**：夜里十臂的特化冠军（ring/elec/laser/curse/bigt）出来后融进 15b 配比——材料并集理论上限
  = beadplan 族 12 种 ∪ {ring,railgun,bigT,laserEye,curse} ≈ 16 种
- 工具侧未做：soup-pack 头注还是"形状 v7"旧文案；`f=undefined` 显示行 cosmetic 没修（低优）

## 2. 工作面二：少风格倾向的 B 轴（00:4x–01:4x，已出中间账）

**方法**：样本 S = 20 枚（14 单技能 + MSB13/MSB11-R2/MSB14-railgun/DSTR4 + Q-s47/G5J-50/KDG-B-Q-s13），
分数 ~ 12 行为特征标准化 OLS；**S/Geff 是质量代理要剔掉再看风格**；n=20/m=12 ⇒ 看调整后 R²。

1. **pickAdaptive 体测（判别力强、偏差与 F2 不同向）**：冠军链 0.42–0.72 vs 1.8 旧包 0.03–0.34；
   剑包 v14-116 被 F2 捧第 3、被它打到 0.06——两把尺偏差**不同向**是混编抵消的前提，实测成立。
2. **pickHumanZ（Z 版类人席，scratch/zcode-1111-single-skill/human-z.mjs）**：v1→v2 两轮；
   v2 修农夫放血（v7blk1-93 0.56→0.44），伤害面按回合轮换（gun/sword/tank/snipe 起步面不固定）。
   判别力：冠军链 0.44–0.78 居前，1.8 旧包 0.03–0.44。
3. **纯风格回归（剔 S/Geff，调整后 R²）**：**HumanZ 0.35 < pickAdaptive 0.75 < F2 0.82**。
   F2 的签名系数 = fieldAAtk −0.11 / holo −0.10（DS FINDING 的 B 轴怪癖复现）；pickAdaptive 几乎只剩
   rounds/dmg 小系数；HumanZ 把剩余权重摊最匀（heavy/rounds/waste 各 −0.13±）。
   ⚠ 局限：n=20、16 局/格（±12pp 噪声），读数看方向别看小数点。
4. **夹具候选**（fixture-eval.mjs，4 席 spec 任意混编 pack/bot/botfile，20 包 × multi+long × 16 局）：
   F2ref（对照）/ F3a = F2−Q-s47+v14-116 / F3b = railgun+v14-116+DSTR4+Q-s47 /
   F3c = MSB13+railgun+pickAdaptive+HumanZ / F3d = MSB13+v14-116+两席 / F3e = MSB13+DSTR4+两席。
   判据 = σ（判别力不掉）× 调整后 R²（风格最小）× 与 A 的 Spearman（0.2–0.6 合理带）。
5. **换尺纪律**（AGENTS §7/§8）：若采纳，正式化 = exam-4n 加 `--champbot=`（本夜未动主仪器，量具在 scratch）；
   新列族（P·B3 族）+ `champ=` 戳 + EXAM-BATCHES.tsv 登记；旧 F2 列冻结不删。采纳与否留用户裁。

## 3. 时间表

| 时刻 | 事 |
|---|---|
| 00:1x–00:3x | 七驱动器 10 臂分两批发射（后台，自动通知监控） |
| 00:4x–01:3x | 环境矩阵并集探针落盘 + 现役池/MSB 冠军基线普查 |
| 01:3x–02:3x | pickAdaptive 体测 + pickHumanZ 编写与体测 |
| 02:3x–03:3x | soup 融合第一批（6 料等权 + 权重扫）× 矩阵验收 |
| 03:3x–04:3x | exam-4n `--champbot=` 接线 + 候选夹具 S 批（multi+long） |
| 04:3x–05:3x | 最优 soup 热启动短臂巩固（若 soup 过线） |
| 05:3x–06:3x | 十臂收官 → 矩阵收账 + 12 线体检 + C 尺重测 |
| 06:3x–08:3x | FINDING + HANDOFF 终稿 + push |

⚠ 核数预算：10 臂并发 ≈10 核 + 轮末重测 8 路 exam-4n，18 核机在位；臂级中途节点每 50 代，杀进程不丢。

## 4. 需要用户裁的点（晨报带上）

1. 候选夹具若数据显示 F3 更优，是否切 B 轴现行夹具（列族切换）；F2 列冻结保留。
2. 类人席（pickAdaptive / pickHumanZ）是否可以作为夹具**常驻席**（脚本席进 champion-gate 的问题）。
3. 三臂冠军若 C 过线但广度/用量不过，按哪条为准（宁缺毋滥 vs 观察席）。
