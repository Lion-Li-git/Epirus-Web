# 训练侧旋钮膨胀的普查与短整理（Qoder · 2026-11-10 晚）

用户 22:0x 令：「先做一下短的整理」⇒ 本班只做**短的那批**（一处正确性修 + 三处过期文档 + 一份普查），
台账/命名配方那两件留在下一批（成本与依据都在下面）。代码改动落在 **`feat/obs4`**（今天的训练侧代码只在这条分支上，main 没有 `CARD_ABORT`）。

## 一、先把"膨胀"落成数字（脚本 `scratch/qoder-1110-knob-census.mjs`，回执 `scratch/qoder-1110-knob-census.tsv` 245 行）

读数器**不新写**：直接调仓库自己的 `server/knob-guard.mjs`（`readKeysOf` / `repoKnobUniverse` / `scanKeysFromSource`），
四个入口的 opt 逐条抄自各文件里的 `enforceKnobs` 调用 ⇒ 读集就是那条闸真正认的那一份。

| 量 | 数 | 出处 |
|---|---|---|
| 旋钮全集（`tools/` + `server/`，去注释） | **245** | census stdout |
| 四入口读集 | train-3p **158**（扫 18 文件）‖ train-server **79** ‖ train-best **23** ‖ train-fast **13** | 同上 |
| **只有 1 个入口读得到** | **195 / 245（80%）** | `.tsv` 的 `entries_reading=1` |
| 人工看的那份索引（`SELF_ENV_KEYS`，带逐条注释）登记数 | **118** ⇒ **39 条读了却没登记** | train-3p.mjs:100–189 vs 读集 |
| SEL_*（当选面）族 | **41 键 / 15 根主键**，全默认关 | `.tsv` family 列 |
| 新增速率（只数读取/登记行） | 30 天 **+106** ‖ 7 天 **+36** ‖ 3 天 **+17**（仓龄 9 周） | `git log -p --since=…` |
| 在册的 train-3p 启动器 / 驱动脚本 | **121** 份 | `git grep -l tools/train-3p.mjs` |

**没登记那 39 条里含今天的两根**：`EPIRUS_FIT_CHAMP` / `EPIRUS_COURSE_PACK`，以及 11-09 的 `TRIPLET` ‖ `SIGMA_*` ‖ `IMIT_*` 全族。
⇒ "人读的那张表"与"代码真读的集合"已经分家，这是"找不到该调哪根"的第一因。

## 二、四处过期（本班已改）

1. `tools/exam-4n.mjs:16` 用法行只写 `--expool=v1|v2`，而 `EXAM_POOL_VERSIONS`（server/opp-pool.mjs:160）早就认 v3 ⇒ 补 v3 + 写清 **`--expool=v3` 与 `--plan=v3` 是两件事**（只换池不换抽席规则 ⇒ 拿到的不是那张分层卷）。
2. 读数行原来只印 `pool=<ver>#<sha8> K=` ⇒ **同池不同桌形 / 带不带冠军席，戳逐字相同**（v3 分层卷与 v2 老规则同池）。本班把 `plan=` 与 `champ=` 一起印上 ⇒ 判"是不是同一把尺"要看三枚。
3. `docs/POOL-CONTRACT.md:248` 的 `--expool=v1|v2` 同步；`:281` 附近补一条 **v3 是诊断卷不是主尺**，数字按 DS 原件核过（`scratch/ds-1109/exam-v3-final.md:7-13`：G5J 0.500→0.388 ‖ G5C 0.460→0.351 ‖ 极差 0.139→0.034；`v3-validation.md:9-12`：Spearman(·,B) 0.077→0.232 ‖ Spearman(·,3P 打 Q-s47) −0.177→−0.186）。
4. **文档写的开关名工具不认**（同一族的第二种形状）：`tools/exam-4n.mjs:16` 原文写 `[--onlyN=2,3,5,8]`，而名单（:43）是全小写、解析（:40）**把原名存进 `FLAG`** ⇒ 照文档敲就 `exit 64`。
   本班把用法改成 `--onlyn` 并写明"只认小写"；**没动解析器**（要两处一起改 ⇒ 属下一批，且它要自己的验牙）。
   这条在本班实测撞出来：跑冒烟时按文档敲 `--onlyN=2` 被拒。
