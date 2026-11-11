# data/ · champion-map 数据模型 A（2026-11-11）

> 只读约定：本目录由 pipeline/backfill.mjs / pipeline/build-view.mjs 生成或维护；不要手改 readings。
> 换尺：在 rulers.tsv 加一行 + 追加 readings；把同轴旧尺标 reference；projections.tsv 不动。

| 文件 | 粒度 | 说明 |
|---|---|---|
| registry.tsv | 一行 = 一份权重 | id/path/ver/fam/fam_label/lineage/ts/sha256/status |
| rulers.tsv | 一行 = 一把尺 | axis/status(current/reference/frozen)/fixture/batch/formula |
| batches.tsv | 一行 = 一次考试批次 | batch_id/ruler/axis/fixture/champ/run/source/rows |
| readings/current.tsv | 长表 | pack_id,ruler_id,cell,horizon,value,n,batch_id |
| readings/h5-frozen.tsv | 宽表 | 旧 H5 参考；frozen，不更新 |
| display.tsv | 一行 = 新点/覆盖的展示行 | viewer 还需要的纯展示列；表头 = coords-projcols 146 列。旧点仍用模板，新点由 add-point 追加 |
| features.tsv | 一行 = 一份权重 | 行为列（rounds/dmg/.../S/Geff） |
| projections.tsv | 一行 = 一份权重 | xt/yt/xt3/yt3/zt3/xt18/yt18/xt20/yt20；换尺不动 |
| build/exam-view.tsv | 视图 | 由 readings + rulers 编译；与 coords-gen3 逐值对照 |
| build/coords-view.tsv | 页面视图 | 146 列；canonical data + display 行；rebuild-map 直接吃它 |
| build/report.json | 报告 | 行数/覆盖/对照 max diff/文件 sha |

新点进图：node champion-map/pipeline/add-point.mjs --pack=... --id=... --readings=... --display=... --bake
换尺接口：node champion-map/pipeline/rulers.mjs --set-current=<ruler_id>
