# 交接：2026-11-12 深夜班（ZCode，23:39→09:00）

> 上一班：HANDOFF-2026-11-11-night-from-zcode.md（11-11 夜）→ DS 白天班（数据模型 A/B/重构）→ 本班。
> 主文书：FINDING-2026-11-12-night2-zcode.md（本文只列状态、待办与读数指针）。
> 用户令（按序）：①训练掺环境+多技能多方法+融合冲 11 技能单包；②B 轴夹具改造（体测类人席/自写类人席/少风格倾向）；
> ③节点研究定代/轮数；④关失败臂、实验臂短一点多测几种方法。自主到 09:00。

## 0. 已修的账

- **F2 夹具断链**：`MSB10-R1S1149480262.js` 盘上丢失（登记表还在，exam-4n B 轴 ENOENT）→ 用登记过的同 wid 副本
  `MSB10-R1S1149480262-band1.bak` 恢复，18 夹具+14 池成员全在。
- **soup-pack v92 容器保真**：mix 丢 `p2` → 补挂来源粒；写包走 `EpirusPolicy2.pack` + arch/dims/layout 抄第一粒。self-test 绿。
- **msbatch2 exit9=守卫拦重**：peak 早熟臂产物与自己的 seg 节点同权重 → §E589 拒写 → 旧驱动器"全败"自杀
  （昨晚 12 次 exit9 被多臂轮兜住，branches=1 才露馅）。已修：按"无改良"用父代顶替。
- D234 ⑩c 页面过期 → 已重烘（1893KB）。

## 1. 已收账的研究结论（详见 FINDING-2026-11-12-night2-zcode.md）

1. **环境矩阵并集**（§1）：池 16 枚跨环境并集 5~9 种；单环境 distinctKeys 系统性低估技能上限。
2. **B 轴**（§2-4）：pickAdaptive/HumanZ 两把类人席判别力都够、偏差与 F2 不同向；F2 签名 = fieldAAtk −0.11/holo −0.10；
   **剑墙维度与 A 反相关（ρ −0.20/−0.37）** ⇒ v14-116/Q-s47 都不是合格锚；
   **1v1 硬判据**（vs 激进脚本 >50%）：Q-s47 7/40 FAIL、v14-116 0/40 FAIL，MSB10 28/40 最弱，KDG-B 40/40 满分；
   **F3k2 = MSB13+MSB11-R2+MSB8-charge+KDG-B**（60 局：σ 0.119、ρ(A) 0.37、R² 0.817 全面均衡）= 换尺首选候选，留用户裁。
3. **节点研究**（§6）：多数臂 C 在 seg1-2（50-100 代）见顶后衰减（A↑B↓ 漂移）；laser 是唯一 A/B 同升例外；
   今晚 ~20 轮只 2 次换代 ⇒ **实验阶段 2-3 轮够**；建议**段内选粒**（臂冠军从 seg1..4+final 按 C 取 argmax，+20 秒/臂）。
4. **soup**（§5）：等权大锅把宽度洗掉（12→7 种）；**0.6 宽料+0.2×2 特化 = 13 种**（soup-15b）但 C≈0.05；
   soup 线巩固 2 轮就 C 0.066→0.210（soupb R2S74063325）。

## 2. 本班训练实验总账

- 长臂（已按用户令关停）：elec/ring/drain2/breadth/laser/bigt/curse——**特化注入全部 0% 转行为**（部署档给机会、
  奖励没钉住），breadth 广度 50→200 代衰减。laser 是例外（A/B 同升到 seg3-4，C 峰 0.30）。产物/节点全在盘上可复算。
- soupb：soup-15b 热启动 + GA_GATE=4，R2 换代自产冠军 C 0.2101，续跑到轮 4。
- **研究矩阵（已收官，FINDING §7/§7.1/§7.2 有全表）**：
  - GA 注入路线全败：机会侧（IMIT/SEL_BIGT/PUSH）与奖励侧（SEQ_W=10、hit 档付款 89 万次实证）成品粒全 0.0；
    R5 是无效实验（RING_FORCE 只在 train-worker 路径——D 级接线缺口）；R2 响亮拒（PACK_OPP 不吃 .bak）；
    R11（ECO_TARGET）exit 7（econ 回执 undefined）。
  - **破局 = obs3 的蒸馏教师路线**（用户点名考古）：`supfit-gd --teacher=ration/bigt` 搬到 obs5 基座，45 秒/次。
    **完整管线当晚打通**：蒸馏（GD4-RATION ring ✔3 段三连 / GD4-BIGT railgun ✔452.5% 浪费 0%）→
    GA 续训 100 代（hit:bigT 付费）→ **bigT ✔ 540-677%/局 + railgun ✔147.5%，C 同时回正**（R14）——
    "环=大雷经济底座"第四次复现且首次被设计；缺口地图时代"bigT 0/11"被打破。
    开放题：ring 过蒸馏但过不了 GA 保持（R15 棘轮也没保住）——多线同时保持 = 白天班的第一题（激光眼线 §E793 同构）。
  - 配方卡（激光眼线杠杆栈 → 今晚映射）在 FINDING §7.1；验收一律 `training/proto2/skill-mastery.mjs` 预注册尺。
- **副产品**：全库 807 枚贪婪出手谱普查（champion-map/usage.tsv）；usage.tsv 缺 laserEye/curse 列（量具缺口）。
- **接线缺口三笔（D 级，白天修）**：RING_FORCE 只在 train-worker；ECO_TARGET 的 CLI 回执 undefined；
  PACK_OPP 不吃 .bak。另：SEL_KEEP 棘轮要求起点有特征锚（R12 exit 7 实证，fail-fast 正确）——**管线顺序 = 先蒸馏造特征、再棘轮**。

## 3. 遗留给白天班

1. **B 换尺裁决**：F3k2（推荐）+ `--champbot=` 正式化 + 新列族；F2 列冻结。
2. 段内选粒（msbatch2 改造：臂冠军 = argmax C over {seg1..4, final}）。
3. 特化技能的奖励面：部署注入不转行为，正路 = 完成式奖励 + 段内选粒 或 IMIT（看研究矩阵结果定）。
4. D191 清账（MSB15 系列产物别名）+ D233（lineage 拒跑：R-s107/P-s22 合并名单在 soup 产物加入后聚类并拢撞守卫，
   需给 3 锅新汤指路融合家族或更新名单——未修，lineage.tsv 已还原）。
5. e1-teach-77003 等包路径漂移（registry 指向 champion-map/packs/ 已归档）→ registry path 刷新。
6. 池：MSB13 未入池（12 线差广/还两道）；soup 线若 C 过 0.3 走 POOL-CONTRACT 门。

## 4. 时钟

本班开工 23:39，计划收工 09:00。当前轮转状态见 `scratch/night-adapt2/msbatch2-*.log`（驱动器日志）。
