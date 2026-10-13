# 2026-10-13 夜班（Qoder）· champion-map 表合并 + rel 档删除 + holo→proto 训练臂

分支 `qoder/night-1013-tables-proto-qoder`（从 `3c7ada4` = main 起）‖ 做到 10-14 09:00 ‖ 时刻一律从 `git log` 抄。

## 她这一班的四条指令（原话要点，别转义）

1. 「尽量把**所有表**都合并，有些表有人读的话你可以设计一个**统一的接口**引用数据而不是留着一堆表」
2. 「研究为什么训练出来的冠军宁愿用全息屏障也不用原型制御……据此你可以进行一些训练。训练出来有代表性的东西**不管水平高低都可以进演化图**（但不要一股脑全进，挑一些代表，**一晚上不要进超过 30 个**）」
3. 「你先看一下目前还有什么遗留的问题可以放在今晚工作里面」
4. 「现在冠军谱系图里还有一个红绿板块……这个红绿板块实际上变得**只有红了，没有任何意义。整个删掉吧**」
5. 另：CI「gate 绿了 browser 红了」，报错是 `smoke.mjs` 的 `CDP endpoint not reachable: http://127.0.0.1:9337/json/version`；tag 加不加无所谓；GitHubDirect 那个连接器有 Actions 能力，可以试着用。

## DONE

· `261b8f6`（10-14 00:48）**v1.7.4**：三件半事一起落。
  - **S1 表合并**：83 张入库表 → `champion-map/point-data.tsv`（逐行原文容器）+ 接口 `champion-map/point-data.mjs`。
    弃用 EAV 长表的理由是现测的：2.03MB → 3.69MB（1.8×，比全部入库表加起来还大）。
    自检 A（逐字节，迁移前 83/83 全等）‖ B（结构，行宽集合 == 入库时记下的）两模式，各带合成正对照且都验过会响。
    我自己四个错全部记进 CHANGELOG：`batches()` 当 `families()` 用 / batch 去扩展名撞键（4 组同名不同扩展）/ "谁在读"没去注释（本工具注释里的例子把 `beh-e583.tsv` 判成有读者，可并集 78→76）/ `@widths` TSV 两格 TXT 三格。
    加了"新容器比现有少一半就拒绝写盘"的护栏（迁移后容器是唯一副本）。
  - **S4 rel 档整档删除**：现测 iv=0.7296、绿侧 45/986 = **4.6%**、两侧 p90 距 0.035 ‖ 0.325（9.3×）、库内中位 0.593 ⇒ 分界落在约第 95 百分位。
    不换锚（那是她 10-12 的裁定），删档 + 一条负向腿；变异验过（把 option 注回产物 ⇒ 84 PASS / 1 FAIL）。
    两处真伤被机器拦下：`}` 后块注释含 `45/986` ⇒ JS 当正则起始（`node --check` 抓）；摘三元条件留悬空 `? (` ⇒ 构建器"内联脚本再解析一遍"抓。
    重建后数据行 794→794、唯一 id 集合相同 ⇒ 没有降级烘焙产物。
  - **S2a 旋钮接线**：`EPIRUS_HOLO2PROTO` 进 `tools/train-3p.mjs`（三条纪律照 `EPIRUS_TRAIN_MODE`，登记进 `SELF_ENV_KEYS`，没动 D229⑧ 的四个出厂入口）。
    生效自证：同 seed 两档产物 sha1 `6ae45950160e` ≠ `9e5074e8055a`；两颗牙：非法值被 policy 响亮拒绝、没接线的 `train-fast` 报黑键 `exit 6`。
  - **S2b/c 18 臂 + 读数**（{off,proto,drop}×6，400 代从零 3 人局，每臂 104~120s，评估统一在 off 档）：
    | 档 | 出手/局 | holo | proto | shift | guard | reflect | 防御类 | 局长 |
    |---|---|---|---|---|---|---|---|---|
    | off | 71.2 | 0.95 | **0.18** | 0.19 | 2.09 | 1.98 | 7.96 | 21.5 |
    | proto | 99.4 | 0.43 | **0.22** | 0.20 | 14.36 | 14.45 | 46.41 | 25.4 |
    | drop | 100.5 | 3.58 | **1.65** | 1.55 | 7.33 | 7.58 | 33.82 | 26.5 |
    三条结论：① **映射档不可能教会策略选 proto**（该动作从未被策略自己选中 ⇒ 无梯度），读数与之一致 ⇒ 以后别拿它当"教会了"的证据；
    ② `drop` 抬起的是**整个自盾族**（proto+shift+guard+reflect 一起涨），不是"专门学会 proto"；
    ③ `proto-chance` 分开机会与选择：同格选取率 off≈0.9% → drop 三臂 2.7~6.8%，但 drop-1 只有 0.6% ⇒ **方向性成立、效应不稳定**。
    ⚠ 库里那 243 枚的 proto 列是**空的（未测）**，不许当"量出来是 0"的对照。
  - **顺手修一条我上一轮留下的洞**：`usage-probe` 只在文件不存在时写表头 ⇒ 加 `proto`/`shift` 两列后 `usage.tsv` 是 19 列表头配 21 列新行 ⇒ 从第 9 列起按表头读全部串位。现在每次跑都校验并只允许"加了新列"这一种迁移（旧行新列**留空**不补 0），其它形状 `exit 9`。迁完 262 行全部 21 列。
  - **D191 红过一次，红的是我造的产物**：18 臂的 band 与最终产物 = 21 组未登记重复权重 ⇒ `np/meta 15/16`。
    走仓库自己的流程 `--plan`（先算出 0 个被下游引用）→ `--write-manifest`（56 行）→ `--quarantine`（只移不删，移到 `D:/code/Epirus-Web-artifacts-quarantine/`，`--restore` 可原样搬回）→ `--check`（断链 0）⇒ D191 1/1、meta 16/16。
