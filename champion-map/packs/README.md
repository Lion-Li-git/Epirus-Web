# champion-map/packs

这里只放**被 `bead-extra.tsv` 显式引用、且需要可复算**的少量包（10-24 现数 **10 枚**：4 枚 E1/E2 实验冠军 + 6 枚激光眼链，各 ~110KB）。

- 仓的既定策略是：`docs/artifacts/`（约 4594 个文件 / 227MB）**整体 gitignore**，训练权重是证据、不入库；
  干净克隆能画图（`coords.tsv` / `lineage.tsv` / `index.html` 都在），但**重建整条链需要本机证据库**。
- 这 10 枚是例外，原因是它们是 `bead-extra.tsv → bead-ruler.tsv → eps → rebuild-coords` 这条**新实验管线**的输入；
  把它们入库，保证别人拿到仓库能复算这些点的读数（而不是能重建全图）。
- 加新包前先问：它是**管线输入**吗？不是就留在 `docs/artifacts/`；是的话再入库，并同步 `bead-extra.tsv`。

原件仍在 `docs/artifacts/{e1,e2}-*.bak`（本机、gitignore），删不删都不影响复算。

⚠ 10-24 补一条口径（千问，随 `g18-77001` 出池写）：**一枚包可以同时在两个消费者名下，但两份路径各有规矩**——
图走 `champion-map/packs/<id>.js`（管线输入，本目录），池走 `pool-members.tsv` 的 `path` 列（既有口径 = 成员一律指
`docs/artifacts/…`，与表里其余成员一样）。**一枚只在图上的包不该在 `docs/artifacts/` 里再存一份入库拷贝**：
那份拷贝当初只是为了让干净克隆能造池 bundle（`build-pool-bundle` 按 `path` 读盘），出池之后它就没有消费者了 ⇒ 已 `git rm --cached`。
反过来，若哪天要把它再放回池，得同时把 `.bak` 重新点名入库，否则 CI 与干净克隆里池会少一枚而退出码仍是 0（§E591 那族病）。
