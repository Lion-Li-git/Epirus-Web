# GOAL · 当前尺分辨率用完前完成游戏目标

> 立标：2026-11-19（用户令）；状态：active。任何 agent 收工前先读这份，再改池/图/尺。
> 相关：[MAP-PIPELINE.md](MAP-PIPELINE.md)、[POOL-CONTRACT.md](POOL-CONTRACT.md)、[ARTIFACT-LOSS-1119.md](ARTIFACT-LOSS-1119.md)。

## 为什么立这条

演化图的 A/B/C 三列是**当前尺的列族**（A=`a-v2coop-page-1114`、B=`b-arena-page-1118`、C=(A+B)/2 页面剂量）。
换尺（换夹具/剂量/eps/列名）后，图上 1002 个点**无法按新尺重算**——旧读数还在旧列里，新列是空的。
所以：**在当前尺的分辨率被用完之前，把游戏侧剩下的目标做完**；换尺只能作为最后手段，且必须先落可重算锚。

## 完成定义（DoD）

1. **池账一致**：`page/pool-members.tsv` = bundle = 图上成员；`map-audit` 无红条。
2. **覆盖补齐**：全池 0/25 的四张卡（`rod` / `taunt` / `purify` / `mirror`）各至少 1 枚**过线**载体；
   hard 带 0/11 的 8 项（armor/rod/firestorm/mine/taunt/cannon/purify/mirror）补到有覆盖，或给出"不做"的书面裁定。
3. **负资产替换**：`night2-S6`（-104.8pt，天火 0/315）与 `night2-X2b-fuse`（-87.2pt，0/671）被过线包替换，
   或用户明确裁定保留。
4. **人席补齐**：7 枚 `seatKill=-1` 的成员补 `seat-rule` 读数（不再是"没测"）。
5. **发布**：版本号 + 图/bundle 同步上线；`rebuild-map` 100 PASS、`np` 166/166。

## 红线

- **DoD 完成前不换尺**：不改 A/B 夹具、不改剂量、不改 eps、不新增/替换 C 列族。
- 若业务上必须换尺：先做 P0（`readings` 加 `dose` 维、新列族、新 gen 锚、1002 点重算方案），
  否则演化图不可重算，等于把历史读数作废。
- 池每次改动走完整链：`promote --dry` → `measure-point --bake` → `pool-add` → `gate-all --auto`（AGENTS #20）。

## 当前状态（2026-11-19 20:0x）

- 池：**24 枚（hard 11 / soft 13）**；bundle 7318KB；图 1002 点；v2.1.9（11-19 晚：cannon-pg 退役、RING-MINIT-CONT 点名保留 seatKill=2）。
- 覆盖：全池 `rod/taunt/purify/mirror` 0/25；`firestorm/miniT/dualGun` 1/25；`mine/cannon` 2/25。
- 负资产：`night2-S6`、`night2-X2b-fuse` 仍在 soft。
- 人席：**5 枚仍 `seatKill=-1`**（night2-S6 / night2-X2b-fuse / RINGB11 / RINGB9 / TZT2D）；RING-MINIT-CONT 已点名保留（seatKill=2），day1119-cannon-pg 已退役。
- 权重重：800 枚清理丢失；Gemini 挽回 130，仍缺 670；lineage 冻结（`rebuild-map` ③ 跳过）。
- 尺：A/B/C 均为页面剂量；换尺会破坏可重算性。

## 检查点

- 每次池/图改动后跑：`node tools/map-audit.mjs`、`node champion-map/rebuild-map.mjs`、`node tools/np-test.mjs`。
- 在提交信息里引用本文件；状态变化回写本节。