· **v1.7.5**（10-14 01:5x）：仪器收成一份 + 5 枚代表量完 + 卡点取证（内容见 CHANGELOG 那条与下面「卡点」节）。
  **上面那两条 D191 的记账要补一句**：我随后把 21 枚**搬回了原位**（臂产物是下游尺表要读的文件，`--extra` 当时报"拉进 0 枚 ‖ 盘上查无 5"就是被搬走害的），
  所以"D191 绿"现在的支撑是账本而不是"文件已经不在盘上"—— 这一条的可被自我填充记在待裁 **#21**，不是我已经解决的事。
· **S1 那把"谁在读"的尺判错了一类，02:0x 抓到并改掉**（是我上一笔 `261b8f6` 自己引入的回归，不是既有的）：
  判据当时是"**注释里提到文件名不算读**"（那条规矩本是为了防我自己的注释把 `beh-e583.tsv` 判成有读者），
  但 `champion-map/attach-hp.mjs:34` 写的是 `--table=` 要吃 `epsfull-tier-2026-10-12.tsv` —— **那是说明书不是 `readFileSync`**，
  去注释之后看不见 ⇒ §E597 那两张全库 tier 重测表被当"无人认领"并进了容器，于是"照着说明敲"当场 ENOENT。
  而它正是现面板头号尺 `Hp` 的来源层（「卡点」④ 里 149/149 逐字相同那一层）。
  复算与处置：`git diff --diff-filter=D 3c7ada4..HEAD` 点名两张 ⇒ `reconstruct()` 与 `git show 3c7ada4:` **逐字符相同**（56,914 ‖ 7,160 字符）
  ⇒ `git checkout 3c7ada4 --` 放回盘上，并写进 `NEVER_MERGE`（判据修正也写在码里：**凡"文件名被源码点名"的表一律留盘，注释也算**）。
  顺带把同一把新尺对整个容器过了一遍：还有 4 张也是"注释里被点名"（`_e318-all15` ‖ `_e328-descendants` ‖ `cont1200-2026-10-10` ‖ `opphuman-arms`），
  逐条看过那 7 处命中**没有一处是运行时默认参数**（`evaln-noise.mjs:141`、`selkeys.mjs:5/144`、`chain-scan.mjs:31` 的 `--emit=` 例子、`seatroster.mjs:12`、`opphuman-arms.mjs:27`、`train-3p.mjs:636`、`np-test.mjs:6219`）
  ⇒ 它们不会 ENOENT，但既然新判据说"留盘"，就一起放回（`--self-test` 的模式 A 逐字节确认 6 张全部与容器等值）。
  ⚠ 这类"注释里的指针没人管"是 **D230 只盯 `.md`** 的边界（它管活引用面的 markdown，不管 `.mjs` 注释）⇒ 记进待裁 **#17**。
