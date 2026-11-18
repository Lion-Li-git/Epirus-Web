# MAP-PIPELINE · 演化图管线现状与重构计划

> 2026-11-18 夜。用户原话："上次我明明说要重构清楚，结果全是毛病"。本文按**现状（as-built）**写，不写理想图；最后给分阶段重构计划。
> 只读体检工具：`node tools/map-audit.mjs`（结构错误红、数据缺口黄）。

## 1. 这套管线在做什么

演化图（`champion-map/index.html`）把 999 枚冠军包放在 A/B/C 三条读数轴上，算主尺 `F = X̄₄(C·R) + T·S`，并保留训练方法/谱系/池/技能等侧栏。页面是**单文件自包含**（2.4MB 内联 DATA + viewer 代码），数据来自 `champion-map/data/`。

## 2. 数据层：谁是真源，谁是从属

| 文件 | 角色 | 写入者 |
|---|---|---|
| `data/registry.tsv` | 包名册（id/path/status/fam…） | 人工 + 训练流程 |
| `data/rulers.tsv` | 尺注册表（axis/status/label/unit/fixture/batch） | 换尺时人工 + attach 脚本 |
| `data/batches.tsv` | 批次表（batch_id/ruler/夹具/run/source/rows） | attach 脚本 |
| `data/readings/current.tsv` | **读数长表**（pack,ruler,cell,horizon,value,n,batch） | 各测量/attach 脚本；**无 dose 维度** |
| `data/display.tsv` | 页面宽表（175 列）：**既是模板又是数据** | build-view 读作模板；attach 脚本改值 |
| `data/build/exam-view.tsv` | build-view 的 41 列中间视图 | build-view |
| `data/build/coords-view.tsv` | 页面 DATA 的 175 列最终视图 | build-view |
| `data/page/coords.tsv` | 面板/普查用的 999 行宽表 | `sync-page-coords` 只补行，值靠旧批 |
| `champion-map/archive/*` | 换尺对照锚（gen3/gen6/gen7/gen8） | 换尺时拷 coords-view |

**真源只有 registry + rulers + readings + display 的展示列**；exam-view/coords-view/index.html 全是派生物。

## 3. 构建链（`champion-map/rebuild-map.mjs`）

1. ① 历史戳检查：`attach-exam-stamp --check`（**只对 F2/F5 旧图有意义**；2026-11-18 起 B=Arena，已改成自动跳过并打印原因）
2. ② `build-view`：readings + current A/B(+X) → `exam-view.tsv` + `coords-view.tsv`；与 gen8 对照锚逐值比对（mismatch=0 才过）
3. ③ `lineage.mjs`：写 `data/page/lineage.tsv`
4. ④ `build-trends.mjs`：写 `trends.html`
5. ④ `viewer.mjs --fit=coords-view`：烘 `index.html`（内联自检 6388 行 JS）
6. ④ `shot.mjs --hash=mode=tree&check=1`：页内 100 条断言（0 FAIL 才收工）

换尺流程（手工，易错）：`build-view --compare=<不存在>` 跳守卫 → 拷成新 gen 锚 → 改 `rebuild-map` 的 `--compare` 行 → 再跑。

## 4. 尺的模型（现在的真相）

- **A**：脚本桌，page 剂量（`a-v2coop-page-1114`）
- **B**：冠军桌，page 剂量（`b-arena-page-1118`，Arena 24 锚 PL）
- **C**：派生 `(A+B)/2`（`c-cr`，不存 readings）
- **参考尺**：`b-arena-pl-1118`（ε=0 贪心，B reference）、`b-f5-page-1114` / `b-f5-eps0-1114`（F5，reference）。
- **X 轴已退役**（2026-11-18 用户令）：原来它是 ε=0 半边，因为 readings 没有 dose 维度；退役后 ε=0 留作 B reference，页面只显示 page。
- Δε 的正确定义应是 `C_page − C_greedy`；现在页面已移除 Δε（缺 A_greedy；A 轴全量贪心重测在跑）。

## 5. 已知毛病（今天实测/核对到的）

1. **readings 没有 dose 维度**：同一张尺不能同时存 page/exam 两批，才会出现 X 轴这种补丁；换剂量就要新尺。
2. **display.tsv 身兼模板与数据**：build-view 读它当模板，attach 脚本又直接改它；一旦模板列变了，历史值可能被静默带进新视图（X 列退役时就是靠手工清空 16 列）。
3. **三张宽表互相漂移**：display / page/coords / coords-view 各 999 行，列族不同；`sync-page-coords` 只补行不补值 ⇒ 5 个新包的 `MxC/MxCL` 为空（map-audit 黄条）。
4. **历史戳层未清**：`attach-exam-stamp` 还在扫 2026-11-11 的 F2 表，并在每次 rebuild 打印 "B 夹具 = F5"；与当前 B=Arena 无关。今天已改成非 F2/F5 时跳过。
5. **死代码/死逻辑**：build-view 的 `B_SHORT`（F5 短程兜底）、measure-point 的 `bShortRow/F2_SHORT`、viewer 的 `DE4/X4P` 与 16 个空 X 列、多份 `currentRuler` 实现。今天删了 build-view/measure-point 的 F5 变量；`DE4/X4P` 与 display 的空 X 列还在（下一步清）。
6. **attach 脚本全是孤本**：`attach-arena` / `attach-bp-1118` / `attach-exam4n-mixed` / `attach-exam-stamp` 各写各的 TSV 拼装，没有共用 schema。
7. **换尺靠手工**：对照锚要手动拷、rebuild-map 里改路径；漏改就 31339 项 mismatch（今天真撞过）。
8. **viewer.mjs 6400+ 行**：数据派生、颜色、交互、深链、自检全在一个文件；`rebuild-map` 的自检只能证明页面能跑，证不了数据语义。
9. **数据量**：readings 65k 行、display 175 列、coords-view 1.26MB、index 2.4MB；每次 rebuild 都重写大文件，diff 噪声大。

