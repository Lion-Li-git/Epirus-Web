# HANDOFF 11-06 晨 · Qoder —— ZCode 夜班批次的三件修复 + 两条新红等裁

**范围**：11-06 早班把「GLM/ZCode 夜班 + 晨班那一大批未提交工作」里我点过名的三件事修掉，然后整批提交推送。
不重做它的任何测量，只补它欠的口。账在 `RESULTS-2026-11-06-night-zcode.md` / `HANDOFF-2026-11-06-night-to-morning-zcode.md`（ZCode 自己写的），本件只写"我改了什么、证据在哪、还剩什么"。

**机器口径**：本机单线程串跑（一次只起一个 Chrome / 一个贵测量）；所有门禁引用一律按工具原话标"定向、不是整轮"。

---

## 一、地图池环 10/20 → 20/20

**症状**（页内自检两条红）：`池层：真源表每一枚都在图上且带档` 点名 10 枚
（DSTR4-s13 · EFFG-s5 · EFFG-s7 · GD3ALL-POPP-s41 · GD3ALL-PUSHON-s13 · D-b-hpseed-s13 · DDEF-s13 · DSTR-s13 · LE-s13 · GD3ALL-G5-s13），
`池层：环数 == 表行数` 读 环 10 ‖ 表 20。

**根因不是别名**：探针 `scratch/qoder-1106-pool-map-probe.mjs`（回执 `scratch/qoder-1106-pool-map-probe.txt`）按**名字**和**权重哈希**两把都对过 ⇒ 这 10 枚根本不在图上（不在 `coords-gen3-1105.tsv` 870 行里）。
所以唯一诚实的做法是"补节点"，不是"给别名表加一行让它们假装在"。

**做法（全链可复算）**：
1. `champion-map/pool-only-1106.tsv`（10 行 id→`docs/artifacts/2p0-pool/<id>.bak`，路径取自池真源）。
2. 120 局那把行为尺量 10 枚：
   `node champion-map/ruler-measure.mjs --set=champ --extra=champion-map/pool-only-1106.tsv --ids=<10 枚> --exam=120 --out=../scratch/night6/ruler-pool-only-1106.tsv`
   ⇒ 10 行 12 维读数。⚠ 第一次跑成了 `--set=layer`（会去量整个层级面板），中途杀掉、残表删掉，所以文件名带 `-only-`。
   途中撞了 `ruler-measure.mjs --out=` 把绝对路径无条件拼到 `HERE` 的老坑（本仓第四次同族），已按 `pool-sync`/`seat-rule` 同一口径修掉。
3. `scratch/qoder-1106-attach-pool10.mjs`（回执 `scratch/qoder-1106-attach-pool10.txt`）把 10 行补进
   `coords-gen3-1105.tsv`（870→880）与 `coords-view-20.tsv`（39→49）：12 维/S/H 来自 ruler，`Hp/De` 来自 `epsfull-r64-multi-1106.tsv`，
   `Hlong/Hplong/Flong` 来自 `epsfull-r64-long-1106.tsv`，`path` 来自池真源，`ver=2.0`，`F` 与 `rank` 按本视重重算。旧表备份 `*.bak-pool10`。
4. 重投影 + 重挂列 + 重烘 + 自检：`proj-tsne`（主图 N=880 选 t-SNE，kNN@10=0.464 ‖ 2.0 视图 N=49 选 MDS，kNN@9=0.488）
   ‖ `attach-projcols.mjs`（行 880 · 18 命中 831 · 20 命中 49 · 列 52→56）
   ‖ `node champion-map/viewer.mjs $(cat champion-map/bake-flags.txt) --out=index.html` ‖ `pool-sync.mjs --check=1` = 「池真源 20 ‖ 图里标了池的 20 ⇒ 新增 0 ‖ 换带 0」。

**我自己引入的一格坑（已修，记下来免得下一班再踩）**：补行时我从子集表抄了 `lineage="续训现役"` + `dupN=1` + `dupOf=<自己>`，
而主表里在册的那 10 枚池行这三列**全空** ⇒ 新行在主表里冒充了"上过线的续训现役"。代价是两格读数被我的数据顶高：
`冠军序列：抽不到上线时刻` 21→31 枚、`谱系图：有位置` 864/870→864/880。
修法两半：① `scratch/qoder-1106-fix-poolid-cols.mjs` 把这三列清空成在册口径（备份 `*.bak-poolid`）；
② 身份交给真源——`node champion-map/lineage-g3-build.mjs` 重建 sidecar（47→59 行：10 枚池成员从各自包内 META 拿到 ts/父/哈希/家族 + 2 个合成 `wid:` 占位父），
⇒ 未上槽回到 21，有位置 864→**874**/880，这 10 枚从此有父边可画。