· **还有一个连带抓到的洞（同一次改动里改掉）**：`selfTest()` 原来是 **A 或 B 二选一**（`if (!onDisk.length)` 才跑 B）
  ⇒ 我把 6 张放回盘上之后，B 那条**整批都不跑了**，77 张没有源文件的 batch 一个结构检查都没有，而输出只说"模式 A"、看不出少了一半。
  现在永远跑 B、盘上有源文件的再跑 A，两条合成正对照也各跑各的：实测 `模式 B 结构 全 83 张 ‖ A 逐字节 6 张 ‖ 比对 89 次 ‖ B 探针响=true ‖ A 探针响=true`。
  ⚠ 副作用要说在前面：新判据下去跑 `--report` 会印 **可并 0**（盘上剩下的入库表**全部**被按文件名点名，实测分成两类各 **63 + 5** 张：
  63 张是 `readFileSync`/路径字符串里真出现的"代码读者"，5 张是**只在注释/说明书里点名**的（`_e318-all15` ‖ `_e328-descendants` ‖ `cont1200-2026-10-10` ‖ `opphuman-arms` ‖ `seat-cands-2026-10-09`）——
  两把尺各有理由，后一类正是上一笔漏掉的那一类），，
  而 `--build` 会撞上那道"少一半就拒绝写盘"的护栏（`exit 8`）—— 这不是坏，是**它本来就该拒绝**：83 张的源文件已被 `git rm`，容器是唯一副本。
  ⇒ `--build` 只在**迁移之前**有意义；迁移之后要改口径请先 `git checkout` 取回源表，别指望它原地重算。
· 分支已推 origin（CI 在这棵树上跑不带分组的整轮）。

## DOING（现在手上这一步）

· **S2d 进图**：正序是 `champion-map/rebuild-coords.mjs` 那五步（`ruler-figs → attach-kin → attach-hp → attach-path → attach-dup`，新点靠 `--extra=<尺表>` 喂）。
  前置测量：`champion-map/ruler-measure.mjs`（`--exam/--self/--seat/--probe`，可 `--ids=` 只量选出的代表，`--out=` 落尺表）‖ `champion-map/feas.mjs --ids=` 补过线判定。
  **进哪几枚（≤30 的约束下我按行为挑代表，不按分数）**：`drop-3`（proto 5.20 最高）‖ `drop-5`（1.87，同格 2.7%）‖ `drop-1`（0.18，同格 0.6% = 反向对照）‖ `off-1`（对照里 proto 最高 0.60）‖ `proto-3`（guard/reflect 50/局 = 映射档的极端形状）= **5 枚**。
  顺手已修：`ruler-measure.mjs` 的用法行原来写的是本机副本 `docs/artifacts/e287-out/e287-measure.mjs`（gitignore ⇒ 干净克隆里照着跑必扑空），改成仓内路径。

## 卡点（10-14 01:4x 判完：**进图今晚不跑**，五条都不是我这批带进来的）

先说结论：5 枚代表的**数已经量完并且对上了图上的档**，但 `rebuild-coords.mjs` 这条链**今天对着现役面板跑不完**，
而把它跑通的每一手都要动共享工具或动全图 986 枚的读数 —— 那是裁定面，不是凌晨一点半我一个人按下去的面板。
`coords.tsv` 现在与 HEAD 逐字符相同（`git diff --quiet HEAD -- champion-map/coords.tsv` rc=0 ‖ 换行归一后 `===` true ‖ 987 行）。

· **① 已量的数**（`champion-map/h2p-ruler.tsv` ‖ `h2p-epsfull.tsv` ‖ `h2p-extra.tsv`，都落在 champion-map/ 而非 gitignore 的产物目录）：
  考卷 120 局/组合（seed 77000 ‖ 35 组合 = 4200 局/枚）‖ 页面臂 `tier:lv:regular`。
  `h2p-drop-5` H=46.9 Hp=46.7 ‖ `h2p-drop-3` 35.7/37.4 ‖ `h2p-drop-1` 35.4/36.1 ‖ `h2p-proto-3` 35.0/34.5 ‖ `h2p-off-1` 27.3/28.7。
  两台仪器互验：`ruler-measure` 的 H 与 `eps-full` 自己那列 `exam` 在这 5 枚上**逐字相同**（同 seed 同组合 ⇒ 本该相同，不同就是接线错）。
  ⚠ 第一遍我按缺省 `--exam=30` 量的（`h2p-ruler.EXAM30-do-not-feed.tsv` 留在产物目录，名字里写明不许喂）：
  30 档与 120 档在这 5 枚上差到 **2.2pt**（`drop-1` 32.8 → 35.4）—— 而 `METHODOLOGY.md` 第 120 条"进图必须单档"量的就是这个台阶，
  图上现有 986 行 `examG` 全是 120 ⇒ 30 档的点进去就是把两把尺画进同一张图。**改档重测花 83 秒，比事后解释一条台阶便宜得多**（那条规矩的原文）。

