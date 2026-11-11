# data/ · champion-map 统一数据模型（2026-11-11）

> 源头：registry/rulers/batches/readings/features/projections/display/feasibility。
> 页面：build-view 编译 build/coords-view.tsv，rebuild-map 吃它；viewer 不再读旧 coords-projcols/feas/panel/duel。
> 换尺：在 rulers.tsv 加一行 + 追加 readings；把同轴旧尺标 reference；projections.tsv 不动。

| 文件 | 粒度 | 说明 |
|---|---|---|
| registry.tsv | 一行 = 一份权重 | id/path/ver/fam/fam_label/lineage/ts/sha256/status |
| rulers.tsv | 一行 = 一把尺 | axis/status(current/reference/frozen)/fixture/batch/formula |
| batches.tsv | 一行 = 一次考试批次 | batch_id/ruler/axis/fixture/champ/run/source/rows |
| readings/current.tsv | 长表 | pack_id,ruler_id,cell,horizon,value,n,batch_id |
| readings/h5-frozen.tsv | 宽表 | 旧 926 行 H5 参考；frozen，不更新；新点不写 H5/F/rank |
| feasibility.tsv | 一行 = 一份权重 | 混合桌 ok（旧）+ okLong/okShort/fails；viewer 绿环读纯桌列 |
| display.tsv | 一行 = 一份权重 | viewer 全部展示列（146 列）；旧 926 + 新点都在这里，不再依赖 coords-projcols |
| features.tsv | 一行 = 一份权重 | 行为列（rounds/dmg/.../S/Geff） |
| projections.tsv | 一行 = 一份权重 | xt/yt/xt3/yt3/zt3/xt18/yt18/xt20/yt20；换尺不动 |
| fit.tsv | 宽表 | 页面 fit 说明 |
| page/coords.tsv / lineage*.tsv / pool-members.tsv / promote.tsv / ship-times.tsv / slot-*.tsv | 页面元数据 | viewer/slot-identity 的页面输入；P0 从根目录迁入，根目录不再放这些表 |
| build/exam-view.tsv | 视图 | readings + rulers；与 coords-gen3 逐值对照 |
| build/coords-view.tsv | 页面视图 | display + canonical 编译；rebuild-map 直接吃 |
| build/report.json | 报告 | 行数/覆盖/对照 max diff/文件 sha（gitignore） |

新点测量+进图：node champion-map/pipeline/measure-point.mjs --pack=... --id=... --ver=2.0 [--bake]
只喂已有数据：node champion-map/pipeline/add-point.mjs --pack=... --id=... --readings=... --display=... [--projections=...] [--bake]
换尺接口：node champion-map/pipeline/rulers.mjs --set-current=<ruler_id>
