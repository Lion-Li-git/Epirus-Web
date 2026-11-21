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

## 七、11-20 清晨续班（06:30→08:5x · 用户点名三线）

用户三问：①「最早一大批包都是 1.3.58 冠军训练出来的，旧槽位冠军应该都写死在当时的槽位 js 里面，能不能找到」②「你搞半天还是只跑了 k2 家族，ldemo 家族和 t8-s114 家族也有一堆包才对」③「obs3 和 obs5 时代的包有没有可复现的」。

### 7.1 槽位考古（87f2c849）：**16 枚 SLOT 全清 + server 系根回盘，台账 605→586**

`slot-timeline.tsv` 40 段逐段 `git show <引入提交>:js/bundled-champion-3p.js` → widOf 守卫 **40/40 全过** → v<7 嵌 v7 → **19 枚缺失行逐位命中**（16 SLOT + v7press-36/v7tgt2-52/v7n1-31）。**SLOT-e379c62c=d13d3c85（584 枚 server 系的热启动根）回盘** —— V7-ERA §八判定第 3 条（"祖先包缺失不可再生"）作废；§八其余三条（server checkpoint 不在 git / pre-v1.5.18 未播种时代 / archive 零命中）不变 ⇒ server 系可复现面变成"根有了，但 server 训练本身的回放器还没建"（train-server.mjs 时代是 HTTP 驱动 + 逐时刻 checkpoint，与 train-3p CLI 不是一条管线——下一班先立 server 回放可行性小案，别直接烧算力）。

### 7.2 Ldemo/B 家族（fam 9）：幸存者 recipe.env 破译 + 三轮批量，台账 586→571→56x

**配方语义表**（幸存者实证；字母=旋钮、数字=seed 或剂量×100）：
- e66 B0=`COSTLY_W=0`；B0L=B0+SEL_KEEP（推）‖ e70 D= COSTLY_W 剂量（D02-31=K2 根实证 0.02）‖ e71 L=ANCHOR（L02=0.02）‖ e73 M05=纯 ANCHOR=0.05×seed 扫描 ‖ e75 NC=ANCHOR 0.05+COSTLY_W 0.02 **活性版** ‖ e78 G=ANCHOR（G03=0.03/G08=0.08/G15=0.15）‖ e85 E=ANCHOR 0.08+BEAD_W（E00=0/E10=0.10/E20=0.20）‖ e95 N5 未知 ‖ e100 B5=ANCHOR 0.08+BEAD_W 0.05/0.10（0.05 在 eb6fc3b7 树不生效，待 bd20cde2 试）‖ e106 N5L=ANCHOR×100（05/15/30）‖ e127 RG0=RING_OPPS=0+ANCHOR 0.08、RG1=RING_OPPS=1 ‖ e234（10-02）=母本 js/bundled-champion-3p.js×字母系（S=C05+SEL_BIGT6、T=C02、K=剂量、M=纯×seed、D0a/D1a/D4a/D5a=纯/C0.2/IMIT/long）。

**era 奢注判例三证成立**（旋钮接线提交晚于批跑 ⇒ 批在未提交树上 ⇒ era 取接线提交，wid 试金定生死）：S71@ab5c13df ✅ ‖ RG1-31/RG1-71@b1809983 ✅ ‖ NC-231@42d7c86e ✅。反例也入账：COSTLY_W 在 6e032309（v1.5.260 接线当日树）**行为惰性**（CALIB-D02-31 跑出 plain B0-31 的 wid）⇒ D 系真 era 也押 42d7c86e（计数门修复）。

**战果**：第一轮 15/20（G03-71/S71/T111/L02-31/L02-71/M05-111/151/191/231/RG1-31/RG1-71/E00-31/E00-71/E20-31/E20-71）+ 跟进 NC-231。**意外收获**：错配方跑出别的缺失包 wid 两枚（NC-231 臂跑出 M05-231、D005-71 臂跑出 NOL24-71——都已对号入账/验真）。**恢复件 META.ts 一律重写回 lineage 原值**（父边时间倒挂会红 probe-instruments——SOUP-KE-l60 那条边抓的）。

