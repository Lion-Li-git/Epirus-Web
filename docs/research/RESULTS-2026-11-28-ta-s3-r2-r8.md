# RESULTS · 2026-11-28 · TA-S3 行为修复 R2–R8

> 基线：v2.1.50 `611d5004`；规则指纹 `c61298e6`。
> 预注册：`PREREG-2026-11-28-ta-s3-r2.md` 至 `PREREG-2026-11-28-ta-s3-r8.md`。
> 结论：R2–R7 均按硬门淘汰；R8 单点 long 八卦阵 modeBias +4 通过结构、Stage 1 与两批人席，`seatKill=0`。

## 1. 结果表

| 臂 | 机制 | Stage 1 | 人席 long 反弹两批 | 裁定 |
|---|---|---|---|---|
| R2 | TA 底座 + TN-S5 Common 行为教师 | 44.08% / union12 | 未跑 | 淘汰：胜率/并集 |
| R3 | TN-S5 底座 + TA 角色教师 | 43.92% / armor14 / tank1 | 未跑 | 淘汰：胜率/角色覆盖 |
| R4 | 70% TA-S3 + 30% TN-S5 权重融合 | 41.67% / armor27 / tank4 / 废89.5% | 未跑 | 淘汰：胜率/坦克/经济 |
| R5 | 只更新 policyHead | 47.42% / union14 / armor99 / tank33 / jin25 | 65.5% / 72.5% | 淘汰：seatKill |
| R6 | 只更新 skillHead | 47.67% / union14 / armor98 / tank33 / jin27 | 66.0% / 74.0% | 淘汰：seatKill |
| R7 | 只训练 long modeBias | 47.67% / union14 / armor97 / tank34 / jin29 | 65.5% / 71.0% | 淘汰：seatKill |
| R8 | modeBias long×bagua 单点 +4 | 46.83% / union15 / armor95 / tank25 / jin19 | **8.0% / 6.5%** | **seatKill=0，进入 promote** |

## 2. R8 机制自证

- 唯一变更坐标：`16510`（`modeBias` 的 `long` 行、`bagua` 键），`0.069483 → 4.069483`，其余权重逐位相同。
- `wid=bbab49f37978aae3`，`v:92 / S1o / 16561`，`selftest3` 六腿全绿。
- 200 局 5P long reflectspam 对照：人类胜率 **67% → 8%**，八卦阵占比 **24.8% → 91.7%**，平均局长 **59.2 → 102.8**。
- Stage 1 角色闭环：tank **176/197（89.3%）**、jinshield **88/158（55.7%）**、armor **253/833（30.4%）**。
- 正式两批人席：long 反弹三格 **8.0% / 6.5%**，按当前 soft 带内参照复算 **`seatKill=0`**。

## 3. Promote、入图与地图修复

`promote --dry --support=2` **0 阻断**：G4/G5 候选自身全过，G5 带档 long 防席夺冠 13%、multi 0%；长程有效技能 4.83、场 B 清场 1.84/局。

`measure-point` 完成测量与入图，但首次 bake 的页检抓到真实交互缺陷：FAM27 新点聚集后，立体地图选中环被后绘邻枚圆盘遮盖，环色占比降至 48%。`viewer.mjs` 改为所有点填充完成后重绘选中/对比环，重烘四视图 **101 PASS / 0 FAIL**。

当前 `TA-S3-R8` 已走完 `pool-add --run-promote --arena=6`，原位替换 `OBS6E9`，池维持 **35 枚（hard 17 / soft 18）**，`pool-add --audit` 为 `bad=[] / seatUnknown=0`。四组阶梯保持 hard < regular < simple：2P rule **29.1% < 40.9% < 54.1%**、2P legacy **19.8% < 25.1% < 26.9%**、5P multi **3.4% < 10.1% < 15.9%**、5P long **2.5% < 8.3% < 11.8%**。发布版本：**v2.1.51**。
