# 重构方案 · champion-map 输入表单一入口（2026-11-11）

> 状态：阶段 1–3 已实施（本地提交 13d47061 / e2361bc3 / 15176e30，未推）。实施偏差：viewer 默认吃 coords-projcols.tsv（页面表），不是 gen3——gen3 缺 xt18/yt18/xt20/yt20；页面入口改为 rebuild-map.mjs。§3.2/§5 中“viewer 默认 gen3”的旧句按此偏差读。阶段 4（目录分层）未做。数据模型 A 已 backfill（2026-11-11 晚）：registry/rulers/batches/readings/features/projections 落盘；add-point 未做。
>
> 触发事件：给 19 个 obs5 新点补短/长过线时，因为 `eps-full.mjs` / `feas.mjs` / `attach-hp.mjs` 硬编码 `coords.tsv`，只能临时把 926 行的 `coords-gen3-1105.tsv` 拷成 `coords.tsv`，跑完再还原。这是“输入表没有单一入口”的直接症状，不是数据问题。

## 1. 现状

### 1.1 两张在册表

| 表 | 行数 | 用途 | 现状 |
|---|---:|---|---|
| `champion-map/coords.tsv` | 825 | 旧 v7/1.8 图主表 | 仍被多个脚本当默认 |
| `champion-map/coords-gen3-1105.tsv` | 926 | 2.0/obs5 图主表（当前页面实际用它） | viewer 需显式 `--fit`，测量/attach 脚本默认不认 |

### 1.2 硬编码点（已核对行号）

- `champion-map/eps-full.mjs:41`：`readFileSync(join(HERE, 'coords.tsv'))`，没有 `--table`。
- `champion-map/feas.mjs:74`：`const ROSTER = arg('table', 'coords.tsv')`，支持 `--table` 但默认旧表。
- `champion-map/attach-hp.mjs:31` 读 `coords.tsv`、`:80` 写 `coords.tsv`，没有目标表参数。
- `champion-map/attach-hlong.mjs:80/:112`：源表 `--table` 必给，但目标仍默认写 `coords.tsv`。
- `champion-map/attach-hshort.mjs:31`：目标 `--table` 默认 `coords.tsv`。
- `champion-map/viewer.mjs:156`：`--fit` 默认 `coords.tsv`；页面实际要 gen3 时必须显式给。

### 1.3 当前修复后的状态

- 19 个新点的短/长测量已完成：`feas-short-obs5-19.tsv` / `feas-long-obs5-19.tsv` 各 19/19；`epsfull-short-obs5-19.tsv` / `epsfull-long-obs5-19.tsv` 各 19/19。
- 19 行已并进 `coords-gen3-1105.tsv`：`okShort/okLong` 空白 0；`coords.tsv` 已还原 825 行。
- 左栏字号自检（用户裁定“奇怪的门禁”）已从 `viewer.mjs` 删除 47 行；页面尚未重烘。
- 上一笔提交 `78f0625f`；当前未提交：`coords-gen3-1105.tsv`、`viewer.mjs`，以及 19 点测量表、6par/86 散件、`scratch` 临时文件。
- `D191` 当前 `unregistered=0`；`training/knobs.mjs --check` 绿。

## 2. 目标与非目标

### 目标

1. **任何脚本都不再假设“默认表就是 coords.tsv”**；输入表必须能显式指定，并在日志里自报“用了哪张、多少行”。
2. **局部测量/局部 attach 不得改写未涉及的行**；缺行保留原值，禁止静默写空。
3. **错误表要 fail-fast**：行数/列名/表身份不符时响亮退出，不静默退回另一张表。
4. 保持现有测量数学、阈值、列名、历史读数不变；只改“表从哪来/往哪写”。

### 非目标

- 不把 `champion-map` 整体搬成 `training/` 那种产品/训练分仓；本目录是研究+可视化，规模不值当。
- 不重写 `eps-full`/`feas`/attach 的测量逻辑、不改阈值、不改 C·R 口径。
- 不删除旧 `coords.tsv`：它仍是 825 行历史对照表，只是不再当默认。

## 3. 设计

### 3.1 单一入口：`champion-map/map-table.mjs`

新增一个小模块，只做四件事：

```js
// 解析 --table= / --coords= / --fit=，返回绝对路径
resolveTable(argv, { defaultTable: 'coords-gen3-1105.tsv', legacy: 'coords.tsv' })

// 读表：统一 CRLF、保留行尾空列（不许 trim 整个文件）
readTable(path) -> { header, rows, ix, path, rowsN }

// 原子写：临时文件 + rename；可选备份
writeTable(path, table, { backup: true })

// 身份/完整性守卫
assertColumns(table, required)
assertFullTable(table, { minRows: 700, allowPartial: false })
tableStamp(table) -> 'coords-gen3-1105.tsv rows=926 sha=...'
```

规则：

