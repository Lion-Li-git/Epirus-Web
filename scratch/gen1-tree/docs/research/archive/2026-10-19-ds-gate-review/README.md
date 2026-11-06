# §E653 归档：复核 DS 的门禁改动（v1.7.114 的并发假红修复 + 点名器）

复核对象 = DS 的 `0b46840`（v1.7.114，13:58）+ 他的交班 `docs/research/HANDOVER-2026-10-19-afternoon-ds.md`。
正文在 `docs/research/logs/2026-10-18-beadseed82-qoder.md` **§E653**。

## 一、三台量具（都可复跑）

| 这台 | 判什么 | 坏样本 / 自检 |
|---|---|---|
| `enumerate-writers.mjs` | 门里每个 `train-3p` 调用点的 env 有没有把**产物落点**改道（按最内层整个调用判，不用字符窗口） | 自检两格：正对照 `train-runner.mjs:734` 必须"改道"、反对照 `:738` 必须 ⛔，不过则 `exit 4`。**上一版这台放过 738**（依次试 opener ⇒ 被远处 `spawnSync(` 的跨度吃掉），是运行时的 `META.arm=d127on` 揪出来的 |
| `verify-writedefault.mjs` | 点名器 `[WRITE-DEFAULT]` 有没有说谎（三格：该失败的失败 / 发布态 / 真写默认落点） | 格 0 是**反向对照**：把 HEAD 那份另存成 `tools/train-3p-v114.mjs` 跑同一格 ⇒ 旧版在 exit 6（根本没落盘）那次照样打 ⇒ 新版不打。16 格全 PASS，并断言主树 `js/bundled-champion-3p.js` 与 `docs/artifacts/train-3p-out.js` 的 sha 逐字不变 |
| `d116-twice.mjs` | D116 的 exit 9 是谁带来的（我改的点名行？还是"没改道 + §E589 命中残留 `.bak`"？） | 同一 env、两份码各跑两遍；**清干净状态后**新版第 1 遍 exit 0 并打 `[WRITE-DEFAULT] nptest-arm`，第 2 遍 exit 0（原地覆写）⇒ 与我的改动无关 |

复跑（**全部在隔离 worktree**，别在主工作树跑格 2/格 3，那两格真会写文件）：

```bash
git worktree add --detach <WT> HEAD && mkdir -p <WT>/docs/artifacts
cp tools/train-3p.mjs <WT>/tools/train-3p.mjs        # 被测的是工作树里那份（含 v1.7.115 改动）
node docs/research/archive/2026-10-19-ds-gate-review/enumerate-writers.mjs
node docs/research/archive/2026-10-19-ds-gate-review/verify-writedefault.mjs --wt=<WT>
node docs/research/archive/2026-10-19-ds-gate-review/d116-twice.mjs --wt=<WT>
# 运行时名单（这趟的产物在 gatepar-wd.log.txt；注意 gate-par 吞子进程 stdout ⇒ 看不到 WRITE-DEFAULT）
EPIRUS_LOG_DEFAULT_OUT=1 node tools/gate-par.mjs --part=train-evo,train-env,train-runner,ship-feas,ship-promote,probe-instruments --jobs=4
```

## 二、原始输出

| 文件 | 是什么 |
|---|---|
| `gatepar-wd.log.txt` | 14:10:57 那趟（六个部分并发）：`train-env GREEN 4/4` ‖ `ship-feas 12/14` ‖ `ship-promote 20/21` ‖ `train-evo 64/65`（D162 报 `got=5c652e17… want=d1a9a7c8…`） |
| `serial-D124.txt` ‖ `serial-D125.txt` ‖ `serial-D116.txt` | 三条红的**单跑**复跑：1/1 绿 ‖ 1/1 绿 ‖ **0/1 仍红** ⇒ D116 不是并发问题 |
| `enumerate-writers.log.txt` | 静态名单（40 个调用点 / 13 处没改道）+ 两格自检 |
| `who-owns-them.log.txt` | 把可疑处对回**所在门腿**（D 编号 + 近旁 env 键）⇒ 分三类：有意写基线 / 一跑通就写 / 真写 |
| `verify-writedefault.log.txt` ‖ `d116-twice.log.txt` | 上面两台的原始输出 |
| `gate-D191.txt` ‖ `gate-D8.txt` | DS 交班 §五 让我跑的两条快门：**1/1 绿 ‖ 1/1 绿**（他担心的"我 13:56 那两份 `.bak` 打红 D191"不成立） |
| `runner.log.txt` | 每趟起止时刻（全部从 `date` 与日志收尾行抄） |

