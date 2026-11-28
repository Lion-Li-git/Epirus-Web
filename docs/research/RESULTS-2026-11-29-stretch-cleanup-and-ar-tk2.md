# RESULTS · 2026-11-29 · Stretch 清理与 `AR-TK2` 监测

> 完成时间：2026-11-29 01:15（UTC+8）。
> 基线：`main@b88d775b`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。

## 1. `scratch/` 隔离清理

- 对账 `champion-map/data/registry.tsv` 与 `champion-map/data/page/lineage.tsv`，收集所有 `scratch/` 精确路径引用。
- 以 `2026-11-22 00:00 +08:00` 为超期线，只允许“目录内无任何在册引用且最新 mtime 早于 cutoff”的整目录迁移。
- 命中 4 个目录、52 个文件、35,020,408 字节：
  - `scratch/session-mined`
  - `scratch/qoder-1120-recipemine`
  - `scratch/command-checkup`
  - `scratch/dsh-mined`
- 已保持原相对路径整体移到：

  `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-29-scratch\scratch\`

- SHA256 清单：[`scratch-cleanup-manifest.json`](evidence-2026-11-28-overnight-qwen/scratch-cleanup-manifest.json)；全量审计：[`scratch-cleanup-audit.json`](evidence-2026-11-28-overnight-qwen/scratch-cleanup-audit.json)。
- `scratch/` 从 476MB 降到 443MB；没有物理删除任何文件。

## 2. `AR-TK2` 4P/5P 角色监测

`Δ = 摘除 AR-TK2 − BASE`，2 seed × 400 局；正值 = 摘除后替身夺冠上升 = AI 变弱。

| 配置 | Δregular | Δsparring | 读法 |
|---|---:|---:|---|
| 4P multi | −0.75 | +1.50 | regular 变强、sparring 变弱，方向混合 |
| 4P long | +0.88 | +1.13 | 摘除后两档都变弱，AR-TK2 有正贡献 |
| 5P multi | −1.50 | +0.13 | regular 明显变强，sparring 基本不变 |
| 5P long | −1.75 | +1.63 | regular 变强、sparring 变弱，方向混合 |

覆盖深度：`AR-TK2` 当前 `armor=120/120`、`tank=22/120`、Stage 1 胜率 `39.92%`，电珠废珠 `1531/1574=97.27%`。

**裁定：保留。** 它不再是 soft 唯一 armor/tank 载体，但摘除后 4P long 两档同向变弱、5P regular 两档同向变强，说明仍承担真实难度角色；高废珠是缺陷，但不能据此直接退役。本轮不开训练、不改池。

证据：[`ar-tk2-loo-4p.json`](evidence-2026-11-28-overnight-qwen/ar-tk2-loo-4p.json)、[`ar-tk2-loo-5p.json`](evidence-2026-11-28-overnight-qwen/ar-tk2-loo-5p.json) 与 16 份逐 seed 原始格。

## 3. `dualGun/mirror`

未重复运行诊断：[`RESULTS-2026-11-28-dualgun-mirror.md`](RESULTS-2026-11-28-dualgun-mirror.md) 已完成 35 池运行时状态窗与选择统计，结论仍有效；用户已明确其优先级低，本班不开训练、不入池、不改规则。
