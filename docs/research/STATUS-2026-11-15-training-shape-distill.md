# STATUS · 2026-11-15 训练交接：分环境拟合、长程反证与当前最佳包

> 范围：v2.0.9 规则/UI 修复已推送；本文件记录之后的训练侧状态。时间：2026-11-15 20:57（Asia/Shanghai）。

## 一、产品侧（已推送 8c58095a）

- 规则引擎三处边界修：`bigTBan` 覆盖多人专用卡、`runBigTBatch` 自指防御族照常判定、`setVoid` 回滚 `guardNext`；`spec 71/71`。
- `checkPack`（v7/v92）拒绝非有限权重；UI 修 2P 单席误报、target2、本机包优先级、导出槽位、结算异常兜底。
- 指纹 `120fca4d → f7f457d3`；2P 槽重测 **98.37%**；3P 槽只刷 meta 指纹（权重未动）。
- CI：gates #623 success、pages #138 success；线上 v2.0.9。
- README 已补 obs6 网络家族（特征维 287 / 参数量 16411 / 逐席 111 + 自状态 116 / 3 席池化 + 交叉注意力），本地提交 `9a3d1e73`，随本次推送。

## 二、训练侧代码（本班新增）

- `training/proto2/supfit-gd.mjs`：`--teacher2Shapes` / `--teacher3Shapes` / `--teacher4Shapes`，值支持 `n` 或 `n:mode`（如 `2:standard` / `5:long`）；`rolloutMode=game` 时按桌形选驾驶教师；t3/t4 允许只设形门不设键道。缺省空集 = 旧路径逐字不变。
- `docs/research/FINDING-2026-11-15-shape-distill.md`：shaped1 配方 + 4N + 长程三连反证。
- `docs/research/PROPOSAL-2026-11-15-collect-jobs.md`：`--collectJobs=W` 提案（先量 collection 占比；当前不是大头；先落 `rareOnly` 密度规则）。

## 三、训练读数（全部 `scratch/arms/`，未进池）

基线 `OBS6E9`：2P 考卷 69.1%；4N cells_S=[0.2408,0.1493,0.2821,0.0543], cells_L=[0.2638,0.0871,0.2411,0.2343], X4P 0.2085/0.2050。

| 包 | 2P 短/长 | 3P 短/长 | 5P 短/长 | 8P 短/长 | X4P 短/长 |
|---|---:|---:|---:|---:|---:|
| **OBS6-SHAPEDIST（best）** | **0.517/0.378** | **0.216/0.221** | **0.263/0.261** | **0.129/0.234** | **0.269/0.264** |
| OBS6-LH6P | 0.578/0.167 | 0.038/0.073 | 0.188/0.175 | 0.089/0.191 | 0.194/0.151 |
| OBS6LH12 | 0.525/0.219 | 0.081/0.071 | 0.223/0.221 | 0.057/0.103 | 0.208/0.166 |
| OBS6LH12R（5:long:r2） | 0.502/0.368 | 0.139/0.059 | 0.254/0.145 | 0.109/0.160 | 0.240/0.159 |
| OBS6-2PDIST（2P-only） | 0.691/0.349 | 0.048/0.097 | 0.164/0.168 | -0.020/0.057 | 0.186/0.161 |

- shaped1：2P 考卷 **89.8%**、7 卡 / 35% 防御、对只防御人机 100% 胜 / 10.2 回合。
- 长程教师三连全部把 3P/5P/8P 拖低；LH12R 富桌把标签 top-1 从 38.8% 拉到 65.5%，但 5P long 部署仍只有 **0.145**（shaped1 0.261）⇒ **长程不是教师标签量的问题**。
- `pg-train --baseline=ridge` 价值容量探针：`xin(80 维) R²=-0.183`、手挑 7 标量 `-0.006` ⇒ 线性价值基线读不动 obs6，已停该 6k 臂；下一步要学习型 critic/value head。
- `--collectJobs` 未实施：shaped 臂 50–140 秒，collection 不是大头；T2-1S 的 65 分钟是空键 rareOnly grind，先落密度规则。

## 四、当前结论

1. **shaped1 是当前最佳一包**：2P 与多人短程同时不亏/上涨；但仍只在 `scratch/arms/`，未进池。
2. **长程规划不能靠换教师/加蒸馏标签合进来**；需要 PG/价值基线/ critic 或状态设计。
3. 2P 与多人用同一池的裁定不变；池准入四列：2P 考卷全 >50% + 3P/5P/8P 不低于 E9 3pt。

## 五、下一步（20:57 晚班续接交接）