· **② 链子第②步的红是既有的，不是我加的**。对照组（不带今晚 5 枚）：
  `node champion-map/rebuild-coords.mjs --extra=champion-map/ruler120-2026-10-10-all.tsv` ⇒ `⛔ 冠军枚数 30 ≠ 旧表真冠军 35（差值 -5）`。
  根因：§E600-A 之后 `lineage` 不再全部有 ruler 表出处 —— `node champion-map/relabel-lineage.mjs --check` 对 HEAD 的 coords 报 `✔ 已一致`，
  即现面板**就是 relabel 之后的状态**，而那 5 格身份（`当前线上`→`历代上槽` 1 枚 ‖ 名册按解析补 1 枚 `T8-s114` ‖ 用户裁定补 3 枚 `eco-34-v7`/`v7f-35`/`v7n1-31`）
  在任何一张 ruler 表里都查不到，`attach-kin` 那条结构式对账却假设"冠军身份能从表里重算出来"。
  我打过一手补丁（把上一版认定的身份随点带过来，条件含"没有 kin ⇒ §E488 验的 183 枚假冠军仍照旧清掉"），**又撤了**（`git checkout -- champion-map/attach-kin.mjs`）：
  撤的理由比留的理由硬 —— 下面③④⑤三条一条没解决时，这一手只会把**现在唯一在响的警铃**关掉，让一次静默换档过去。

· **③ 档**：`rebuild-coords.mjs` 把 `champion-map/ruler-all.tsv` 写死在几何输入**第一个**，而 `ruler-figs.mjs:43` 是 `seen.has(o.id) ⇒ continue`（**先读的先赢**）
  ⇒ 链子产出的 `H` 是 **30 档**（实测 `eco-34-v7` 在 `ruler-all.tsv` = 51.3，在 `ruler120-2026-10-10-all.tsv` = 50.5 = coords 那一格）。
  面板 986 行里有 69 行（`SOUP-*` ‖ `snipe*` 等）**只有 `ruler120-…-all.tsv` 覆盖**，其余 917 行 `ruler-all` + `e370` 能覆盖 ⇒ 想单档就必须让 120 那张排在前面。

· **④ `examG` 没有产出者**：链子六步（ruler-figs / attach-kin / attach-hp / attach-path / attach-dup / proj-tsne）里**没有任何一步写 `examG`**
  （`grep -n examG champion-map/*.mjs` 只有 eps-full / eps2seed / switch-gear / k8measure / ruler-measure 命中），
  而页内有一条"每一行都必须带考卷档且全图只能一个档"（`viewer.mjs:3642`，§E569）⇒ 跑完必红，除非再补一次 `switch-gear.mjs`。

· **⑤ 头号尺会被整批换档（这条最硬）**：第③步 `attach-hp` 的 `--table` 缺省是 `epsfull.tsv`，今晚逐张比对盘上带 `page` 列的表与 `coords.Hp`：
  `epsfull.tsv` **16/718** 相同 ‖ `epsfull120-2026-10-10.tsv` **22/986** ‖ `champion-map/epsagg.tsv` 4/121 ‖ `docs/artifacts/e597-out/pool-hp2.tsv` **149/149 全同**。
  ⇒ 现面板的 `Hp` 是"**120 那批打底 + §E597 的 149 枚 tier 覆盖**"两层叠出来的，而链子按缺参会把 **986 行 Hp 全改成最旧那一批**（还顺手把 §E597 那条裁定冲掉）。
  要救就得把 `pool-hp2.tsv` 从 gitignore 的产物目录搬进仓、并把第③步的 `--table` 改成 120 那张 —— 都是共享工具的改法，等裁。

