# 交接：Epirus-Web 多人（5P）/ 长程模式 / 测量口径

> 会话日期 2026-09-12 · HEAD = `f525346`（v1.4.14）· 回归 **spec 37/37、np-test 58/58**
> 读这份就能接手；每个结论都带可复跑的命令。**§5「踩过的坑」请先读**，能省几小时。

---

## 0. 30 秒现状

- **线上多人冠军 = v1.3.58**（5P 考卷 1st **38.4%**、top2 55.9%、3P 47.5%、座位极差 5.0pt）。
  **本轮没有换冠军**（多 seed 验证下没有一个新臂能稳定超过它）。
- 新增 **长程模式（5 血 · 3-5 人）** + **终局收缩**（100 回合后每轮全员 −1 血，替代硬截断）。
- **skill-report 从 1 个口径扩到 5 个**（inject / grant / plan·combo / smart / ban / pure / field），
  并新增「**该用口径**」列、**覆盖表**、**消融 `Δ_lost`**（主口径）与**一键 `.cmd` 入口**。
- 训练默认对手池**未改**（加了 `reflectspam`/`ringspam` 等名字但默认池不变，只作 `?opps=` 旋钮）。

---

## 1. 下个会话第一件事：把 ring2 实验跑完

**ring2 只跑了 1/4**（DSH 卡死把作业带走了）：
- 已产出：`docs/artifacts/ring2-31.bak`（seed 31，池含 `ringspam`，自评 **0.3602**）
- 未跑：seed 32 / 33 / 34（**实验臂**）+ **8 次评估一次都没跑**
- **控制臂已存在且已验证逐位可复现**：`docs/artifacts/ms2-p12-{31,32,33,34}.bak` ⇒ 只需跑实验臂

**目的**：验证"把**聚能环经济流**放进训练池"能否让冠军学会反制环（用户指出小雷正是打环的）。
**验收**：`--mode=long --field=ringwall` 的 1st 提升，且标准考卷不劣化（多 seed 配对，n≥4）。
**命令见 §6.3**，耗时 ≈ 7 分钟。

---

## 2. 本轮交付（文件 → 内容）

### 2.1 引擎 / 规则
| 文件 | 改动 |
|---|---|
| `js/core/rules.js` | `MODES.long = { hp:5, 3-5人, drainHpMax:3, suddenDeath:100, maxRounds:140 }`；`蓄能` desc 与 R9' 对齐（原写"可累加"是错的，且 `ui.js:131` 直接展示给玩家）|
| `js/core/resolve.js` | `endTurn` 末尾**终局收缩**（`bypassGuards`+`noMine`+`source:null`）；**双枪第二发复用 `dgDmg`**（原写死 `amt:1`，改数据表只影响第一发）|
| `js/core/state.js` | 摄魂门槛改读 `state.mode.drainHpMax`（缺省 1 ⇒ multi/standard 口径不变）|
| `js/core/play.js` | `autoGameN` 新增第 4 参 `onRoundStart`（在 `legalActions` **之前**，珠类门测量用）|
| `js/train/policy.js` | `round/MAX_ROUNDS` 的分母跟本局上限（5 血下不出 [0,1] 分布）|
| `js/ui/ui.js` + `index.html` | 模式下拉加「长程（3-5人·5血）」；人数↔模式改为 `option.disabled` 校验（原实现 3-5 人时**整体禁用下拉**⇒永远只能 3 血）|
| `js/train/trainer.js` | 删死代码 `startTraining`（172→141 行）|

### 2.2 测量器材 `tools/eval-5p.mjs`（多人唯一主力工具）
- `--field=` 前置条件场：`focusfire/focusme/focusme2/tank/mine/minespam/cursestorm/reflectwall/guardwall/baguawall/protowall/ringwall/ringmix`
- `--inject=<技能>` 边际注入 · **`--ban=<技能>` 消融** · **`--pure=<技能>` 纯招** · `--smart=<卡>:<条件>` · `--plan=chargeRailgun` · `--combo=curseStorm[:N]`
- `--grant=<elec|boom|epN>` 回合前开珠/补 ep · `--mode=` · `--regen=` · `--drainHp=`
- 读数：主体场均承伤 / 平均回合 / 转移事件 / 火焰事件 / **自己的攻击被弹回次数** / 平局率 / 终局血量
- **每个口径都有自检计数**（注入率 / 消融命中 / 纯招可负担率 / 连招打出次数）⇒ 没跑到就不是结论
- `PAY_KEY` 已改为**从 `R.skills` 自动生成**（手写白名单漏过 `miniT` ⇒ 静默 `exit(1)`）

