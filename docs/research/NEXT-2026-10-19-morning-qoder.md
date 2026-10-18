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

## 二、DOING（三批，判活**只看进程 CommandLine 与日志收尾行**，不看行数）

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

1. **跑门禁**（还没跑）：改过 `js/train/evo.js` + `js/ui/ui.js` ⇒ `--group=train`（约 13 分钟）‖ `--group=meta`（约 11 秒）；
   两条计数都要带工具原话"只跑 X / 278 条 ⇒ 不是整轮认证"，输出**先落文件再截**。等三批收口后再跑，别四路抢核（秒数会作废）。
2. **§E649 落笔**：Hp/Hplong 的 Δ 分布（`analyze-hp-prior.mjs` 已就绪）+ 强度三档结论填进 §E648 第六节那两个"（时刻待补）"。
3. **E0 补测 16 枚现役成员的裸包送盾**（≈4 分钟）⇒ 这是 veto 的硬前置，也是"体检口径跟产品走"目前只覆盖 13/29 的那块账。
4. **合并回 main 的清单**（版本号在这一步才写）：CHANGELOG 新节（写 knobs/九条腿/Hp 口径三件事，注意 D205 的门号正则与"最新版正文"这条扫描面）
   ‖ `index.html` 的 `?v=` 缓存戳（我改了 `js/ui/ui.js`，DS 的 promote 机器人才会刷它 ⇒ 合并时手动刷一次）‖ 归档 `champion-map/epsfull-noopcheck*.tsv` 从 champion-map 挪进 archive 目录。
5. 若还有余力：按 §五 那 6 条 120 代小臂（≈8 分钟）先验证 veto 的"送盾必须降"这一半——**但线画在哪要先等她裁**（标定给的是 2/4/6/8 四个位置的砍除数）。

## 四、等她裁的四件（都在 `LIVE-LINES` 有对应行）

1. **体检线能不能被先验洗白**：82 从"裸包 17.3 阻断"变"开档 5.42 过线"并进 hard ⇒ 你要的是"玩家看不见刷屏"还是"包自己不刷"？后者意味着 82 该撤或该等训练侧解决。
2. **要不要给"页面默认开档"加一条门腿**（按 D224 家族加腿 + 我同时交一条该摘的旧腿）；现在门里对 `SUPPORT_PRIOR` 零命中，红只在手跑时可见。
3. **veto 的线画在哪**（>2/4/6/8 的砍除数与现役命中已标定；我倾向与体检线同值 6，保持"一条线一个意思"）。
4. **`bandFor` 表外的 k 怎么办**（返回 null / 补全表=编数 / 收窄 `parseSelSeeds`）——归 DS 的文件，我只写了选项。

## 五、今晚我自己犯过、已进记忆或已加守卫的错（别在明早重演）

- ROOT 层数少退一层 ⇒ **0 格却"跑完"**（守卫加了 `n != 54 ⇒ exit 1`）。
- `--out=` 是仓库根相对路径，我传绝对 `/tmp` ⇒ 算完才 ENOENT（值没丢）。
- 拿跨轨迹的两个计数相除当概率（腿⑥b 已删，改成方向读数 + 腿⑨ 直量）。
- `list_console_messages` 不带 `types` 时看不到 `info` ⇒ 差点把"工具没显示"写成"页面没打印"。
- 表格插行拿**行首单元格**当锚点，同一张表连犯两次（第 22、23 次；已把反制降到"必须跨行边界下锚 + 逐行列数校验"）。