**余下阻断（fam 9 内 ~26 枚）**：e234 单字母臂 21 枚（驱动脚本四 harness+gemini steps 全失传——唯一残档=kr3 骨架的臂名单）‖ B0L-71（SK 语义未破）‖ N5L-15（A15 在 eb6fc3b7 呈 0.08 行为，剂量表未明）‖ V2-31（V 系无幸存者）‖ HF-191（e116 臂名 b<seed>，HF 语义未知）‖ N5-0（N5 语义未知）‖ NC-301/341/D005-31/71 在 42d7c86e 跑批中。

### 7.3 t8-s114 家族（fam 15）：**缺失清零**

51 枚 gen-3/GA 臂全在前波复产/在册——用户点名的这族其实已经整族归位，本晨对账复核确认 missing=0。

### 7.4 obs3/obs5 时代（2.0 小族 ~32 枚）复现性

- **CLONE-D4a 解封一半**：教师 D4a 本晨回盘（e234-out/D4a.js），上游 GD3-SWORD.bak 仍无源 ⇒ fam 14 五枚仍阻断。
- fam 19 obs5 课程链 14 枚（MSB*）：11-09~11 夜 supfit 臂，配方未进 RECIPE-BOOK，教师链（ration2 等）无源 ⇒ 需 11-09~11 夜班日志考古（下一班）。
- fam 23 obs6.5 统一 10 枚：上游 V3S2-MB/U2.snap0/V3H3-MB 无源（前判不变）。fam 21/22/24/25/16/17/20 单枚级待逐枚验。fam 7（e35prod807/seed81）配方未出土。
- **obs3/obs5 时代没有"一挖就中"的整族**——能立即复产的只有 fam 14/19 里上游教师恰好齐装的那几枚，逐枚验前置。

### 7.5 工具与管线增量

- `scratch/slot-recover.mjs`（timeline 逐段取件+守卫+嵌入，可重跑）‖ `scratch/bfam-batch{,2,3}.mjs`（并发批+wid 试金+台账落账）‖ `scratch/survivor-env.mjs`（全库幸存者 recipe.env 出土，165 枚）‖ `scratch/read-env.mjs`。
- `training/train.mjs` era 委托层补**建树竞态防线**（并发批多路同 era 时复用未检出完的树会 exit 2——本轮 D005/NC-301/L05K 三臂栽过，重试即愈）。
- **冗余副本纪律**：e370-out 取件产物里 19 件与在册包同 wid ⇒ 挪隔离+dupes-manifest 登记 move 行（D191 归零）；v7 时代原件一律不落仓（rank 会被它抢走，把既有在册文件挤成"多余"）。

## 八、11-20 深夜续班（23:15→ · zcode 夜班 3）

> 接账：白天班（gemini/ds/qwen）台账 566→505——2.0 小族 24 枚落仓（fam 14/16/17/21/22/23/24/25 全清）、**server 回放打通**（09-12/13 四批配方出土，统一根包=champion-5p-v1.3.58.bak=e379c62ccd2648fa，def-31 逐位验证）、def 33-36/v11×12/v7catE1/v7clear2/v7curri1、qoder 两层挖矿修复+出土命令体检（COMMAND-CHECKUP）。

### 8.1 A 线判定（fam 19/20，交接点名的"第一件事"）