> 详表与机制诊断见 [FINDING-2026-11-15-shapedist-v2.md](./FINDING-2026-11-15-shapedist-v2.md)（含 §一–§五完整同尺读数）。本轮已完成两组工作：
>
> **前序基建修复**：
> 1. 修复 `supfit-gd.mjs` 在 `--shapeBal=1` 下 `train0/test` 未按桌形分层切片 Bug，并新增 `--snapEvery` `snap0` 快照；
> 2. 将 `pg-train.mjs` 的 `small` 岭回归价值基线从 7 标量扩为 14 维桌形/残局标量（混桌批内 `R²` 从 `-0.006` 翻正至 `+0.116 / +0.163`）；
>
> **多 `v7` 强包按环境分工蒸馏与同盆子空间合成（`V3a`/`V3b`/`V3c` + `V3S1`–`V3S4` + `V3H1`–`V3H3`）**：
> 3. **多 `v7` 教师突破 `railgun=0` 天花板**：在 $N \le 5$ 引入 `v7` 强包团队（`bundled-champion` 仅锁 `2:standard`；`v7blk1-92` / `U-s205` 管 `2:long/3P/5P` 攻防长盘；`T8-s114` / `Q-s47` 管 `3P/5P` 电磁炮+大雷+聚能环链；`OBS6-SHAPEDIST` 管 `8P`）。实测 **`V3a`（r1）** 在 `5:long` 80 局打出 **`score=0.320, railgun=20, bigT=4, ring=1`**（`5:multi score=0.320, railgun=10`），**`V3b`（r1）** 打出 **`2:long 0.850（bigT=68, railgun=7）`** 与 `5:long` **`bigT=35, railgun=17, ring=3`**，而 **`V3a.snap0` / `V3c`** 分别把 **2P 20×120 考卷推高到 `91.1%` / `91.6%`**。
> 4. **同盆权重融合 + 子空间路由刷新短/长/记忆三项全史新高**：
>    - **`OBS6-SHAPEDIST-V3S2`**（同盆 6 粒融合）：4N **短 C = `0.2761`**（较 `SHAPEDIST 0.2454` `+3.07pt`）、4N **长 C = `0.2465`**（2/3/5/8 四格全正：`0.385/0.268/0.167/0.167`）、`2:long 0.900`、`mem-probe-e6 R 90.3% / H 76.8%`、2P `87.2%`；
>    - **`OBS6-SHAPEDIST-V3S3`**：`mem-probe-e6 R 96.1% / H 81.3%`（全库 R+H 最高）、2P `89.1%`；
>    - **`OBS6-SHAPEDIST-V3H3`**（融合主干 + `skillHead`/`actEnc` 89 维技能子空间路由）：4N **短 A/B/C = `0.3410 / 0.3557 / 0.3483`**（较 `SHAPEDIST` `+10.29pt`、较 `V2.snap0` `+5.73pt`，四格人数 `0.756/0.259/0.211/0.167` 全正），且 `5:long` 保持 `0.234`（`ring=1`）；
>    - 诊断边界：`v7` 占 `3P/5P` 96% 时会稀释抗 `obs5/obs6`（B 轴）与跨回合记忆（`mem R`）；而融合后直接替换 `skillHead` 会因 `hctx` 基旋转无法直接激活 20 发 `railgun`。
>
> **下一步动作**：
> 1. 以 `OBS6-SHAPEDIST-V3S2` 或 `V3H3` 为起点，用 `V2.snap0` 占主干（50–60%）+ `bundled-2p@0.70`（仅 `2:standard`）+ `v7blk1-92@0.35` + `T8-s114`/`Q-s47` 配 `--rareOnly=ring,railgun,bigT --rareFrac=0.22 --classPow=0.35 --classCap=5 --lr=0.0005 --steps=180 --dagger=0` 做端到端稀有链+主干对齐（让 `hctx` 与 `skillHead` 同基收敛）；
> 2. 从对齐产物（或 `V3S2` / `V3a`）接 `pg-train --baseline=ridge --ridgeFeat=small --ridgeL2=0.1 --anchorWeight=0.25`（提高 `2:standard` 抽样占比并保留 `2:standard` 回锚），将短/长/链/记忆合一入池竞争。
> 3. `2:standard` 正式进 `arena2.SHAPES`（新列族 §E597），训练/考卷同形；验收固定四列与 `champ=MSB15R-HITMIX,GD6a-TILT,Q-s47` 同看。

## 六、提交账

- `8c58095a` v2.0.9（已推送；规则/UI 修复 + 2P 98.37% + 指纹）。
- `9a3d1e73` README obs6 + FINDING 初版 + `--teacher2Shapes`（本次推送）。
- `335752ac` t2/t3/t4 形门 + 按桌形选驾驶教师 + 长程三连反证 + collectJobs 提案（本次推送）。
- 本文件（本次推送）。
