# STATUS (2026-11-19 深夜 → 11-20 凌晨 · zcode) —— B 轴 24/24 锚恢复 ‖ 恢复工具箱升格 ‖ DS-P0 路线首证

> 接力：[HANDOFF-2026-11-19-anchor-recovery.md](HANDOFF-2026-11-19-anchor-recovery.md)（Gemini 恢复班）→ 本班（用户令「gemini 已收工，你可以动工作区」→「尽可能恢复尺中所有包…会话记录挖参数」→「好东西不留 scratch」）。
> 全部命令/判据在 [RECIPE-BOOK-1119.md](RECIPE-BOOK-1119.md) 与 [RECOVERY-TOOLKIT.md](../RECOVERY-TOOLKIT.md)。

## 一、B 轴 24/24：7 枚缺失锚全部逐位复现（方法=会话挖掘）

| 锚 | wid | 关键 |
|---|---|---|
| OBS6-LH6 | `b768758160541e66` | **原始命令出土自 Gemini 5ae 班 step3044**——白班 32 发教师栈全错（真栈 t1=OBS6-LH2 + E9@0.76 带 12 键过滤 + GD16m-D1@0.14 + lasereye 脚本教师@0.06），第一发即中 |
| OBS6-LH6P | `457e635123000e85` | 原始命令出土（step3070）：baseline=mean/temp=0.5/lamC=0/klW=0.06/lamF=0.02/lamExp=0.04/lr=0.0002/segEvery=1000/arenaShapes=2:multi,3:long,5:multi,5:long,8:multi——与白班重构完全不同 |
| OBS6-SHAPEDIST-V3S2 | `669145027f8020ae` | 六路融合重建（recipe 真值在 08c29d18 的 provenance 脚本）×1e6 舍入 |
| OBS6-SHAPEDIST-V3a.snap0 | `377e81aba5e70b48` | V3a 在 **a0feae0f 代码**上复现——残差根因=**代码漂移**（提交 21:53 vs 生成 20:42），当前代码标签 charge 416 vs 原始 505，a0feae0f 上 505/26/21/2 四项全中；teacher2 历史版零影响已排除 |
| DIV-V3-PRESSURE-S2 | `1c726b7bfaf2f345` | seed=11181（bf303d0d 时代旗标，wt-repro-1118pm） |
| DIV-V3-ANTIDEF | `0c31e13f5ab6ba9c` | seed=11186 |
| DIV-LH6-HEAVY-S2 | `6b7b5fc2dcba1834` | seed=11182 |

（前三枚 v7blk1-92/MSB13/P9-CN-MINI-CONT/TZ2C 由白班恢复，本班补 git 登记。）**收尾验真**：arena-eval 静默通过 ‖ V3a 整臂闭环（snap0+终粒 `94f1343c` 双双逐位）‖ 门禁 np/meta+spec+smoke+battle+map 全绿。

## 二、三件根因诊断（复现学）→ 立法

1. **教师栈错=全错**：LH6 真栈里有白班不知道的两个角色（t1=LH2 干净底座、t4=lasereye 脚本教师）+ t2 带键过滤。**挖原文，别重构。**
2. **代码漂移是隐形变量**：生成时刻的 working tree ≠ 之后任何 commit。a0feae0f（21:53 提交）≠ 20:42 的树 ⇒ 复现要 worktree 到生成时刻**之前最近的 commit**，并且接受「未提交改动不可复原」的残余风险（本例 a0feae0f 恰好命中）。
3. **舍入模式是身份的一部分**：V3S2 融合 ×1e6 舍入命中、无舍入不命中。
4. **seed 不进权重路径的旗标不是随机变量**（→ METHODOLOGY §150）：supfit-gd `--seed` 只进 META；"种子对照"臂设计前先反查 RNG。

## 三、工具升格（用户令「好东西不留 scratch」→ docs/RECOVERY-TOOLKIT.md）

`tools/pack-soup.mjs`（n 路融合+wid 试金）‖ `tools/session-mine.mjs`（四 harness 挖掘：gemini/zcode/dsh/qoder）‖ `tools/anchor-recover.mjs`（对账恢复）‖ `tools/pool-xray.mjs`(池 X 光)。全部实战验证过（pack-soup 一发命中 V3S2；pool-xray 即今晚分带量具升格）。