- **KDO5C 原始命令全文出土**（zcode db rowid=26662，11-10 05:05 终版 600 步重产）：`supfit-full --up=scratch/obs4/KDO5-seed.bak --steps=600 --groups=1200 --lr=1e-4 --batch=24 --seed=13 --temp=0.5 --games=400 --n=5 --mode=long --collect=teacher --teacher=KDG-C-Q-s41 --wKey=gun:2 --wKey=sword:2`，era=20cb5255（补丁 tch2b 于 05:05:07 应用、05:06 入库、终跑 05:05:42 发射 ⇒ 终跑树=该提交）。
- **按原文重跑 → 3c7c74e7 ≠ 2eecbe24（与白天班同果）**。根因定性：**KDO5-seed.bak = makePolicy(0.25) 随机抽签**（arch2 makePolicy rng 缺省走宿主 Math.random，make-seed5 不播种）⇒ 原件 11-19 被 TRIM、内容从未整读进任何会话日志（zcode db 40KB+ 含包正文行 255 条全非 obs4 夜）⇒ **课程 1（MSB2×3）根不可达，KDO5C 不可逐位复现**。
- **链根修正（交接的第二程假设有误）**：lineage 实际父链 = ADAPT-DEF-O5-s916 ← **23a782cb**（≠KDO5C）⇒ 课程 2/3（S916→S916R2B→MSB6×3/MSB8×2/MSB9/MSB10/MSB12 = 11 枚）挂在 23a782cb 下——23a782cb 身份未破（千问 missing-vs-transcript 表 grade C），下一班沿 qoder projects 层挖 ADAPT-DEF-O5-s916 的创建命令定其上游。
- fam 20：GD6b-TILT ← MSB8-charge（fam 19 链内）⇒ 同面。

### 8.2 C 线快赢：V2-31 逐位复现（46e3bd20）

千问 A 级名单的 qoder Write 原文 = **e68 批驱动脚本**（09-27 17:24，/tmp/kr3/e68）：V0=纯、V1=C0.2、V2=SK0.35、V3=C0.2+SK0.35，母本 win-Ldemo，1200 3 8 8。V2-31 按 era=42d7c86e 重跑 **wid 75019bc5 逐位命中**（SEL_KEEP 语义+era 判例三证）。台账 505→504。

### 8.3 B 线主攻：server 系 115 批 452 枚批级回放过夜扫

- **批→配置表**（scratch/v7-mined/server-batch-config.tsv）：115 批（id 前缀=批），同前缀幸存者 META 直读配置 34 批（119 枚），其余按对手阶梯推断（oppsN→URL 名单：12/13/15/16/17/18/22 齐，20 名单未得——v7big1/v7press1/2 三批 18 枚暂跳）。
- **回放器**：官方 `tools/ring2-run.mjs`（本就是通用 seed-sweep：RING2_POOL 任传名单/ARM/SEEDS/MODE/HOT）在 era worktree 内驱动 era train-server。**两处坑入档**：① era 树槽文件≠批时代根——原工作流每次跑前 cp 根包到槽（def-31 META hotstartFrom 实证）⇒ 驱动按 slotAt(ts) 找时代槽冠军包（e370-out/隔离区/registry 三处查找）拷入 worktree；② 老 era 的 runner（<09-20）不认 RING2_HOT ⇒ 驱动对 era runner 打一行补丁（copyFileSync(BASE→env.RING2_HOT||BASE)）——只改驱动层，era server/js 一字不动。
- 校准：def-31 @ e227d222 seed31 **wid 3406d277 + firstRate 0.33904761904761904 与原件逐位**（09ce558d 同参数不中 ⇒ era 一格之差全盘皆错， Wid 试金是唯一裁判）。
- 双 shard（RING2_PORT 8906/8921 错峰）过夜扫 112 批 434 枚；命中即拷台账路径+翻账+git add。

### 8.4 夜班 3 战况（04:0x 时点）与 era 规则修订

