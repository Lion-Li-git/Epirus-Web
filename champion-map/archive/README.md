# archive/ — champion-map 归档件（11-07 整理 · 用户令"整理干净 + 信息汇总"）

**归档判据**：信息已并入顶层活表（`coords.tsv` / `coords-gen3-1105.tsv` / `lineage.tsv` / `epsfull.tsv`），
或为一次性探针（读数已入账），或为已退役的分页图。git 史与 `git mv` 保留完整来路；本目录只作溯源。

## 内容分组（文件 → 信息现居地）

| 组 | 文件 | 信息现居地 |
|---|---|---|
| E 系列批次对（§E608~E825 时代的 per-experiment 尺表+考卷表） | `e608-*` `e641-*` `e757-*` `e762-*` `e772-*` `e779-*` `e806-*` `e825-*`（ruler/epsfull/ruler-extra 成对） | `coords.tsv` 的 H/Hp/De/12 维行为列（rebuild-coords --extra 曾吃它们） |
| 一次性探针/分析脚本 | `_probe-*.mjs` ‖ `directions/gapscan/duel-stats/evaln-noise/eps-arms*/eps2seed/hlong-compare/holefeatures+stats-lib/holoprobe/holo2proto/iso-sweep/k8arms/k8measure/oldpacks*/pool-arrange*/pool-basin-1103/pool-screen/pool-traits/seatassoc/seatgap/seatroster/selkeys/trace-game/vetoline/widhunt.mjs` | 各自的 FINDING/RESULTS/DECISIONS 记录；结论都进了活表 |
| 退役分页图（09b38ebc 退役三张 verpages 的同族前代） | `gen3-map.*` `gen3-evolution.*` | `index.html`（单页 + 版本下拉） |
| 旧考卷/旧尺快照（被 120 档统一或被 R64 重测取代） | `epsfull-hp-final-2026-10-19*` `epsfull-hlong-final-2026-10-19*` `epsfull-long-2026-10-1[6/24]` `epsfull-long-prior2` `epsfull-prior2` `epsfull-tier-88000c` `epsfull-v7long-1106` `eps2s88000-120` `eps313-agg` `bead-*` `h2p-*` `holo*` `cont1200` `duel-e334-*` | `epsfull.tsv`（718 枚历史库）+ `coords-projcols.tsv` 的 Hlong/Hplong/Flong 列 |
| 1103 建造期的中间产物 | `g3-nodes-1103.tsv` `ruler-g3-1103.tsv` | `build-1105/coords-gen3-1103.tsv`（927 行联合表） |
| R64/夜班已消费的批次 | `epsfull-r64-*1107*` 之外的多余份 ‖ `ruler-pool-new-1107` `extra-g3-1105-new` `extra-g3c/g3d-1105` `feas-long/short-g3-1105` `_e318-all15` `_e328-descendants` | `coords-gen3-1105.tsv`（884 行现役联合表） |
| 旧数据代（gen3-map 时代） | `point-data.tsv` `point-data.mjs` | `index.html`（烘焙页）+ `coords-projcols.tsv` |
| 旧座席/旧用途快照 | `seat-2026-10-11-*` `seat-cands-2026-10-09` `pool-seat-ml2-*` `pool-hp.tsv` `poolruler-2026-10-17` `selband-2026-10-18` `usage.tsv` `usage-buckets-2026-10-20` `opphuman-arms.tsv` | `slot-*.tsv` / `promote.tsv` / 活管线现役表 |
| 备份 | `index.html.bak` | `index.html`（烘焙页） |

## 顶层活件速查（整理后 229 → ~100 项）

- **联合表**：`coords.tsv`（1.8 面板 825）‖ `coords-gen3-1105.tsv`（2.0 系 884，现役真源）‖ `coords-projcols.tsv`（56 列烘焙 fit 表）‖ `coords-view-18/20.tsv`（子集视图）
- **谱系账**：`lineage.tsv`（上槽谱系）‖ `lineage-g3.tsv`（2.0 sidecar，builder 产物）‖ `g3-lineage.tsv`（237 行 harvest 账，builder 输入）
- **考卷/读数**：`epsfull.tsv`（718 枚历史库，attach-hp 缺省表）‖ `epsfull-long-2026-10-23.tsv`（attach-hlong 现役长程表）‖ `epsfull-tier-2026-10-12.tsv` `epsfull120-2026-10-10.tsv`（rebuild/switch-gear 默认）‖ `epsfull-r64-*1107.tsv`（R64 重测批）‖ `feas*.tsv`（可行性四腿，viewer 环的两把主语）
- **池与身份**：`pool-members.tsv`（3P 池真源）‖ `pool-members-2p.tsv`（2P 池真源）‖ `pack-aliases.tsv` ‖ `slot-*.tsv` `ship-times.tsv` `ts-override.tsv`
- **活脚本**：`viewer.mjs`（烘焙）‖ `rebuild-coords.mjs`（十步链）‖ `attach-*.mjs`（挂列链）‖ `night6-join` 在 `scratch/`（1105 建造器，源在 `build-1105/`）‖ `pool-sync.mjs` `pack-*.mjs` `slot-*.mjs` `seat-rule.mjs` `eps-full.mjs`（考卷仪器）等
