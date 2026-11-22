# v7 扫批回执 · 2026-11-22 夜班（GLM）

> 承接 [HANDOFF-2026-11-22-night-for-glm.md](HANDOFF-2026-11-22-night-for-glm.md) §二（探针先行算法）与
> [v7-scan-plan.tsv](v7-scan-plan.tsv)。本文件是**按批回执**（命中/不中/配方来源），下一班从这里接着排。
> 执行器：`scratch/sweep-server-batches.mjs`（复用）+ `scratch/v7-probe-jobs.py`（探针 jobs 生成）+
> `scratch/fam-recipe-mine.py`（逐族配方挖掘）。jobs 文件在 `scratch/v7-mined/server-jobs-cli-*.tsv`。

## 配方发现的关键结构（下一班直接复用）

1. **fam4/5/6 的 era 批不是裸 env 命令——是 era 的批 runner 工具**（如 `tools/l2-arms.mjs`），
   臂→env 映射**逐字写在工具源码的 ARMS 表里**。考古路径：`git grep -l <批名> <era> -- tools/` 命中即读；
   不命中的族查 era 的 `docs/RESEARCH-LOG-2026-09-*.md` / `docs/HANDOFF-2026-09-*.md`（配方链逐字可读）。
2. **era 解析要用特征提交本体**，不是 ts 之前的最后一个 commit：v7l2c 批 ts(09-19 00:42) 早于
   l2-arms 提交(00:56) 14 分钟 ⇒ 按 ts 解析得 aba68a21（**探针 miss**），换 407d2c6c（l2-arms 本体）后
   **逐位命中**。判据：批名含排程器/臂批工具的特征名（l2c→l2-arms）。
3. **era 默认值 ≡ 表内旋钮**（aba68a21 的 evo.js 实测：DIV_W 0.06 / DIV_K 6 / HOARD_PEN 0.12（硬编码 const，
   不可 env）/ DEAL_W 0.01 / 其余 0）⇒ 表值=默认的批**零 env 即可重放**；偏差批用
   `EPIRUS_DIV_W/DIV_K/DIV_ROLEW/DIV_CATW/STOCK_BONUS`（era econ-env 的 11 键表）。
4. **v1.5.134 系标准臂模板**（HANDOFF-2026-09-19.md 逐字）：DIV_W=0.3 / CLEAR_W=0.1 / TRAIN_SEAT_GAMES=24 /
   IMIT_FRAC=0.5 / IMIT_TEACHER=pickDeepSaver / IMIT_OVERRIDE=1 / 21 名池
   `random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,ringspam,reflectspam,guardspam,targeter,gunspam,snipespam,gunspam,guardspam`；
   r61fix=模板本体 ‖ v7gf1=模板+池尾 `gunfocus,gunfocus` ‖ v7aim1=gf1 配方+`EPIRUS_IMIT_TEACHER=aimdefender`。
5. **登记口径**：重放件与当年原件字节异（wid 逐位同）⇒ 台账记 `sha-diff-wid-same` + 第 4 列盘上实际 sha；
   `registry.sha256` 永不动（sweep-server-batches.mjs 已改此口径，:156 一带）。

## 按批回执（11-23 深夜更新 → 06:3x 续账）

