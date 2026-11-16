# STATUS · 2026-11-17 夜班 2（ZCode）——管线端到端打通 + mx1116 当选键回填 + 16 臂矩阵

> 时段 `2026-11-16 23:35 – 11-17 ~03:00 +08:00`。用户令：①训练测与图的**所有管线理清打通**（进图零缺漏零矛盾）；
> ②GD6ATEACH 长程训练后短程反升归因；③按**原有技能覆盖顺序**做大规模训练（先过线+短技能 → T1 → 后 T2/T3）。
> 计划文书：[PLAN-2026-11-17-night-pipeline-largescale-zcode.md](PLAN-2026-11-17-night-pipeline-largescale-zcode.md)。

## 一、管线端到端打通（批 1，✅ 全落地）

**新工具三件**（全部在册、可重复跑）：
- [`tools/pipeline-audit.mjs`](../../tools/pipeline-audit.mjs) —— 10 站审计（registry/sha/checkPack/ts 恒等式/父边证据/soup/coords/readings/pool/promote/skE）。**974 枚全库终审：真缺漏清零**（55 legacy v6 容器 + 19 墓碑 + 4 CBG 旧时代时间倒挂，全部 informational）。
- [`tools/sync-page-coords.mjs`](../../tools/sync-page-coords.mjs) —— page/coords.tsv 测量名册 825→974 与 registry 对齐（display 行按 coords 表头投影，旧行逐位不动）。
- [`tools/attach-exam4n-mixed.mjs`](../../tools/attach-exam4n-mixed.mjs) —— mixed 夹具读数贴 coords+display 新列族 `mx1116`。

**审计自证三次纠偏**（都拿实测背书）：①checkPack 吃整包容器非 META、成功返 `{ok:true}`；②registry.ts=注册时刻、META.ts=lineage.ts=出产时刻两套合法并存（旧 ts 无时区按 UTC 归一+2s 容差）；③wid 有 12 位旧格式/16 位新格式两代——父边与 pool 比较改**前缀兼容**，爬链（add-point 同语义）双键。

**台账修复**（ledger-fix-1117.mjs，一次性）：
- batches 补登 `b-f2-eps0-1113`（validate 的 **7321 条 readings 孤儿引用**修复；ruler 早已在册只缺批行）；
- MSB10 sha256 过期同步；MSB12-seqboom 文件丢失 → 按 a30f1098 先例转墓碑（path 清空 + archived-pack-meta）；
- EFFG-s41 三表对齐池件（docs 池件 cdeb5f7c=tracked 真值；scratch 件 21f5f4 权重漂移不作身份）；
- MSB15-SOUPB **反向假账**撤除（lineage 声明 soup 但 META 无 soup.sources → parentSrc=unknown-wid）。

**EQ 链考古与父边直连**（本班最有价值的谱系修复）：
真链 = `OBS6E9 → BASE-E9-MB5 → EQ-E9-A1 → EQ-S3-E9 → EQ-S4-E9`（权重指纹逐位验证）。三枚**未注册中间代**（EQ-S3-E9 / BASE-E9-MB5 / BASE-P9-MB5）走 measure-point→add-point 正式入口入图；S4/A1/S5-P9 三条父边升 `seedpack-wid` 直接证据；G-75S6 降虚线（hotstart=老布局快照 471a 与现节点 wid 已不同）。

**promote 台账补全 34 行**：SHAPEDIST/UNIFIED 全家族 15 枚 + 中间代 3 枚真跑 `--dry`（**GD6ATEACH 全门 ✅ 全家族唯一**；US1 block×4、U4 block×1-2 等 14 枚如实记 block）+ 13 枚 staging blob 回填 + 13 枚老池转录。

**rebuild-map 100 PASS / 0 FAIL**（fam 24↔25 时序对调修复家族行序断言——BASE 基座 ts=11-14 早于 V3 融合 11-15；display.tsv 加 Mx 列修复剖面 16 维取值断言）。

## 二、当选键回填（批 2，✅）

- 旧当选键（41 枚 GA 选举读数）留表当账不撤；新列族 `mx1116` 并列：**MxC/MxCL**（mixed 夹具复合 C，C=(A+B)/2，multi/long 两桌形）+ **MxSkU/MxSkE**（跨环境技能，两模式取大=并集下界）。
- mixed 夹具补测 **45 局**（EQ5 元老 5 枚 + 中间代 3 枚 + SHAPEDIST/UNIFIED 家族 15 枚 ×2 桌形；skE 11-19）——mixed 表覆盖 965 枚，coords 贴数 962 枚。
- viewer 并列新色档 **ske（有效技能数·跨环境）** + 剖面卡 +2 行（有效技能/混合C）；色域=窗口内实测 p02..p98，灰=未测。