· **⑥ 配对命名**（小但会绊人）：`--extra=<X>` 派生"必须有 `<X 去掉 -ruler.tsv>-epsfull.tsv`"，而 `ruler120-2026-10-10-all.tsv` 不以 `-ruler.tsv` 结尾
  ⇒ 要的文件名是 `ruler120-2026-10-10-all.tsv-epsfull.tsv`。按 `METHODOLOGY.md` 120.4「先并成一张再喂」的正解是并一张 991 行的 `<批>-ruler.tsv` + 配一张 `<批>-epsfull.tsv`，
  但那等于把 986 行的面板**再抄一份进仓库**（今晚刚因为 D191 在算"重复了几份"）。

· 顺手立一条给裁的账：今晚这三张表（`h2p-ruler/epsfull/extra`）**入库**，而它们里面写的 `path` 指进 gitignore 的 `docs/artifacts/h2p-e593-out/*.js`
  —— 正是 `METHODOLOGY.md` §120.3 那条硬约束（"`coords.tsv` 的 `path` 列引用的每个文件都必须在盘上"）在**干净克隆**里的形状：本机在、仓里没有。
  与待裁 **#19** 同一类（那 7 条是门体写死的，这批是新表写死的），要并案就一起并。

· **要裁的就一句**：这张图到底允不允许"整批重算几何 + 换 Hp 来源"的重建（991 枚的 x/y/投影全动 ⇒ §E376 标签拥挤度、家族序、kNN 召回那些按现布局定的判据都会换主语）；
  还是只允许**增量登记**（现布局不动、新点按同一把尺落进去）。今晚这 5 枚的数已经备好在 `champion-map/h2p-*.tsv`，两条路任选一条都能当天进图。

## NEXT（按价值排，不做也交得掉）

1. ~~把上面 5 枚量完 + 进图 + 重建页面 + 页内自检 + `meta` 复跑，单独一笔提交（v1.7.5）~~ —— **量完做了，进图停在"卡点"那节等裁**（01:4x）。
   数与表都在仓里（`champion-map/h2p-ruler.tsv` ‖ `h2p-epsfull.tsv` ‖ `h2p-extra.tsv`），裁定一落就能接着跑。
2. **S0 CI browser 红**：仪器面已做完（`tools/cdp-boot.mjs` 一份实现 ‖ smoke/battle 迁过去 ‖ 本机 `SMOKE OK`/`BATTLE OK` 各复跑两遍，改完死导入又跑了一遍）。
   **但"分支推送让 CI 自证"这句是我写错的**（本班 NEXT 原来的第 2 条）：`.github/workflows/gates.yml:35-38` 的触发器是
   `on: push: branches: [main] ‖ pull_request ‖ workflow_dispatch` ⇒ **推分支根本不触发**。
   实测（02:0x）：`GET /repos/.../actions/runs?per_page=6` 最新一条是 run **173 = 3c7ada4（v1.7.3）success**，
   本班推上去的 `261b8f6`/`6bef0e9` **没有对应 run**（`status=in_progress` 查也是空）⇒ 不是"红"，是**压根没跑**。
   剩下两条路都要她点头，我先不动：① 开 PR（会让 CI 在 PR 上跑一遍，但那是公开可见的动作）；② `workflow_dispatch` 手工点一次分支上的 run
   —— 本班这个会话里连的 `github` MCP（45 条）**没有 actions 面**（`mcp_list keyword=workflow` 返回 0 条），
   她提的那个带 Action 能力的 `@GitHubDirect` 在这个会话里没接上，所以连"试着用这个调用"这一手也落不了地。
   **判"该不该红"仍然悬着**：现在能说的是——红的那一条以后一定会自己说清是哪一种（没装 Chrome / 起了但死了 / 绑端口慢过预算），因为报错已经分岔了。
