# PREREG · 2026-11-28 · 5P multi 低废角色替身 AM/TF

> 立项时间：2026-11-28 14:52（UTC+8）。
> 基线：`main@5915f741`，规则指纹 `c61298e6`，池 35 枚 `hard 17 / soft 18`。
> 证据：独立 seed LOO 显示摘除 `nov21-armor-tzt2d` 后 5P multi regular `+2.50pt`、摘除 `TF2-DR` 后 `+3.13pt`（摘除后 AI 变弱）；两包废珠率分别约 97.1% / 91.6%。

## 1. 清单外假设

现有高废珠包仍承担 5P multi 强度角色，但 Stage 2 小样本消融指向常见键而非稀有技能：

- AM：`snipe / armor / gun / reflect`；
- TF：`gun / reflect / guard`。

假设：以低废 `L1B-S1200` 为共同底座，只从角色教师蒸上述常见键，并严格禁 `charge/transfer`，可以在不继承高废珠行为的前提下保住 5P multi 强度。这不是重开 armor/transfer 直接注入，而是“常见键角色替身”。

## 2. 开臂前诊断

- 只测 `n=5, mode=multi`，4 个脚本对手，200 局/包，逐局配对。
- 主尺：ban 掉对应键组后的替身夺冠率差 `Δ = ban − base`。
- 开臂条件：`Δ均值 ≤ −2pt`，且至少 3/4 对手同向为负；否则该臂不开。
- force 键组只作描述，不单独作为开臂依据。

## 3. 固定训练配方

公共参数：

- `--mode=supfit --upstream=docs/artifacts/L1B-S1200.bak`
- `--teacher=pack:docs/artifacts/L1B-S1200.bak`
- `--teacher2frac=0.10 --teacher2Shapes=5:multi`
- `--rolloutMode=game --objective=cand --dagger=0 --keySplit=1`
- `--shapeBal=1 --classPow=0.5 --classCap=6`
- `--groups=1000 --steps=80 --lr=0.0001 --seed=20261128 --snapEvery=1`
- `--arenaShapes=2:standard@2,3:multi,5:multi@3,5:long,8:long`

臂 A `AM-CARRIER`：

- `--teacher2=pack:docs/artifacts/nov21-armor-tzt2d.bak`
- `--teacher2keys=snipe,armor,gun,reflect --rareOnly=snipe,armor,gun,reflect --rareFrac=0.25`

臂 B `TF-CARRIER`：

- `--teacher2=pack:docs/artifacts/TF2-DR.bak`
- `--teacher2keys=gun,reflect,guard --rareOnly=gun,reflect,guard --rareFrac=0.25`

两臂最大 2 并行；不扫 lr/frac/seed。

## 4. 验收硬门

1. 首件与终点：`v:92 / S1o / 16561`，`selftest3` 六腿全绿；
2. Stage 1：总废珠 ≤60%，花珠绝对量 ≥ L1B-S1200 底座的 80%，目标键组有效覆盖不降；
3. 5P multi regular 替身夺冠率不高于 L1B-S1200 底座 1pt；
4. 2P rule/legacy 各 4 seed 退化 ≤3pt；5P long 不退化超过 2pt；
5. `promote --dry --support=2` 0 阻断，人席 `seatKill=0`，Arena B 不超出判决带；
6. 任一旧门回退即淘汰，不追加旁证挽留。

## 5. 边界

- 本轮只训练与筛选，不自动入池、不退池；
- `charge/transfer` 不作为目标键；若标签仍污染，按失败记，不加剂量挽救；
- 首件血统错或 selftest3 红立即停止该臂；
- 两臂都失败则关闭“常见键角色替身”方向，不转 PG 扫参。
