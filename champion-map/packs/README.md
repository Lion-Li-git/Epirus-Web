# champion-map/packs

这里只放**被 `bead-extra.tsv` 显式引用、且需要可复算**的少量包（10-24 现数 **10 枚**：4 枚 E1/E2 实验冠军 + 6 枚激光眼链，各 ~110KB）。

- 仓的既定策略是：`docs/artifacts/`（约 4594 个文件 / 227MB）**整体 gitignore**，训练权重是证据、不入库；
  干净克隆能画图（`coords.tsv` / `lineage.tsv` / `index.html` 都在），但**重建整条链需要本机证据库**。
- 这 10 枚是例外，原因是它们是 `bead-extra.tsv → bead-ruler.tsv → eps → rebuild-coords` 这条**新实验管线**的输入；
  把它们入库，保证别人拿到仓库能复算这些点的读数（而不是能重建全图）。
- 加新包前先问：它是**管线输入**吗？不是就留在 `docs/artifacts/`；是的话再入库，并同步 `bead-extra.tsv`。

原件仍在 `docs/artifacts/{e1,e2}-*.bak`（本机、gitignore），删不删都不影响复算。

⚠ 10-24 补一句（千问复核 `8e39c13e` 时量到的）：**入池那一枚会有两份**。`g18-77001` 除了这里的管线件，
`pool-members.tsv` 的 `path` 列还指着 `docs/artifacts/g18-77001.bak`（池装配的既有口径 = 成员一律指
`docs/artifacts/…`，与它同表的另外 29 枚一样），而那枚 `.bak` 因此也得跟着入库，否则干净克隆里 `build-pool-bundle` 造不出池。
⇒ 这不是"策略漂了"，是**两个消费者各有自己的路径口径**：图走 `champion-map/packs/`，池走 `docs/artifacts/`。
要收成一个得先改 `pool-members.tsv` 的路径口径（那会牵动 D234 的"成员必须在册"那条腿），是另一件要裁的事。
