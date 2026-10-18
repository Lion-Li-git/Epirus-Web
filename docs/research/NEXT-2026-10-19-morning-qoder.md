# 明早交班（10-19 晨 · 千问）—— 分支 `qoder-1018-night2` 的 DONE / DOING / NEXT

> 时刻只从 `date` 与产物 mtime 取；状态类数字（HEAD、批进度）**写查法不写值**（写了就会被自己下一笔提交过期掉）。
> 主工作树今晚停在分支上（用户裁：晚班无并发）⇒ 合并前，这棵工作树里量到的行为读数都属这条分支，不许与 `main` 的在册读数并排引用。

## 一、DONE（都在这条分支上，未 push——推送每次都要当次授权）

查法：`git log --oneline origin/main..HEAD`

1. **复核 DS 今晚 11 笔**（v1.7.102→112）并落成 §E648 一节：三条实测根据 + 两条正向新机理（先验自我强化）。
2. **A 段（口径可复现）**：`SUPPORT_PRIOR` 的 knobs 接出来（新增 `pick: 'weighted'|'max'`，默认不动 ⇒ shipped 行为逐字不变，已对拍）‖
   setter 的非法值/打错的键从静默吞改成抛 ‖ `eval-5p` 加 `--supportpick/--supportskip/--supportminep` 且 banner 印**引擎回读**的三值 ‖
   `ui.js` 那句 `catch(e){void e;}` 换成"回读 + 响亮警告"，并在真页面里取证（引擎档 = 2 ‖ knobs = weighted/0.6/3）。
3. **自证 6 腿 → 9 腿**（`exit=0`）：⑥ 换成按 `skipP` 判概率的三条牙 ‖ ⑦ knobs 的牙 ‖ ⑧ `weighted` 不是装饰 ‖ ⑨ 复刻 hash 先与引擎对拍再量 `salt=2` 兑现率（61.3% ‖ 声明 60%）。
4. **Hp/Hplong 重跑的仪器与筛子**：`eps-full.mjs` 加 `--support=`（只加页面臂，`exam`/`d` 从裸包表搬 ⇒ `d` 语义不脏）与 `--only=`；
   控制组 12 枚先跑，**测出两件事**：仪器没漂（`--support=0` 逐字复现 10-12 表 12/12）＋ `holo.tsv` **不能当筛子**（ε=0 口径的列，页面剂量下 6/12 仍变）。
5. **C1 的尺**：`ab-pool-batch.sh` + `analyze-ab-pool.mjs`（池桌 29 枚 × 两模式 × 两档，批内 SE 与枚间分布两层分开）。
6. **E 段勘察**：`DESIGN-2026-10-19-train-side-gift-qoder.md` —— 结构结论（**这游戏没有队友** ⇒ "学会辅助"无定义，可解的是"少刷"）＋ veto 标定 ＋ 16 枚现役成员没有裸包送盾登记的缺口。
7. **登记**：`LIVE-LINES` 加了分支行、Hp 进行中的接法、`SUPPORT_PRIOR` 无门覆盖的待裁、`bandFor` 回落待裁；route-B 文档顶部标了"本文的形状是严档"。
8. **E 段真的做了（§E650，01:27:01→01:52:16）**：`EPIRUS_SEL_GIFT_VETO` 默认关接进当选面 + 纯函数 `rejectGiftSpamWinners` + 合成表自证 `tools/probe-gift-veto.mjs`（5 腿，做过变异测试）；
   六臂跑完并按预注册逐条判 ⇒ **闸咬得动（@100 裸包 39.24→4.55 ‖ 24.04→2.44），但 `eval-5p` 考卷上撑住判线的那两格是 −5.65pt** ⇒ 读数是"能剪、要付强度"，**没接上线上**（默认仍关）。
   第二起点没跑 ⇒ 按 §三.4 **不升格**。证据：`归档/.../arms/*.winner.js` 六份 + `arms/MANIFEST.tsv.txt`（每格的权威源与权重 sha8）。
9. **D218 那条规矩补齐到我这班新写的 7 台量具**（`rejectUnknownFlags`，实测 bogus 旗标一律 exit 64、正常调用照旧出数）。
10. **门禁跑过**：`--group=train` **157/159**（01:06→01:40）‖ `--group=meta` **16/16**（01:51:40）；唯一那条红 D191④ 的根因是我自己的产物池卫生（见 §五），处理后 D191 单跑 **1/1**（01:45:25）。
    ⚑ 两遍都是**按组**跑（工具原话"只跑了 159 / 278"与"16 / 278"）⇒ **不是整轮认证**；且与批同机并发 ⇒ 秒数不作证据。

## 二、DOING（只剩 **Hp long** 一批；判活**只看进程 CommandLine 与日志收尾行**，不看行数）