## 三、复核结论（四条，都不越界去改别人的面）

1. **DS 修对了那两条，但病没修完**：门里还有 **7 条腿真写默认落点**（`train-runner.mjs:738/837/1307/1315/1474/1539` ‖ `ship-promote.mjs:422`，另 `:417` 是坏参照那臂）＋ **3 处**今天靠 exit≠0 侥幸没写（`train-env.mjs:59/69` ‖ `train-runner.mjs:674`）。补改道是逐条机械活，**`tools/gates/**` 归他**，我只交名单不代改。
2. **点名器要能用还得动 np-test**：现在 `gate-par`/`np-test` 把子进程 stdout 吞掉 ⇒ `[WRITE-DEFAULT]` 在门里永远看不见（DS 交班那条命令照抄捞不到东西）。在那之前，运行时取证靠**默认产物的 `META.arm` + mtime**（本次就是这么抓到 `d127on` 的）。
3. **门禁不是只读的**：门跑一轮就往 **tracked** 的 `champion-map/pack-aliases.tsv` 加登记行（§E589"不写第二份、只登记别名"的设计后果）。本次主树那处改动我**既没提交也没还原**，等裁。
4. ⚑ 我自己的一台尺也有口径病：本目录那段"表格列数自检"用 `line.match(/\|/g).length` 数竖线，**不剥转义 `\|`** ⇒ 把已修好的行 28/32 报成断列（doc-structure-guard 那把尺认转义，才是干净的）。⇒ 用别人的尺之前先读它的条款（见记忆「用尺前先读这把尺的条款」）。

## 四、落地后的验证（§E654，数字都从工具自己那行抄）

| 这台/那趟 | 结果 |
|---|---|
| `verify-writedefault.mjs`（钉旧版参照 = `0b46840`） | **22 PASS ‖ 0 FAIL**（含格 0 反向对照"旧版在 exit 6 也打"、格 1"暗键仍拿 6 不是 10"、格 5"没声明 ⇒ exit 10 且横幅都没印"、格 3/4"声明过的写标 `[WRITE-BASELINE]` + 台账六段齐"） |
| `alias-dedupe.mjs` + `alias-dedupe-step.mjs` | **4/4 PASS**（含反面：换 `wantedPath` 必须新增一行） |
| 六条红腿单跑（`serial-legs.log.txt`） | D116 **1/1**(24s) ‖ D123 **1/1**(131s) ‖ D15 **1/1**(0s) ‖ D124 **1/1**(7s) ‖ D125 **1/1**(7s) ‖ D162 **1/1**(59s) |
| 全 16 部分并发（`fullmatrix.log.txt`，15:31–15:45） | 14 绿 ‖ 2 红（`meta-repo` D191 实测 3 ‖ `ship-feas` D124/D125）⇒ **两条都是我的脏**：第一版幂等测试把 `docs/artifacts/A/B/C.bak` 写进真仓 |
| 清脏之后复跑 | `--only="D191 "` **1/1** ‖ `--part=ship-feas` **14/14**（15:48:55，`ship-feas-after-cleanup.txt`）；`train-evo` 65/65 ‖ `train-runner` 31/31 ‖ `ship-promote` 21/21 在矩阵里已全绿 |
| 台账（`write-default.tsv`） | 整趟 **1 行**，`arm=d123` 且标 `BASELINE（声明过）` ⇒ 除声明者外无人再写默认落点 |

新增原始文件：`serial-legs.log.txt` ‖ `fullmatrix.log.txt` ‖ `write-default.tsv` ‖ `ship-feas-after-cleanup.txt` ‖ `alias-dedupe.log.txt` ‖ `verify-g654.sh`（单跑→并发→台账收口的驱动，可整跑）。

⚑ **两条留给下一班的硬话**：① `D124/D125` 的读数会被 `docs/artifacts/` 里的陌生包影响（我三个 `.bak` 一进去它们就"3P 栏没跑"）⇒ 这两条腿**对池子没有隔离**；② `train-runner` 单部分 1014.6 s 是整趟墙钟的顶（拆成两个部分预计压到 ~13 分钟）。