## 6. 今天已经修掉的

- 换尺：B 从 ε=0 改 page（v2.1.4），X 轴退役（v2.1.5）；build-view/measure-point 容忍无 X。
- `rebuild-map` ①：非 F2/F5 夹具时跳过历史戳，并打印原因（不再出现误导性的 "B 夹具 = F5"）。
- build-view / measure-point 的 F5 短程兜底与孤儿变量删除。
- 新增 `tools/map-audit.mjs`：尺唯一性、表头一致、readings 无重复键、四表 id 集合一致、B 读数与 P?R 对账、C=(A+B)/2 对账；黄条列出 page/coords 的 C̄ 缺口。

## 7. 重构计划（按代价/收益排）

**P0 · 一次 schema 迁移（半天）**
- `readings` 加 `dose` 列（`page|exam`），`batches` 同步；同一条尺可挂两批。
- `build-view` 用 `dose` 选列，不再需要 X 轴；`display` 的 X 列彻底删除。
- 迁移脚本一次性把现有 readings 标 dose（历史无标记的按 batch 名推断 page/exam）。

**P1 · 单一写入器 + 审计进门（1 天）**
- 一个 `tools/attach.mjs --ruler=<id> --tsv=<file> --dose=` 取代所有孤本 attach 脚本；attach 只写 readings + batches，不直接改 display。
- `display` 退化为纯模板（只有展示列），宽表数据由 `build-view` 一次生成。
- `map-audit` 接进 `np-test` 一条门（结构红；数据缺口黄）。

**P2 · 构建入口收口（1 天）**
- `rebuild-map` 自动切 gen 锚：`--compare=auto` 时先烤、比对失败就写到 `archive/<date>-<ruler>/` 并打印新锚，不再手工拷。
- `viewer` 拆成 `data-derive.mjs`（纯函数，可单测）+ `viewer-page.mjs`（渲染/交互）；页面自检保留。

**P3 · 数据瘦身（按需）**
- coords-view 的 175 列里只有一半被页面读；按 viewer 的字段清单裁剪，index 可降 30–40%。

## 8. 换尺操作（当前版本，手工）

1. 新尺读数落 `readings/current.tsv` + `batis`（`attach-arena` 现在能写 page/exam 两套）。
2. `rulers.tsv` 新尺设 `current`，旧尺转 `reference`；`batches.tsv` 补行。
3. `build-view --compare=<不存在>` 烤新视图 → 拷到 `archive/<gen>/coords-<gen>.tsv`。
4. `rebuild-map` 的 `--compare` 指向新锚 → 跑全链（100 PASS）。
5. `node tools/map-audit.mjs` 必过（黄条可接受，红条不许）。
## 9. 2026-11-18 夜补记（A 贪心 / Delta epsilon / 9 枚缺档）

- **A 轴贪心全量**：999 包 × multi/long × 100 回合、seed=77000、coop=v3，**40.7 分钟**；990 枚成功。9 枚失败全是 status=archived 且 registry 的 path 为空（D1-77000 / C2-77000 / N2-77000 / Q4-77000 / U2-77001 / RC1-77001 / V9-77001 / RW2-77001 / MSB12-seqboom-R1S1308870894），盘上没有 .bak。
- **新参考尺**：a-v2coop-exam-1118（A，reference）；tools/attach-a-greedy.mjs 接入。exam-4n-full 现在遇缺文件跳过（打印 缺文件），不再算失败、不再 abort 整批。
- **Delta epsilon 恢复为 C_page − C_greedy**：display 新增 De/DeL 两列（161 列）；build-view 用 A 贪心 a-v2coop-exam-1118 + B 贪心 b-arena-pl-1118 现算（weights 0.15/0.25/0.45/0.15），viewer 卡片重新显示 Delta epsilon（短/长）。9 枚无 A_greedy 的包显示未测，是诚实缺测。
- **守卫缺口（新发现）**：rebuild-map 的 --compare 只对 exam-view（A/B/C 格）逐值；display 独有列（De/DeL、arR、page 列）不进对照锚，改这些列不会让守卫红。今天的 gen10 就是先烤了空 De 列、补值后 compare 仍报 0。修法列入 P1：对照锚改比 coords-view 的共有数值列。
