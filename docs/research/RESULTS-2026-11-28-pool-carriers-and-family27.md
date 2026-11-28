# 2026-11-28 `obs6.5` 家族重划（23–27）、`miniT` 靶向审计与池补洞结论

## 1. `obs6.5` 家族重划（`23..27`）

将原过并的三支 `23(35)+24(19)+25(46)` 在不打散早期主线的前提下拆为 5 支（计划表：[family-plan-23to27.tsv](file:///d:/code/Epirus-Web/docs/research/evidence-2026-11-28-family-27/family-plan-23to27.tsv)，共 100 行，人数守恒）：

| 家族 | `minTs` | 计划时成员数 | 主题 |
| --- | --- | --- | --- |
| `23` | `11-15T12:47` | 22 | `2.0 obs6.5 V3 路由、统一单包与 EQ 底座（11-15–16）` |
| `24` | `11-16T17:05` | 19 | `2.0 obs6.5 MX 矩阵与早融合（11-16–19）` |
| `25` | `11-17T23:23` | 34 | `2.0 obs6.5 早期协同与单技特化补洞（11-17–25）` |
| `26` | `11-25T07:16` | 15 | `2.0 obs6.5 DR-R3E 广谱蒸馏替换链（11-25–26）` |
| `27` | `11-26T13:45` | 10+（入池后新增 3 枚） | `2.0 obs6.5 PG 珠闭环与岭基线载体线（11-26–）` |

## 2. 小雷（`miniT`）靶向有效性评估

按口径「无效化 `2 Ep` 技得 `1` 分；无效化 `ring` 或 `>=3 Ep` 技得 `2` 分；打到 `ji`/枪/防御技/被 `voidImmune` 免疫得 `0` 分」，在 `fx-pool1126d` 120 格 Stage 1 上审计（明细见 [minit-effectiveness.txt](file:///d:/code/Epirus-Web/docs/research/evidence-2026-11-28-family-27/minit-effectiveness.txt)）：

| 包名 | 施放次数 | 命中详情 | 总分 | 均分（分/次） |
| --- | --- | --- | --- | --- |
| `TM-S2` | 16 | 12 次非镜像无效化（`railgun:9, laserEye:1, ji:2`）+ 4 次 `voidImmune (guard)` | **11** | **0.688**（无效命中均分 **0.917**） |
| `MT-PG` | 39 | 24 次无效化（`gun:16, ji:6, bagua:2`）+ 15 次 `voidImmune (guard)` | 0 | 0.000 |
| `JN-DR` | 27 | 27 次无效化（`ji:27`） | 0 | 0.000 |
| `DR-R3E` | 1 | 1 次无效化（`ji:1`） | 0 | 0.000 |

结论：纯小雷高发包（如 `MT-PG`）只刷出低价值 `gun/ji` 无效化；仅经高费/闭环载体（`TM-S2`）才打出稳定指向高费主炮（`railgun`/`laserEye`）的真实战术收益。

## 3. 新入池载体与旧包淘汰

三枚新包均系 `v:92 / S1o / 16561` 架构，`selftest3` 六腿全绿（`0.00e+0`），均走 `L1B-S1200` 底座经蒸馏与岭 PG 微调（训练旋钮定义见 [TRAINING-KNOBS.md](file:///d:/code/Epirus-Web/training/TRAINING-KNOBS.md)）：

| 新包（位置） | `wid` | 替换对象（档位） | Stage 1 关键读数（`fx-pool1126d`） | `seatKill`（`90210/90211`） |
| --- | --- | --- | --- | --- |
| [TM-S2.bak](file:///d:/code/Epirus-Web/docs/artifacts/TM-S2.bak) | `bf3a8c28c7e47349` | `MX6-GD-TF20`（`soft`，废手 `96.69%`，`seatKill=1`） | `win=39.42%`, `waste=40.74%`, `transfer=19 (10/105)`, `miniT=3 (11/15=73.3%)`, `jin=25`, `ring=19`, `rail=5` | `0`（`8.0% / 11.5%`） |
| [TN-S2.bak](file:///d:/code/Epirus-Web/docs/artifacts/TN-S2.bak) | `1713eeac754505d6` | `nov21-taunt-dsp0b`（`hard`，`selftest3` RED，废手 `98.01%`） | `win=47.42%`, `waste=11.11%`, `taunt=11 (uses:118, closure 94/95=98.95%)`, `ring=19`, `rail=6` | `0`（`10.5% / 12.5%`） |
| [TA-S2.bak](file:///d:/code/Epirus-Web/docs/artifacts/TA-S2.bak) | `2e05eda664c8ceb0` | `OBS6E9`（`soft`，`selftest3` RED，废手 `95.85%`） | `win=46.17%`, `waste=71.70%`, `tank=2 (20/20=100%)`, `armor=40 (40/273)`, `jin=13 (52/88)`, `ring=20`, `rail=5` | `0`（`15.0% / 14.5%`） |

- `TA-S2` 连携探针补充：`tankUse=11, tankDmg=45, tankSelfRefl=0, armor->tankFireHits=8`。
- `MX6-GD-TF20.json`、`nov21-taunt-dsp0b.json` 与 `OBS6E9.json` 已按仓规迁至仓外隔离目录 `D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-28-p0p1/`，未做物理抹除。

## 4. 入池后难度阶梯与图视图修复

- 难度阶梯（`probe-diff-ladder.mjs --pool=1`）：
  - `2P rule`：`29.3% < 43.1%`（`-13.80 ±3.22pt, 8.4σ`）
  - `2P legacy`：`22.3% < 24.9%`（`-2.53 ±2.75pt, 1.8σ`）
  - `5P multi (800g 95002)`：`3.1% < 9.6%`（`-6.50 ±2.33pt, 5.5σ`）
  - `5P long (400g 95001)`：`2.8% < 8.3%`（`-5.50 ±3.06pt, 3.5σ`）
- 技能覆盖（`35` 成员：`17 hard / 18 soft`）：`hard` 覆盖 `28` 技，`soft` 覆盖 `28` 技（`miniT: 2/1, tank: 1/4, armor: 1/4, jinshield: 9/8, taunt: 2/2, transfer: 1/5`）。
- 树图渲染修复：入池 3 枚进入 `FAM 27` 后使该族在 `11-26–11-28` 右端聚集 `13` 枚池成员，邻点圆填充曾盖住早绘节点的池环，导致 `mode=tree` 自检中池环像素降为 `241`（门限 `280`）。已在 [viewer.mjs](file:///d:/code/Epirus-Web/champion-map/viewer.mjs#L2898-L2929) 的 `drawTree` 中改为先绘全量点填充再叠加池环与选中/对比环，重烘后四视图自检全过。

## 5. 预注册补臂结果（11-28 晚 · 三条硬门均过）

三条载体在初版被预注册拦下后，按同一预注册文件补训，最终候选与硬门读数：

| 候选 | 位置 | wid | 档位 | Stage 1 win | 目标覆盖 | 废珠 | selftest3 | promote | seatKill |
| --- | --- | --- | --- | ---: | --- | ---: | --- | --- | --- |
| `TM-S5-a40` | [TM-S5-a40.bak](file:///d:/code/Epirus-Web/docs/artifacts/TM-S5-a40.bak) | `922277a50709854e` | soft | 42.75% | miniT 4 / transfer 20 / jinshield 48 | 29.09% | 绿 | 0 阻断 | 0 |
| `TN-S5` | [TN-S5.bak](file:///d:/code/Epirus-Web/docs/artifacts/TN-S5.bak) | `4039c918f4cb171b` | hard | 42.83% | taunt 37 / jinshield 21 | 22.22% | 绿 | 0 阻断 | 0 |
| `TA-S3` | [TA-S3.bak](file:///d:/code/Epirus-Web/docs/artifacts/TA-S3.bak) | `4a533551923d12dd` | soft | 47.58% | armor 97 / tank 33 / jinshield 27 | 0（无珠经济） | 绿 | 0 阻断 | 0 |

- `TM-S5-a40` 是 `TM-S3`（miniT6 / win39.50）与 `TM-S4`（miniT2 / win43.50）的 40/60 权重插值；单用任一都不满足两条硬门。
- `TN-S5` 先在低剂量 `TN-S4` 上补齐 `taunt/jinshield` 覆盖，再做 2400 局岭基线 PG 抛光；覆盖率与胜率同时过线。
- `TA-S3` 第一版多教师臂被教师调度闸判 `teacher2 0 组`，改为单教师 `TK-FS4`（只补 tank/armor）后过线，避开优先级饥饿。
- 入池阶梯（`probe-diff-ladder --pool=1`）：2P standard 5000 局 **19.8% < 25.4% < 29.3%**；5P multi 1500 局 **2.9% < 7.9% < 13.9%**；5P long 600 局 **1.3% < 9.0% < 13.0%**；8P multi 300 局 **9.7% < 11.7% < 16.0%**，四组均 hard < regular < simple。
- 旧 `TM-S2/TN-S2/TA-S2` 的 raw JSON 已移至 `D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-28-carriers/`；`.bak` 保留在册，未做物理删除。

## 6. 2026-11-28 20:44 复核更正：最终 `TA-S3` 人席不是 0

- v2.1.49 池表与 canonical 人席表当时仍指向初版 `TM-S2/TN-S2/TA-S2`；最终 `TM-S5-a40/TN-S5/TA-S3` 没有并入 `champion-map/pool-seat-90210/90211.tsv`。
- 补测最终三枚后，`TM-S5-a40` 与 `TN-S5` 仍为 `seatKill=0`；`TA-S3` 在 90210/90211 的 long 反弹型三格分别为 `67.0% / 75.5%`，按当前 soft 带内参照重算为 **`seatKill=2`**。
- 因此本节 §5 的 `TA-S3 seatKill=0` 结论作废；在完成替代或回滚前，不得把 v2.1.49 的 `TA-S3` 读作人席合格。
- 原始件：`evidence-2026-11-28-family-27/final-carriers-seat-90210/90211.{txt,tsv}`；重算件：`seat-recompute-v2149.json`。