5. **新查出来的一类（比过期更基础）**：`scratch/` 底下有 **4 份整棵 `tools/` 的旧副本且在册** —— `gen1-tree`(208) ‖ `hc3`(225) ‖ `preDispatch`(210) ‖ `mutgrid`(3) = **646 个跟踪文件**。
   后果：任何"这根旋钮谁在读"的 grep 都会先命中旧副本 —— 本班那步临时 `git grep -l` 就被骗过一次（第一份文件全是 `scratch/gen1-tree/…`，
   看着像"只有副本在读"，实际现役 `tools/promote-champion.mjs:375` 就在读 `EPIRUS_NO_DEFQ`）。
   普查本身没中招：`repoKnobUniverse` 只扫仓库根的 `tools/` + `server/`，不碰 `scratch/`；中招的是那步临时 grep。
   ⇒ 本班没动它们（删/搬是不可逆面，等裁），但**规则要立**：取证快照不许带同名工具树。

## 三、本班真正修的那个不是"难用"，是"会算错"：`WIN` 接线从"手写名单例外"改成"2.0 臂一律接"

**病**（`tools/train-3p.mjs:809` 那段 11-02 在册原文已经写过一次）：量具沙箱 `WIN`（`tools/behavior-profile.mjs:61` 导出）默认是 **v7 世界**；
2.0 臂里谁调 `fieldProfile` / `aggressionProfile` / `cardUsageProfile` / `measureDefenseQuality`，谁就在拿"v7 前向代 2.0 权重"读数，**且不崩不报错**。
11-02 的修法是"哪几根旗标用到它就在 :815 的 OR 名单里加一根" —— 于是**名单会过期**。本班查到两处已经过期：

- `EPIRUS_CARD_ABORT`（**今天 20:09** 加的，`train-3p.mjs:2486` 调 `cardUsageProfile(WIN, …)`）——不在名单里，而它一咬就是 **exit 13、产物不落盘**；
- `SEL_KEEP` / `SEL_LAND` / `BREADTH_FLOOR` / `EFFSKILL_MIN` 那一段（`:2891` → `:2980` 调 `fieldProfile(…)`，它内部用的就是 `WIN`）——也不在名单里。

**改**：条件去掉 ⇒ 2.0 分支里一律 `installArch2(WIN, cfg)` + `verifyArch2Wired` 自证，接不上就 `exit 7`；横幅里那份名单降级成"只点名、不决定接线"。
代价 = 开局多打一局 `games:1`；不消费 `WIN` 的臂行为逐字不变（没人读 ⇒ 装了也没人用）。

**对照（同 seed=12345 · 同 obs5 spec · 只开 `CARD_ABORT`、六根 SEL 全关 · 1 代 2 局 种群 2 · 回执 `scratch/qoder-1110-win-before.txt` / `-after.txt`）**：

| | 改前（`HEAD` 副本） | 改后（工作树） |
|---|---|---|
| `量具同代已接线` 横幅 | **没有这一行 ⇒ `WIN` 没接** | 有：面=`obs5` ‖ paramCount=12393 ‖ forwardCands 自证通过 |
| `[cardAbort] gen 0 topCards` | **12** | **11** |

⇒ 两件事同时成立：**旧代码在这条路上确实拿的是没接线的尺**（横幅缺席），**而换接线会改这个数**（12 vs 11）。
⚠ 这是一对样本（n=1 pair，公随机数同 seed），只许写"方向"，不许写"效应大小"；`CARD_MIN=30 / CARD_ABORT=999` 是刻意让它们不可能触发杀臂。

## 四、留在下一批（都不短，且需要点头）

