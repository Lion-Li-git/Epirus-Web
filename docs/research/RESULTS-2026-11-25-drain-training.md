# RESULTS · 2026-11-25 摄魂强包训练

## 目标与基线

目标：补 hard 带有效 `drain` 覆盖，同时不牺牲强度、2P 与珠经济。

- `drain` = 摄魂指法，3 EP、1 伤、命中自愈 1；multi 仅目标 HP≤1，long 为 HP≤2。
- hard 原有有效载体只剩 `RING-MINIT-CONT`（17 格 / 101 手），但它 `seatKill=2`、ArenaB +2.30pt；`T65-RINGBEAD` 仅 1 格 / 11 手。
- `FS2-LE26`：ArenaB +14.52pt、`seatKill=0`、2P rule/legacy 22.2%/21.4%，但 drain 为 0，适合强底座。
- `TZ2C`：标准场 drain 0.225/0.675，敌意场 1.875/0.550；`selftest3` 腿 C 红，只能作冻结教师。

## 实验总账

| 臂 | 结果 | 判定 |
|---|---|---|
| FS2 + TZ2C drain + T65 2P | drain 标签 144、留出 36；实战标准场 0/0.025、敌意场 0/0；激光眼塌 | 失败：教师标签没有转成部署 |
| RING + FS2 + TZ2C + RING 自锚 | `teacher2Groups=0`，珠过期 7.3/局，exit 14 | 失败：教师调度饥饿 |
| RING + FS2 + TZ2C + T65 | drain 标签 144、留出 67%；珠过期 6.0/局，exit 14 | 失败：强度教师洗坏珠经济 |
| RING 自锚 + TZ2C drain + T65 | drain 标签 167、留出 70%；标准场 0.225/0.375、敌意场 0.650/0.675；珠过期 1.7/局 | **成功补盲，但仍是 soft 强度** |
| 上臂锚定 PG（klW0.30 / dmgW0.005） | 各快照均保住 drain；G4 只狙击约 88%、G5 long 约 60%；seg400 ArenaB −1.89，long 纯反弹人席 43.5% | 失败：没有修复清场，强度反退 |
| FS2 + TZ2C + DAgger1 | 学生自访留出 81.1%，但实战标准场 drain 2.5%、敌意场 0；激光眼仍为 0 | 失败：DAgger 未修复部署 |

## 最佳候选

`DRAIN-SOFT-SELF.bak`（wid 与 `scratch/arms/nov25-ring-drain-self-s20261127.bak` 逐位相同）：

- 摄魂 mastery 双场过线；环与大雷保住。
- 2P standard 替身：rule 均值 24.8%，legacy 18.5%；均优于 RING 基线 35.15%/18.7%。
- ArenaB 六 seed 中位 +2.23pt，未达 hard。
- promote 被 G4 只狙击 81.7%、G5 long 61% 阻断。
- 人席 long 纯反弹 39–40%，仍是软包形状。

因此保留为 **soft 反应型摄魂研究候选**，不入池、不改现役成员。

## 结论与停线

1. 单步奖励路线早已判死；本轮再次确认不能靠加摄魂奖励解决。
2. 强底座 FS2 能采到摄魂标签，但不会自然走到部署窗口；DAgger 也没解决。
3. RING 自锚能把摄魂推过 mastery，但强度与清场是独立问题；低剂量锚定 PG 只保行为，不修 G4/G5。
4. 不再扫教师份额、seed 或 PG 剂量。下一轮要换机制：要么找“强且原生会 drain”的底座，要么做残血留 EP 的序列/状态干预。
5. `supfit-gd` 新增教师调度饥饿 fail-fast：配置的 teacher2/3/4 分到 0 组时 `exit 15`，不再静默训练。
