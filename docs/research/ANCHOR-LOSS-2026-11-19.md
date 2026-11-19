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

---

## 恢复进度更新（2026-11-19 23:20 +08:00）

- 已按 `widOf` 逐位复现并写回 **4 / 7** 枚（在盘 **`21 / 24`**）：`v7blk1-92`（`6b749817f5cfc725`）、`MSB13-R1S791820660`（`5625693e5e54f30a`）、`P9-CN-MINI-CONT`（`70a2a6bc27cc64c7`）、`TZ2C`（`f5776ccecb333168`）。
- 余下 **3 / 7** 锚（`OBS6-LH6P` / `DIV-V3-ANTIDEF` / `DIV-LH6-HEAVY-S2`）阻塞诊断、已排除配方清单、下游精确命令与 worktree 现场详记见：[HANDOFF-2026-11-19-anchor-recovery.md](HANDOFF-2026-11-19-anchor-recovery.md)。

## ✅ 终局：24 / 24 全齐（2026-11-20 00:1x +08:00 · zcode 夜班）

**全部 7 枚缺失锚逐位复现完成**，方法 = 四 harness 会话记录挖掘（配方账 [RECIPE-BOOK-1119.md](RECIPE-BOOK-1119.md)）+ era-correct worktree 复跑：

| idx | 锚 | wid | 复现路径 |
|---|---|---|---|
| 3 | v7blk1-92 | `6b749817f5cfc725` | 白班恢复（v7 线 10-09 配方） |
| 5 | MSB13-R1S791820660 | `5625693e5e54f30a` | 白班恢复 |
| 11 | OBS6-LH6P | `457e635123000e85` | **夜班：原始命令出土**（5ae 班 step3070：baseline=mean/temp=0.5/lamC=0/klW=0.06/arenaShapes=2:multi,3:long,5:multi,5:long,8:multi/segEvery=1000），e2816572 worktree 一发命中 |
| 12 | DIV-V3-ANTIDEF | `0c31e13f5ab6ba9c` | **夜班**：V3S2 重建 → PRESSURE（seed=11181，wid `1c726b7b`）→ ANTIDEF（seed=11186），bf303d0d worktree |
| 13 | DIV-LH6-HEAVY-S2 | `6b7b5fc2dcba1834` | **夜班**：LH6 复现 → HEAVY（seed=11182），bf303d0d worktree |
| 14 | P9-CN-MINI-CONT | `70a2a6bc27cc64c7` | 白班恢复 |
| 21 | TZ2C | `f5776ccecb333168` | 白班恢复（TZ 链 5 跳阶梯逐跳核验） |

**三件根因诊断（白班 32+ 发未中的真相）**：
1. **OBS6-LH6**：白班教师栈全错——原始命令（5ae 班 step3044，2026-11-15T13:04:48）是 **t1=OBS6-LH2 + E9@0.76 带 12 键过滤 + GD16m-D1@0.14 带 5 键过滤 + lasereye 脚本教师@0.06**，groups=3200/steps=120/lr=0.01/dagger=0/无 --seed（默认 20261031）。夜班第一发即中。
2. **V3a.snap0**：残差 = **代码漂移**（a0feae0f 提交 21:53 vs 生成 20:42 之间的未提交改动）——当前代码探针标签 `charge=416/bigT=21/railgun=21/ring=0`，a0feae0f 上 **`505/26/21/2` 四项全中**；teacher2 历史版零影响（两个 bundle 的 snap0 逐位相同）已排除。
3. **V3S2**：六路融合 recipe（0.25/0.20/0.15/0.15/0.15/0.10）+ ×1e6 舍入 ⇒ wid `669145027f8020ae` 命中；v3as0 正身 wid `377e81aba5e70b48` 首次在册。

**附带修复**：registry.tsv 第 1003 行（day1119-cannon-pg，9 列 → 25 列，白班遗留的 CI 红腿）补齐；ledger `missing 668→662`（6 行 missing→ok）；arena-eval 静默通过（接线自证绿）；门禁 np/meta+spec+smoke+battle+map 全绿。
**方法资产**：配方挖掘器 `scratch/mine-commands.mjs` / `mine-lh6-first.mjs`（四 harness transcript 原文提取）；融合试金 `scratch/v3s2-fuse-test.mjs`；正身固化 `scratch/v3s2-build.mjs`。
