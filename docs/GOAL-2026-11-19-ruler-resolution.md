# GOAL · 当前尺分辨率用完前完成游戏目标

> 立标：2026-11-19（用户令）；状态：active。任何 agent 收工前先读这份，再改池/图/尺。
> 相关：[MAP-PIPELINE.md](MAP-PIPELINE.md)、[POOL-CONTRACT.md](POOL-CONTRACT.md)、[ARTIFACT-LOSS-1119.md](ARTIFACT-LOSS-1119.md)。

## 为什么立这条

演化图的 A/B/C 三列是**当前尺的列族**（A=`a-v2coop-page-1114`、B=`b-arena-page-1118`、C=(A+B)/2 页面剂量）。
换尺（换夹具/剂量/eps/列名）后，图上 1002 个点**无法按新尺重算**——旧读数还在旧列里，新列是空的。
所以：**在当前尺的分辨率被用完之前，把游戏侧剩下的目标做完**；换尺只能作为最后手段，且必须先落可重算锚。

## 完成定义（DoD）

1. **池账一致**：`page/pool-members.tsv` = bundle = 图上成员；`map-audit` 无红条。
2. **覆盖补齐**：全池必补技能（`purify` / `taunt` / `rod`）已 **100% 破零**，`mirror` 已书面裁定"可没有"；
   `hard` 带仍 `0/13` 的 `armor` / `rod` / `firestorm` / `mine` / `cannon` 补到有覆盖，或给出"不做"的书面裁定。
3. **负资产替换**：`night2-S6` 已于 `v2.1.11` 退役；`night2-X2b-fuse`（`-87.2pt`，`0/671`）需在训出合格 `armor` 载体后退役替换，或用户明确裁定保留。
4. **人席保持**：全部在池成员已有 `seat-rule` 读数（当前 `0` 枚 `-1`），后续入池不得再引入未测成员；`nov21-rod-tzt2d-r10`（点名入池 `seatKill=2`）列为留观加固对象。
5. **发布**：版本号 + 图/bundle 同步上线；`rebuild-map` 100 PASS、`np` 166/166。

## 红线

- **DoD 完成前不换尺**：不改 A/B 夹具、不改剂量、不改 eps、不新增/替换 C 列族。
- 若业务上必须换尺：先做 P0（`readings` 加 `dose` 维、新列族、新 gen 锚、1002 点重算方案），
  否则演化图不可重算，等于把历史读数作废。
- 池每次改动走完整链：`promote --dry` → `measure-point --bake` → `pool-add` → `gate-all --auto`（AGENTS #20）。

## 当前状态（2026-11-21 22:05）

- 池：**27 枚（hard 13 / soft 14）**；[`nov21-rod-tzt2d-r10`](research/STATUS-2026-11-20-night-zcode.md) 已点名入 `soft` 补齐最后一张全池 `0` 覆盖卡 `rod`；图 **1,006 点**。
- 覆盖（Stage 1 `pool-skill-report`，27 枚 ×120 格）：
  - 全池必补技能全部破零：`taunt` **95/120 格**（`hard` 主力）、`rod` **17/120 格 / 151 次**（`nov21-rod-tzt2d-r10`，`soft`）、`purify` 条件对活咒源 **0.27/局**（`nov21-purify-dsp0`，`hard`）、`mirror` 已有"可没有"书面裁定；
  - `armor` `1`（仅 `night2-X2b-fuse` 活跃）、`firestorm` `2`、`mine` `2`、`cannon` `1`（均仅在 `soft` 活跃）；`hard` 带 `armor / rod / firestorm / mine / cannon` 活跃格仍为 `0/13`。
- 负资产：`night2-S6` 已退役；`night2-X2b-fuse` 因承载唯一 Stage 1 活跃 `armor` 暂留 `soft`，等待 `armor` 强载体替换。
- 人席：**27 枚全部量过（0 枚 `-1`）**；9 枚 `seatKill>0`（含 `nov21-rod-tzt2d-r10=2` 点名入池、`multi` 只枪压制 `76.5%/70.5%` 留观）。
- 权重重：11-19 清理后仍缺 **416**（400 枚早期 `1.8 server` 批：`fam4` 109 / `fam6` 107 / `fam5` 94 / `fam3` 43 / `fam1` 28 / `fam2` 19；16 枚 `2.0` 未播种随机根链 `fam19` 14 / `fam20` 2 已证死）；`lineage` 冻结（`rebuild-map` ③ 跳过）。
- 尺：A/B/C 均为页面剂量；换尺会破坏可重算性。

