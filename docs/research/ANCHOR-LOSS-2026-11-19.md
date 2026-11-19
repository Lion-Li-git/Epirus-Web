# Arena 锚缺失与 Q-s47 恢复（2026-11-19 夜）

## Q-s47 已恢复（权重逐位一致）

- 配方（从 registry + 旧日志反推）：`EPIRUS_HOTSTART=1` + `EPIRUS_SEEDPACK=docs/artifacts/kept/e70-out__D02-31.bak`（K2）+ `EPIRUS_SEED=47` + `node tools/train-3p.mjs 400 3 8 8`。
- 训练代码时点：`15c568b2`（2026-10-09 00:30；Q-s47 生成于 00:45）。
- **权重一致**：重训产物 `widOf = 596b8fad2d56fe76`，与 `lineage.tsv` 在册的 Q-s47 wid **逐位相同**。
- 文件 sha 不同（`ec5317fa…` → `c38e6367…`）：只因 meta 的 `ts`/`arm`/selection 字段不同；registry 的 sha256 是整文件哈希，故已更新为新的文件哈希。
- 落盘：`docs/artifacts/e507-out/Q-s47.js`（`git add -f`）；`map-audit` 缺失 668。

## 但 Arena 还缺 7 枚锚

`arena-league-1118-page.tsv` 的 24 锚里，以下 7 个路径仍不在盘（均为 11-19 清理丢失、REGISTRY/LINEAGE 有 wid 但盘上无同 wid 文件）：

| idx | id | 角色 |
|---|---|---|
| 3 | v7blk1-92 | v7 long-burst |
| 5 | MSB13-R1S791820660 | MSB c-anchor |
| 11 | OBS6-LH6P | obs6 heavy-base |
| 12 | DIV-V3-ANTIDEF | obs6 v3-antidef |
| 13 | DIV-LH6-HEAVY-S2 | obs6 heavy-bead |
| 14 | P9-CN-MINI-CONT | obs6 cannon-holo |
| 21 | TZ2C | obs6 |

⇒ **B 轴仍无法给新点补测**（arena-eval 需要完整 24 锚）。现有 1002 点读数是清理前测的，仍有效；新点只能等锚补齐，或换锚重测全库。

## 下一步选项

1. 逐枚按旧日志/父本复现（v7blk1-92 可走 v7 线；6 枚 obs6 需父本+配方）。
2. 用户提供旧备份（`e507-out`、`obs6-coldstart`、`night-adapt`）。
3. 用现存 17 锚组新联赛 ⇒ 换尺，全库 B/C 重测。
