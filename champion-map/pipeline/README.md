# pipeline/ · champion-map 统一数据模型

> 2026-11-11 起：**源头是 data/ 的长表 + display**；build/ 是编译产物；页面已改吃 data/build/coords-view.tsv，旧 coords-projcols/feas/panel/duel 已退役。

## 数据文件

| 文件 | 一行 | 关键列 |
|---|---|---|
| data/registry.tsv | 一份权重 | pack_id/path/ver/fam/fam_label/lineage/ts/sha256 |
| data/rulers.tsv | 一把尺 | ruler_id/axis/status(current/reference/frozen)/fixture/batch_id/formula |
| data/batches.tsv | 一次考试批次 | batch_id/ruler_id/axis/fixture/champ/run/source/rows |
| data/readings/current.tsv | 一条读数 | pack_id/ruler_id/cell/horizon/value/n/batch_id |
| data/readings/h5-frozen.tsv | 旧 H5 参考 | 只读；流水线不写 |
| data/features.tsv | 一份权重的行为 | rounds/dmg/.../S/Geff |
| data/projections.tsv | 一份权重的投影 | xt/yt/xt3/yt3/zt3/xt18/...；换尺不动 |
| data/display.tsv | 一份权重的展示行 | 146 列；旧 926 + 新点都在这里；--bake 时新点必给 |
| data/feasibility.tsv | 一份权重的过线 | ok/okLong/okShort/fails；绿环读纯桌列 |
| data/fit.tsv | 页面 fit 说明 | 从旧 fit 迁入 |
| data/page/ | 页面元数据 | coords/lineage/lineage-g3/pool-members/promote/ship-times/slot-*；viewer 与 slot-identity 只读这里 |

## 换尺接口

换尺 = **追加 readings + 改 current 指针**，不动 projections：

```bash
# 1. 在 data/rulers.tsv 加一行新尺（status=reference），旧尺改 reference
# 2. 用新 ruler_id 追加 data/readings/current.tsv
node champion-map/pipeline/rulers.mjs --set-current=<new_ruler_id>
node champion-map/pipeline/build-view.mjs --compare=champion-map/coords-gen3-1105.tsv
```

- H5 是 frozen：`--set-current=h5-page-1109` 会 exit 2；没有写它的路径。
- C 是派生尺（formula=(A+B)/2），不存 readings；A/B 换尺后 C 自动重算。
- projections.tsv 由 pack_id 关联，换尺绝不改它。

## 命令

```bash
# 一次性 backfill（926 行 → data/；已有 data 要 --force）
node champion-map/pipeline/backfill.mjs

# 编译考卷视图 + 与 coords-gen3 逐值对照（0 mismatch 才过）
node champion-map/pipeline/build-view.mjs

# 数据模型门（发布前 --strict：每枚 16 格齐全）
node champion-map/pipeline/validate.mjs --strict

# 当前尺清单
node champion-map/pipeline/rulers.mjs --list
```

## 自动测量（2026-11-11 晚，已跑通假点）

```bash
node champion-map/pipeline/measure-point.mjs \
  --pack=docs/artifacts/xxx.js --id=NEW-1 --ver=2.0 [--rounds=12] [--no-add] [--bake]
```

- 自动跑 A/B × multi/long 四张 exam4 + ruler-measure + feas(allLong/allMulti) + proj-tsne（整表重投影），拼 readings/display/projections，再调用 add-point。
- 实测 rounds=1 假点：四腿 + ruler + feas + proj 约 50s；写出 16 条 readings、146 列 display、927 行 projections。
- 假点 `--bake` 已跑通：927 行 coords-view + 页面 **98 PASS / 0 FAIL**（temp data，未动在册）。
- display 里 `Sc/kin` 等少数列仍空；**新点不写 H5/F/rank**（H5 冻结旧尺，页面按 C·R 重算名次）。

## 新点进图（已落数据侧）

```bash
node champion-map/pipeline/add-point.mjs \
  --pack=docs/artifacts/xxx.js --id=NEW-1 --ver=2.0 \
  --readings=<ruler_id,cell,horizon,value,n> \
  --display=<一行 display 表，表头=data/display.tsv> \
  --batch=<batch_id> [--fixture=...] [--bake]
```

- `--readings` 必给；A/B 当前尺的读数。
- `--display` 在 `--bake` 时必给（146 列展示行；新点没有模板行会缺 x2/Sc/kin 等）。
- `--projections=<927 行全表>`：`measure-point` 会传；整表重投影后旧点坐标也一起换，避免新旧混两套坐标。
- 流程：registry → batch/readings/display（+ features/projections）→ build-view →（--bake）rebuild-map → shot 98/0。
- **本脚本不跑测量**：读数/display 由 ruler-measure/门禁或 `measure-point.mjs` 产出后喂入。
- 写入不是事务式的：构建失败会报错，数据已落；回滚用 batch_id 手工撤。