3. 待裁本班新增 **三条**（#19 门体写死的产物路径有 7 条 untracked ‖ #20 `pack-guard` 的 stale `widIndex` ⇒ 每次训练必留未登记重复 ‖ #21 D191 那条腿可被账本自我填充，且 `--quarantine` 把下游要读的臂产物判成"零引用"），见下面「待裁新增」。
   另有「卡点」节最后那一句等裁：**整批重算 vs 增量登记** —— 这一条不裁，今晚这 5 枚（以及以后任何一枚）都进不了图。
   两条路任选一条都能让 CI 在这棵树上跑（本机推分支不触发，见上面第 2 条）：
   ① **手工点一次**：Actions → workflow「**gates**」（`name: gates`）→ Run workflow → 分支选 `qoder/night-1013-tables-proto-qoder`
      （CLI 同效：`gh workflow run gates.yml --ref qoder/night-1013-tables-proto-qoder`，本机没装 `gh` ⇒ 要在有 token 的机器上）。
      跑出来的 smoke 那一行会**第一次**告诉我们是哪一种红（没装 Chrome / 起了但死了 / 绑端口慢过预算），因为报错已经分岔。
   ② 开 PR（`pull_request` 触发）—— 公开可见，等她点头才动；**本班没有开 PR、没有推 main、没有打 tag**。
4. 有余力：#16（2P 桌缺"按档位装配"的尺 —— `tier-census` 是 5 席循环）‖ #14（`kill-instinct` 判据收紧到"扣掉被挡的那部分"）。

## 收工认证那遍（10-14 02:30 本机时刻 ‖ 树 = `231c733`）

`node tools/gate-all.mjs --np`（五道同一棵树，跑之前工作树 `git status --short` 为空）：

```
门禁：np 278/278（680.6s） · spec 52/52（0.2s） · smoke OK（10.1s） · battle OK（37.0s） · map OK（3.2s）
（同一棵树 2026-10-14 02:30 本机时刻）
✔ 结论：**5 道全绿**      退出码 0
```

· 这一遍是**冻结树之后**跑的：01:57 那第一遍（`np 278/278 ‖ 962.5s ‖ 02:14`）跑的过程中我还在改 `point-data.mjs`/三处版本号/`docs/README`
  ⇒ 它按"同一棵树"那句话读不得（np 里每条门各自读文件，有的看见改前有的看见改后），所以**不作认证引用**，只留在这里说明为什么两遍秒数差 282 秒
  —— 第一遍我还同时在跑 `--self-test`/`--report`/`node tools/cdp-boot.mjs --self-test` 这些进程在抢核；第二遍什么都没有并发（`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` 跑前跑后各查过一次，只剩 Adobe 那个）。
· 认证**不含** v1.7.4（`261b8f6`）那一笔的整轮——那是本班更早的、只跑到 `--group=meta` 的部分；从这一遍起，五道全绿的口径属于 `231c733` 这棵树。
· 这一遍之后我又只改过**这一个文件**（加本节点），改完复跑 `--group=meta` ⇒ 见下一条的实际输出。
· 02:35 的复跑原文：`N人测试：通过 16 / 16` ‖ 同一次输出带着那句固定警告
  「`--group=meta`：只跑了 16 / 278 条（跳过 262 条）⇒ 这不是全量门禁，不许当整轮全绿引用」——
  所以这一条**只**说明"改了日志文本之后仓库纪律那一组没退"，全绿的口径仍然只属于上面那遍五道。

## 待裁新增

· **#19 门体写死的产物路径有 7 条是 untracked**（干净克隆里那些腿会红或静默 SKIP），其中 3 条**本机也不在盘上**：
  `docs/artifacts/.training-in-3p.js` ‖ `e129-out/matrix.js` ‖ `human-behavior.js`（另 4 条本机在、仓里没有）。
  这是 `dedupe-artifacts --check` 的 CI 等价档自己报出来的，**不是我引入的**，我也没动它 —— 要么把这些产物入库（`tools/keep-artifact.mjs` 那条路），要么让那几条腿在缺输入时**响亮 SKIP**。

· **#20 `pack-guard` 的 `widIndex` 每进程只扫一遍 ⇒ 一次 `train-3p` 跑完必留未登记重复**。
  现象（可复算）：今晚 `docs/artifacts/h2p-e593-out/` 有 18 枚臂产物 + 108 枚 band 夹具，而 `grep -c h2p champion-map/pack-aliases.tsv` = **0** ——
  审计注释写明"band 夹具这类设计如此的复制会经 `pack-guard` 登记进别名表 ⇒ 不算未登记"，实际一条都没进去：同进程内先写 band1、再写与它同权重的 band2 时，
  索引还是进程开跑时扫盘的那份，看不见刚写的 band1 ⇒ 走"新权重 ⇒ 写盘"分支 ⇒ 不登记。D191 那条腿因此每次训练后都红。
  **我一度打了一行补丁**（写完把 wid 塞进本进程索引），**已撤回**（`champion-map/pack-guard.mjs:103-109` 留了原因）：
  塞上之后下面那条非 `force` 分支就真命中 ⇒ 收尾那次写返回 `wrote:false`、只登记别名不写第二份 ⇒ **臂产物文件根本不存在**，
  而 `train-3p` 的注释写明"最后一份不重复落盘"是**设计如此**（还留着 `--force-copy` 出口）。所以该裁的是"臂产物算不算设计如此的复制"，不是夜里单方面动共享守卫。

