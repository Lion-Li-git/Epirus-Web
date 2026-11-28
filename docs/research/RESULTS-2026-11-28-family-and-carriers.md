# RESULTS · 2026-11-28 · 家族收敛与 5P multi 低废替身

> 完成时间：2026-11-28 15:05（UTC+8）。
> 预注册：[`PREREG-2026-11-28-5p-multi-carriers.md`](PREREG-2026-11-28-5p-multi-carriers.md)。
> 池与规则指纹未改：35 枚 `hard 17 / soft 18`，`c61298e6`。

## 1. 家族收敛

不新增家族号，最终只保留 23/24/25 三个 obs6.5 家族：

| 家族 | 枚数 | 内容 |
|---|---:|---|
| 23 | 35 | V3/统一单包 + 从 24 回迁的专项补盲与部分防御载体 |
| 24 | 19 | MX 矩阵与 PG-mean 覆盖核心 |
| 25 | 46 | 强包底座、DR 派生、LE/PH 岭基线角色分担 |
| 26 | 0 | LE/PH 已并入 25，空号不保留 |

51 行迁移计划见 `evidence-2026-11-27-overnight-qwen/family-consolidation-2026-11-28.tsv`。`registry.tsv` 与 `lineage.tsv` 已同步，地图四视图各 `101 PASS / 0 FAIL`。

## 2. 开臂前诊断

200 局 5P multi、4 脚本对手、逐局配对：

| 臂 | ban 键组 | 平均 Δ | 对手同向 | 裁定 |
|---|---|---:|---:|---|
| AM | snipe/armor/gun/reflect | −18.25pt | 4/4 | 开臂 |
| TF | gun/reflect/guard | −18.50pt | 4/4 | 开臂 |

原始件：`carrier-ban-diagnostic.{json,tsv}`。

## 3. 训练结果

两臂共同底座 `L1B-S1200`，共同参数：`groups=1000, steps=80, lr=1e-4, dagger=0, teacher2frac=0.10, teacher2Shapes=5:multi`。

### AM-CARRIER

- `wid=edb5036e4d883409`，`v:92 / S1o / 16561`；
- 终点 `selftest3` 腿 C 红，解析梯度大量对不上数值 0；
- 按预注册立即止损，未跑 Stage 1、promote 或人席。

### TF-CARRIER

- `wid=f7fa38bcfebff2c7`，`v:92 / S1o / 16561`，`selftest3` 六腿全绿；
- Stage 1：胜率 `51.58%→54.75%`，废珠 `14.63%→7.14%`，花珠 `69→64`（保留底座 92.8%）；
- 目标覆盖：gun `114→117`、reflect `91→94`、guard `55→60`；
- 5P multi 400 局配对：相对底座 `+0.25pt`，相对原教师 `+4.56pt`，4/4 对手不差于底座；
- 护栏：2P rule `−1.65pt`、2P legacy `−1.93pt`、5P long `−0.25pt`（负值 = AI 变强）；
- 人席 90210/90211 均显著强于底座；
- **promote 阻断**：场 B 清场 `0.04/局 < 0.3/局`，按预注册淘汰，不入池。

## 4. 裁定

- AM 因结构红淘汰；TF 虽达到 5P multi 替身目标，但过不了产品行为门。
- 两臂都未入池，池成员与顺序不变。
- “常见键角色替身”方向按预注册收口，不转 PG、不扫 lr/frac/seed 挽救。
- 下一轮若继续，需要先解决“5P multi 强度与场 B 清场”的同时约束，不能只追单一 5P multi 读数。
