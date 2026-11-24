# RESULTS · 2026-11-25 冠军池优化通宵班

> 规则指纹 `bfd49045`；基线 `4dac3adb`；工作区间 00:56–07:25。
> 本轮唯一池成员新增：`T65-RINGBEAD`（hard）。其余训练结果只作候选/研究，不入池。

## 1. `t65` 入池

- 完整链：promote dry → `measure-point --bake` → `pool-add --arena=6` → bundle/skill-page/map 重烘 → pool audit/probe-pool/D234/ship-pool/四视图验证。
- 池成员 **23→24（hard 12→13）**。
- `wid=00065fc589070d4e`；Stage1 并集 **19/30**；Arena 六粒中位 **+16.56pt**。
- promote dry：G4/G5 零阻断、花珠率 **80.3%**、环@安全窗口 **7.7%**。
- 两批 200 局人席电池已补：`seatKill=0`；`selftest3` 红只限制续训，不否决冻结推理包。
- 2P 辅助训练的最终可用解是 **65% RING-MINIT + 35% 珠经济/天火保护臂的权重融合**：产品 `2:standard` rule 替身 **21.6–24.2%**、legacy **18.2–18.7%**；5P 花珠 **79.8% / 81.7%**、天火局闭环 **20%**、ring 15、promote dry 全过。此前 FC-G1/v7 强教师蒸馏、2P 配额加权和直接 PG 都未稳定改善产品 standard；Arena B 的 2P 格是 `multi`，与产品 `standard` 分列。

## 2. 池缺口现读

- hard `laserEye`：21/198 格，唯一格载体 `RING-MINIT-CONT`，2 席完全为零。
- soft `ring`：92/2121 格，2 席仅 `TN35` 与带伤的 `rod` 两载体。
- hard 另有 `dualGun` / `purify` 未跨格阈；soft 两带并集差异不构成“缺一整个技能”。

## 3. 激光眼训练

| 候选 | wid | laser 格/手 | Arena 相对基座 | promote | 结论 |
|---|---|---:|---:|---|---|
| `LE40-PG2k-s25` | `e8f8bd8f869833fd` | 29 / 1,049 | **+4.35pt（5/6 正）** | 过 | soft 激光专长副产物 |
| `LE40-PG2k-s26` | `34435c956f0d6203` | 31 / 947 | **+2.83pt（5/6 正）** | 过 | 复现成立，仍偏 soft |
| `RING-MINIT + laser0.20` | `1a7ad978a4711c49` 等 | 78 / 1,356 | −6.14pt | 过 | 2P rule 77–80%，淘汰 hard |
| `RING-MINIT PG seg1000` | `a4f25d3b589024e8` | 20 / 185 | **−3.53pt（5/6 反号）** | 过 | 人席与基座持平、G5 过，但 Arena 未达 hard |
| `RING-MINIT PG KL8 seg1000` | `8ac5ba861e369a31` | **21 / 187** | **−2.39pt（3/6 反号）** | 过 | hard 池配对 +0.50/+1.50pt（200 盐；long 未显著）；`selftest3` 腿 C 红 |
| `RING-MINIT PG KL8 s28 seg1000` | `9ece28daf03dfdb0` | 18 / 188 | **−5.25pt（5/6 反号）** | 过 | hard 池 0.00/0.00pt；long 只防御人席 27%（基座 5.5%），强度未复现 |
| `KL8 + 基座融合 25%` | `538f38e299c8ddd4` | 21 / 196 | **−1.06pt（3/6 反号）** | 过 | hard 池 −1.00/+1.00pt；人席无独立改善；`selftest3` 腿 C 红 |
| `KL8 + 基座融合 50%` | `851edac3888fb886` | 21 / 202 | −1.53pt（4/6 反号） | 过 | 覆盖保持，强度仍无正向证据 |
| `KL8 + 基座融合 75%` | `d06bbf21a1d9ca19` | 21 / 203 | −2.59pt（5/6 反号） | 过 | 覆盖保持，强度仍无正向证据 |
| `RG-CN + laser0.08` | — | 30 / 722 | +3.94pt | 过 | 2P 两把替身均退，淘汰 hard |
| `LE40 完整教师回蒸` | — | 0–1 格 | — | — | 当前底座采不到 laser 标签 |

