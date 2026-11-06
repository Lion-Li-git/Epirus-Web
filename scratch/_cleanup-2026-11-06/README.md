# 11-06 午清理挪出来的东西（用户令「清理一下仓库里的临时文件」）

这一格里的文件**全部未跟踪、全部可再生产生或有 git 历史兜底**，挪出来只是为了让工作树干净；
确认没人要之后，整格 `rm -rf scratch/_cleanup-2026-11-06` 就行。研究结论没有一个字住在这里。

| 文件 | 它是什么 | 为什么能挪走 |
|---|---|---|
| `_t20oldlin.html` ‖ `index-onepage.html` ‖ `index.html.bak` | 演化图的两份对照页与一份烘焙前副本（共约 3.4 MB） | 全仓 grep 只在浏览器历史记录里命中，**没有任何代码 / 门 / 文档引用**；现行产物是 `champion-map/index.html`（由 `viewer.mjs` 按 `bake-flags.txt` 烘，随时可重做） |
| `coords-gen3-1105.tsv.bak-pool10` ‖ `coords-view-20.tsv.bak-pool10` | 补进 10 枚池成员**之前**的面板快照（870 / 39 行） | 唯一一份没进 git 历史的改表前状态，所以没删只挪走；重放路径 = `scratch/qoder-1106-attach-pool10.mjs`（它自己会重新生成同名备份） |
| `coords-gen3-1105.tsv.bak-poolid` ‖ `coords-view-20.tsv.bak-poolid` | 把新行的 `lineage/dupN/dupOf` 改回在册池行口径**之前**的快照 | 同上，重放路径 = `scratch/qoder-1106-fix-poolid-cols.mjs` |
| `qoder-1105-pool-g3.js` | 11-05 那次池装载实测的包副本（3.2 MB） | 它是 `scratch/qoder-1105-g3pool-load.mjs:57` 的**输出**，跑一次就有；表在那脚本旁边（tracked 的 `qoder-1105-pool-g3.tsv`） |
| `qoder-1105-map-*.png`（7 张，约 7.7 MB） | 11-05 地图渲染那几版的截图 | 当时是给你肉眼验收用的；页内自检与判据读数都有文本回执在册（`scratch/qoder-1105-map-*-selftest-*.txt` ‖ `…-d234.txt`），图本身没有判据依赖 |
| `qoder-1106-lineage-g3.before.tsv` | 血统 sidecar 重建（47 → 59 行）**之前**的那一份 | 重建后的 59 行版已进 `47e28ebc` ⇒ **旧那份不在任何提交里**，删了就永久消失，所以只挪不删；重放路径 = `node champion-map/lineage-g3-build.mjs --write=0` 之前先备份 |

**没动**的两件（点名说明，免得下一个人以为漏了）：
- `champion-map/coords.tsv.pre-e600.bak` —— `champion-map/relabel-lineage.mjs:104` 把它当回滚锚，删了会打断那条腿；
- `scratch/duel-behavior.mjs` —— 是别的班正在改的探针（`M` 状态），不属于这次清理。
