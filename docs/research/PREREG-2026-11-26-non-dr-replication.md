# PREREG · 2026-11-26 · 非 DR 底座复现单技能 `game` rollout

## 问题与已有结论

- 11-26 上午 `MT-DR` 证明：在 `DR-R3E` 上，以 `minit@0.70 + T65(2:standard@0.80)`、`--rolloutMode=game`、单键 `rareOnly=miniT` 可注入 `miniT`，同时把 2P rule 降到 `17.4%`。
- 这不是独立复现：`JN-DR`、`MN-DR`、`PUR-2P` 与它共享 `DR-R3E` 父链。行为基线也显示 DR 续训族内部脚本桌 L1 中位 `0.2044`，低于 fam25 其他线 `0.3291` 与 fam24 `0.2983`。
- 本臂只问：**同一机制换到非 DR 底座 `RG-CN` 是否仍成立**，不重证“蒸馏能注入技能”。

## 唯一控制变量

- 起点：`DR-R3E.bak` → `RG-CN.bak`（`6f926e8b926fa719`）。
- 目标键与教师：`minit@0.70`，桌形 `3:multi,3:long,5:long,8:long`。
- 2P 保护教师：`T65-RINGBEAD@0.80`，桌形 `2:standard`。
- 其余逐字承 `MT-DR`：`groups=2000 / steps=260 / lr=0.0004 / seed=20261127 / objective=cand / dagger=1 / rolloutMode=game / rareOnly=miniT / rareFrac=0.35 / shapeBal=1 / classPow=0.5 / classCap=6 / arenaShapes=2:standard@4,3:multi,5:long@2,8:long`。
- 输出缺省路径：`scratch/arms/nov26-rgcn-minit-s27.bak`。

## 启动前基线

- `RG-CN` 的 `selftest3` 六腿全绿（2026-11-26 14:1x）。
- 2P 同尺基线（`n=2 / standard / 500g / seed=95001`）：rule 替身夺冠 `76.2%`，legacy `19.8%`。
- Arena B 在册：`-1.9914pt`（24 锚，6 seed）。

## 预注册判据

1. 产物必须 `v:92 / S1o / params=16561`；第一枚落盘立即记 `wid` 与 META。
2. 终局 `selftest3` 必须全绿；红则本臂结束，不续训。
3. Stage 1 **脚本对手 80 格**中 `miniT >=3` 格且总命中 `>=20`，才算注入成功。全 120 格只作辅助读数：现有 34 份报告实际混有 3 套真包对手，不能拿来跨包比。
4. 2P rule 同尺改善 `>=10pt`（即 `<=66.2%`），且 legacy 不恶化超过 `5pt`（即 `<=24.8%`）。
5. Arena B 不劣于基线超过 `5pt`（即 `>=-6.9914pt`）。
6. 同时满足 2–5 才称“机制跨底座复现”；只满足 3 称“可注入但强度不成立”；selftest3 红称“不可续训”。本臂只作研究裁定，不自动入池。

## 停止条件

- 上游或终局 `selftest3` 红；
- 第一枚产物血统不符；
- 主判据失败后不扫剂量、不挑快照挽留。
