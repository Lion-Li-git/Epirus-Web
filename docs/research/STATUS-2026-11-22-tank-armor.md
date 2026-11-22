# STATUS 2026-11-22 18:45 — 坦克藤甲线复盘与 `AR-TK2` 正式入 `hard` 池闭环

> 承接：[`TRAINING-RUN-LOG.md`](../TRAINING-RUN-LOG.md) 中 `AR-TK2..AR-TK8` 全链（11-22 14:0x–18:45）。  
> 结论：DS 早前因指标读反开出的 `AR-TK3/4` 三教师摘 `reflect` 手术已被证实南辕北辙；后续经 `AR-TK5..AR-TK8` 四组对照实验彻底查明 `rareFrac` 切分机制与人席对照边界，确认并验收 **`AR-TK2` 在官方 `hard` 带内参照口径下 `seatKill = 0`**，已完整走完建图测点与入池流程并加入 **`hard` 带**（全池 `30 → 31`，`hard 15 / soft 16`）。

---

## 一、核心定论（修正 DS 初判）

1. **为什么 DS 的「教师层摘 `reflect` 键不可行」是对症状、错归因**：
   - [`tools/probe-human-seat.mjs`](../../tools/probe-human-seat.mjs#L35-L36) 报告的 `long 全程刷反弹 = 25.0%` 是 **1 席只会每回合无脑按 `reflect` 的脚本人，对阵 4 席被测包的夺冠率**（越高说明 AI 越治不住按反弹的人），**不是被测包自己按 `reflect` 的频率**；
   - `AR-TK3` 把该格压到 `6.7%` 并不是因为从 `nov21-armor-tzt2d` 摘了 `reflect`（训练集仍有 `340` 条），而是因为把 `teacher1` 退回 `TZT2D` 顺带恢复了破反卡 `sword`（`62 → 214`）；
   - `AR-TK1/3/4` 均验证：**退回 `TZT2D + nov21-armor + tkWeak` 三教师拼盘会撕裂策略**，`arenaB` 掉至 `-35.87 / -41.40 / -25.05pt`。必须保持 `nov21-armor-tzt2d` 单主教师架构。
2. **`supfit-gd.mjs` 的 `rareFrac` × `splitByShape` 边界发现**：
   - [`training/proto2/supfit-gd.mjs`](../../training/proto2/supfit-gd.mjs#L1254-L1257) 的 `inRare` 在每形后 `RARE_FRAC` 段开启稀有采样，而 `splitByShape`（[`supfit-gd.mjs:1397`](../../training/proto2/supfit-gd.mjs#L1397-L1400)）固定将前 `75%` 划入 `train`、后 `25%` 划入 `test` ⇒ **当 `--rareFrac ≤ 0.25`（如 `AR-TK5` 的 `0.25`）时，全部稀有富集段落在测试集，`train` 集 `tank` 富集为 0**，`P(tank→t)` 直接掉回 `0.00%`。只有 `rareFrac - 0.25 > 0` 的超出段才会进入 `train`。
3. **官方 `hard` 带内参照口径下的 `AR-TK2` 终裁**：
   - 按 [`champion-map/seat-rule.mjs`](../../champion-map/seat-rule.mjs#L65-L131) 与 [`tools/pool-add.mjs`](../../tools/pool-add.mjs#L113-L158) 默认 `REF=band` 口径（两批同号 `(read - 现役) - (同带同伴均值 - 现役) ≥ 20pt` 才计杀刀，`champ=bundled-champion-3p` 基线 `5.0% / 4.0%`）：`hard` 带 `long 全程刷反弹` 的 `90210 / 90211` 允许上限分别为 **`<25.25%` / `<24.25%`**；
   - **`AR-TK2`** 实测为 `25.0%` (`90210`, `ga = +19.75pt < 20pt`) / `25.0%` (`90211`, `gb = +20.75pt`)，仅单批超线，不触发两批同号否决，`pool-add.mjs --tier=hard` 正式给出 **`上槽体检 pass ‖ 人席否决 0 格`**。

---

## 二、全系列对照读数汇总（并列 A / B / C 与人席）

> 主尺夹具：`A` = 脚本考卷 / `exam-4n --exam=A`（`champ=bundled-champion-3p`），`B` = 24 锚 `arena-noise-floor`（page 剂量 6 种子中位），`C = (A+B)/2`。同批 150 态反事实因果探针由 `AR-TK2` 自对局采集 `multi`/`long` 各 150 个 `tank` 可打、目标 `fireWeakNow=false` 状态，测试将目标翻为 `true` 时的 `P(tank→target)` 变化。

| 臂 ID | 关键受控变量（均 `TZT2D` 底） | `tank / armor / sword` 标签 | `selftest3` | 150 态因果 `P(F→T)` (`multi`) | A 轴 / `promote` (`champ=bundled`) | B 轴 `arenaB` (6 粒中位 / 极差) | 人席 `90210/90211` `long` 反弹（`multi` 关键格） | 裁定 |
|---|---|---|---|---|---|---|---|---|
| **`nov21-armor-tzt2d`** | `TZT2D + armor@0.30`（单主教师基座） | — | — | `0.00%→0.00%` | `考卷 52.7%` · `0 阻断` | `-12.20pt` | `12.0% / 16.0%`（`3.0% / 4.5%`） | `soft` 在册教师 |
| **`AR-TK2`** | **`armor` 主教师 + `tkWeak@0.20`, `rareFrac=0.35`, `450步/2e-3`** | `204 / 705 / 62` | **6/6 (`0.00e+0`)** | **`4.96%→12.39%` (`+7.44pt`, `argmax 7→18`)** | `考卷 54.5%` · `P5=0.2466 / P5L=0.2399` · `0 阻断` | **`+10.36pt`**（极差 `53.42`） | `25.0% / 25.0%`（`17.5% / 14.0%`, **`band` 0 杀**） | **✅ 正式入池 `hard`** |
| `AR-TK3`（DS） | 三教师：`TZT2D + armor@0.30(只armor) + tkWeak@0.20` | `145 / 161 / 214` | — | — | `F 21.5% / G4 42.3/44.3` · `0 阻断` | `-41.40pt`（极差 `49.86`） | `6.7% / —`（`5.0%`） | 淘汰（三教师碎裂） |
| `AR-TK4`（DS） | 三教师：`TZT2D + armor@0.50(去reflect 14键) + tkWeak@0.20` | `63 / 313 / 166` | — | — | 未跑 `promote` | `-25.05pt`（极差 `39.73`） | — | 淘汰（三教师挤占） |
| `AR-TK5` | 单主教师 + `tkWeak@0.14`, `rareFrac=0.25`, `450步/2e-3` | `116 / 718 / 84`（`train` 近 0） | ✘ 腿 C `1.41e-3` | `0.00%→0.00%` | `考卷 49.1%` · **1 阻断** (`G5[long]=26%`) | `+6.83pt`（极差 `53.18`） | `20.0% / 20.0%`（`17.0% / 16.5%`） | 淘汰（揭示 75/25 边界） |
| `AR-TK6` | 单主教师 + `tkWeak@0.18`, `rareFrac=0.315`, `420步/1.8e-3` | `177 / 695 / 70` | ✘ 腿 C `2.58e-3` | `4.62%→11.33%` (`+6.71pt`, `7→18`) | 未跑 `promote` | `-18.25pt`（极差 `53.38`） | `15.5% / —`（`11.5%`） | 淘汰（B 轴转负） |
| `AR-TK7` | 单主教师 + `--teacher2Shapes=multi/multi4`, `0.20/0.33`, `420步/1.8e-3` | `139 / 685 / 86` | 6/6 (`0.00e+0`) | `multi +15.36pt / long +16.49pt` | `考卷 56.4%` · **1 阻断**（`反弹墙穿透 0`） | `-2.37pt`（极差 `37.96`） | `24.0% / 16.5%`（**`multi 只枪 41%/48%` 触 `hard` 杀**） | 淘汰（`long` 破反塌缩） |
| `AR-TK8` | 单主教师 + `tkWeak@0.20`, `rareFrac=0.33`, `450步/2e-3`（单变量） | `199 / 690 / 89` | 6/6 (`0.00e+0`) | `multi +7.23pt / long +9.79pt` (`1→16`) | 未跑 `promote` | `-11.54pt`（极差 `66.40`） | `36.5% / —`（`12.5%`） | 淘汰（B 轴与人席劣于 `TK2`） |

---

## 三、`AR-TK2` 入池后池覆盖与下一步方向

- **入池实体**：[`docs/artifacts/AR-TK2.bak`](../../docs/artifacts/AR-TK2.bak)（`wid=b5d4cbc6af57bbdd`），`C5R = +0.0826`、`C5RL = +0.1752`、`ruler H=51.9 / S=2.01`，Stage 1 并集 `16/30`（胜率 `40.75%`、`armor 120/120` 格 `5,205` 手、`tank 26/120` 格 `212` 手、`sword 80/120` 格 `770` 手、`snipe 54/120` 格 `1,815` 手），Stage 2 强度 `22` 技（消融 `9`）。
- **池结构变化**：产品池 `30 → 31`（`hard 14 → 15 / soft 16`），`hard` 带首次同时具备 `armor` 与 `tank` 协同输出能力。
- **后续方向**：若要在 `hard` 带把 `long 全程刷反弹` 从 `25.0%` 进一步压低同时不损 `arenaB`，重点不在修改 `reflect` 键，而是先做一次低风险单变量补查（如在 `supfit-gd.mjs` 中分离“评估集采集”与 `rareFrac` 段落，或以 `AR-TK2` 自身做基座加少量 `antiReflect` / `sword` 保底），而当下 `hard` 覆盖优先级可以放心转向 `firestorm` / `mine` / `cannon` / `rod`。