## 四、P1 · DS 研究路线首证（[HANDOFF-2026-11-19-day-training-and-cleanup.md](HANDOFF-2026-11-19-day-training-and-cleanup.md) §五）

| 臂 | 配方 | arenaB | 判定 |
|---|---|---|---|
| **night2-E1-det-strong** | **DS-P0**：EQ-S4-E9（+14.3）做基座+主教师 0.70 + detonate 专科 0.30 | **−30.36pt（极差 10.6）** | ✅ **promote 0 阻断全过，已入池 soft**（25 枚）——比同系蒸馏产物（S6 −104.8/X2b −87.2/det-gd −88.9）好一个数量级；强包锚定防洗塌成立 |
| night2-E2-det-pg | det-realpg.seg1500 续训（真包×5+aggro/wall/ringspam+ridge） | **−104.67pt** | ✗ 负结果：白班成果被洗掉（−81→−105）——续训方向/参数错，det 系续训的 lr/kl 需单变量重校 |
| night2-E3-det-share35 | E1 单变量：专科份额 0.30→0.35（seed 2026112002，wid a6c4605f610c424b） | **−39.51pt（极差 53.2，−17~−71）** | ✗ 负结果：**「专科份额加码到 0.35~0.40」方向被否**——中位差 9.2pt 且抖炸；0.30 靠近剂量甜点 |
| night2-E4-t2str-det | E1 单变量：锚换 MX5-GD-T2STR（+20.5，t1/t2=4540/2060，seed 2026112003，wid aeae5686ca04a5a3） | **−25.09pt（极差 24.5，双峰 −10.5×3 / −31~−35×3）** | ⚠ 中位好 5.3pt 但稳定性降级（E1 极差 10.6）——**强锚换装方向值得跟**，下一臂=同配方换 seed 对跑验证双峰是不是种子噪声，或 0.65/0.35 份额下压 |
| night2-E5-det-share25 | E1 镜像：专科份额 0.25（AGENTS 18 镜像对照，seed 2026112004） | **−25.10pt（极差 28.4）** | 剂量曲线闭合：**0.25→−25.1 / 0.30→−30.4 / 0.35→−39.5，两侧都塌且极差 10.6→28.4→53.2 爆炸**——E1 的 0.30 是窄甜点；"份额加码"与"减码"两方向同时被否。新经验：teacher2 份额的剂量扫描必须带极差轴，偏离甜点 = 中位掉 + 稳定性双杀（是否跨专科教师普适待复证，暂不进方法论） |
| night2-E6-t2str-det-s2 | E4 同配方换 seed 2026112005（双峰归因设计） | **与 E4 wid 逐位相同（aeae5686ca04a5a3），arena 读数逐字节同** | 臂作废但换来方法论 §150：**supfit-gd 的 `--seed` 是 META 记录字段不是训练变量**（训练 RNG 硬编码 LCG 20261030）——"种子对照"在这条管线里天然无效；E4 的 arenaB 双峰是**权重的固有环境方差**（3 环境 −10~−19 / 3 环境 −31~−35），换 seed 平抑不了 |
| night2-E7-cannon30 | E1 单变量：专科教师 detonate→**cannon**（过载炮专职，X4 toolkit 失败的正解教师；0.30 同份额，seed 2026112006，wid 4dbee487194173f4） | **−39.64pt（极差 24.3）** | ✗ 负结果：换专科轴也否——cannon 比 detonate 差 9.3pt 且抖；**E1（EQ-S4-E9 锚 + detonate 0.30）在"换份额/换锚/换专科"三轴上全是局部最优**，DS-P0 配方定型 |

