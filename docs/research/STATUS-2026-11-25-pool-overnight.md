# STATUS · 2026-11-25 池优化通宵班（00:56 → 05:12）

> 基线：`4dac3adb`；规则指纹 `bfd49045`。
> 用户授权：`t65` 入池；自主研究 hard 带 laserEye、soft 带 ring 与其余可优化训练点；实机迭代，中间不提问。
> 红线：不 push；不擅自退役现役成员；训练启动先过 `selftest3`；并行子进程 ≤2。

## DONE

### 池成员新增

- `T65-RINGBEAD` 完整入池链完成：promote dry → `measure-point --bake` → `pool-add --tier=hard --arena=6` → bundle/skill-page/map 重烘 → pool audit/probe-pool/D234/ship-pool/四视图验证。
- 池成员 **23→24（hard 12→13）**。
- `wid=00065fc589070d4e`；Stage1 并集 **19/30**；Arena 六粒中位 **+16.56pt**。
- promote dry：G4/G5 零阻断、花珠率 **80.3%**、环@安全窗口 **7.7%**。
- `seatKill=-1`（未测，表内如实记录）；`selftest3` 红只限制续训，不否决冻结推理包。

### 池缺口

- hard `laserEye`：21/198 格，唯一格载体 `RING-MINIT-CONT`，2 席完全为零。
- soft `ring`：92/2121 格，2 席仅 `TN35` 与带伤的 `rod` 两载体。
- hard `dualGun` / `purify` 未跨格阈。

### 训练结果

- **hard laserEye 没有干净候选**。built-in 激光教师剂量扫描、完整 LE40 教师、RG-CN/RING-MINIT 底座、KL PG 均未同时保住 2P/5P 强度。
- **soft laserEye 副产物两粒复现**：`LE40-PG2k-s25/s26`，laser 29/31 格，Arena 相对 LE40 **+4.35 / +2.83pt（各 5/6 正）**，promote 均过；5P 人席仍约 14–18%，符合 soft 定位。
- **soft ring 副产物两粒复现**：`c3g + ringEcon`，ring 41/43 格，Arena 相对 c3g **+2.71 / +1.58pt**，promote 均过，天火局闭环 94%/96%。
- `purify@0.30` 只有 4 格/23 手且 G5[long]=28% 阻断；`dualGun` 两条教师路线均零标签。
- 按用户裁定，soft 不再专门训练，只接收强包扩广度后强度落差的副产物。

### 真实浏览器

候选包注入页面本机槽后，5 人局均正常终局、0 JS 错误：

- `T65-RINGBEAD`：24 回合、16 次伤害。
- `LE40-PG2k-s25`：21 回合、18 次伤害、6 次聚能环。
- `soft-ring-c3g-s26`：20 回合、15 次伤害。

## 验证

- pool audit：24 枚、hard 13/soft 11、untracked 0、dupWid 0、blockedAuto 0、seatUnknown 1。
- `pool-sync --check`、`validate --strict`、`check-lineage` 全绿。
- `np --group=ui`：**55/55**（定向，不是整轮）。
- `spec-run`：**81/81**。
- `smoke` / `battle`：均 `SUMMARY OK`。
- 四视图：各 **100 PASS / 0 FAIL**。
- `git diff --check` 通过；TSV 行尾空列 tab 已在 `.gitattributes` 标为列结构，不按行尾空白告警。

## 决定

- **只入池 `T65-RINGBEAD`**；不改其他成员、不退役、不 push。
- hard 激光眼本轮未解决；soft 激光眼与 soft 环各有两粒可复现副产物，留作后续候选。
- 下一轮优先：激光眼副产物换第二基座或做 2P/5P 分工；dualGun 先解决状态可达性，不再重复本轮教师剂量扫描。

## 产物

- 结果报告：`docs/research/RESULTS-2026-11-25-pool-optimization.md`
- 证据：`docs/research/evidence-2026-11-25-pool/`
- 训练与评测原件：`scratch/arms/nov25-*`、`scratch/nov25-*`