### 2.3 `tools/skill-report.mjs` + `tools/skill-report-cmp.mjs`
- `--champ=<文件>`（原写死路径）· `--json=<文件>`（导出逐技能结果）
- 输出：**「该用口径」列** + **覆盖表**（① 本口径量不到 ② 冠军已在用）+ 覆盖率卡片
  + **「消融 Δ_lost」列**（对使用率 ≥1% 的技能另跑"拿掉它"的同 seed 原生经济考卷；
  **正数 = 承重、负数 = 陷阱**）+ 反制卡标注（带**（本场）**限定）
- **一键入口（用户可自己操作）**：
  - `tools\skill-report.cmd [冠军文件] [局数=6]` → `docs\skill-report.html`（自动打开）
  - `tools\skill-report-compare.cmd [局数] [标签…]` → `docs\skill-report-cmp.html`（多版本对比）
  - 都支持 `EPIRUS_NO_OPEN=1` 只生成不弹浏览器

### 2.4 新增脚本 `js/train/bots.js`
`pickMineSpam`（铺雷）· `pickCurseStorm`（贴贴→天火，含承诺攒钱）· **`pickRingSpam`（开环→续环→攒到 5 ジ兑现大件）** ·
`pickComboCounter` 补"**对手在开环 ⇒ 出小雷**"分支（此前缺失）

### 2.5 训练基础设施
- `server/opp-pool.mjs` = **对手池唯一来源**（17 个名字）；server 的 `BOT_FN_N` 与 worker 的 `OPP_POOL` 都从它派生
- `server/train-server.mjs`：`?opps=` 覆盖 · **未知对手名立刻中止并进 SSE** · 墙上时钟改 `EPIRUS_WALL_MS` 可关
- `server/train-worker.mjs`：启动时校验每个 `fn` 存在
- `tools/ab-analyze.mjs`：多 seed 配对分析（逐 seed 差分 / 均值·sd·se·t / 符号检验 / **两臂单跑极差**）

### 2.6 文档
- **`docs/REVIEW-5P.md`**：5P 版复查（§1 已解决 10 项 / §2 P0–P3 / §3 **方法论 9 条** / §4 给千问的 6 个问题 / **§5 第十轮独立复核处置** / 复现命令）
- **`results/Epirus-Web-第十轮复核-5P与长程.md`**：千问的独立复核（自建评测架，未复用我方工具；已归档）
- `CHANGELOG.md`：v1.3.59 → **v1.4.14**（每版一条，含结论与踩坑）

---

## 3. 关键结论（可直接引用，都带数字）

### 3.1 深经济（原 P0）**已被拆成四条**，别再当一条追
| 编号 | 内容 | 证据 |
|---|---|---|
| P0-a | **收入不足**：`枪` 的 1.00 伤害/ジ 是全表上限，任何"延迟支付"从亏利率出发 | 千问 ep 阶梯：cap3 峰 54.8%、cap10 掉到 32.5% |
| P0-b | **陷阱卡**：`雷击之枪`（0 伤害/2 ジ，1.6% 用量）拿掉反而 **+2.2pt** | 我方消融复验 |
| P0-c | **反弹墙**：冠军 v1.3.58 对 4×`reflectspam` 1st **0.0%**（每局被自己的枪弹回 **3.00** 次 = 恰好 3 血上限）；纯激光剑/狙击 **100%** | 我方 1400 局复验 |
| P0-d | **聚能环复利线没被教**：首次 3 ジ→+1、连续第 2 次 0 ジ→+2、**第 3 次起 0 ジ→+3/回合** | `resolve.js:614`；我历次补贴恰好绕开它 |