· **#21 D191 的"未登记重复 = 0"可以被账本自己填绿，而 `--quarantine` 会把下游要读的东西判成"零引用"**（今晚我自己踩实）。
  取证顺序：D191 红（21 枚）→ 我跑 `--quarantine` → 绿 → 我把那 21 枚**搬回原位** → 还是绿。
  为什么搬回还绿：`--quarantine` 落账在先（`writeManifest()` 在动文件之前），审计的"已登记"集直接收整张账本的 `path` 列 ⇒ 自动生成的账本把自己列出的副本全算成已登记。
  三条实测：① 基线 `--audit` = `{"groups":27,"files":56,"unregistered":0,"trackedRedundant":8}`；
  ② 牙是真的 —— 临时多放一份同权重副本后 `unregistered` 变 **1** 并点名 `docs/artifacts/d191-teeth/clone.js`（测完已删，重跑回到 0）；
  ③ 账本语义自洽 —— 现在重跑 `--write-manifest` 与仓里那份**逐字节相同** ⇒ `quarantineTo` 那列是"**要搬去**的默认去处"，不是"当前所在"，
  所以那 21 行 `role=move` 并没有说谎（我先前把它当位置读，是我读错，不是账本坏）。
  真正咬到我的是另一条：`--check` 明说"本次要移 21 个，其中 **0 个正被下游表/门引用**"，可我把臂产物搬走之后，
  `ruler-measure.mjs --extra=…/reps.tsv` 立刻报"拉进 0 枚（名单里已有 0 ‖ 盘上查无 5）"—— 断链检查引用的来源只有包体里的 `EPIRUS_SEEDPACK` 与 `"sources":[…]` 两个元数据键，
  **只出现在命令行里的路径（`--extra=`、`--out=`）它天生看不见** ⇒ "移走不会断链"这句话的适用范围比读起来窄。
  可裁的两种方向（都不该由我在夜里定）：账本行只在"文件确实不在原位"或"别名表里带 `why`"时才算已登记；或给 `--quarantine` 加一条"untracked 产物默认不动，要动点名"。

## 不动的手（这一班）

`js/core/**` ‖ 两张 RULES 文档 ‖ 两个内置包 ‖ 两个池 bundle 一字未改；规则指纹 `b98985bf` 未变；
**没有新增门、没有删门、没有改判据**（页内自检那条是既有自检块里的腿）；未 promote、未碰线上槽；DS 的提交不代推（main 上现在也没有待推的 DS 提交）。

v1.7.5 那一笔再加几条（都是本班动过又**收回去**的手，写清楚免得下次以为它们还在）：
· `champion-map/coords.tsv` 与 HEAD 逐字符相同（`git diff --quiet HEAD -- champion-map/coords.tsv` rc=0 ‖ 换行归一后 `===` true ‖ 987 行）——链子第①步确实覆盖过一次，事后按 git 复原（动手前它是干净的）。
· `champion-map/attach-kin.mjs` 的身份 carry-forward 补丁**已撤回**（`git checkout --`，工作树与 HEAD 相同）；理由写在「卡点」节那条 bullet 里：**它会在②③④未解时关掉唯一在响的警铃**。
· `champion-map/pack-guard.mjs` 只留了一段注释（说明 stale `widIndex` 与"为什么不在这儿修"），**没有改行为**。
· 没有开 PR、没有推 main、没有打 tag（她说 tag 无所谓 ⇒ 就不加）、没有点 `workflow_dispatch`（那要她的会话外权限，也不该我替她点）。
· `dedupe-artifacts --restore` **没用**：隔离目录里躺着 293 份**别人那一班**的文件（`e234-out/K2.js` 那种被 63 枚候选引用的），整目录搬回会把它们倒进仓库 ⇒ 只按名单搬回我自己那 21 枚。