**链路口径核对**：`scratch/night6-join-coords.mjs` 现在也吃这份 ruler 表，且**缺文件就 exit 2**
（原先 `existsSync` 兜底 = 那 10 枚静默不进表 ⇒ 谁重跑整条合流链，池环当场回红）。
对过合流器输出（`scratch/qoder-1106-joincheck-all.tsv`，880 行 / 2.0=49）：在我补的 10 行上，
`id/H/S/Geff/Hp/De/ver/examG/path/lineage/dupN/dupOf` 与 12 维**逐列一致**；只有 `seed/F/rwDmg/Hlong/Hplong/Flong` 合流器不产出——那几列归下游 attach 步骤，不是我另起了一份真源。

## 二、D234⑥b 的 rand 公平份额锚（11-06 晨 · 定向 1/1 绿）

夹具从 `L5-1200-s13` 换成 `D1200-s13`（都在册、都是池成员）。理由是实测不是措辞：
同条件（`--batches=2 --games=20 --modes=multi`）旧夹具随机席 20% > 参照 10% ⇒ 锚因夹具过弱而**假红**；新夹具随机席 12.5% < 参照 27.5%。
另把 `electBad` 那行写死的 L5 路径改成读同一个 `POOL_FIXTURE`（两个口径各指一颗包 = 下一班必踩）。

牙口按 R4 第③步反向验过：把 `POOL_FIXTURE` 改回 `L5-1200-s13`（改完先自证文件里真读到新值）⇒ D234 当场红在
`⑥b 主体席尺（rand 公平份额锚）必须跑成（实测 exit=8）`（原件 `scratch/qoder-1106-d234-mutant-L5.txt`）；
还原后再跑 = 1/1 绿（`scratch/qoder-1106-d234-regreen.txt`，还原前后逐字节相同才敢说还原成功）。
夹具换法的**结构**方案（锚改"受测包 vs 池均值"相对量）仍是 DECISIONS D-12 待裁，我今天只做了校准。

## 三、2~8 人显示串 ‖ D16 指纹重记（定向 1/1 绿）

改文案：`js/core/rules.js` 三个 MODES 显示名 `(3-5人)/(4血·2-5人)/(5血·2-5人)` → `(2-8人)` 系 ‖ `docs/RULES-2P.md` ‖ `docs/RULES-NP.md` ‖ `js/ui/ui.js` 注释 ‖ `js/ui/rules-panel.js`「2~8 人对战」。
指纹 `a96fffd8 → 83c11b82`，按 v1.5.166 先例走"不动权重只重记"：
- 结构性证据：`grep` 实证引擎五件套（rules/resolve/state/play/policy）**没有任何一处读 `MODES[*].name`**（只读 hp/skills/drainHpMax/suddenDeath/maxRounds，这些一字未动；`eval-5p` 只把 name 印在回执行）。
- 经验性证据：3P 体检全过、考卷 1st = **55.9%（40 局）与在册 `examScoreAtBuild:0.559` 逐字同**；且写完的 bundle 去掉 META 行与 HEAD **逐字节相同**（108555 字节，`scratch/qoder-1106-promote-3p.txt`）。
- 2P：`tools/promote-champion2p.mjs` 重记（20 基准 × 40 局平均 98.37%，最差 82.5%，"权重逐字节未变"回执在 `scratch/qoder-1106-promote-2p.txt`）。
- ⚠ 这里**没有**跑整轮。引用请照工具原话说"定向 D16 1/1"。

## 四、页内自检现在 94 PASS / 5 FAIL —— 其中两条是新的，等裁

三红在册未动（`批次过滤：冠军永远保留` ‖ `冠军序列：21 枚未上槽` ‖ `谱系图：旧包没有 lineage 行也要真被画出来`）；
今天把 ZCode 那两条池环红消掉了，但**把 10 枚变成真图上的点**又换来两条新红。两条都不是"图坏了"，是判据的主语/分母没跟着池规模换代：

1. **`标签：默认视图里被别人的名字压住的点` 172 枚 vs 线 138**。
   线 = `110/718 的密度 × 当前 880 枚 + 3`，即按**点数**标定。A/B 实证（`scratch/qoder-1106-label-ab.txt`，把 10 枚新池名在一份页面副本里摘掉再跑同一套自检）：
   摘掉 ⇒ **131**（线内）；装回去 ⇒ **172**。也就是每条常驻池名平均压住 4.1 枚点，与存量那 29 条（131/29≈4.5）同级——
   **涨的是常驻名单的条数（29→39），不是密度**。而"常驻名单必须全员上名"是硬腿（它 PASS）。
   两条腿现在互相要账：要么这条线改按"常驻名单条数"标定，要么产品侧减量（池名只在放大后显示 / 池名缩写）。**都要动判据，所以停手等人裁。**
