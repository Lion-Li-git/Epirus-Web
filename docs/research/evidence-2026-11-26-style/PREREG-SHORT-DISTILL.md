# PREREG · 2026-11-26 · 全网络短程蒸馏找绿色风格点

## 前序诊断

- 180 步全网络蒸馏：holo/shift≈14%、L1≈0.34，但 selftest3 红，2P rule 退化。
- skillHead-only：全绿但风格≈0。
- 混合桌 PG：全绿，但塑形命中仅约 0–0.03 次/局，风格≈0。
- 结论：holo/shift 需要密集教师标签；不能靠稀疏 PG 塑形从零学。

## 假设

全网络蒸馏在更短步数/更小学习率下，可在 selftest3 变红前完成风格注入；同时提高 2P 形状权重保护 rule。

## 固定配方

同一 DR-R3E 底座，仅 steps 变化：

- 主教师 `HL-G1`，第二教师 `OBS6E9(shift@0.14)`，T65 `2:standard@0.30`
- `--rareOnly=holo,shift --rareFrac=0.35`
- `--arenaShapes=2:standard@4,3:multi,3:long,5:multi,5:long,8:multi,8:long --shapeBal=1 --classPow=0.5 --classCap=6`
- `--groups=2000 --lr=0.0001 --seed=20261130 --objective=cand --dagger=1 --smoke=40`
- A：`steps=40`；B：`steps=80`
- 输出：`scratch/arms/nov26-util-dr-short40-s30.bak`、`scratch/arms/nov26-util-dr-short80-s30.bak`

## 验收

- 第一枚产物立即验血统与 selftest3。
- Stage 1：holo/shift 各≥3 格、合计≥2.5%、L1≥0.30。
- 2P rule/legacy 各 4 seed；rule 比基座退化≤3pt。
- 若 40/80 都风格不足，不继续加步数；若 80 绿且风格够，复制到 ROD-DR 做独立底座复核。

## 01:40 追加括号（在已知结果后、开跑前写明）

- 40/80 均全绿且 2P 不退：rule `−0.38/−1.70pt`，legacy `−3.10/−3.30pt`；holo/shift 已注入，但到旧 hard 质心 L1 仅 `0.229/0.178`，加入后整池平均 L1 也未上升。
- 已知 180 步（更高 lr）L1=0.344 但 selftest3 红。因此在绿色 80 与红色 180 之间只补 120/140 两个括号点，继续使用 lr=1e-4 与 2P@40%；若 140 仍红或 L1 仍<0.30，停止该路线。