查法：
```bash
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,@{n='c';e={$_.CommandLine.Substring(0,[Math]::Min(120,$_.CommandLine.Length))}} | Format-Table -Wrap"
wc -l < champion-map/epsfull-prior2-2026-10-18.tsv          # multi，目标 794 行（803 减缺基线的 9 枚）
[ -f champion-map/epsfull-long-prior2-2026-10-18.tsv ] && wc -l < champion-map/epsfull-long-prior2-2026-10-18.tsv
grep -c '^ROW' docs/research/archive/2026-10-18-night2-prior-caliber/strength-E648.log.txt   # 目标 54
tail -1 docs/research/archive/2026-10-18-night2-prior-caliber/strength-E648.runner.log.txt   # 认 STRENGTH_DONE
ls docs/research/archive/2026-10-18-night2-prior-caliber/ab-tmp/ | wc -l                     # 目标 116
grep -E 'AB_CELLS_DONE|⛔' docs/research/archive/2026-10-18-night2-prior-caliber/ab-pool.runner.log.txt
```
- **Hp multi → long**（一条链式后台）：跑完接 `attach-hp --table=epsfull-prior2-2026-10-18.tsv --more=epsfull-tier-2026-10-12.tsv`，
  再 `rebuild-coords`（**必须含第⑩步 `attach-hlong`**）+ 四视图 `--hash=…&check=1` 各 93 PASS；long 用 `epsfull-long-prior2-2026-10-18.tsv` + `--more=epsfull-long-2026-10-16.tsv`。
- **强度三档**（54 格）：`node .../analyze-support-strength.mjs .../strength-E648.log.txt`（已扩 gear 维度，旧文件向后兼容已验）。
- **C1 池桌 A/B**（116 格）：驱动末尾自动吐 `ab-pool.paired.txt`。

## 三、NEXT（按优先级，明早醒来看见的第一件事）

1. **收尾复跑门禁**：`--group=train` 已跑 **157/159**（唯一那条红 D191④ 已根因=我的产物池卫生，处理后单跑 **1/1** 绿）‖ `--group=meta` **16/16**；
   但**代码在 train 那一遍之后又改过**（归档量具的旗标守卫 + 分析器产物指认）⇒ 明早若要引"这条分支绿"，重跑一遍 `--group=train`（约 13 分钟，**别与批并发**，秒数会作废）；
   ⚑ 两遍都是按组跑的，工具原话"只跑了 159 / 278 ‖ 16 / 278 ⇒ 不是整轮认证"要照抄；**整轮（不带 `--group`）今晚没跑**。
2. **Hp long 收口后接 T1 链**：`merge-hp-caliber.mjs --main=epsfull-long-prior2-… --fill=epsfull-long-2026-10-16.tsv --out=…` ⇒
   `rebuild-coords.mjs --hp=epsfull-hp-final-2026-10-19.tsv --hlong=<long 合并产物>` ⇒ 四视图 `--hash=…&check=1` 各 93 PASS。
   这台链子会**覆盖** `champion-map/coords.tsv`：工作树里它现在是干净的 ⇒ `git show HEAD:champion-map/coords.tsv` 就是备份（`--from` 缺省也正是这份）。
3. **§E649 只剩 long 层没填**：multi 那张表（794 枚）与池桌 A/B（29 枚两层）都已落纸；强度三档在 §E648 六（"时刻待补"已回填）。
   E0 那 16 枚现役成员的裸包送盾**已补测**（`champion-map/holo-e649-2026-10-19.tsv`，803 包全量在册）。
4. **合并回 main 的清单**（版本号在这一步才写）：CHANGELOG 新节（写 knobs/九条腿/Hp 口径/veto 四件事，注意 D205 的门号正则与"最新版正文"这条扫描面）
   ‖ `index.html` 的 `?v=` 缓存戳（我改了 `js/ui/ui.js`，DS 的 promote 机器人才会刷它 ⇒ 合并时手动刷一次）。
   ⚑ 原写在这条里的"把 `champion-map/epsfull-noopcheck*.tsv` 挪进归档目录"**已经做完且已跟踪**（四份都在 `docs/research/archive/2026-10-18-night2-prior-caliber/`：`epsfull-noopcheck-2026-10-18.tsv` ‖ `epsfull-noopcheck-s0-2026-10-18.tsv` ‖ `hp-noopcheck-12.tsv` ‖ `hp-rerun-list.tsv`）⇒ 别再照这句话去 champion-map 里找。
5. **veto 的下一步不是再跑臂**，是等 §四.1/.3 那两条裁定（强度代价要不要付、线画在哪）；第二起点 `v7teach-32` 只在"要写普适"时才需要（2 臂 ≈4 分钟，我今晚没跑 ⇒ 现在这句只到"这一支上能剪"）。

## 四、等她裁的四件（都在 `LIVE-LINES` 有对应行）