结论：**没有可直接入池的 hard 激光眼候选**。两粒 `LE40-PG2k` 是当前最稳定的激光眼副产物，Arena 与 promote 都成立，但 5P 人席仍约 14–18%，符合 soft 定位。PG2k 直接续训会被 cannon 并列 logit 的 `selftest3` 腿 F 拦住；回蒸到干净 LE40 又会丢 laser。更强 KL 的两粒 `RING-MINIT PG KL8 seg1000` 把 laser 复现到 **21 / 18 格**，promote 都过；hard 池 200 盐配对第一粒 **+0.50/+1.50pt**、第二粒 **0.00/0.00pt**，Arena 两粒 **−2.39 / −5.25pt**。覆盖成立，强度增益不成立；两粒 `selftest3` 均仅腿 C 在小梯度处红，故都只作冻结推理研究候选。25/50/75% 基座融合都保住 21 个 laser 格与 promote，Arena 损失收窄到 −1.06/−1.53/−2.59pt；最佳 25% 融合的 hard 池为 −1.00/+1.00pt、人席无独立改善，`selftest3` 仍腿 C 红。融合只能缓冲强度损失，不能形成 hard 增益。

## 4. 聚能环训练

按用户裁定，soft 不再专门立项，只接收强包扩广度后强度落差的副产物。

| 候选 | wid | ring 格/手 | Arena 相对 c3g 基座 | promote | 结论 |
|---|---|---:|---:|---|---|
| `soft-ring-c3g-s25` | `8c7030eb03258b17` | 41 / 1,726 | **+2.71pt** | 过 | soft 环副产物 |
| `soft-ring-c3g-s26` | `0926c583b9f7e9ba` | 43 / 1,633 | **+1.58pt** | 过 | 复现成立 |

两粒天火局闭环 **94% / 96%**，环@安全窗口 **29.3% / 36.4%**。2P rule 替身较强（12–17%），5P 两粒分化明显，保留为 soft 研究候选。

## 5. 其他缺口

- `purify@0.30`（EQ-S4-E9）：purify 4 格 / 23 手，promote 因 G5[long]=28% 阻断。
- `dualGun`：38.4k 组 multi 专属长臂把教师标签从 22 增到 **101**，但留出 9 条只命中 1 条；Stage1 仍 **0 格 / 5 手**。Arena 相对 RG-CN **+2.40pt（4/6 正）**、promote 过，但 ring 25→7、railgun 8→1，未获得双枪部署覆盖。直接回报 PG（5000 局）更从第一步起 `dualGun=0.00`，Stage1 **0 格 / 0 手**、Arena **−0.73pt（5/6 反号）**；奖励从未拿到样本。菜单级探查显示 RG-CN 在 20 局 316 个决策里双枪只合法 **5 次**，全决策平均概率约 **5×10⁻²⁰**、合法时均值 **3.16×10⁻¹⁸**；历史教师 TN35 同尺为 **5/218 次合法、全决策 1.28×10⁻⁴、合法时 0.558%、最大 2.64%**，确有教学信号。4×/20×/1e20× 键锚仍全部 0 命中、Stage1 0 格；同数据同教师的 `key` 目标 A/B 避开已登记的 `pack:` 教师 + `objective=cand` 第 0 席锁定偏差，P-A1 达标、双枪标签 37 条，把全决策概率拉到 **6.34×10⁻⁹**、Stage1 **0 格 / 12 手**。该键级副产物 Arena **+6.75pt（5/6 正）**、hard 池 **+5.50/+2.00pt**、5P 人席 long 最高 **0.5%**、promote 过，是本轮最强 hard 研究候选；但 `selftest3` 腿 F 被 curse 并列 logit 拦住，双枪目标仍未解决，按授权不入池。
- 因此不再加教师或扫剂量，hard 剩余缺口转为方法问题：激光眼需要能同时优化真包强度与脚本人席的目标，dualGun 需要先解决状态可达性。

## 6. 真实 Chrome 验证

候选包注入页面本机槽后，5 人局均正常推进并终局，0 JS 错误：