**用户令追加（01:2x）**：① 千问 v7 期训练会话重挖（此前"0 命中"结论错——v7 用 train-3p/EPIRUS_* 形态，不是重构后形态）② v7 图上配方直接复刻。**复刻路线实验定案**：主仓 `--mode=v7` 恢复版**不能**逐位复现 era 包——v7 训练沙箱消费**整树 js/***，era 包必须 **era 整树** ⇒ 方法论 §151 立账。**主仓管线修理落地（2b85f78c）**：train.mjs `--mode=v7 --era=<commit>` 委托层（自动建/复用 era worktree、母本同步、产物路径转主仓），烟测 Q-s47 一发命中。

**v7 复刻日总账（02:3x）**：**52 枚逐位复现落仓**——Q-s33/38/51（era 树）‖ K2 家族 **44/44 批量全中**（P/T/U/V/plainAnchor 纯续训 21+G/S/H guardSpam 13+snipePool/SP/R snipeSpam+IMIT 8+snipeNoPool 2+K-s63 1；配方从幸存者 band META 的 recipe.env 出土，k2-batch.mjs 主仓委托并发 6，36 分钟）‖ Lspend（dsh 原文配方，era=94cfc7e7 econ 族 5 键接线 commit）‖ 外加 Q-s47 本尊委托验证。台账 **missing 662 → 605**。**K2 家族 59 枚全清归位**。详见 [V7-ERA-SESSION-MINING-2026-11-20.md](V7-ERA-SESSION-MINING-2026-11-20.md)。

**famLabel 索引（用户点名）**：registry fam_label=家族级配方账 ⇒ 剩余 605 枚的家族分布与考古工作清单已落 V7-ERA 文档 §七。**server 系根阻断判定（§八，重要负结论）**：C1/C2/C3/B1/B2/A+d13d3c85 家（492+380 枚）的热启动根链指向**已删的 pre-v1.5.18 未播种时代祖先**（SLOT-e379c62c，era 代码自注「产物永远不可复现」）⇒ 逐位复现数学上不可达（era checkpoint 不在 git、祖先四路寻获零命中、C 系父权重在盘数=0）——下一班别再往 server 回放花算力，除非用户提供更早备份。剩余可挖：B 家族正主会话（47 枚）‖ def/v7bead 等小族配方。

**E 系终局判定**：E1（EQ-S4-E9 锚 + 0.30 份额）仍是 DS-P0 路线的入池代表——剂量曲线 0.25/0.30/0.35 两侧都塌且极差爆炸（10.6→28.4→53.2），0.30 是窄甜点；MX5-GD-T2STR 锚 = 更高上限更偏科（med −25.1 但固有极差 24.5，最坏格 −34.9 ≈ E1 的 −34.5），按"进图只收代表性包"留 scratch，池里若要"高上限偏科带"再提。E4/E6 同 wid 只算一枚。

## 五、P2 · 批量重产：wid 目标账已全齐，剩下的是源盘

- **wid 目标账不用考古了**：1.8 全集的 wid 本来就在 `page/lineage.tsv`（1002 行）——`tools/anchor-recover.mjs` 之前只读 lineage-g3.tsv 才显得缺 614 枚。两表并读后 **wid 目标 1004 条，缺失 662 枚全部有 wid 身份判据（无 wid 目标 = 0）**。
- **批量重产工作清单已建并全部闭环**：`tools/recipe-index.mjs` 四 harness 全量挖 `--out=` 命令（64959 条）对缺失台账 → 11 枚缺失包有原始命令 → **当晚全部定性**：KD 链 4 枚逐位复产（见上）；CB-combo-v2 阻断（era 冒烟闸）；**EQ-E9-A1/S5-P9 阻断（新类别：非在册教师依赖）**——真配方出土自 gemini transcript（`--shapeTeachers` 十一形套件+groups=4000/lr 0.0007，"最早命令"≠"最终命令"），但教师件 BASE-U1-2L/DEF-s15-band6 零 git 历史、零台账、零盘 ⇒ **不在册教师 = 永久不可复产类**；UNIFIED-U1/U4+OBS6D3 阻断（上游 V3S2-MB/U2.snap0/OBS6A4.seg1000 盘上无源）。**qoder 定性**：segments 是生命周期遥测、projects/*.jsonl 是别项目对话——千问从未在本仓跑训练，0 命中是真答案。
- **复产学新账**（照 RECIPE-BOOK 体例）：era 选取不能只看 lineage ts——KD-K2-l 的 ts 早于 `--teacher` 旗标存在 ⇒ era 按"旗标何时进工具"选；台账路径 ≠ 原始命令落盘路径（KD-K2 台账在 docs/artifacts/night-adapt/、原命令写 scratch/night-adapt2/）⇒ 恢复以台账路径为准。
- **当晚已照单复产 4 枚（KD 链整链逐位命中）**：
  - **KD-V7** `61164b09cac44d2d`（era 4ea71a74，上游 scratch/ga-arms/L5-D4a-s13.js 在盘，一发即中）
  - **KDFULL2** `1529c10b509c9de8`（era 8ce59307，v1 步数变体未中、v2 steps=3000 命中——**留出 78.7% 与该 commit 自述互证**；两变体都在 recipe-index 里，取 earliest 不灵就试下一个）
  - **KD-K2-l** `9ed57f4e9a3d98e1` + **KD-K2** `e2306c670a4c1a3f`（era 90150d1b——**lineage ts 11-07 23:35 早于 `--teacher` 旗标存在（11-08 01:09）⇒ ts 不可靠，era 按"旗标何时进工具"选**；`$T=kept/e70-out__D02-31.bak` 从 zcode 会话原文出土）
  - **CB-combo-v2 未中**（era 348728e1 冒烟闸把产物拦了：过期 34.7 颗/局 > 5——原跑在闸更松的未提交代码上；11-03 老 GA 品，不追）
  - **新坑两件**：① `--out=` 产物在台账的路径可能 ≠ 原始命令的落盘路径（KD-K2 台账=docs/artifacts/night-adapt/、原命令写 scratch/night-adapt2/）⇒ **恢复以台账路径为准**；② `.gitattributes` 的 .bak binary 护罩原只盖 `docs/artifacts/*.bak`（* 不跨目录，night-adapt 等子目录全裸）⇒ 已全局化 `*.bak binary`。
- 台账对账顺手清账 5 枚：MSB13/TZ2C/v7blk1-92/P9-CN-MINI-CONT 其实白班已恢复入仓（wid 四枚逐位验证），只是台账没翻 ⇒ missing→ok；GD16m（LH6/LH2 链的关键教师）从 wt-repro-1114 落回 `scratch/arms/GD16m-D1.bak`（--do 逐位复验）。
- 真正的瓶颈变成 **无源**：盘上（隔离区+4 个 worktree+主仓 scratch/docs，3955 文件 / 947 唯一 wid）只能直接对回 **1 枚**，其余 657 枚要靠会话挖掘配方 + era worktree 批量重产（RECIPE-BOOK 已有部分配方）。
- dsh（.zstd，已解压挖掘：7 会话 1406 条命令）与 662 缺失清单**零交集**（9-10 月 claude 导入时代错位）；qoder 尚无命中案例，探路模式。
- 会话挖掘已就绪：`tools/session-mine.mjs --harness=dsh/qoder`。

### 附带修复（入池链条上的契约漂移，E1 收尾时抓到）

1. **add-point registry 9→25 列**：d78ef34f 给 registry 补 16 列训练配置但没同步 add-point 的 `newReg` 字面量 ⇒ 新包入账即崩（E1 首次重放当场咬到）。修复：1.8 从 lineage.tsv 同名/wid 行回填 16 列（与白班批量回填同法、单一来源不变），2.0/G3 留空（与在册 83 枚 2.0 行同例）。
2. **anchor-recover wid 目标源扩成两张 lineage 表**（同上，662 全覆盖）。

## 六、池/图现状

池 **25 枚**（hard 11 / soft 14）+ night2-E1-det-strong（soft，promote 0 阻断，Stage1 16/30 ‖ Stage2 23 技）——bundle/图/skill-report 全部重烘同步；**E1 图节点补全走完完整链**（首枚产物落账发现 measure-point 链上次在 add-point 中途断掉：lineage 落了而 registry/display/features/readings/projections 全缺 ⇒ `--reuse` 重放补完，map 池层自检 100/0）。

**遗留建议（等用户裁）**：DS §五-P2 提议退役软带负资产 night2-S6（−104.8，0/315 废贴）与 night2-X2b-fuse（−87.2，0/671）——但这两枚是用户 11-19 深夜点名入池的，本班不擅动。
