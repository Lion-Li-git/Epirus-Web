# `champion-map/` —— 冠军谱系图 + 数据仓（读我）

> 目的：**找数据不用翻目录**。这个目录同时装三样东西 —— ① 谱系图页面与其源码；② 谱系/体检的**表**；③ 把表补齐的脚本。
> 规矩：`_` 开头的都是临时产物（`.gitignore` 已挡），**别把它们当数据源**；入库的表一律是 `名字.tsv`。

## 一、我要找什么 → 看哪个文件

| 我想知道 | 看这个 | 说明 |
|---|---|---|
| **池里现在有哪些冠军** | `pool-members.tsv` | 列：`id wid path tier invited promoteVerdict seatKill addedAt note`。`tier` 只有 **hard / soft** 两档（§E596 起三带，池里实际两档） |
| **某枚包的送盾体检** | `holo.tsv` | 列：`id ok H rank holoPerGame holoOther giftShare overCap` ‖ **`holoOtherPrior2` = 开档 2 的口径**（页面默认，`promscan` 优先用它） |
| **某枚包能不能上槽** | `promote.tsv` | `--run-promote` 的落盘结果（`pass` / `block` + 原因） |
| **某个包打起来是什么风格** | `e588-usage-*.tsv` | **每局出手次数**：`snipe defense defenseShare holo guard reflect bigT miniT gun railgun charge ring ji atkShare rounds`；四张 = `multi/long` × `ε=0/0.2` |
| **池成员谁广、谁刷盾**（选池界面看不见的两列） | `archive/pool-traits.tsv`（11-07 归档；需要时按 README 命令再生） | 每枚一行：`Hplong Geff distinctKeys holo裸包 holo开档2 charges rounds noThreatStance 广度过线 送盾偏高` |
| **攒 ep 的时机**（环/ジ 在什么局面用） | `archive/usage-buckets-2026-10-20.tsv`（归档；`behavior-profile --buckets=1` 再生） | 四格 = 能不能开环 × 这一回合挨没挨打；long 档 `Pearson(环@有ep·安全, 混合桌胜率) = +0.76`（`FINDING-2026-10-20-ring-payoff-ds.md` §十） |
| **考卷/尺的读数（历史批次）** | `archive/eNNN-*.tsv` | §E608~E825 时代的 per-experiment 尺表+考卷表，信息已并入 `coords.tsv`；`e328-*`/`e370-*`/`e287-ruler` 因仍是链上缺省参数留在顶层 |
| **对打结果** | `duel*.tsv` | `duel-run.mjs` 产出 |
| **谱系图上的坐标与各列** | `coords.tsv`（1.8 面板）‖ `coords-gen3-1105.tsv`（2.0 系 926，现役真源）‖ `coords-projcols.tsv`（烘焙 fit 表） | 宽表（H 系列读数**已改名 H5 参照系**：`H5/Hp5/De5/Hlong5/Hplong5/Flong5` = 旧 5P 单卷读数，新四格卷上线后整列退出）；**由链生成，别手改** |
| **重复包清单** | `dupes-manifest.tsv` | 与 `tools/dedupe-artifacts.mjs` 配套 |
| **别名** | `coords-aliases.tsv` | 同一枚包的多个文件名 → 一个 `id` |
| **这一行的 A/B/C 读数来自哪批** | `EXAM-BATCHES.tsv` + coords 的 `examA/examAL/examBs/examBl/examFix/examC` 六列 | 由 `attach-exam-stamp.mjs` 生成；`--check` 会拦 unknown / 旧夹具 / C 不符 |

## 二、页面（产物，不许手改）

- `index.html` —— 谱系图页面，**是产物**：改 `viewer.mjs` 后必须 `node champion-map/viewer.mjs` 重烘。
- `viewer.mjs` —— 页面源码（内含自检；`node champion-map/lint-viewer.mjs` 先绿再烘）。
- `map-table.mjs` —— 输入表单一入口（阶段 1）：`resolveTable/readTable/writeTable/assertColumns/assertFullTable/tableStamp`；`map-table-selftest.mjs` 15 条。
- `attach-exam-stamp.mjs` —— 给 coords 盖 `examA/examAL/examBs/examBl/examFix/examC` 六列；`--check` 只读，拦 unknown/旧夹具/C 不符。
- `data/` + `pipeline/` —— 数据模型 A：长表 readings + rulers 换尺接口 + `build-view` 对照；详见 `pipeline/README.md`。
- `rebuild-map.mjs` —— 页面唯一入口（戳 → projcols → viewer → shot 98/0）；`viewer` 默认已改吃 `coords-projcols.tsv`。
- `rebuild-coords.mjs` —— **九步链**：把所有 `attach-*.mjs` 串起来重建 `coords.tsv`（漏一步就丢列，v1.7.97 那次的 `Hlong` 就是这么丢的）。

## 三、`attach-*.mjs`：每列一个脚本