- **v12 批 12 枚全中**（fam 1，09-15 珠价/代数批：era 689516cd + BASE 根 + POOL_C 阶梯）——阶梯推断打法首次整批复现。台账 505→492（cf57ba02）。
- **era 规则修订（server 系）**：era=**首个含批时特征的提交**（v9 的 EPIRUS_ALLOW_HEALTH_FAIL 09-14 未提交、09-15 00:00 入库 ⇒ era=16b3854e 实证）；closest-before/after 都只是候选。驱动支持 era 候选逗号串，批 0 命中自动换候选重跑（RING2_FORCE=1）。
- **EPIRUS_ALLOW_HEALTH_FAIL=1** 常开（透明；health gate 拦落盘 = "产物未落"主因，v9 批 11/12 种子当年被拦）。
- **RNG 结构实证**：era server 的 `__seedIdxN` 从未参与播种（RNG=mulberry32(seed×7919+13) 只依赖种子自身）⇒ 批内种子顺序/集合不影响单粒权重，回放无需复刻原批种子清单。
- **校准优先设计**：有幸存者的批先单跑幸存者 seed 验 era/配置（1-2 分钟），全候选 miss ⇒ 跳过整批记档；无校准批整批扫。**v7l2c 三候选全 miss**（配置逐字同、唯权重异 ⇒ 批时树=会话编辑中态，夹在 33b963ff 与 828b9100 之间不可达）——**会话树重构**（把会话里 13:24→16:40 的 Write/Edit 按时序回放到 worktree）= 下一班的能力项，能救 v7l2c/v7l2f/l2 系列 ~40 枚。
- **mix/sty 批（09-12 白天）**：早于 ring2-run.mjs 诞生（09-13）⇒ 需 pre-runner 回放流（裸 server+/train 循环）；mix 的 16 对手=12+4 席 champ: 座位（champion-5p-hA9/armB12f/armA9 三包在盘 ✓）。
- 20 对手名单（v7big1/v7press1/2）仍未出土（e68ffc09 只有 16/17/18；22 名单在 7134b299）。

## 九、夜班 3 续（05:2x）：mix/sty 配方定案 + lineage ts=UTC 系统修正

### 9.1 mix/sty 配方（dsh 0add3d39 v4 原文出土，全定案）

- §8.4「mix/sty 在 09-12 白天、早于 runner」判断**错误**：lineage ts 是 UTC——mix 批实际 09-12 **22:23-22:32** +0800、sty 批 **22:49-22:54** +0800，都在会话 0add3d39（20:36 起）窗内，且都经时代 ring2-run 跑（v4 会话原文 `RING2_STAGE=train RING2_ARM=mix/sty`、状态日志 docs/artifacts/ring2-status-sty.log、会话墙钟 22:50:54 "sty=2/6" 与 lineage UTC ts 逐位对上）。
- **mix**（16 对手）= A12 + `champ:docs/artifacts/champion-5p-v1.3.58.bak,champ:...hA9.bak,champ:...armB12f.bak,champ:...armA9.bak`（4 席），era=**8a018817**（v1.5.2 22:36 提交 champ: 池支持；批跑时未提交）。
- **sty**（12+风格切片）= A12 同池 + `styleopps=champ:×3（v1.3.58/hA9/armB12f；armA9 留出场——会话设计原文）&stylew=0.5&stylegames=2`，era=**f872ee6c**（v1.5.3 22:58 复合适应度；批跑时未提交）。**sty 批 6/6 逐位命中**（sty-31 一发即中；32-36 首轮链式偏掉、修驱动重跑后全中，每枚 hotstartFrom=e379c62c 与原批一致）。
- 驱动 `scratch/replay-mixsty.mjs`：era worktree + 时代 train-server 直驱（8811/8812 错峰），流程照抄时代 runner 的 trainSeed——**每 seed 重铺 BASE**→槽 js/bundled-champion-3p.js → /train → SSE done → 槽拷出 → wid 试金 → 落账。首轮只在起 server 时铺一次槽 ⇒ seed 32 起从上一枚产物链式热启动全偏（会话原文实锤：每个 seed 的开跑行都是「起点 = v1.3.58 权重」）——修复后 sty 5/5、mix-31 已中。

### 9.2 lineage ts 全账 UTC（系统修正，本夜最大坑）

