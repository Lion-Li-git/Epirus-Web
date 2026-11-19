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

## 二、三件根因诊断（复现学）

1. **教师栈错=全错**：LH6 真栈里有白班不知道的两个角色（t1=LH2 干净底座、t4=lasereye 脚本教师）+ t2 带键过滤。**挖原文，别重构。**
2. **代码漂移是隐形变量**：生成时刻的 working tree ≠ 之后任何 commit。a0feae0f（21:53 提交）≠ 20:42 的树 ⇒ 复现要 worktree 到生成时刻**之前最近的 commit**，并且接受「未提交改动不可复原」的残余风险（本例 a0feae0f 恰好命中）。
3. **舍入模式是身份的一部分**：V3S2 融合 ×1e6 舍入命中、无舍入不命中。

## 三、工具升格（用户令「好东西不留 scratch」→ docs/RECOVERY-TOOLKIT.md）

`tools/pack-soup.mjs`（n 路融合+wid 试金）‖ `tools/session-mine.mjs`（四 harness 挖掘：gemini/zcode/dsh/qoder）‖ `tools/anchor-recover.mjs`（对账恢复）‖ `tools/pool-xray.mjs`(池 X 光)。全部实战验证过（pack-soup 一发命中 V3S2；pool-xray 即今晚分带量具升格）。

## 四、P1 · DS 研究路线首证（[HANDOFF-2026-11-19-day-training-and-cleanup.md](HANDOFF-2026-11-19-day-training-and-cleanup.md) §五）

| 臂 | 配方 | arenaB | 判定 |
|---|---|---|---|
| **night2-E1-det-strong** | **DS-P0**：EQ-S4-E9（+14.3）做基座+主教师 0.70 + detonate 专科 0.30 | **−30.36pt（极差 10.6）** | ✅ **promote 0 阻断全过，已入池 soft**（25 枚）——比同系蒸馏产物（S6 −104.8/X2b −87.2/det-gd −88.9）好一个数量级；强包锚定防洗塌成立。没到 DS 乐观带 −15~+10（E9 self-teacher 份额里 ji 74% 仍高、firestorm 实战 1%）——下一杠杆=专科份额 0.35~0.40 或 t2 强包换 MX5-GD-T2STR（+20.5） |
| night2-E2-det-pg | det-realpg.seg1500 续训（真包×5+aggro/wall/ringspam+ridge） | **−104.67pt** | ✗ 负结果：白班成果被洗掉（−81→−105）——续训方向/参数错，det 系续训的 lr/kl 需单变量重校 |

## 五、P2 · 批量重产：wid 目标账已全齐，剩下的是源盘

- **wid 目标账不用考古了**：1.8 全集的 wid 本来就在 `page/lineage.tsv`（1002 行）——`tools/anchor-recover.mjs` 之前只读 lineage-g3.tsv 才显得缺 614 枚。两表并读后 **wid 目标 1004 条，缺失 662 枚全部有 wid 身份判据（无 wid 目标 = 0）**。
- 真正的瓶颈变成 **无源**：盘上（隔离区+4 个 worktree，3525 文件 / 869 唯一 wid）只能直接对回 **3 枚**，其余 659 枚要靠会话挖掘配方 + era worktree 批量重产（RECIPE-BOOK 已有部分配方）。
- dsh（.zstd，已解压挖掘：7 会话 1406 条命令）与 662 缺失清单**零交集**（9-10 月 claude 导入时代错位）；qoder 尚无命中案例，探路模式。
- 会话挖掘已就绪：`tools/session-mine.mjs --harness=dsh/qoder`。

### 附带修复（入池链条上的契约漂移，E1 收尾时抓到）

1. **add-point registry 9→25 列**：d78ef34f 给 registry 补 16 列训练配置但没同步 add-point 的 `newReg` 字面量 ⇒ 新包入账即崩（E1 首次重放当场咬到）。修复：1.8 从 lineage.tsv 同名/wid 行回填 16 列（与白班批量回填同法、单一来源不变），2.0/G3 留空（与在册 83 枚 2.0 行同例）。
2. **anchor-recover wid 目标源扩成两张 lineage 表**（同上，662 全覆盖）。

## 六、池/图现状

池 **25 枚**（hard 11 / soft 14）+ night2-E1-det-strong（soft，promote 0 阻断，Stage1 16/30 ‖ Stage2 23 技）——bundle/图/skill-report 全部重烘同步；**E1 图节点补全走完完整链**（首枚产物落账发现 measure-point 链上次在 add-point 中途断掉：lineage 落了而 registry/display/features/readings/projections 全缺 ⇒ `--reuse` 重放补完，map 池层自检 100/0）。

**遗留建议（等用户裁）**：DS §五-P2 提议退役软带负资产 night2-S6（−104.8，0/315 废贴）与 night2-X2b-fuse（−87.2，0/671）——但这两枚是用户 11-19 深夜点名入池的，本班不擅动。