| 脚本 | 补什么 |
|---|---|
| `attach-hp.mjs` | `Hp`（页面口径的夺冠率） |
| `attach-hlong.mjs` | `Hlong/Hplong/Flong/okLong/failsLong`（长程考卷） |
| ⚑ **`okLong` 的 `-`** | 它来自 `feas.mjs --allLong=1` 的分片表：`0`/`1` = 判过/判不过；**`-` = 介入实验臂**（`t5-*-ringon/ringoff` 那 5 枚），**不是候选包、按设计不跑可行性子集** —— 不是漏测，也不参与任何筛选 |
| `attach-sc.mjs` | `sc`（当选面打分） |
| `attach-exam-stamp.mjs` | `examA/examAL/examBs/examBl/examFix/examC` 六列（考卷批次戳；`--check` 只读） |
| `attach-kin.mjs` | 亲缘/父子边 |
| `attach-path.mjs` | 谱系路径 |
| `attach-dup.mjs` | 重复标记 |

## 四、命名约定

- **`_xxx.tsv` = 临时/中间产物**，gitignore 挡着，**不是数据源**（例：`_e1-arms.tsv`、`_pf-K2.tsv`）。
- **`eNNN-*.tsv` = 研究日志 §ENNN 那一段的落盘**（`docs/research/logs/` 里能按编号查到来龙去脉）。
- **`*-2026-MM-DD.tsv`** 带日期的 = 某一天的快照，**会被更新**，引用前先看 mtime。

## 五、三条使用纪律（踩过的坑）

1. **`coords.tsv` 不手改**：它由九步链生成；手改会在下次重建时被覆盖，而且会让页面显示与表不一致。
2. **`index.html` 不手改**：它是产物，改源码再重烘。
3. **口径要写清**：同一枚包在 `holo.tsv` 有两个送盾数（裸包 `holoOther` 与开档 `holoOtherPrior2`），**报告里引哪个要写明**。

## 六、常用命令

```bash
node champion-map/rebuild-coords.mjs          # 重建 coords.tsv（九步链）
node champion-map/attach-hlong.mjs --check    # 检查长程列在不在
node champion-map/rebuild-map.mjs             # 页面唯一入口：戳 → projcols → viewer → shot 98/0
node champion-map/viewer.mjs                  # 仅当 coords-projcols.tsv 已是最新时才直接烘
node tools/promote-champion.mjs <pack> --dry  # 单枚上槽体检（≈2.5 分钟）
node tools/probe-pool.mjs --subject=<pack>    # 池尺对打（默认 support=2）
node tools/behavior-profile.mjs --champion=<pack> --buckets=1   # 行为画像 + 攒 ep 时机分桶
```

> 数据在哪：**产物本体在 `docs/artifacts/`**（多数被 `.gitignore` 挡，只在本机）；这个目录只放**表与页面**。

## 七、2026-11-06 清理（260 → 221 份）

- **删掉作废的分页图**：`index-2v-18.html` / `index-2v-20.html` / `index-2v-all.html`（共 3.4 MB）。三合一之后只有 `index.html` 是产物；
  页面自检四视图仍 99 PASS / 0 FAIL。要读旧版：`git show <old-commit>:champion-map/index-2v-18.html`。
  ⚠ 退役当夜只删了产物、没拆生成器（`--verpages=1` 与 `rebuild.sh` 还各烘一遍 ⇒ 跑完整链会把这三页和那条覆盖缺口一起长回来）。
  11-06 深夜拆干净：`VERPAGES` 恒为空表、`--verpages=1` 响亮拒绝（exit=2），`rebuild.sh` 那三行删除；拆前后各烘一遍产物**逐位相同**，所以这条不动页面。
- **搬走 25 份零代码引用的数据回执** → `docs/research/archive/2026-11-06-champion-map-cleanup/`（`INDEX.tsv` 是逐份对照表）。
- **原地没动的**：所有 `.mjs`（脚本是别条链的入口）‖ `*epsfull*` / `*ruler*`（`rebuild-coords.mjs` 按名字反推口径表）‖
  `feas-*`（`attach-hlong/hshort` 通配读）‖ `coords*` / `point-data*` / `lineage*` / `pool-*`（页面与池的真源表）。
- 判据写在 `docs/research/archive/README.md` 的 2026-11-06 那两节（含一次如实记录的事故：第一遍判据太宽，11 份未跟踪文件被误删且不可恢复）。

## 八、2026-11-07 整理（229 → ~100 项）+ H 系列改名 H5 参照系

- **归档**：`archive/`（103 份：已并入联合表的历史批次 e608~e825 对、一次性探针、退役分页图、旧考卷快照；`archive/README.md` 有逐组"信息现居地"对照表）。
- **建造源归拢**：`build-1105/`（9 份 = `coords-gen3-1105.tsv` 的 night6-join 冻结输入；join 路径已同步，重放前先核头注）。
- **留下的判据**：活脚本 + 活表全在顶层；`pool-seat-ml2-*`（ship 门读）、`holo.tsv`（promscan 读）、`panel.tsv`（viewer 读）、`oldpacks.tsv`（dedupe 门读）等真活件逐一核过引用才留。
- **H 系列改名（用户令）**：旧 5P 单卷读数整族改参照名 —— `H→H5 ‖ Hp→Hp5 ‖ De→De5 ‖ Hlong→Hlong5 ‖ Hplong→Hplong5 ‖ Flong→Flong5`，
  五张 coords 表 + viewer（字段/图例/tooltip/页检）+ attach-hp/hlong/sc + switch-gear/fold/dups/rebuild/repair + night6-join/r64-attach 全链同步；
  仪器 `eps-full` 的 `page/d` 输出 schema 不变（历史考卷表保持可比）。**等新四格卷（X2/X3/X5/X8）上线后，H5 参照列整列退出图**。