- **六处独立验证**：def-31（03:05 UTC=11:05+0800 会话内）、eco-31、v12-81（+8h=19:31+0800，era 689516cd=19:01 吻合）、mix/sty（dsh 墙钟 22:50:54）、V2-31（+8h=09-28 01:29，era 42d7c86e=01:48 吻合）。
- ⇒ `scratch/server-jobs-build.py` 修正：ts **+8h** 后喂 git --since/--before（utc_to_local()）。旧 jobs 的 era 候选全体偏早 8 小时（v12 命中是稀疏提交区间的侥幸）；带校准的批靠幸存者探针兜底没炸，无校准批整夜白磨。
- jobs 重建：109 批（mix/sty 移交专用驱动；带校准 34 批），双 shard 杀旧重启——**从此所有后台长任务带 harness 标记**（run_in_background），退出自动注入通知，不再有 windowless 进程（用户点名纠正过两次的坑，本次起根除）。
- **二阶坑（06:00-09:4x 白磨一轮的根因）**：config 表的 ts_min/ts_max 是**分钟精度**（无秒位）——utc_to_local 的 strptime('%H:%M:%S') 对 '14:35' 静默 ValueError 走 except 原样返回 ⇒ +8h 一行都没生效，115/115 批全中招（v9 的 9 枚命中来自硬编码 era 特例，不是时区修正）。修复：秒位补 `:00` 再解析，**解析失败改 fail-fast SystemExit**（禁静默回退，AGENTS #3）。v7gf1 era 首选随之修正为 c7076ac9（gunfocus 提交本体——「聚焦枪手进池跑了一臂」就是 v7gf1 本批，批时 22:35-22:47 +0800，提交 22:59）；此前 era 树无 gunfocus bot ⇒ server「未知/缺失对手」error ⇒ runner 233 行炸批（46 枚「产物未落」的主因之一）。
- **队列收束裁定（13:0x，用户采纳 gemini 建议）**：校准批跑完即停；74 个盲扫批拆出到 `scratch/v7-mined/server-jobs-blind.tsv` **移交通宵班**（下午不做盲扫）。盲扫批下一班的正确打法不是继续盲——按幸存者 META / 配方账（RECIPE-BOOK-1119 + TRAINING-RECORDS）把每批的 EPIRUS_* env 覆写精配进 RING2 驱动 env 再扫，盲扫两 era 0 命中已证明阶梯猜测不够。

## 十、下午班收尾（13:0x-14:4x，会话连续跨夜+下午）

### 10.1 校准段收官（32 批跑完即停，用户裁定采纳 gemini 建议）

- **5 枚入账**：eco-32/36、def-32（09-13 四批正主补齐——eco/def/long/v7b 四批的 missing 由此清完）、**v7divK-81/82**（v7 系校准路径首个战果：幸存者探针过 ⇒ 整批连中）。台账 457→**452**（本会话累计 53 枚：505→452；全 campaign 605→452）。
- 校准 miss 记档：v7w3c、v7seat24、v7u1 等——幸存者探针全候选不中 = 会话编辑中态/配置缺失家族，归考古线。
- **边缘案例留观**：v7wall-34 校准过但产物 wid=BASE 本体（e379c62c）——疑似 era 落盘被拦后 runner 仍拷槽（槽未变=BASE）。下一班遇「产物=BASE」字样直接判该 seed 无效，别当命中。

### 10.2 给通宵班的主攻项（74 盲扫批 = server-jobs-blind.tsv）

1. **别裸盲扫**（今晚两 era 0 命中已证伪）：逐批从幸存者 META / 配方账（RECIPE-BOOK-1119、TRAINING-RECORDS、COMMAND-CHECKUP）把 `EPIRUS_*` env 覆写（ECO_TARGET/CAP/DIVW/DIV_K/ROLEW/CATW/WALL_FILTER/GAMES…）精配进 sweep 驱动的 runBatch env 再扫。
2. 驱动已备好：盲扫批单 era（ed6a82c0）；jobs 分片 parity k%2。
3. 20 对手名单（v7big1/v7press1/2）仍缺——e68ffc09 只有 16/17/18，22 名单在 7134b299。
4. 与 gemini 白班正交确认：fam7（e35prod807/814、seed81）/fam9 不在盲扫表内，gemini 并行复刻零冲突。

## 十一、傍晚番外：DS rod（避雷针）线闭案（20:2x-21:5x）