2. **`空地上的单根线必须看得见` 采样点 10 个 < 下限 12**（内容其实过了：中位墨 76 ≥ 线 30）。
   10 枚进 sidecar ⇒ 多出一批父边 ⇒ "所在格子只压着 ≤8 条线"的采样点从 ≥12 掉到 10。
   这条红说的是"样本量不够、量具够不到"，不是"单根线看不见"——按 R8 它应当走**第三态 SKIP（点名理由）**或把探针档位改成随边数自适应，两种都算改判据。

## 五、这批**没**做的事

- 没跑整轮门禁，没跑 `battle-test`；D16/D234 都是 `--only=` 定向。
- 没动 `docs/RULES-*` 以外的产品语义，没动 `js/core/resolve.js`（D-13 那条逐枚符咒浪费率仍捆在下一次指纹换代）。
- 没替池行的 `seed` 列补齐（ZCode 那 10 枚空、我今天这 10 枚按包名后缀填了 ⇒ 「按 seed 上色」那一档里存量 10 枚落 `?`）；要统一得在合流器里加一行派生，别只手改表。
- 五枚新臂 / CR4 / 课程席 / MIX8 / flat-vs-seg 那几条训练侧待裁（DECISIONS D-11、D-14~D-17）一律没碰。

## 六、收班定向读数（照工具原话引用，都不是整轮）

| 跑法 | 读数 |
| --- | --- |
| `node tools/np-test.mjs --group=ui`（累计 ui+ship+meta 59 条） | **58 / 59**（原件 `scratch/qoder-1106-postfix-ui-group.txt`） |
| `node tools/np-test.mjs '--only=D234 '` | **1 / 1**（重烘+重记后复跑；`scratch/qoder-1106-d234-final.txt` ‖ 还原夹具后再跑 `…-regreen.txt`） |
| `node tools/np-test.mjs '--only=D16 '` | **1 / 1**（`a96fffd8 → 83c11b82` 重记之后） |
| `node tools/spec-run.mjs` | **60 / 60** |
| `node champion-map/pool-sync.mjs --check=1` | 池真源 20 ‖ 图里标了池的 20 ⇒ 新增 0 ‖ 换带 0 |
| `node champion-map/shot.mjs '--hash=mode=map&check=1'` | **94 PASS / 5 FAIL**（`scratch/qoder-1106-postfix-map-selftest2.txt`） |

**唯一一条门红 = D191④「未登记的重复 2 枚」**，与今天三件修复无关，是 ZCode 07:56 那批 band-save 落出来的：
`docs/artifacts/MUTFLAT-s15-band5.bak` 与 `band6.bak` 的 wid 与 `band1.bak` **逐位相同**（`206a93fabfa23653`）。
按 `champion-map/pack-guard.mjs:123` 原文——"臂产物算不算设计如此的复制（走 declareCopy），那是裁定面，不是夜里单方面动共享守卫"——
我既没删别人的产物，也没擅自往在册别名表里登记 ⇒ 挂 **DECISIONS D-20**。
⚠ 另一层：`docs/artifacts/` 是 gitignore 的 ⇒ 干净克隆里这两个文件根本不存在，这条在 CI 上必然绿，本机红的是我这台的盘（gate-audit R2 那个形状）。

**两条新红等裁**（§四）：DECISIONS **D-18**（标签压点 172 vs 线 138，A/B 实证摘掉新 10 条池名 ⇒ 131；复算器 `scratch/qoder-1106-label-ab-build.mjs`）
‖ **D-19**（单根线采样点 10 < 下限 12，内容 76 ≥ 30 其实过了）。

---

## 七、11-06 午追记（用户令"修一下" ‖ 看图点名两件事）——三条等裁落地 + 6 枚补长程 + 文案改口径

**CI 先报一句**：`47e28ebc` 那条 run（`gh run 42161342219`）**整轮绿**，含"并集守卫（全部部分的并集必须 = 整轮）"那条腿 ⇒
本机那 5 条页内红与 D191④ 在干净克隆里都不成立（与 §六 的 R2 判断一致）。原件 `scratch/qoder-1106-ci-47e28ebc.txt`。

### 7.1 三条等裁按用户口径落地（判据的**对象与地板都没动**，动的是定标主语与量具密度）

| 条 | 做法 | 读数 |
| --- | --- | --- |
| D-18 标签线 | `COVL = 4.52 枚/条 × LB.n + 5`（= 131/29 那次 A/B 实测）‖ 前两版分别钉绝对枚数 110 与按点数定标 `110/718 × N` | 172 vs 线 **181** ⇒ 绿 |
| D-19 单根线 | 加密**取样**：探针上限 24 → 单一常数 `PROBE_MAX = 48`（步长与上限同源） | d≤8 采样点 **63** ‖ 中位墨 68 ≥ 30 ⇒ 绿 |
| D-20 D191④ | 走在册 `declareCopy` 补两行带理由的别名账（文件字节一字未动、**没删别人产物**） | `--only=D191 ` **1/1** |

