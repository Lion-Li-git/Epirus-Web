# STATUS · 2026-11-15 训练交接：分环境拟合、长程反证与当前最佳包

> 范围：v2.0.9 规则/UI 修复已推送；本文件记录之后的训练侧状态。时间：2026-11-15 18:4x（Asia/Shanghai）。

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

## 五、下一步

1. 结构提案：`pg-train` 的学习型 MLP value head（`--baseline=mlp`），先做价值容量探针；R² 不过 0 不进训练。
2. shaped1 `groups=2400 + dagger=1`，补 5P 短 −0.020 与 `guardgun/reflectmix`。
3. `2:standard` 正式进 `arena2.SHAPES`（新列族 §E597），训练/考卷同形。
4. `rareOnly` 只对自然密度 >0 的键开；`collectJobs` 先计时后实现。

## 六、提交账

- `8c58095a` v2.0.9（已推送；规则/UI 修复 + 2P 98.37% + 指纹）。
- `9a3d1e73` README obs6 + FINDING 初版 + `--teacher2Shapes`（本次推送）。
- `335752ac` t2/t3/t4 形门 + 按桌形选驾驶教师 + 长程三连反证 + collectJobs 提案（本次推送）。
- 本文件（本次推送）。