1. **体检线能不能被先验洗白**：82 从"裸包 17.3 阻断"变"开档 5.42 过线"并进 hard ⇒ 你要的是"玩家看不见刷屏"还是"包自己不刷"？后者意味着 82 该撤或该等训练侧解决。
2. **要不要给"页面默认开档"加一条门腿**（按 D224 家族加腿 + 我同时交一条该摘的旧腿）；现在门里对 `SUPPORT_PRIOR` 零命中，红只在手跑时可见。
3. **veto 的线画在哪、以及"要不要用强度去换干净"**（§E650 把两半都量出来了）：线值只量了 6（与体检线同值，我倾向保持"一条线一个意思"）；
   代价那一半是新的信息 —— 咬到的那两格在 `eval-5p` 考卷上是 **−6.20 ‖ −5.10（两格均值 −5.65pt）**，换来的是当选产物裸包送盾 **39.24→4.55 ‖ 24.04→2.44**。
   ⇒ 现在能裁的是"这买卖做不做 / 线放低到只剪 >20/局那种极端刷屏"，**不能裁**的是"普适"（第二起点没跑）与"广度会不会塌"（三格方向不一致，单抽）。
4. **`bandFor` 表外的 k 怎么办**（返回 null / 补全表=编数 / 收窄 `parseSelSeeds`）——归 DS 的文件，我只写了选项。

## 四·补　DS 交班 T2（全库 `promote.tsv` 重扫）——今晚**没做**，两条理由都写在实测上

1. **成本实测**（00:15:33，单枚 `promote-champion --dry`，默认已带 `--support=2`）：**150 秒/枚**。
   ⇒ 全库 803 枚 = **33.5 小时**（4 路并行仍要 8.4 小时）‖ 现在 `promote.tsv` 有 **159 行**（它本来就不是全库），重扫这一份 = 6.6 小时（4 路 ≈ 1.7 小时）。
   **这不是"今晚剩下时间"的能量级**，要做得单独立项，而且值得先问"哪些行的 verdict 真的会被先验改变"（候选集 ≈ 送盾超线那 32 枚 + 现役 29 枚，≈ 1 小时串行）。
2. **命名空间不能借**：`champion-map/promscan.mjs:8` 写得很清楚 —— `docs/artifacts/promote-<id>.txt` 是**真上槽那一次**的体检日志（"它必然过了体检才会写槽"），
   `e*-out/dry-*.txt` 才是 dry 输出。我要是今晚为凑数往 `promote-*` 里写 dry 文件，就是把"没过过槽"的包留下"像过过槽"的痕迹 ⇒ 这类静默污染比慢更糟。

⇒ 留给明天的两条合法路径：① 只重扫"送盾超线 ∪ 现役"那约 40 枚，产物写进一个**新的 `e649-out/dry-*.txt`** 目录（promscan 的 `e*-out` 收集规则天然吃它），并先确认它与旧 dry 的同 id 合并优先级；② 或直接等 veto 定下来再重扫（verdict 语义可能整个换掉，早跑要白跑）。

## 五、今晚我自己犯过、已进记忆或已加守卫的错（别在明早重演）

- ROOT 层数少退一层 ⇒ **0 格却"跑完"**（守卫加了 `n != 54 ⇒ exit 1`）。
- `--out=` 是仓库根相对路径，我传绝对 `/tmp` ⇒ 算完才 ENOENT（值没丢）。
- 拿跨轨迹的两个计数相除当概率（腿⑥b 已删，改成方向读数 + 腿⑨ 直量）。
- `list_console_messages` 不带 `types` 时看不到 `info` ⇒ 差点把"工具没显示"写成"页面没打印"。
- 表格插行拿**行首单元格**当锚点，同一张表连犯两次（第 22、23 次；已把反制降到"必须跨行边界下锚 + 逐行列数校验"）。
- **照抄共用落盘名把上一臂登记成本臂**：三格开档臂都 `rc=9`（§E589 守卫判"这粒已在盘上"⇒ 不写产物），而配对臂共享同一条带内梯子 ⇒ 关档先写、开档**必然**撞守卫 ⇒ 这条路在这个批形状下**永远错**。
  改法：权威源 = 臂日志 `[band-save] …（当选）` 那个 `.bak`，并拿拷贝自己的 `META.arm` 对暗号（不相等就当场点名）。第一批"开档 39.24 ‖ 关档 39.24"就是这条错印出来的。
- **实验 `.bak` 写进了共享产物池 + 驱动还原了登记行** ⇒ "文件在、登记没了" ⇒ 门 D191④ 实测 6 格红（还原 gv-* 时跳到 19）。
  这次红是对的（"同一粒权重多存一份会把 N 枚候选读得比实际多"是真的），我按事实清理本班产物、没去动判据；移出后 `unregistered: 0`（01:44 ‖ 01:50 两次）。