| 批 | 枚数 | 判 | 配方来源 | 备注 |
|---|---:|---|---|---|
| v7l2c/l2f/l2o/l2s/l2h | 20/18/3/5/3 | ✅ 全中 | era `tools/l2-arms.mjs` ARMS 表逐字 | 已推送 |
| r61fix | 5 | ✅ 全中 | era c2e02d70 标准模板 | 已推送 |
| v7wall1 / v7sub1 | 5/6 | ✅ 全中 | DSH 真命令（WALL_FILTER=1 ‖ curri2+SUB_ONLY） | 已推送 |
| v7aim1 / v7gf1 | 6/5 | ✅ 全中（修复后） | teacher 完整函数名 `pickAimDefender` ‖ era=c7076ac9 未提交工作树裁定 | 已推送 |
| v7curri2 | 6 | ✗ 0/6 归档 | 差一维待探针 | — |
| **wave4 全中** | ~80 | ✅ 全 6/6 或近全 | big1/iso1/new1/new4/new6/press1/fix1/ringT3/role1w/role5/stock1 6/6；f2t 5、wall2 5、f5div3 5、f5t 4、blk1 3/4、w3c 3/4、new2 起 | 6397182d + b54ae0f9 |
| **wave4 归档** | ~60 | ✗ | D/G 猜测行（ringA1/bead15·25·100/bead2/bead3/catE5/protoE/rb1/rb2/new5 系/noteach1 旧版/press2 旧版/ws2 旧版/role12/divK2/t1/seat24b…） | recipe 待修的 5 批走 wave4fix2 |
| **wave4fix2** | 27 | 进行中 | 全量块挖掘纠偏：**w3r1 ✅ 6/6**（POOL16+ROLEW=1，Detached 驱动幸存注册）；noteach1=IMIT_FRAC 0 真相；ws2/role1/press2 带 era 漂移候选 | 台账 06:3x：missing 207→~180 |

**台账口径**（对用户报数只许用这两个）：`missing` 剩余（今夜 375 → 207+，还在降）+ 今夜恢复增量（至 06:3x = 168+）。

## 教训（本轮踩过的 · 含深夜新增）

- **jobs 文件 paths/targets 列空 ⇒ 驱动对每行静默 `continue`，0 登记**——l2c/l2f 两批全中招
  （建文件时台账过滤 bug 所致），产物其实在 worktree 里，靠 `widOf` 逐枚核验 + `tools/land-recovered.mjs --do`
  补登记（自证 wid、按 §7.1 口径写 sha-diff-wid-same、registry 永不动）。规矩：**发批前 awk 验三列非空**。
- **单行 jobs + SHARD=1/TOTAL=2 会把唯一的行过滤掉**——第二次踩同款地雷。规矩：行数 < TOTAL 时一律 SHARD=0，或配哑行。
- **同 era 两批并发必须用不同 shard**（worktree 名含 shard ⇒ 同 shard 同 era 同 worktree ⇒ era 训练锁秒杀第二个）。
- **era 地雷：包 ts(+8h) 早于特征进主线提交 ⇒ 当年在未提交工作树训的**。era 取"特征提交本体"起的候选
  （gf1→c7076ac9）。era 可用对手名单以 runner 的 SSE 报错清单为准（`未知/缺失对手: gunfocus,gunfocus（脚本名可选: …）`）。
- **教师名必须用完整函数名**（`pickAimDefender` 不是 `aimdefender`）：`setImitTeacherByName` 只认
  `BOT_PICKS` 键或全局 `EpirusBots` 函数名；v1.5.134 起 era runner 对解析失败**拒绝跑**（fail-fast，
  np-test 里记着当年"错标签跑完"的事故）。aim1 的 RESEARCH-LOG 写"注册名 aimdefender"是松话。
- **`EPIRUS_BUNDLE_IN` 是死重**：ring2-run.mjs:85 无条件覆写，重放不用传。
- **池字面值四形态**（各 era 稳定）：POOL_E=16 名 ‖ +gunspam=17 ‖ 20 名模板（+gunspam,snipespam,gunspam,guardspam）‖
  22 名 gf1 系（+gunfocus,gunfocus）。`$POOLE` shell 变量 = POOL_E。
- era ring2-run 的产物命名 `<ARM>-<seed>.bak` 与 sweep 驱动的 checkProducts 天然兼容；每 seed 恒拷 BASE
  （RING2_HOT 补丁在旧 era 上无害）。热启动批（t1/u1）的驱动 hot 列已补：拷热包进 worktree + 设 RING2_HOT。

## 下班接着排（优先级）

1. wave2fix（aim1/gf1）→ wave4（50 批/140 枚，先发 33 个命令级批；16 探针批走 `-wave4-probe.tsv`）；
2. T2 链（12 批/33 枚）在 T1 命中后自然解锁；
3. 台账收尾：驱动新代码写的就是 §7.1 口径（sha-diff-wid-same + 盘上 sha），无需事后修正；
4. C 线副轴（style-distance/probe-pool 口径 v2 重测）与铺批错峰。