### 3.2 **小雷不是陷阱卡，是反制卡**（用户纠正，已实测坐实）
- 机制：`resolve.js:789` 判 `ringStreak` 只看本回合是否 `ok` 出环 ⇒ **被小雷 void 的环让 streak 归零**
  （3 ジ投入 + 复利线一起报废）
- **5 血 · 4×环流场**：基线 **2.5%** → `--inject=miniT` **22.5%（+20pt）**；`--ban=miniT` 无变化（冠军那 1.6% 没瞄准环）
- **5 血 · 无环场**：基线 31.1% → `--inject=miniT` **5.4%（−25.7pt）**
⇒ 同一个动作**场依赖**；"陷阱卡"是**口径/考卷**结论，不是卡的性质。

### 3.3 聚能环是**长程模式的胜利路线**
4×`ringspam` 在 **5 血**下把现役冠军打到 **1st 2.5%（5th 85%、场均承伤 5.90、终局血量 0.07）**；
**3 血**下反而退化（环还没回本就被打死，冠军 100%）。⇒ 5 血确实解冻了一类轨迹策略。

### 3.4 反弹墙：**加进池子没有显著影响**（n=6 配对）
| 指标 | 12 对手 | 12+墙 | 配对 Δ | t |
|---|---|---|---|---|
| 标准考卷 1st | 37.48% | 35.65% | −1.83pt | −1.05（不显著）|
| 反弹墙 1st | 47.50% | 72.08% | +24.58pt | 0.99（**sd=60.9**，不显著）|

逐 seed 墙差分 `0/+80/−67.5/0/+35/+100`，**两臂各自极差 0→100pt**
⇒ 墙的表现由"这一跑落到哪个局部最优"决定。**该指标 n=1 不可读**。
且 **hA9(85%)/hB12(100%) 从没见过墙也不会自杀** ⇒ 洞是**特定网络**（v1.3.58、armB12f = 0%）的性质，不是配方性质。

### 3.5 终局收缩生效（替代硬截断）
450 局里 **0 局**碰到安全网（`maxRounds=140`）：防守型场从 `multi` 的"**撞上限 150/150、5 人全活**"
变成 `long` 的"平均 **104** 回合、**收缩生效 150/150**"。
**已知边界**：纯乌龟场全员同时归零 ⇒ 走 N10"全灭平局"（引擎 `draw`，但 `rankOf` 的承伤升序仍给出有意义的序）。

### 3.6 摄魂门槛：**放宽反而更差**
3血 HP≤1 Δ+1.1pt；5血 HP≤1 **+1.8** / HP≤2 −0.3 / HP≤3 **−3.1**。
"HP≤1"机会率两模式**都是 0.3%**（并不相对变窄）⇒ 门槛留 1，要调就调**费用**。

### 3.7 测量有效性的两条确认
- **`winner` vs `rankOf`：900 局里 0 不一致**（仅 6 局引擎判 `draw` 而 `rankOf` 仍排第一，属 N10 设计）
  ⇒ 千问 §6-7 报的 ~15% 在真实考卷口径上**不复现**（他们自己标了样本含高温网络）
- **训练逐位可复现**：同 seed/同池/同起点重跑，去掉 META 后权重**逐字节相同**（seed 31 验过两次）

---

## 4. 未解 / 待办

1. **ring2 跑完**（§1）→ 决定要不要把环经济流放进默认池。
2. **`--smart=armor:<条件>`**：藤甲"火弱那一半"仍未测（饱和铺雷场里 `armor` 与 `reflect` 给出**逐位相同**结果
   ⇒ 该场防御族惰性）。
3. **训练考卷没跟着换 5 血**：`oneGameN(…, opts)` 支持 `opts.mode`，但**30 个调用点无一传 mode**
   （`scoreMemberN`/`evalN`/`bot-audit`/各 diag 全是 `multi`）⇒ 5 血冠军尚未训练。
4. **判定阈值是刀锋**：`use ≥ 4%` 决定"常用"，`枪` 在 3.8% 摆动 ⇒ 边界技能**读消融 Δ 不读标签**。
5. **连招类**：`贴贴×天火` 已证**算术锁死**（符咒 `age≤3` vs 铺符速率 ≤1 张/2 回合，两模式都引爆 0 次）；
   要解开得改 `age` 或贴贴成本 —— **需要用户裁定**。