- DS 晚五臂全败（rm/rb9/rb9-pg/ring/ring2）的根因双判例：①**底座选择**——RINGB9 有 ring 习惯但清不了龟壳（G5 61%）；TZT2D=11-18 普测 G5 **0%** 清场型 ALL-GATE；②**ring 剂量**——ring 0.20 对无 ring 习惯的底座是行为改写过量（反弹墙 14.5→0.00、连狙击枪 290→0），**减半到 0.10 行为存活**。rod 标签采样结构（rareOnly=rod,ring 0.45、无 arenaPool）照抄 rod-ring，rod 标签 233/4800 有效注入。
- **第 7 臂 nov21-rod-tzt2d-r10 promote 0 阻断**（F 20.1%、反弹墙 14.75、G4[multi] 49.7 余 10pt、G5 全 0%）→ 用户 21:1x 点名入池（人席 2 格原话在案：multi 只枪压制 76.5/70.5、只防御 43.5/37.5 对基准 +44/+30，与 G4[multi] 骑线同弱点三量具互证）→ **池 26→27（soft），rod 覆盖 0→1**。前线 -30.4 落册；measure-point 图节点 + skill-report 22 技 + bundle/图重烘同笔（b331ce31，gate-all --auto 6 道全绿）。
- 留观项：multi 被人形玩家克制（G4 骑线+人席 2 格同源）——若实战读数差，`pool-add --retire` 随时撤；下一臂若要修，方向是 TZT2D 底 + steps/lr 减剂量（机制未证，先记档不跑）。

## 十二、通宵班（11-21 22:05 → 11-22 02:3x）：B 线精配回放破局 + 训练判例群

### 12.1 B 线（74 盲扫批）战果：29 枚入账（台账 416→382→388 内含 v13 时序，终值见台账）

- **server 子集 7 批全处理**：v17×7、v15×6、fgtA×5、fgtB×5、v13×5、v16×6 = **29 枚逐位**；miss 残账：fgtA-35/fgtB-34（单 seed 配置差）、v13-105/106（我清孤儿服务器误伤，补扫中）、fstA×6（**会话编辑中态**：批时 14:09 在跑未提交的 v1.5.15 改动（14:38 才提交），两 era 试尽归档）。
- **era 判例第三形态**：特征提交落在批前 ±10 分钟内的批，era=该**特征提交本体**（fgtB=31310c26 哨声惩罚、v16=66fc7fa0 罚关闭形态——提交信息里写着「v16 那 6 个 seed 是在惩罚关闭下跑的」）；after_commits[0]（批后提交）一律不对。
- **env 注入能力落地**：sweep 驱动加 `env` 列（KEY=VAL;…），会话原文旋钮（EPIRUS_FIGHT_WHISTLE/DEAL）直接进驱动；fstA 判例：EPIRUS_FIGHT_FIRST 在 era 代码无接线（静默空操作）。
- **v7* CLI 批（62 批）= 移交能力项**：train-3p 时代，需 era worktree+CLI 回放；e68ffc09 命中 24 批上下文、7134b299 命中 6 批（原始命中见 $TEMP/mine-e68.txt / mine-7134.txt，需固化为仓库文件）。
- 基础设施教训：陈旧 server 残响（fgtB-34/35/36 = fgtA-32/33/34 逐位同 wid、fstA 全 BASE）⇒ 跨批重扫前必杀 8906/8921 口孤儿；单行任务表禁用 shard=1（k%1 恒 0 过滤成空）。

### 12.2 训练判例群（A 线/C 线，全部入 TRAINING-RUN-LOG）

- **A1 armor 四臂书面裁定**：armor 的 guardSet 反弹族行为与 F 门（主动还手率）**结构性互斥**（EQ-S4-E9 底压 G5、TZT2D 底压 F，均与剂量无关）→ X2b-fuse 暂留占位；后继路线 ① PG 补标签 ② F 门语义裁定留用户。armorPick 教师代码保留可用。
- **A2/A3 淘汰**：cannon 臂 F+G4[multi] 双阻断；r10b G4[multi] 84% 劣化——**专科 supfit 扰动系统性翻 F/G4[multi]**（底座自过、教学必翻其一），multi 只枪格在三臂间 49.7/76.3/84 高方差骑线。
- **C1 负结果**：短程 PG（1500 局 24s）+ klW=0.12 抬不了强（arenaB -30.4→-45.5 反漂）——风格多样 hard 载体 = **长程 PG（小时级）算力项**移交。

