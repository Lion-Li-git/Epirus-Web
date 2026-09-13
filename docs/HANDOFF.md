# ⚡ 当前状态与待办（v1.5.18）

> **变化流水看 `CHANGELOG.md`**（每版一条）· **会复发的坑看 `docs/METHODOLOGY.md`** ·
> 历史复查结论看 `docs/REVIEW-5P.md` / `REVIEW-3P.md`；老仓库规则集在 `D:\code\Epirus`。
> 本文件**只记"现在"和"下一步"**，别在这里堆版本记录（它曾经滚到 589 行）。
>
> **旧章节引用去哪儿了**（CHANGELOG / REVIEW 里还留着旧编号）：
> 旧 `§②`→现 §3-1（+`PARAMS-PLAN.md`）· 旧 `§③`→现 §3-2 · 旧 `§4-1..12`→CHANGELOG 对应版本 + `REVIEW-5P.md` ·
> 旧 `§5.1-N`/`§5.2-N`→**`METHODOLOGY.md` 第 N 条**（编号未改）· 旧 `§6.x`→现 §5 + 各实验段落 ·
> 旧 `§1`/`§2.1`（5P/长程那篇交接）→CHANGELOG v1.4.x–v1.5.x + `REVIEW-5P.md`。

## 0. 一句话状态
- **v1.5.18**；上线冠军仍是 **`eco-34`**（未换）；规则指纹 **`b2ea7f0b`**；**训练暂停中**
  （用户裁定："先把规则修干净再训练"）。
- 回归全绿：**spec 36/36 · np-test 80/80 · smoke SMOKE OK · battle-test BATTLE OK**（0 JS 错误）。
- 第三方独立复核 `docs/AUDIT-RESPONSE-v1.5.17.md` 的 **A 批（工程/门槛）+ B 批（规则定稿）都已做完**。

## 1. 别重做的事（细节全在 CHANGELOG v1.5.18）
- **A 批（不动规则/参数量、不重训）**：`firstW` 静默半开修掉（抽 `server/fight-env.mjs` 单一来源，D24）；
  2P 冠军包补 meta/指纹（新 `tools/promote-champion2p.mjs`，基准表抽成 `tools/p2-baselines.mjs`，D16 管两个包）；
  2P `runTrain` 与 `tools/diag.mjs` 补播种（`REPRO2` 改成调用点反查 + 实测幂等 D25）；补 `shapeOf`/维度守门 D26；
  体检指标抽成 `tools/audit-lib.mjs` + 新增 **G 有效技能数**列 + 6 项做成**阻断**（D27）；
  `battle-test` 截图改到未跟踪目录 `docs/artifacts/battle-out/`。
- **B 批（改了 `js/core/*`）**：**删掉快速/欧皇模式**（spec 37→36）；**铁索连环改一次性**；
  **合二为一保持 `>=2`**；补 8 条规则数据行为断言（D29，含修掉 `spec.js` 里那条**恒真**的爆头用例）；
  复核 R2 的结论是 **"无需改代码"**（提前落位可证明是空操作）+ 顺带修掉真实偏差"免雷窗口挡不住电磁炮"。
- 新增守门 **D24–D31**，每条都做了**反证**（改坏→应红→改回，5/5 达标）。

## 2. 关键数字
| 对象 | 读数 |
|---|---|
| `eco-34` 3 血考卷 | **41.4%**（40 局，`examScoreAtBuild`） |
| `eco-34` 自对局（20 局） | 伤害 **13.5/局**、平局 **0%**、**31.3 回合**、全息屏障 0 |
| `eco-34` 行为三列 | **E 被动场架势率 94%** · **F 活跃场进攻率 21%** · **G 有效技能数 4.24（10 种）** |
| 2P 冠军包 | 19 基准 × 40 局：平均 **94.74%**、最差 **72.50%**、过门 ✓ |
| 规则指纹 | **`b2ea7f0b`**（两个 bundle 的 meta 都必须等于它） |

⚠️ `eco-34` 现在**过不了** `promote-champion` 的新门槛（被 **E/F** 两项卡住，G 已达标）—— 它是在库产物，
用 `--force` 重记过（meta 里留着 `auditFails`/`auditForced`）。

## 3. 待办（**要用户拍板**）
1. **加参数量 + 重训**（`PACK_VERSION` 6→7）。复核已推翻旧"路线 A 不动参数量"：
   动作特征是**纯按 key 查表** ⇒ 把「蓄能」拆成 电/爆 两个候选会拿到**逐位相同**的特征 ⇒ 同分、等于随机。
   建议顺序 **④目标选择 > ③自身架势 > ①珠类型 > ②镜面复制内容**（依据是该分支的**实测访问率**）。
   方案底稿 `docs/PARAMS-PLAN.md`；配套守门**已有**（D26）。
2. **反摆烂的取值**：`FIRST_W` / `WHISTLE_PEN` / `SUDDEN_DEATH` 仍**默认关/未动**（用户："等看数据再定"）。
   现在有 E/F/G 三列 + 阻断条件当数据。
3. 复核 §5 剩下的可选工程项：`FIREWEAK_PERSIST` env 门仍在 `js/core/`；三套考卷局数没对齐进文档；
   `eco-34.bak` 的 meta 缺 `ecoOverride/fightOverride` 四键。
4. **守门缺口（如实记录）**：`BIG_T_EXEMPT`（大雷 3 回合禁用的豁免表）还没做穷举表态
   —— D29 目前只覆盖了**小雷豁免名单**与**防御族**。

## 4. 硬约束（别改）
- 游戏部分必须**双击 `index.html` 即玩**（`file://`、零依赖）；**2 人对战冻结 v1.0**，bug 只给 patch 号。
- `.gitignore` 的 `*.bak` 是本地存档（冠军包不入库，`git ls-files` 里 0 个 .bak）。
- **版本号粒度**：日常只动最后一位；中间位只在"显著突破"时动。
- 流程：**长任务先报【预估】、跑中报【进度】；别把等待写进 tool call**（会把 DSH 卡死，见 METHODOLOGY 第 1 条）。
- 浏览器可复现性那条线**已停止**；训练研究走 `server/train-server.mjs`（= 页面点"开始训练"的同一机制）。

## 5. 复跑命令
```bash
node tools/spec-run.mjs            # 36/36
node tools/np-test.mjs             # 80/80（D1–D31 + N/L 族）
node tools/smoke.mjs               # SMOKE OK（CDP 真 Chrome）
node tools/battle-test.mjs         # BATTLE OK（真 Chrome 对战；截图 → docs/artifacts/battle-out/）
node tools/rules-fingerprint.mjs   # 当前规则指纹
node tools/champ-audit.mjs --games=20 docs/artifacts/eco-34.bak     # 体检表 A~G
node tools/promote-champion.mjs docs/artifacts/eco-34.bak --exam-games=40 [--force]   # 换/重记冠军
node tools/promote-champion2p.mjs                                   # 2P 包补 meta（不动权重）
node tools/eval-5p.mjs 40 5 77000 <包> [--mode=long --field=ringwall]                 # 考卷
node tools/ring2-run.mjs                                            # 多种子训练自跑器
```
⚠️ `tools/ring2-run.mjs` 训练期间会写 `docs/artifacts/.training.lock` 并临时覆盖 bundle ⇒
**别在训练期间跑 `D16` / `champ-audit` / `battle-test`**（`promote-champion` 见锁直接拒绝）。