- `T65-RINGBEAD`：24 回合、16 次伤害。
- `LE40-PG2k-s25`：21 回合、18 次伤害、6 次聚能环。
- `soft-ring-c3g-s26`：20 回合、15 次伤害。
- `laser-ringbase-kl8-seg1000`：16 回合、12 次伤害、2 次聚能环，0 JS 错误；单局 laser 未出现，覆盖结论以 120 格 Stage1 为准。
- `laser-kl8-fuse25`：30 回合、16 次伤害，0 JS 错误；单局 laser/ring 未出现，覆盖结论以 120 格 Stage1 为准。
- `dualgun-keyobj`：20 回合、14 次伤害，0 JS 错误；单局 dualGun 未出现，覆盖结论以 120 格 Stage1 为准。

浏览器探针：`scratch/browser-candidate-test.mjs`；回执与候选汇总见 `docs/research/evidence-2026-11-25-pool/`。

## 6.5 后段追加

- 训练 roster 新增 `human:rule` / `human:legacy`，复用 `tools/human-pool.mjs`；D209 与 probe-libs 定向通过，未知人名 exit 2。
- 从 LE40 直接对人席原型做 10k PG：laser 覆盖 25–29 格，但 5P 人席约 14–17%，Arena 相对基座仅 +0.57 / −0.81pt，未改善目标错位。
- `RING-MINIT` 自身 laser 稀有富集只到 1 格 / 5 手；`purify@0.30` 的 5k PG 把 G5[long] 从 28% 修到 27%，仍未过线。
- 更强 KL 臂 `laser-ringbase-kl8-seg1000`：Stage1 laser **21 格 / 187 手**、promote 全过；hard 池 200 盐配对 multi **+0.50pt**、long **+1.50pt（未显著）**，Arena **−2.39pt（3/6 反号）**。`selftest3` 仅腿 C 在小梯度处红，冻结推理可用，直接续训仍被拦。
- 第二粒 `laser-ringbase-kl8-s28-seg1000`：laser **18 格 / 188 手**、promote 全过；hard 池两模式均 **0.00pt**，Arena **−5.25pt（5/6 反号）**，long 只防御人席 **27%**（基座 5.5%）。两粒证明激光覆盖可复现，但强度增益不可复现。
- 25/50/75% 基座融合均保持 **21 个 laser 格**、promote 全过；Arena **−1.06/−1.53/−2.59pt**。最佳 25% 融合 hard 池 **−1.00/+1.00pt**、人席无独立改善，`selftest3` 腿 C 红；停止扫融合比例。
- `dualGun` 限定 3/5/8 人 multi 桌后，9.6k 组采到 22 条标签、部署 3 次，但未达格阈；38.4k 组长臂得到 101 条标签、留出 9 条命中 1 条，Stage1 仍 0 格 / 5 手。Arena +2.40pt 但 ring/railgun 覆盖退步，判定为“标签可喂、部署未学会”。直接回报 PG 5000 局全程 0 次命中、Stage1 0 格/0 手、Arena −0.73pt；菜单探查只 5/316 次合法、概率约 5×10⁻²⁰，4×/20×/1e20× 键锚也全部 0 命中。键级目标 A/B 把概率拉到 6.34×10⁻⁹、Stage1 0 格/12 手，并得到 Arena +6.75pt、hard 池 +5.50/+2.00pt、人席 long ≤0.5% 的强副产物；但双枪仍 0 格，且产物 `selftest3` 腿 F 红，不能直接续训。

## 7. 决定

- **只入池 `T65-RINGBEAD`**；不改其他成员、不退役。
- hard 激光眼本轮未解决；soft 激光眼与 soft 环各有两粒可复现副产物，留作后续候选。
- `dualgun-keyobj` 是本轮最强 hard 研究候选（Arena +6.75pt、hard 池 +5.50/+2.00pt、人席 long ≤0.5%），但双枪仍 0 格且 `selftest3` 腿 F 红；按授权只记录，不入池。
- 下一轮优先：hard 激光眼换第二基座或改目标函数；KL8 已证明 laser 覆盖可复现，但两粒强度增益都未成立；融合也只缓冲损失，不再加同一配方 seed 或扫比例。