### 12.3 C 线（用户风格多样性令）：地形图 + 口径 v2 + 量具修复

- 风格地形图（27 枚同夹具 coverage 向量，scratch/style-distance.mjs）：hard 带 11/13 挤同质核；**九条空轴**（tank/transfer/laserEye/holo/ring/curse/shift/bigT/proto）池均值合计 <10%。
- **带划分口径 v2 落册**（441d55af，用户裁定）：强度+池配合+风格离散度三因子；风格多样性臂目标升格为进 hard 带拉开距离。
- 量具：probe-round1-open 修复（沙箱缺 policy2.js 装载，已入仓待提交）；hard 带池对局基线存档（probe-pool，allSameGames 0/840）；**池配合量具（跨席组合出现率）= 新工具项待建**。
- 留观：X2b-fuse（-87.2pt）是全池最外围独占风格位（0.94），撤换时需接盘者，否则 hard 更同质。

### 12.4 池变动

- **nov21-rod-tzt2d-r10 入池**（用户 21:1x 点名，人席 2 格原话在案）：池 26→**27**（hard 13 / soft 14），rod 覆盖 0→1（Stage1 17/120 格 / 151 次）。r10b 劣化未替换。

## 十三、夜班延长段（11-22 02:3x → 09:00，用户令「长时训练方向开工 + 发散探索训练方法」）

### 13.1 方法账核查（§15/§21 合规，跑前必查）

- 已有结论不许重证：C1 判例（短程 PG 24s 抬不了强反而漂差，长程才是算力项）；§148.5（PG 必须模式门控 KL，先 selftest3）；klTilt 机制已有（11-14 breadth 补课判例：倾斜锚抬弱键份额）——**新应用**=把倾斜锚当风格轴方向盘（bang 向空轴/自身签名轴），机制未在风格轴上测过。
- selftest3 六腿全绿过 `night2-E1-det-strong`（16561 参数，腿 C 1465 判定最坏误差 0）⇒ PG 臂允许开。

### 13.2 Wave1 三长程臂（02:0x 点火，全部后台 harness，segEvery=50000）

| 臂 | 配方 | 假设 |
|---|---|---|
| `nov22-c2a-freeze-long` | E1 底 + klW=0.12 + klModes=multi,long + games=500k + lr=1e-4 + C1 同 arena（3 真强包+aggro,wall） | C1 纯时程放大（1500→500k，333×）：长程能否把「锚风格」和「抬强度」同时拿到 |
| `nov22-c2b-tilt-long` | 同上 + klTilt=curse,bigT,firestorm mul=2 | 倾斜锚当**风格方向盘**：把 E1 自身签名轴（池均值近空轴）再放大，风格距离与强度同涨 |
| `nov22-c2c-synergy` | 同 c2a 但 arenaPool=hard 带 8 强真包席、games=300k | 强度对手=hard 带成员本体（口径 v2 第二因子进训练桌）：对着要进的带练 |

- **配速裁定**：三臂并发实测 ~14.5 局/s（C1 单跑 62/s，并发抢内存带宽）⇒ 500k 全程 ~9.5h 超班内预算。裁定：**seg 快照为评估节点**（segEvery 机制本来的用途——PG 后段漂移、多节点筛选），08:00 用最新 seg 评估，剩余 kill 不心疼。
- C2c 首发败因：`pack:nov21-taunt-dsp0` registry id 不在册（pool 表 id ≠ registry id）⇒ 改显式路径重发成功。判例：**arenaPool pack 席用文件路径最稳**。

### 13.3 池配合量具 v0 落成 + 基线读数（900 局/桌，multi+long，3 seeds）

