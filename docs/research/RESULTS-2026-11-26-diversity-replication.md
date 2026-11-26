# 2026-11-26 池行为多样性与非 DR 底座复现

## 结论

- **家族标签集中不等于行为完全同质，但 DR-R3E 续训族确实更同质**：脚本对手行为向量 L1 的组内中位为 `0.2044`，低于 fam25 其他线 `0.3291` 与 fam24 `0.2983`。
- **单技能 `game` rollout 不是跨底座无条件成立**：同一配方换到 `RG-CN` 后，2P rule 从 `76.2%` 降到 `17.0%`，legacy 从 `19.8%` 降到 `18.2%`，但 `miniT` 仍为 `0` 格 / `0` 次；训练日志显示专科教师键道命中为 `0`。
- 因此本臂的裁定是：**强度保护复现，目标技能注入不成立**。按预注册停止，不测 Arena B、不跑 promote、不入池。

## 一、行为多样性基线

- 输入：当前 34 池成员的 Stage 1 `cells`。
- 向量：只取 10 个脚本对手 × 2/3/5/8 人 × multi/long 的出手键计数，归一为份额后算 pairwise L1。
- 为什么排除真包格：34 份报告虽都写 `fixtureKey=fx-pool1124a`，实际真包对手有 **3 套**（池滚动后 hard 头 4 + soft 头 1 改变），不能混比。脚本对手集合 34/34 完全一致，规则指纹均为 `bfd49045`。
- 这不是“玩家行为”的全量测量，只是**同夹具脚本桌的behavior profile**；真包桌需要重新统一夹具后另测。

| 组 | n | 组内 pairwise L1 中位 | 到组质心 L1 中位 | 最近邻 L1 中位 |
|---|---:|---:|---:|---:|
| 全池 | 34 | 0.3793 | 0.2675 | 0.1369 |
| hard | 17 | 0.3231 | 0.2302 | 0.1256 |
| soft | 17 | 0.4779 | 0.3129 | 0.1370 |
| fam24 | 14 | 0.2983 | 0.2322 | 0.1312 |
| fam25 | 17 | 0.3264 | 0.2423 | 0.1356 |
| **DR-R3E 续训线** | **10** | **0.2044** | **0.1581** | 0.1356 |
| fam25 其他线 | 7 | 0.3291 | 0.2435 | 0.1820 |

最相似对包括 `MT-DR ↔ PUR-2P`（`0.1028`）、`DR-R3E ↔ ROD-DR`（`0.1081`）；全池最相似的是 `nov22-ring3-gd6a18 ↔ R-GD12`（`0.0400`）。这说明“同质核”不只 DR 一家，但 DR 续训族的组内压缩最明显。

证据：[`summary.tsv`](evidence-2026-11-26-diversity/summary.tsv)、[`pairwise-l1.tsv`](evidence-2026-11-26-diversity/pairwise-l1.tsv)、[`per-pack.tsv`](evidence-2026-11-26-diversity/per-pack.tsv)、[`fixture-audit.tsv`](evidence-2026-11-26-diversity/fixture-audit.tsv)。

## 二、非 DR 复现臂

预注册见 [`PREREG-2026-11-26-non-dr-replication.md`](PREREG-2026-11-26-non-dr-replication.md)。

| 项目 | `MT-DR`（DR-R3E 底座） | `nov26-rgcn-minit-s27`（RG-CN 底座） |
|---|---:|---:|
| 血统 | `v92 / S1o / 16561` | `v92 / S1o / 16561` |
| wid | `dc222c8e7a090b40` | `90f9a0662a1b8fc6` |
| 终局 selftest3 | 绿 | 绿 |
| Stage1 脚本 80 格 `miniT` | 5 格 / 35 次 | **0 格 / 0 次** |
| Stage1 全 120 格 `miniT` | 5 格 / 36 次 | **0 格 / 0 次** |
| 2P rule（500g, seed 95001） | 17.4% | **17.0%**（基线 RG-CN 76.2%） |
| 2P legacy（同尺） | 19.2% | **18.2%**（基线 RG-CN 19.8%） |
| 专科教师键道命中 | 784 | **0** |
| 裁定 | 入 hard | **研究淘汰，不入池** |

训练本身成功，候选相对起点改变了 `10393/16561` 个坐标，留出加权似然 `-0.3827 → -0.2612`。失败点不在梯度或血统，而在**教师机会为零**：`minit` 脚本教师在 RG-CN 引发的状态分布里没有给出任何 `miniT` 标签，后续蒸馏只能巩固底座与 2P 教师。

这解释了为什么 2P 大幅改善而目标技能为零：`T65` 的 2P 标签充足，`miniT` 的标签不存在。下一步若继续这条机制，先决条件是**提高目标键的教师命中/状态覆盖**（例如改用密集 `miniT` 包教师或定向状态采集），那会是新机制臂，不能把本臂改写成成功。

## 三、证据与停止边界

- 训练日志：[`train-rgcn-minit.log`](evidence-2026-11-26-diversity/train-rgcn-minit.log)
- 血统与 selftest3：[`selftest3-rgcn-minit.txt`](evidence-2026-11-26-diversity/selftest3-rgcn-minit.txt)
- Stage 1：[`stage1-rgcn-minit.log`](evidence-2026-11-26-diversity/stage1-rgcn-minit.log) 与 [`skill-report/nov26-rgcn-minit-s27.json`](evidence-2026-11-26-diversity/skill-report/nov26-rgcn-minit-s27.json)
- 2P：[`rgcn-base-2p-rule.txt`](evidence-2026-11-26-diversity/rgcn-base-2p-rule.txt)、[`rgcn-minit-2p-rule.txt`](evidence-2026-11-26-diversity/rgcn-minit-2p-rule.txt)、[`rgcn-base-2p-legacy.txt`](evidence-2026-11-26-diversity/rgcn-base-2p-legacy.txt)、[`rgcn-minit-2p-legacy.txt`](evidence-2026-11-26-diversity/rgcn-minit-2p-legacy.txt)
- 按预注册主判据失败后停止：未跑 Arena B、promote、seatKill，也未改池。