⚑ **D-19 第一版改错了**：只把步长 `nEd/24` 改成 `nEd/48`、上限还钉 24 ⇒ 抽中的那 24 条整体挪到前半段，稀疏格采样点从 10 掉到 **4**（读数更差）。
真正的限流器是 `EDGR.probe.length < 24` 那道上限——"我以为我在加密量具，其实我在换抽样范围"。判据地板 12 自始至终没动。

⚑ **D-20 的根因没修**：`pack-guard.mjs:110` 那段写明 `widIndex` 每进程只扫一遍 ⇒ `train-3p` 收尾写 band 夹具时看不见本进程先落的另外几枚 ⇒
每跑完一批臂都会留下一批"未登记的重复"。补账只能救今天。要动的是训练侧收尾那一支（declareCopy 还是干脆不写第二份），**等点名再动**。

### 7.2 6 枚没有长程成绩的点（用户看图点名）

缺的是 `V7C-s13 ‖ V7M-s13 ‖ V7C-s41 ‖ V7M-s41 ‖ V7L-s13 ‖ V7L-s41`（全 v7 面臂）。
成因不是漏测而是**换代时跳过**：ZCode 晨班按用户补令"R64 只动空放天火 ⇒ v7 不用跑"跳过了 v7 面，于是这 6 枚连基线长程读数都不存在。
补测：`node champion-map/eps-full.mjs --only=../scratch/qoder-1106-v7long-only.txt --extra=../scratch/qoder-1106-v7long-extra.tsv --games=120 --mode=long --jobs=6 --epsTier=lv:regular --out=epsfull-v7long-1106.tsv`
⇒ 6/6 成、**1.5 分钟**（原件 `scratch/qoder-1106-epsfull-v7long.txt`）。
挂列：`scratch/qoder-1106-attach-v7long.mjs` 写主表 `Hlong/Hplong/Flong`（`Flong = Hplong/100 + 0.10·S`，先在 874 枚在册行上验过这公式**无一枚不符**才敢沿用），
并把这三列从主表**同步**进 `coords-view-18`（6 行）与 `coords-view-20`（39 行——那批 r64 只挂过主表，子集表留着旧空列 = 下一个人烘子集页时又缺一遍）。
⇒ 三张表长程读数 **880/880 ‖ 831/831 ‖ 49/49**，页眉印「F = 长程桌（有读数 880/880 ‖ 全图同一把长程卷）」。

### 7.3 产品侧文案口径（用户重申的规矩，已进长期记忆）

删掉页眉那句「（旧行为是静默退回默认桌 = 混两把尺，v1.8.27 已废）」整句 ‖「RNG seed（旧口径）」→「RNG seed（包名后缀）」×3 处 ‖
「这一档画的是**绝对值**，不再对某一枚包取差」→「…（不对某一枚包取差）」。**页内自检的断言名不动**：那是审计者读的句子，改名会牵动钉文本的门。
自查方法（可复跑）：只扫引号里的内容、跳过注释行，搜 `已废|旧行为|旧口径|原先|以前|不再|历史|v1\.[0-9]+\.[0-9]+`。

### 7.4 顺手抓到的一格（D-22）

`#ftab=long` 深链只改 `st.ftab`、不同步控件 ⇒ 用链接打开的人看到「桌形 = 默认（3血短程）」而画的是长程桌。
同一支 hash 解析里 T / labels / color 三支都同步了控件，唯独漏了这支。已补同步，自证：
`node tools/page-chrome.mjs --url=…#ftab=long` 读到 `["long","长程（5血）","F = 长程桌**（有读数 880/880 …"]`。
**要不要给"深链后控件必须与 st 一致"立一条页内判据**——那是新对象，按纪律该配自己的门而不是塞进「工具栏接线」那条，等裁。

### 7.5 复验（照工具原话，都不是整轮）

map 页内自检 **96 PASS / 3 FAIL**（只剩在册那 3 条）‖ `--only=D234 ` 1/1 ‖ `--only=D191 ` 1/1 ‖ `spec-run` 60/60 ‖ `lint-viewer` ✅。
⚑ 本轮又差点撞本仓第五次同族坑：新写的注释里放了 ``scratch/…txt`` 反引号 ⇒ `lint-viewer` 1 秒拦在烘焙前（烘焙那次确实 SyntaxError 了，被 `exit=` 抓到）。
