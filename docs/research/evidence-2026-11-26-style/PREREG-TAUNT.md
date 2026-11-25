# PREREG · 2026-11-26 · taunt 外围控制轴短程蒸馏

## 为什么换目标

- holo/shift 路线在绿色短程点能修复 2P，但候选到 hard 质心 L1 最高仅 0.230，加入后整池平均 L1 不升；按预注册停止。
- hard 的 taunt 份额仅 0.91%，唯一强载体 `nov21-taunt-dsp0b` 本身到质心 L1=0.368，是现成的外围控制轴。
- 假设：短程蒸馏 taunt 能增加控制深度并保持外围风格，同时 2P@40% 避免前一轮的 rule 退化。

## 固定配方

两个独立绿色底座各一臂，除 upstream/out/tag 外逐字相同：

- 底座：`DR-R3E.bak`、`ROD-DR.bak`
- 主教师：`pack:docs/artifacts/nov21-taunt-dsp0b.bak`
- 2P 教师：`T65-RINGBEAD`，`2:standard@0.30`
- `--rareOnly=taunt --rareFrac=0.35`
- `--arenaShapes=2:standard@4,3:multi,3:long,5:multi,5:long,8:multi,8:long --shapeBal=1 --classPow=0.5 --classCap=6`
- `--groups=2000 --steps=80 --lr=0.0001 --seed=20261130 --objective=cand --dagger=1 --smoke=40`
- 输出：`scratch/arms/nov26-taunt-dr-s30.bak`、`scratch/arms/nov26-taunt-rod-s30.bak`

## 验收

- 血统与 selftest3 必须全绿。
- Stage 1 taunt≥3 格、到 hard 质心 L1≥0.30，加入后整池平均 L1 不降。
- 2P rule/legacy 各 4 seed；rule 比基座退化≤3pt。
- Arena B 不低于基座超过 5.8pt；promote 0 阻断、seatKill=0；5P probe-pool 无显著回退。
- 任一底座不满足即不复制、不扫剂量；转考古。