6. 各 seed 落到的局部最优战术差异极大（激光剑流/狙击枪流/坦克流/枪流）⇒ 换冠军必须多 seed。

---

## 5. 踩过的坑（务必先读）

### 5.1 工具/流程
1. **别把"等待"写进 tool call**（用户 2026-09-12 指出，千问定位）：我写了个 15 分钟的轮询循环，
   导致 **DSH 整个卡死**、实验被带走。**改成"一次只看一眼"（`timeoutMs ≤ 60s`），让实验自己写日志**。
2. **长任务先报【预估】、跑中报【进度】**（用户要求）。基准吞吐：**5 人 250 代热启动 ≈ 1 分钟**、
   **一个 1400 局考卷 ≈ 8 秒**。
3. **补丁与提交必须 `&&` 串联**，并在提交前 `grep` 校验 —— 我两次因为 Python 补丁失败
   （SyntaxError / 锚点不匹配）而**提交了声明里有、磁盘上没有**的 CHANGELOG 条目。
4. **别在同一条命令里叠多个 heredoc**：`python - <<'PY' … PY` 后面再跟 `git commit -F - <<'MSG'`，
   第一个 heredoc 会吃掉后面全部内容（本轮犯过，什么都没提交）。
5. **`git commit -m "…"` 的信息里不要有内层双引号**（会截断成 pathspec）。
6. **`sed -i 's/…v1.4.6/…/'` 不匹配时不报错** ⇒ 版本号会静默漂移（README 曾停在 v1.4.6、index.html 停在 v1.4.1）。
   **改用任意版本的正则** `s/v[0-9.]+/vX.Y.Z/`；且 **np-test D8** 已在守护三方一致。
7. **node 的 `/tmp` = `D:\tmp`**（不是 Git Bash 的 `%TEMP%`）⇒ 给 node 传 /tmp 下的文件必须 `$(cygpath -w …)`。
   这是会话内**第 4 次**踩。
8. **`.cmd` 里不能写中文注释**（GBK 码页会把行拆成非法命令）⇒ 两个 `.cmd` 都是纯 ASCII。
9. **按命令行模式杀进程会杀掉自己**（我的 kill 命令里含匹配串，把当前 shell 也匹配上了）。
   要按 pid 精确杀，或用不会出现在杀手指令里的模式。
10. **跨 heredoc 写 JS 正则会丢反斜杠**（`[\\/]` 变成 `[\/]`）⇒ 写完必须回读字节验证；
    实在要用就换成**不含反斜杠**的写法（如 `/^.*[^0-9A-Za-z_.-]/`）。

### 5.2 测量/方法（都是花钱买来的）
11. **n=1 不得下结论** —— 本轮**三次**同类翻车：v1.4.1 把 38.4%→21.8% 归因于轮换（真因是"从零冷启动 vs 热启动谱系"）；
    v1.4.9 想据 `wall2-31` 换冠军（多 seed 后不显著）；v1.4.9 的反弹墙效应（n=6 仍不显著）。
    **单跑极差**：标准考卷 3.8~8.5pt、**反弹墙 100pt**。
12. **每个新口径都要带自检计数 + 反证对照**。本轮的范例：`--ban=sword`（使用率 0%）应给出 **≈0 的变化**
    （实测 −0.1pt）⇒ 证明消融器材本身不改变行为。没有反证对照的 Δ 不可信。
13. **"白名单/清单两处各写一遍"必出事**（漏加名字）—— 已踩**三次**（v1.3.59 漏 server、v1.4.8 漏 worker、
    v1.4.14 漏 `opp-pool.mjs` 本身）。现在由 **single source（`server/opp-pool.mjs`）+ np-test D7/D9** 守住。
    而"未知对手名"现在**开跑前就中止并进 SSE**（原先只 `console.log` 到隐藏 server 的 stderr，curl 看不到）。
