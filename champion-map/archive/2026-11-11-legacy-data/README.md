# 2026-11-11 legacy data 归档

页面数据统一迁到 champion-map/data/ 后，以下旧文件只作历史/审计，不再被 viewer 读取。

| 旧文件 | 新位置/状态 |
|---|---|
| coords-projcols.tsv | 拆成 data/display.tsv（展示列）+ data/projections.tsv；本副本冻结 |
| feas-s1..s4.tsv | 合并进 data/feasibility.tsv（ok/okLong/okShort） |
| panel.tsv | 合并进 data/feasibility.tsv 的旧 ok（覆盖不全） |
| fit.tsv | 复制到 data/fit.tsv |
| e370-epsfull.tsv | 一次性产物，仅审计 |
| attach-projcols.mjs | 旧 projcols 生成器；新链 build-view 直接从 display 编译 |
| epsfull.tsv / e328-epsfull.tsv | 旧 attach-hp / rebuild-coords 输入；路径已指向本目录 |
| e370-ruler.tsv | 旧 rebuild-coords --extra 默认；路径已指向本目录 |
| eps.tsv | 旧 eps-scan 产物；路径已指向本目录 |
| _e321-job1/2.tsv | 旧 attach-sc 输入；路径已指向本目录 |
| packs/ | 旧实验包（仅历史） |
| build-1105/ | coords-gen3 的冻结建造输入 |
| coords-view-18 / 零引用 exam4/extra/feas/only/ruler 表 | 旧批次读数，仅审计 |
| coords-gen3-1105.tsv / exam4-* / feas* / epsfull* / e328-ruler* | 旧考卷/尺/可行性批次；新链只读 data/ |
| attach-*.mjs / rebuild-coords / eps-* / duel-run / chain-scan | 旧 1.8/旧考卷链脚本；页面不再调用 |
| coords.tsv | **仍留在根目录**：slot-identity 解析活槽要用，不能归档 |
| eps04-check.mjs / reproj-check.mjs | 一次性探针，仅审计 |
| duel.tsv / duelscan.mjs | 已删除（用户 2026-11-11：对旧冠军 Ldemo 的决斗着色无用） |

不要把这些文件再写回 champion-map 根；需要旧读数时从这里读。
