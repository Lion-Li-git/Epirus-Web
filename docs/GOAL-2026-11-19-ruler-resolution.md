# GOAL · 当前尺分辨率用完前完成游戏目标

> 立标：2026-11-19（用户令）；状态：active。任何 agent 收工前先读这份，再改池/图/尺。
> 相关：[MAP-PIPELINE.md](MAP-PIPELINE.md)、[POOL-CONTRACT.md](POOL-CONTRACT.md)、[ARTIFACT-LOSS-1119.md](ARTIFACT-LOSS-1119.md)。

## 为什么立这条

演化图的 A/B/C 三列是**当前尺的列族**（A=`a-v2coop-page-1114`、B=`b-arena-page-1118`、C=(A+B)/2 页面剂量）。
换尺（换夹具/剂量/eps/列名）后，图上 1002 个点**无法按新尺重算**——旧读数还在旧列里，新列是空的。
所以：**在当前尺的分辨率被用完之前，把游戏侧剩下的目标做完**；换尺只能作为最后手段，且必须先落可重算锚。

## 完成定义（DoD）

1. **池账一致**：`page/pool-members.tsv` = bundle = 图上成员；`map-audit` 无红条。
2. **覆盖补齐**：全池仍 0 的 `rod` 补至少 1 枚**过线**载体；`mirror` 已书面裁定"可没有"；
   `taunt` / `purify` 已有 hard 载体，保持不退化。hard 带仍 0 的 armor/rod/firestorm/mine/cannon
   补到有覆盖，或给出"不做"的书面裁定。
3. **负资产替换**：`night2-S6` 已于 v2.1.11 退役；`night2-X2b-fuse`（-87.2pt，0/671）仍需被过线包替换，
   或用户明确裁定保留。
4. **人席保持**：全部在池成员已有 `seat-rule` 读数（当前 0 枚 `-1`），后续入池不得再引入未测成员。
5. **发布**：版本号 + 图/bundle 同步上线；`rebuild-map` 100 PASS、`np` 166/166。

## 红线

- **DoD 完成前不换尺**：不改 A/B 夹具、不改剂量、不改 eps、不新增/替换 C 列族。
- 若业务上必须换尺：先做 P0（`readings` 加 `dose` 维、新列族、新 gen 锚、1002 点重算方案），
  否则演化图不可重算，等于把历史读数作废。
- 池每次改动走完整链：`promote --dry` → `measure-point --bake` → `pool-add` → `gate-all --auto`（AGENTS #20）。

## 当前状态（2026-11-21 19:20）

- 池：**26 枚（hard 13 / soft 13）**；v2.1.11；DS-P0 `purify` / `taunt` 双将入 hard，`night2-S6` 退役；图 1002 点。
- 覆盖（Stage 1 `pool-skill-report`，26 枚 ×120 格）：`taunt` **95/120 格**（hard 主力）；`purify` 默认夹具少咒源，条件化对活咒源 **0.27/局**（Stage 2 forced 为负 ⇒ 有载体但强度待提）；全池活跃仍 0 的是 `rod`（`anyUse=1/26`，候选 `nov21-rod-rm` 条件 `8/100`、`arenaB=-1.86pt`）与 `mirror`（已有"可没有"裁定）。
  - `armor` 1、`firestorm` 2、`mine` 2、`cannon` 1（均在 soft）；`dualGun` 1、`miniT` 1（hard）。hard 带的 armor/firestorm/mine/cannon 仍为 0。
- 负资产：`night2-S6` 已退役；`night2-X2b-fuse` 仍在 soft，尚未替换。
- 人席：**26 枚全部量过（0 枚 -1）**；8 枚 `seatKill>0`：OBS6P9-S4000=3、RING-MINIT-CONT=2、MX5-GD-LE40=2、RINGB9=2、TZT2D=2、DEF-s16=1、MX8-R6B-KL=1、night2-E1-det-strong=1；7 枚 `invited=0` 待逐枚裁定。
- 权重重：11-19 清理后仍缺 **416**（400 枚早期 1.8 `server` 批：fam4 109 / fam6 107 / fam5 94 / fam3 43 / fam1 28 / fam2 19；16 枚 2.0 未播种随机根链 fam19 14 / fam20 2，已证死）；lineage 冻结（`rebuild-map` ③ 跳过）。
- 尺：A/B/C 均为页面剂量；换尺会破坏可重算性。

### 下一步训练排期（覆盖优先）

1. `rod`：先把 `nov21-rod-rm` 走 `promote --dry --support=2` / PG 提强，目标把条件 `rod` 从 8/100 提到过线；若失败换高 `ep` 底座再训。`mirror` 不排（已裁定可没有）。
2. hard 弱覆盖：`armor` / `firestorm` / `mine` / `cannon` 各补 1 枚 hard 载体，或书面裁定不做。
3. `night2-X2b-fuse` 用覆盖优先的过线包替换，或用户裁定保留。
4. 训练后走 `promote --dry --support=2` → `measure-point --bake` → `pool-add` → `gate-all --auto`，并在提交信息引用本文件。

## 检查点

- 每次池/图改动后跑：`node tools/map-audit.mjs`、`node champion-map/rebuild-map.mjs`、`node tools/np-test.mjs`。
- 在提交信息里引用本文件；状态变化回写本节。