- `--table=` 与 `--coords=` 同义；`viewer` 保留 `--fit=` 作为别名。
- 不传时默认 **gen3**；旧表只能显式 `--table=coords.tsv`。
- 路径口径：绝对路径原样；相对路径先按 cwd，再按 `champion-map/` 目录；都不存在则 exit 2，列出试过的路径。
- 每次运行打印一行 `[map-table] <name> rows=<n> sha=<8位>`，让日志可对账。
- 写表前校验表头宽度；任何一行宽度不符 ⇒ exit 2，不写。
- 备份名 `<table>.bak-<tool>-<yyyymmdd-HHMMSS>`，不再覆盖固定 `.bak-cmean-r`。

### 3.2 各脚本的接口

| 脚本 | 输入 | 输出 | 缺省 |
|---|---|---|---|
| `eps-full.mjs` | `--table=` | `--out=` | gen3 |
| `feas.mjs` | `--table=` | `--out=` | gen3 |
| `attach-hp.mjs` | `--from=<读数表>` | `--table=<目标表>` | 目标 gen3；from 必给 |
| `attach-hlong.mjs` | `--from=<长程读数表>` | `--table=<目标表>` | 目标 gen3；from 必给 |
| `attach-hshort.mjs` | 读 `feas-short-*` | `--table=<目标表>` | 目标 gen3 |
| `viewer.mjs` | `--fit=` | `--out=` | gen3 |

兼容：

- 旧命令 `node champion-map/eps-full.mjs` 仍能跑，但改为读 gen3；要旧表必须显式 `--table=coords.tsv`。
- `attach-hlong` 的 `--table` 当前是“源表”，语义易混；迁移后源表统一叫 `--from`，`--table` 只表示目标。旧参数保留一个版本并打印 deprecation，不静默。

### 3.3 局部 attach 的合并语义（关键）

当前 `attach-hp` 对不在源表里的 id 会写空；`attach-hlong` 也会把缺行写成 `-`。这在“19 点局部测量”场景会清掉其余 907 行，必须改：

- 默认 **merge-only**：只更新源表里出现的 id；未出现的行保留原值。
- 要显式清空/全量重建，必须 `--allow-partial` 或 `--full`，并在日志里写明“本次覆盖 N 行、保留 M 行”。
- 覆盖率报数：源表 N 枚、命中 M 枚、保留 K 枚；M=0 时 exit 2。

### 3.4 自检

新增 `champion-map/map-table-selftest.mjs`，用临时 2 行 fixture：

1. 不传 `--table` 时默认 gen3，且不创建/修改 `coords.tsv`；
2. 显式 `--table=coords.tsv` 能读旧表；
3. 不存在的表 exit 2，错误信息包含试过的路径；
4. `attach-hp` 用 1 行局部表更新 2 行目标表：只改命中行，另一行逐字不变；
5. 表头缺列/行宽不符 exit 2，不写文件。

## 4. 实施顺序

### 阶段 0：冻结当前数据

- 先把当前 19 点测量表、`coords-gen3-1105.tsv`、`viewer.mjs` 的改动整理成一个“数据批”提交（或至少 stash 记录）。
- 重烘一次页面，确认删掉字号门后自检为 **98 PASS / 0 FAIL**（若还有别的 FAIL，先记录，不在本重构里混修）。

### 阶段 1：入口模块 + 自检（不改业务）

- 新增 `map-table.mjs`、`map-table-selftest.mjs`。
- 只接 `viewer.mjs` 和 `feas.mjs` 两张表做试点。
- 跑 selftest + 一次 19 点 `feas` 局部跑，确认不碰 `coords.tsv`。

### 阶段 2：迁移测量/attach

- `eps-full.mjs` 去掉 `:41` 的 `coords.tsv` 直读，改 `resolveTable`；
- `attach-hp.mjs` / `attach-hlong.mjs` / `attach-hshort.mjs` 改目标表 + merge-only；
- 所有脚本 usage 头注同步更新，旧参数保留一版 deprecation。

### 阶段 3：页面与文档

- `viewer.mjs` 默认 `--fit=coords-gen3-1105.tsv`；重烘 `champion-map/index.html`。
- 在 `champion-map/README`（或本目录头注）写清“两张表、默认 gen3、旧表显式”的一张表。
- 跑 `node champion-map/map-table-selftest.mjs`、页面四视图自检、`D191`。

### 阶段 4（可选，后续）

- 若脚本继续增多，再把 `champion-map/*.mjs` 中纯流水线的部分移到 `champion-map/pipeline/`；数据表留根目录。**不在本次做**，避免大搬迁掩盖输入层修复。

## 5. 验收

