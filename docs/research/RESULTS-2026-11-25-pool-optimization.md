# RESULTS · 2026-11-25 冠军池优化通宵班

> 规则指纹 `bfd49045`；基线 `4dac3adb`；工作区间 00:56–05:10。
> 本轮唯一池成员新增：`T65-RINGBEAD`（hard）。其余训练结果只作候选/研究，不入池。

## 1. `t65` 入池

- 完整链：promote dry → `measure-point --bake` → `pool-add --arena=6` → bundle/skill-page/map 重烘 → pool audit/probe-pool/D234/ship-pool/四视图验证。
- 池成员 **23→24（hard 12→13）**。
- `wid=00065fc589070d4e`；Stage1 并集 **19/30**；Arena 六粒中位 **+16.56pt**。
- promote dry：G4/G5 零阻断、花珠率 **80.3%**、环@安全窗口 **7.7%**。
- `seatKill=-1`（未测，表内如实记录）；`selftest3` 红只限制续训，不否决冻结推理包。

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
| `RG-CN + laser0.08` | — | 30 / 722 | +3.94pt | 过 | 2P 两把替身均退，淘汰 hard |
| `LE40 完整教师回蒸` | — | 0–1 格 | — | — | 当前底座采不到 laser 标签 |

结论：**没有新的 hard 激光眼候选**。两粒 `LE40-PG2k` 是当前最稳定的激光眼副产物，Arena 与 promote 都成立，但 5P 人席仍约 14–18%，符合 soft 定位。PG2k 直接续训会被 cannon 并列 logit 的 `selftest3` 腿 F 拦住；回蒸到干净 LE40 又会丢 laser。

## 4. 聚能环训练

按用户裁定，soft 不再专门立项，只接收强包扩广度后强度落差的副产物。

| 候选 | wid | ring 格/手 | Arena 相对 c3g 基座 | promote | 结论 |
|---|---|---:|---:|---|---|
| `soft-ring-c3g-s25` | `8c7030eb03258b17` | 41 / 1,726 | **+2.71pt** | 过 | soft 环副产物 |
| `soft-ring-c3g-s26` | `0926c583b9f7e9ba` | 43 / 1,633 | **+1.58pt** | 过 | 复现成立 |

两粒天火局闭环 **94% / 96%**，环@安全窗口 **29.3% / 36.4%**。2P rule 替身较强（12–17%），5P 两粒分化明显，保留为 soft 研究候选。

## 5. 其他缺口

- `purify@0.30`（EQ-S4-E9）：purify 4 格 / 23 手，promote 因 G5[long]=28% 阻断。
- `dualGun`：TN35 键道与完整教师均采不到标签，本轮未解决。
- 因此不再加教师或扫剂量，hard 剩余缺口转为方法问题：激光眼需要能同时优化真包强度与脚本人席的目标，dualGun 需要先解决状态可达性。

## 6. 真实 Chrome 验证

候选包注入页面本机槽后，5 人局均正常推进并终局，0 JS 错误：

- `T65-RINGBEAD`：24 回合、16 次伤害。
- `LE40-PG2k-s25`：21 回合、18 次伤害、6 次聚能环。
- `soft-ring-c3g-s26`：20 回合、15 次伤害。

浏览器探针：`scratch/browser-candidate-test.mjs`；回执与候选汇总见 `docs/research/evidence-2026-11-25-pool/`。

## 7. 决定

- **只入池 `T65-RINGBEAD`**；不改其他成员、不退役。
- hard 激光眼本轮未解决；soft 激光眼与 soft 环各有两粒可复现副产物，留作后续候选。
- 下一轮优先：给激光眼副产物换第二基座或直接做 2P/5P 分工，不再重复本轮教师剂量扫描。