### 下一步工作方案（已详写至 [HANDOFF-2026-11-21-night-for-glm.md](research/HANDOFF-2026-11-21-night-for-glm.md)）

1. **A1（头号）· `armor` 强载体替换 `night2-X2b-fuse`**：新增仅键道 `armorPick`，以 `EQ-S4-E9`/`OBS6E9` 底配 `armor@0.30` 过线入池，随即 `pool-add.mjs --retire=night2-X2b-fuse` 清零最后负资产。
2. **A2 · `hard` 弱覆盖补强或书面裁定**：按 DS-P0/PG 冲 `firestorm / cannon / mine` 进 `hard`，或给出书面不做裁定。
3. **A3 · `nov21-rod-tzt2d-r10` 减剂量加固**：同 `TZT2D` 底座压低 `steps/lr` 消除 `multi` 人席 `2` 格。
4. **B · `fam=1..6` 74 批 400 枚 `server` 精配扫库**：先对照幸存者 `META`/配方账精配 `EPIRUS_*` 覆写再跑，严禁裸盲扫。

## 检查点

- 每次池/图改动后跑：`node tools/map-audit.mjs`、`node champion-map/rebuild-map.mjs`、`node tools/np-test.mjs`。
- 在提交信息里引用本文件；状态变化回写本节。

## 用户裁定 · 带划分口径 v2（2026-11-21 23:4x）

1. **带分配三因子**：强度（arenaB/前线）只是其一；**池对局配合**（多人局组合效应）与**风格离散度**必须同看——单看包强度定带不成立，因为多人局会出现配合（蓄能→电磁炮、藤甲+转移、环+集火等组合），而组合只在风格异质的池里出现。
2. **hard 带同质化实锤**（style-distance.mjs，fx-pool1119a 同夹具）：hard 13 枚全部挤在风格同质核（L1 到池质心 0.16–0.24），ji/gun/sword/reflect/snipe 五轴占 66%；**tank/transfer/laserEye/holo/ring/curse/shift/bigT/proto 九轴池均值合计 <10%**。全同质 hard 带抽出的桌局天然抑制配合出现。
3. **后续动作**：
   - 量测协议：`probe-pool --tier=hard` 跑池对局基线（开局脚本分布 / 非ジ协作组合出现率 / 各技能实际使用），对照混风格合成桌（hard 核 + 外围 soft 混抽）看配合是否出现；
   - 训练侧：风格多样性臂（空轴教师：lasereye/drain/transfer2/ringEcon/ration6b 系）的目标是**进 hard 带可行**（过 promote 地板），把 hard 带风格距离拉开——新成员入 hard 时参考其到 hard 质心的 L1 距离，同簇超额成员缓入；
   - 待退役的 `night2-X2b-fuse`（全池最外围风格位 0.94）撤换时**其风格位需要有接盘者**，否则 hard 带进一步同质化。

### A1 armor 载体四臂书面裁定（2026-11-22 00:1x · 夜班 §23）

四臂证据链（台账 TRAINING-RUN-LOG 同笔）：EQ-S4-E9 底 armor@0.30/0.15 → G5[long] 31%/48%（防御教学压垮清场）；TZT2D 底 armor@0.30/0.15 → G5 解（17%/0-14%）但 **F 场A 恒 14.5-14.7% < 20%，与剂量无关**。机制结论：**armor 的 guardSet 反弹族行为在被围殴时=被动还手，与 F 门量的主动还手率结构性互斥**（两底座 × 两剂量证据齐）。⇒ 裁定：
1. **X2b-fuse 暂不退役**（继续占 armor 载位 1/27），本轮不做 armor hard 载体；
2. armor 载体的后继路线（下一班按优先级）：① 在过线包上以 PG 补 armor 标签（非 supfit 全剂量改写）；② **F 门语义裁定留用户**——armor 反弹族是否算"还手"（改门先改 RULES 文档）；
3. `armorPick` 教师代码保留（加性路径，已过 selftest），白名单可用。