- **A 台账 + 一条门腿**（真正治"找不到"）：从代码生成 `docs/KNOBS.tsv`（名·族·缺省·一句话·状态 live/诊断/化石·哪个入口读·在哪份配方里），118 条现成注释可机械搬；
  配**一条**断言：读集里每根键必须在台账里有非空说明 + 合法状态 ⇒ "加了旋钮没人知道"从此当场红（判结构不判词，与 D218 同形）。估 1~2 小时。
- **B 自述 + 命名配方**：`train-3p --knobs` 按族打印缺省与"本入口读不到"的那一片；`EPIRUS_RECIPE=STR-B` 取代 121 份手抄 env。
  现证：STR-B 手抄块（`scratch/night-adapt2/msbatch2.mjs:36-49`）**不含**今天新加的 `CARD_ABORT`，`FIT_CHAMP_EVERY` 代码缺省 4 而驱动传 1（:49），
  横幅 :3630 印的是 `env||'4'` 而不是引擎回读值 ⇒ 与 §E821"下达后必须读回"那条纪律不一致。估 1 小时。
- **D 化石处置**：`measureFromLedger()` 空壳（`msbatch2.mjs:102`）‖ 646 个旧工具树副本 ‖ `WIDTH_W`（08:34 判"单靠它不够"但仍是档位键）——**只出清单，删要逐条点**。

## 五、门（定向，不是整轮）

`scratch/qoder-1110-gate-{probe,meta,ship}.txt` = **串行重跑**的最终三份（本仓规矩：共享树不许 `--auto`，会把别班的活儿算进改动面）。
第一遍是**三组并发**，其回执已改名 `*.interleaved.txt` 留证 ⇒ 那三份读数不可用，原因见下面第二段。
**冒烟臂必须把 `EPIRUS_T3P_OUT` 与 `EPIRUS_BAND_DIR` 两个都钉到 scratch**（这条是下面 D191 那次的根因，写在这里免得下一班再撞）。

**第一次 `--group=meta` 15/16 红、`--group=ship` 51/52 红，两条红的是同一根：D191，而且红得对——红的是我自己的残渣**：
对照冒烟那两臂（`EPIRUS_ARM=QWIN1110BEF/AFT`）把 band 快照写进了 `docs/artifacts/QWIN1110{BEF,AFT}-band{1,2}.bak`，
两臂 `bestFit` 逐字同 ⇒ 同权重 ⇒ D191 归成 2 组**未登记重复**。移进 `scratch/qoder-1110-win-smoke-residue/` 后 `--only="D191 "` 复跑 1/1 ✔（改前复现红 ‖ 改后新绿 ‖ 没放宽名单）。
**第二次踩的是我自己发的并发**：以为第一遍的 `--group=probe` 已经死了（回执停在 44 字节、`tasklist` 报无 node），就另起一串重跑 ⇒ 实际旧实例还在跑，
于是**同一台机器上起了两份 `np/probe`，而且两遍 stdout 重定向进同一个文件**（回执里出现 5 行 `▶ 起跑` ⇒ 交错，读数不可用）。
处置：停新链 → 按 PID 收掉 TaskStop 没杀的孤儿 `node.exe`（31600）→ 三份交错回执改名 `*.interleaved.txt` 留证 → **真正串行**重跑（`-gate-{probe,meta,ship}.txt`）。
⚑ 复述在册那条（`tool-background-and-win32-process-gotchas`）：**回执停在半行 + 进程计数为 0 都不等于"那个实例死了"**，判断前要 `tasklist /FO CSV` 逐 PID 看，别按文件猜。

**根因那句补完（属于上面 D191 那一段）**：只钉 `T3P_OUT` 会让 band 快照继续落进 `kept/` 扫描面 —— 在册的 `tools/gates/probe-instruments.mjs:710` 那腿就是两个都钉的（`EPIRUS_BAND_DIR: d` + `EPIRUS_T3P_OUT: join(d,…)`），照它抄即可。