- `node champion-map/map-table-selftest.mjs` 全绿。
- 运行任意测量/attach 脚本，日志都有 `[map-table] ... rows=...`；不再出现“临时 cp coords.tsv”。
- 局部 19 点 attach 后，`coords-gen3-1105.tsv` 其余 907 行逐字不变（用 sha 对账）。
- `viewer.mjs` 不传 `--fit` 时读 gen3；页面自检 98/0；`D191` 0。
- 旧命令 `--table=coords.tsv` 仍可读 825 行旧表。

## 6. 风险与回滚

- **列宽/CRLF**：统一走 `readTable`，禁止各脚本自己 `trim().split`；自检覆盖。
- **默认表切换**：旧命令行为变化；在 usage 和日志里显式打印默认表，发布说明写明。
- **attach 语义变化**：merge-only 是行为变化，必须用 19 点局部跑验证“未命中行不变”。
- **回滚**：一个 commit 只做入口层；出问题 `git revert` 即可，不动数据表。

## 7. 工作量

- 入口模块 + 自检：约 40–60 分钟。
- 六个脚本迁移 + usage：约 40–60 分钟。
- 页面重烘 + 四视图自检 + 提交：约 20–30 分钟。
- 合计 **约 1.5–2 小时**，不含数据重测。

## 8. 需要用户裁的点

1. 默认表是否就定 `coords-gen3-1105.tsv`（旧表只显式）？
2. `attach-*` 的局部表默认 merge-only、要清空必须 `--allow-partial`，是否认可？
3. 是否本次就做，还是先把 19 点数据/页面提交后再做？（建议先提交数据批，再做入口重构，避免把数据 diff 和脚本 diff 混在一起。）

## 9. 实施记录（2026-11-11 晚）

- 阶段 1 已落：champion-map/map-table.mjs（resolveTable/readTable/writeTable/assertColumns/assertFullTable/tableStamp）+
  map-table-selftest.mjs（15/15）；feas.mjs 改走单一入口，缺省 gen3（旧 coords.tsv 显式），每次打印
  [map-table] rows/cols/sha。
- 阶段 3 已落：viewer --fit 默认改 coords-projcols.tsv；rebuild-map.mjs 已从 attach-projcols 改为
  build-view(data) → viewer → shot 98/0（页面吃 data/build/coords-view.tsv）；viewer 在 --projcols=1 且缺
  xt18/yt18/xt20/yt20 时 exit 2，不再静默退回 xt/yt；attach-projcols 改 map-table + 幂等。
- 额外（考卷方向）：attach-exam-stamp.mjs 给 coords 追加 examA/examAL/examBs/examBl/examFix/examC 六列 +
  EXAM-BATCHES.tsv（fixture/champ + run id）；attach-cmean-r.mjs 加夹具守卫。926/926 覆盖，B 夹具唯一 F2，
  旧 obs5 夹具 0 行。详见 docs/research/FINDING-2026-11-11-exam-old-vs-new.md §3.6。
- 阶段 2 已做：eps-full.mjs 改 resolveTable（缺省 gen3）；attach-hp/hlong/hshort 改 resolveTable + merge-only
  （缺源保留原值，--allow-partial 才清）；attach-hp 新增 --target，attach-hlong 源/目标分离 --table 源 / --target 目标；
  rebuild-coords 的两处调用已显式 --target=coords.tsv。
- 阶段 2 验证：三个 attach 的 --check 在 gen3 上通过（hp 794/926、hlong 807/926、hshort 844/926，缺源保留）；temp 表写入 926×142 正常。
- 数据结论：v7 内 A 升、B 降、C=(A+B)/2 抵消；B 下行不是逐行夹具漂移，是固定 F2 夹具的选择偏差。

## 10. 数据模型 A（2026-11-11 晚，已落）

- champion-map/data/：registry 926 / rulers 4 / batches 3 / readings 14,816 / h5-frozen 926 / features 926 / projections 926。
- A/B 读数在长表；C=(A+B)/2 派生；H5 标 frozen、无写入路径。
- backfill 对照：exam-view 926×25 与 coords-gen3 逐值 max_abs_diff=0 / mismatch=0；validate --strict 通过。
- 换尺接口：pipeline/rulers.mjs --set-current=<id>；只改 current 指针 + 追加 readings，projections.tsv 不动；frozen 尺拒绝。
- add-point.mjs 已落：readings/display 喂入 → registry/batch/readings/display（+features/projections）→ build-view →（--bake）rebuild-map → shot；当前不跑测量。
- 完整 coords-view 146 列已由 data + display 编译；rebuild-map 已改吃 data/build/coords-view，页面 98/0（926 行对照 0 mismatch）。
- measure-point.mjs 第一版已落：自动跑 A/B × multi/long 四张 exam4 + ruler-measure，拼 readings/display，再调 add-point；实测 A multi + ruler（rounds=1）22s/枚。
- 未做：feas（okLong/okShort）、proj-tsne 投影、rank/F/ok 展示列自动生成；`--bake` 对新点还没跑通页检；旧脚本退役、阶段 4 目录分层。

