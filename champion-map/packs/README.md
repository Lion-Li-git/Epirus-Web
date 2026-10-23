# champion-map/packs

这里只放**被 `bead-extra.tsv` 显式引用、且需要可复算**的少量包（当前 4 枚 E1/E2 实验冠军，各 ~110KB）。

- 仓的既定策略是：`docs/artifacts/`（约 4594 个文件 / 227MB）**整体 gitignore**，训练权重是证据、不入库；
  干净克隆能画图（`coords.tsv` / `lineage.tsv` / `index.html` 都在），但**重建整条链需要本机证据库**。
- 这 4 枚是例外，原因是它们是 `bead-extra.tsv → bead-ruler.tsv → eps → rebuild-coords` 这条**新实验管线**的输入；
  把它们入库，保证别人拿到仓库能复算这 4 个点的读数（而不是能重建全图）。
- 加新包前先问：它是**管线输入**吗？不是就留在 `docs/artifacts/`；是的话再入库，并同步 `bead-extra.tsv`。

原件仍在 `docs/artifacts/{e1,e2}-*.bak`（本机、gitignore），删不删都不影响复算。