工具：`tools/pool-synergy-meter.mjs`——roster-lib 真包席 + duelAssembly onTurn 钩子（引擎实际解析的 actions）+ damage 事件；T1=hard 核 5 枚固定桌 vs T2=hard 核 3 枚+X2b-fuse+rod r10 固定桌，同 seed 配对。基线存档 `champion-map/data/pool-synergy-baseline-1122.tsv`。

| 指标 | T1 hard 核 | T2 混风格 | 判读 |
|---|---|---|---|
| 空轴触达率 | **1.0%**（bigT 8 + curse 1 / 900 局） | **11.9%**（tank 39/c curse 43/ring 14/transfer 3） | **+10.9pt**：风格多样性在池层面直接控制桌层面行为多样性 |
| 用卡熵 | 1.540 nats | 1.725 nats | +0.185 nats |
| 集中火率 | 100% | 100% | **饱和不判别**（FFA 下 ≥2 source 打同一人恒真）——v1 要换成集中度 HHI / 逐受害者 source 数分布 |
| 挑衅联动 | 1/1 | 0/1 | taunt 专家 900 局只 taunt 1 次（0.1%）——**「风格」要看桌局行为不能看包名**（taunt-dsp0b 的 taunt 在真桌上基本不开） |
| 胜者分布 | taunt-dsp0b 33.4% 领跑 | X2b-fuse 9.2%、rod 4.9%、draw 13 | 风格成员弱但不为零；gun>curse/curse>gun 共现对出现 |

**支撑口径 v2**：全同质 hard 桌局九空轴≈死轴（1%）；混风格桌空轴活过来（11.9%）。hard 带风格拉开距离 = 桌局配合多样性的直接杠杆。

### 13.4 评估判据预注册（08:00 前不许改动，§148.9 纪律）

基线：E1 底 arenaB **-30.4**（池前线 -30.36 同源）、全门过、风格向量 curse 11.2%/bigT 4.6%/firestorm 7.3%、G4[multi] 只枪读数以 promote dry 现跑为准。

| 判 | 线 | 含义 |
|---|---|---|
| 强度 | product arenaB ≥ **-35** | 不比底座漂差 5pt 以上（C1 教训线）；≥ -25 = 真抬强 |
| 入池地板 | `promote-champion --dry --support=2` **0 阻断** | E1 本来全门过 ⇒ PG 不得把门打挂（F≥20%、G4[multi]≤60%、G5[long]≤25%） |
| 风格 | c2b：G4[multi] 只枪% **下降** 且 锚L1 ≤0.20 | 倾斜锚放大签名轴（只枪率下降 = 行为更多样），锚未漂走 |
| C4 | tank 标签 ≥200 且 selftest3 六腿绿 | tank 接盘者候选成立 → 进 PG 长臂 |
| 失败处置 | 任一门挂 | 该臂记淘汰判例入 RUN-LOG，seg 快照留 scratch 不删（§24） |

评估命令（单包四连）：`selftest3 <pack>` ‖ `arena-noise-floor --json --id=<tag> --pack=<path>` ‖ `promote-champion --dry --support=2 <pack>` ‖ 锚L1 读臂日志尾。

### 13.5 量具 v1（集中度补轴）：集火维度无风格差——配合差住在出卡维度

v1 给 ① 补两轴（三方围殴率 = ≥3 source 同受害者；伤害 HHI = 受害者伤害份额 Σsᵢ²）：T1 91.9% / HHI 0.215 vs T2 90.1% / 0.218——**均无风格差**。判读：FFA 围殴是**桌形结构性质**（5 人桌谁都挨集火），不是风格构成的函数 ⇒ 口径 v2 的「池配合」因子量**出卡维度**（空轴触达/用卡熵/跨席共现），不量集火维度。工具 v1 已入库（同 seed 确定性复核：v0/v1 两轮空轴触达/熵逐位同）。TSV winnerDist 列空写 bug 修复（line() 引用错对象），两份基线用实测值补齐。