14. **口径会决定结论**（本轮最贵的教训）：`枪` 的 mono-spam Δ = **−15.5pt**（读作"坑"）而消融 `Δ_lost` = **+0.5~3.8pt**
    （读作"该留着"）；`雷击之枪` mono −44pt（读作"没用"）而消融 −2.6pt + 环场 **+20pt**。
    **已在用的技能看消融；反制卡看场**。

---

## 6. 复跑命令

### 6.1 回归
```bash
node tools/spec-run.mjs      # 37/37
node tools/np-test.mjs       # 58/58（含 D1..D9）
```

### 6.2 技能表（用户自己也能跑）
```bat
tools\skill-report.cmd                                   :: 当前线上冠军
tools\skill-report.cmd docs\artifacts\champion-5p-hA9.bak 6
tools\skill-report-compare.cmd                           :: 多版本对比页
```

### 6.3 ring2 实验（下个会话第一件事，≈7 分钟）
```bash
# 控制臂已有：docs/artifacts/ms2-p12-{31,32,33,34}.bak（同池同 seed，已验证逐位可复现）
# 只跑实验臂（池 = 12 对手 + ringspam），然后按 §6.4 评估
PORT=8906
A="random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver"
B="$A,ringspam"
cp docs/artifacts/champion-5p-v1.3.58.bak js/bundled-champion-3p.js
pwsh -NoProfile -Command "Start-Process -FilePath node -ArgumentList 'server/train-server.mjs','$PORT' -WorkingDirectory 'D:\code\Epirus-Web' -WindowStyle Hidden"
sleep 4
for S in 32 33 34; do            # 31 已产出为 docs/artifacts/ring2-31.bak
  cp docs/artifacts/champion-5p-v1.3.58.bak js/bundled-champion-3p.js
  LOG=/tmp/ring2-$S.log
  curl -sN --max-time 900 "http://127.0.0.1:$PORT/train?gens=250&n=5&pop=16&gpo=8&seed=$S&opps=$B" > "$LOG" 2>&1 &
  # 轮询：一次看一眼（不要写长等待！）—— 等 "type":"done" 或 "type":"error"
  # 人为做法：隔一会儿 `grep -a '"type":' $LOG | tail -1` 看进度，done 后再 cp
  cp js/bundled-champion-3p.js docs/artifacts/ring2-$S.bak
done
pwsh -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*train-server*$PORT*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
cp docs/artifacts/champion-5p-v1.3.58.bak js/bundled-champion-3p.js
```

### 6.4 评估（每臂两个考卷）
```bash
F=docs/artifacts/ring2-31.bak
node tools/eval-5p.mjs 40 5 77000 $F                                    # 标准考卷
node tools/eval-5p.mjs 40 5 77000 $F --mode=long --field=ringwall       # 环场（5 血）
# 控制臂：docs/artifacts/ms2-p12-31.bak 同上两条
# 汇总：把 runner 日志按 "seed pool 自评 标准 环场" 格式写好后跑
node tools/ab-analyze.mjs "$(cygpath -w /tmp/ring2-run.log)" p12 r17
```

### 6.5 单点诊断（都很便宜）
```bash
node tools/eval-5p.mjs 40 5 77000 docs/artifacts/champion-5p-v1.3.58.bak --field=reflectwall   # 反弹墙
node tools/eval-5p.mjs 40 5 77000 docs/artifacts/champion-5p-v1.3.58.bak --field=ringwall --mode=long --inject=miniT  # 小雷反制环
node tools/eval-5p.mjs 40 5 77000 docs/artifacts/champion-5p-v1.3.58.bak --ban=gun             # 消融
```

---

## 7. 用户裁定 / 硬约束（别改）

- **游戏部分必须"双击 index.html 即玩"**（`file://`、零依赖）
- **2 人对战冻结在 v1.0**；bug 只给 **patch** 号
- **`.gitignore` 的 `*.bak` 是本地存档**（冠军包不入库，`git ls-files` 里 0 个 .bak）
- **浏览器可复现性那条线已停止**；训练研究走 `server/train-server.mjs`（= 浏览器点"开始训练"的同一机制）
- 用户要的流程：**长任务先报【预估】、跑中报【进度】；别把等待写进 tool call**