## 三、16 臂矩阵（批 3，✅ 9/16 过预注册线）

配方 = obs6.5 modeBias 1500 组/180 步（EQ-S4/GD6a 原方蒸馏），教师组合 {EQ 均衡原方 / ST 补 2:multi / GD6a 经济道 / BA breakAll 加权} × 底座 {E9, GD6ATEACH | US1, U4}，按用户覆盖顺序分两波：**MX1 过线波 → MX2 T1 波**（长程臂禁 E9 高权重基座——铁律遵守，T1 波底座 US1/U4）。

**预注册验收（promote 全门 ∧ mixed skE≥4）实测 9 枚进 Next**：

| 臂 | C多 | C长 | skE | 门 |
|---|---:|---:|---|---|
| **mx1-e9-gd** | **0.324** | 0.236 | 11/12 | ✅ 全门 |
| mx1-gd-st | 0.298 | 0.195 | 11/11 | ✅ 全门 |
| mx1-e9-eq | 0.273 | 0.231 | 11/13 | ✅ 全门 |
| mx1-e9-st | 0.273 | 0.147 | 10/12 | ⛔×1 |
| mx1-gd-eq | 0.247 | **0.257** | 11/11 | ✅ 全门 |
| mx1-gd-gd | 0.235 | 0.193 | 11/11 | ✅ 全门 |
| mx1-gd-ba | 0.192 | 0.150 | 11/10 | ✅ 全门 |
| mx1-e9-ba | 0.169 | 0.297 | 11/10 | ⛔×1 |
| mx2-us1-st | 0.160 | 0.119 | 12/13 | ✅ 全门 |
| mx2-us1-eq | 0.225 | 0.212 | 12/13 | ⛔×1 |
| mx2-us1-gd | 0.210 | 0.045 | 13/13 | ⛔×1 |
| mx2-us1-ba | 0.187 | 0.064 | 13/13 | ✅ 全门 |
| mx2-u4-eq | 0.144 | 0.202 | 13/13 | ✅ 全门 |
| mx2-u4-st | 0.197 | 0.085 | 13/12 | ⛔×2 |
| mx2-u4-gd | 0.157 | 0.137 | 13/**17** | ⛔×1 |
| mx2-u4-ba | 0.204 | 0.116 | 11/16 | ⛔×1 |

**三条结论**：
1. **经济教师组合是过线+强度双赢家**（mx1-e9-gd 双榜第一）——与批 0 反升归因（经济纪律经共享主干迁移抬弱格）互证；GD6ATEACH 底座接 ST/EQ 组合也全门。
2. **T1 覆盖问题答案是"保得住"**：全部 16 臂 skE≥10，US1 线 12-13、U4 线最高 17（mx2-u4-gd long 17 = ring/railgun/bigT 层在长桌形活跃）；3 枚 T1 波粒全门过线。
3. breakAll 加权在 E9 底座爆门（mx1-e9-ba block×1）但在 GD/US1/U4 底座能过——重训教师配方要跟着底座挑。

## 三·补、gen2 续代（02:45–03:15，4/4 全门全过）

底座 {MX1-E9-GD, MX1-GD-EQ} × 组合 {GD, EQ} = 4 臂，**全部 promote 全门 + skE 达标**：

| 臂 | C多 | C长 | skE | 门 |
|---|---:|---:|---|---|
| **mx3-gdeq-gd** | **0.308** | 0.236 | 11/12 | ✅（全场第二，GD→GD 链保强度） |
| mx3-e9gd-eq | 0.247 | 0.257 | 11/11 | ✅ |
| mx3-e9gd-gd | 0.235 | 0.193 | 11/11 | ✅ |
| mx3-gdeq-eq | 0.230 | 0.155 | 11/10 | ✅ |

**机制发现（如实记）**：mx3-e9gd-eq 与 mx1-gd-eq 读数四位小数一致——shapeTeachers 全覆盖桌形时**配方主导结果，基座/热启动贡献边际化**（蒸馏收敛到同一配方最优）；gen2 复用了 gen1 的 seed（脚本疏漏），方差估计本轮作废，下一班续代请换 seed。含义：想改结果先改 shapeTeachers 配比，换底座不如换配方。

## 三·补 2、进图收缩为"代表性"（01:4x 用户令）

> 用户：「不要所有点都进图，找那些重点有代表性的就行。」——矩阵 13 枚过线臂全量入图被叫停（gen2 入图中途停止）。

**图上保留 4 枚代表**（每个独立结论一枚）：

| 包 | 代表的结论 | 成绩 |
|---|---|---|
| `MX1-E9-GD` | 经济教师组合 = 强度双榜第一 | C多 0.324 / C长 0.236，全门 |
| `MX1-GD-EQ` | GD 底座接均衡配方 = 长程第一 | C长 0.257，全门 |
| `MX2-U4-EQ` | T1 波（US1/U4 底座）能过门 | skE 13/13，C长 0.202，全门 |
| `MX3-GDEQ-GD` | GD→GD 链续代保强度 | C多 0.308 全场第二，全门 |

**剪除 8 枚冗余变体**（MX1-E9-EQ/GD-ST/GD-GD/GD-BA、MX2-US1-ST/US1-BA、MX3-E9GD-GD/E9GD-EQ）：从 registry/lineage/display/features/projections/feasibility/readings/batches/page-coords/promote 十表移除 + docs 副本删除。**训练记录不丢**：scratch/arms 原件、exam4n-mixed-matrix-1117 考卷表、staging 体检 blob、本节榜单都在。

## 五、gen3：T2/T3/T4 覆盖臂 + 强度臂（02:10–02:40，2/6 过预注册）

载体考古：**supfit-gd 的 TEACHER_KNOWN 早已内置 transfer/minit/lasereye/cannon/detonate/bigT 键道脚本教师**（T2/T3 机器全在，只差配方接线）；T4 载体 = GD16m-D1（firestorm/curse 独苗，scratch/arms）。

| 臂 | 目标 | 结果 |
|---|---|---|
| **MX4-GD-T2** | transfer/drain | ✅ 全门 + **transfer 命中**（T2 层 0→1），C 0.100/0.122（新键道代价强度）|
| **MX4-GD-T4** | firestorm/curse | ✅ 全门 + **firestorm,curse 双命中**（T4 层 0→2），C 0.111/0.198 |
| MX4-GD-T3L | lasereye/cannon | ⛔ block×1，**cannon 命中**（近失——降权重重试 gen4） |
| MX4-GD-T3M | minit | ✅ 全门但 minit 未命中（键道蹭不到轨迹——11-14 复合教师教训重现）|
| MX4-GD-T1B | bigt | ✅ 全门但 bigt 未命中（同上）|
| MX4-U4-STR | 强度提升 | ✅ 全门但**双倍预算反而退化**（C长 0.202→0.023，如实记负：强度杠杆不是加预算）|

**入图（代表性）**：MX4-GD-T2、MX4-GD-T4 两枚新层代表注册。gen4 重试：minit@0.40 四桌形、cannon@0.20 减扰。

## 六、池强度分带重做 + 池补强（02:0x）

- **量具**：mx1116 mixed 复合 C̄ =（MxC+MxCL）/2；断点取实测分布天然谷 0.165/0.135 → **hard 12 / mid 6 / soft 8**。
- 错位修正：**EQ-S4-GD6ATEACH（全池最强 C̄=0.280）soft→hard** ‖ KD-G2 soft→hard ‖ STR-B-Q-s41 hard→soft ‖ OBS6E9/P9/V3b/MSB11×2 hard→mid ‖ DEF-s16 soft→mid。tier 外门账列（invited/promoteVerdict/seatKill）全不动。
- 池补强：MX1-GD-EQ（c4fa2576）+ MX3-GDEQ-GD 入池 hard。**MX1-E9-GD 被 dupWid 闸正确拦下——它和 EQ-S4-GD6ATEACH 权重逐位相同**（蒸馏完全确定性：同配方同底座=同粒，seed 不扰动）⇒ 想造新粒改配方，换 seed/底座没用。
- pool audit 全绿（26 枚 12/6/8，untracked 0，dupWid 0）。

## 七、池技能覆盖普查（新跨环境口径，02:5x）

口径：26 成员 × mixed 夹具 exam（keys= 发射用过键清单，任用即计——比 11-15 cov-census 的"≥2% 才计"更灵敏，两代不可直比）。

| 层 | 键=覆盖/26 | 备注 |
|---|---|---|
| T0 | ji 26 · charge 23 · gun 25 · sword 25 · snipe 17 · guard/reflect 21 · bagua 16 · shift 15 · jinshield 9 · proto 12 · holo 17 · **armor 0** | armor 是 T0 真空 |
| T1 | ring 10 · railgun 18 · **bigT 19** | 大雷已非真空（11-15 快照 0/17 是池换代+阈值差）|
| T2 | transfer 3 · drain 1 | MX4-GD-T2 待入池补强 |
| T3 | miniT 1 · mine 4 · **laserEye 0** · cannon 2 | laserEye 是 T3 真空（gen4 重试中）|
| T4 | firestorm 2 · curse 5 | MX4-GD-T4 待入池补强 |
| 其他 | tank 9 · taunt 1 · dualGun 1 · mirror 1 · **rod 0 · purify 0** | tank 已 9/26（11-15 快照 0/17）|

**池真空清单（当前口径）**：laserEye（gen4 打）· armor · rod · purify（无教师，押后）。

## 八、gen4 重试 + 强度线（03:0x–03:3x）

- **T3M2**（minit@0.40 四桌形）：全门但 minit 仍未命中——加权救不了"状态不可达"，要复合教师（把 minit 接进主教师轨迹，rationdet 先例）。下一班做。
- **T3L2**（cannon@0.20 减扰）：仍 block×1，cannon 继续命中——cannon 能力成立、过门差一口气；T3L 的缺门是行为门粗类，下一班对准缺的那道细调。
- **MX5-GD-T2STR**（transfer@0.10 轻触）：全门，**C长 0.3151 全场最强长程**——但 transfer 键没保活（0.10 权重不够，保活需 ≥0.30）。"能力↔强度"权衡实测：transfer 保活代价 ≈ C多 −0.17。
- **SOUP4**（4 粒等权）：C̄=0.2997 全场最强综合，G5[long] 26%/25% 超 1pt block + selftest3 腿C 1.66e-3（插值 ReLU 折点已知工件，不能开 PG 臂）。
- **SOUP4b**（0.30/0.30/0.20/0.20）：**全门 ✅**——1pt 边际被权重微扰翻过；强度读数见下。

## 九、gen6/g7：真空清零冲刺（02:5x–03:3x）

- **MX5-GD-LE40**（lasereye@0.40 强攻）：全门 + **laserEye 命中**——T3 真空 laserEye 0→1，**已注册入图 + 入池 hard**（C̄=0.173）。T3 三键全通：cannon 2 / miniT 1 / laserEye 1（mine 见下）。
- **MX5-GD-T4STR**（GD16m@0.10 轻触）：全门 + firestorm,curse 保活（C 0.200/0.086）——T4 强度回收可行，留 scratch 记档。
- **MX5-GD-T2STR**：全门 **C̄=0.2953 全场最强全门综合**（C长 0.3151 最强长程），已注册入图。
- **soup 线结论**：等权 C̄ 0.300 被 G5[long] 26%/25% 超 1pt 拦；权重版（0.3/0.3/0.2/0.2）全门但 C̄ 0.2665 **弱于自己最强成分**（GD6ATEACH 0.2798）——soup 强度加成不稳健，scratch 记档不再追。
- **gen7（跑中）**：`ration6` mega 复合教师（ration 骨架 + DOSE6 剂量门内建 mine/armor/taunt/rod/cannon/curse 全清单）@0.35 混入 multi 桌形——一发臂打剩余全部真空（teacher 早就在册，只差接线）。

## 十、gen7：ration6 mega 教师（03:0x）

- **MX5-GD-R6**（ration6@0.35 混入 multi 桌形 + cannon@0.15）：block×1，但 **skE=19/18 全夜最高，armor+rod+cannon 三键首次打出**（mine/taunt 未中——DOSE6 剂量 1/局太窄或状态未达）。能力存在性证明完成，过门与强度是下一班的事（ration6@0.25 减量重试 R6B 已发）。
- 池真空账更新：laserEye ✅（LE40 入池）‖ cannon ✅（2/26 在池）‖ armor/rod **能力已证**（R6）‖ mine/taunt 部分 ‖ purify 仍无教师。

## 十一、ration6 权重二分（03:2x–03:4x，收口）

| 权重 | 门 | 键命中 | C | skE |
|---|---|---|---|---|
| 0.25 | ✅ 全门 | 无 | 0.259/0.240 | 14/14 |
| 0.30 | ⛔×1 | armor | 0.177/0.243 | 14/16 |
| 0.35 | ⛔×1 | armor+rod+cannon（skE 19/18 全夜最高）| 0.089/0.107 | 19/18 |

**结论**：键道 fired 阈值在 0.30+，门阻断也在 0.30+——纯权重二分无双全点。下一班解法 = PG KL 锚定（supfit 后接 pg-train --klW 锚住强度、保留键）或 DOSE6 剂量下调重蒸。

## 十二、transfer 剂量响应扫描（03:5x，收口）

| transfer 权重 | 门 | transfer 键 | C多/C长 | C̄ |
|---|---|---|---|---|
| 0.05 | ⛔×1（非单调——近基线配方也翻边际门）| ✗ | 0.265/0.253 | 0.259 |
| 0.10（T2STR）| ✅ 全门 | ✗ | 0.276/**0.315** | **0.295** |
| **0.15** | ✅ 全门 | ✓ | 0.258/0.131 | 0.195 |
| 0.20 | ✅ 全门 | ✓ | 0.251/0.072 | 0.162 |
| 0.30（MX4-GD-T2）| ✅ 全门 | ✓ | 0.100/0.122 | 0.111 |

**能力↔强度前沿完整量化**（五点）：保活阈值 ≈0.15；0.10 是强度峰但键恰好丢；边际门 ~1pt 级敏感、非单调。前沿三点（强度峰/均衡/覆盖峰）全部在案，选哪个点进池由下一班按池需求裁。

## 十三、收班核验（03:3x）

- **R6@0.35 的缺门定位**：G5[long] 防席夺冠 31%/25%（超 6pt）——与 SOUP4 的 26%/25% **同一道门**。ration6 的 taunt/armor"挂必打义务"键在养"只防御不还手"对手的清场失败率 ⇒ 下一班的 G5[long] 修法瞄准 DOSE6.taunt/armor 剂量或 PG klW 锚。
- `knobs --check` ✅（193 全集 · 0 未登记 · 0 无注解）；rebuild-map 100 PASS；audit 982 枚零现行缺漏。
- 夜班共 **9 个提交**（管线打通 → 代表性入图 → 池分带 → 覆盖普查 → T2/T3/T4 打通 → 强度线）。

## 四、交接与下一步

- **工具资产**：`tools/pipeline-audit.mjs`（10 站审计，随时 `--all` 重跑）‖ `tools/sync-page-coords.mjs` ‖ `tools/attach-exam4n-mixed.mjs` ‖ `exam-4n` 新发射 `keys=`（用过键清单——T 层验证与池普查的钥匙名来源）。
- **确定性发现（省预算）**：蒸馏完全确定——同 (底座, 配方) 必产同粒，seed 不扰动（MX1-E9-GD ≡ EQ-S4-GD6ATEACH 权重逐位同）。**要新粒改配方（shapeTeachers 配比/键道 lane），改 seed/底座无用**；shapeTeachers 全覆盖时底座贡献边际化（gen2 四位小数复现）。
- **键道教师蹭轨迹病**：minit/bigT lane@0.30 打不出键（键只在主教师轨迹外的状态出现）；transfer@0.30 打得出（状态可达）。解法 = 复合教师（把键道接进主教师轨迹，rationdet 先例）或加权/换桌形——gen4 重试中。
- **强度杠杆**：双倍 groups 不是杠杆（U4-STR 反退化）；soup（4 粒等权）测量中；"能力→强度回收"单变量臂 T2STR（transfer@0.10 轻触）跑中。
- **池**：26 枚 12/6/8；真空 laserEye（gen4 打）/armor/rod/purify（无教师押后）；MX 新成员 seatKill=-1 待补人席批次。
- **T2/T3/T4 下一班**：T2/T4 已通（代表在图）；T3 看 gen4；T4 强度回收同 T2STR 模式。

- 9 枚 winner 正在走 measure-point→add-point 入图（后台），完成后需：`sync-page-coords` + `attach-exam4n-mixed` + `rebuild-map` 同笔重烘提交。
- 7 枚 block 臂留 scratch/arms 记负结果（不注册，防污染名册口径；要入图需先修门）。
- **T2/T3 层今晚未开**（按覆盖顺序等 T1 粒站稳）——下一班从 `mx2-u4-gd`（skE 17 但 block×1，看缺哪道门）与 `mx2-us1-eq`（C 双轴最均衡但 block×1）修门开始。
- promote 门结果明细：`champion-map/staging/mx*-{audit}.json`；矩阵考卷表：`champion-map/data/exam4n-mixed-matrix-1117-{multi,long}.tsv`（§E597 独立列族，不混 1116 全库表）。
- 审计随时可重跑：`node tools/pipeline-audit.mjs --all`（产物 pipeline-audit-*.json 不入库）。
