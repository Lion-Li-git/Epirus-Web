# PREREG · 2026-11-26 · holo/shift 风格候选的 2P 修复

## 失败诊断

- `nov26-util-dr-s30` / `nov26-util-rod-s30` 冻结推理有效，但 `selftest3` 腿 C 均红，不能直接续训。
- 与绿色父代做 10%–75% 候选比例融合，四档仍红：低候选比例红在数值梯度，高候选比例红在键级导数；不是简单融合比例问题。
- 原候选风格已达标，但 DR 的 2P rule 四 seed 均退化，均值 `+11.55pt`。

## 新机制与既有结论

- 11-18 在册 `P9-CN-MINI-*` 已证明 `--onlySeg=skillHead` 可冻结 `selfEnc/seatEnc/attn/ctx`，只注入稀有动作并保住高 bpM。
- 本轮不是重证“skillHead 能训练”，而是把它用于 holo/shift 风格 + 2P 保护这个新组合。
- 2P 形状权重由 1/7 提到 4/10，T65 教师份额 0.20→0.30；目标是修复已观察到的 2P 退化，不是扫剂量。

## 固定配方

两个独立绿色底座各一臂，除 upstream/out/tag 外逐字相同：

- 底座：`DR-R3E.bak`、`ROD-DR.bak`
- 主教师：`HL-G1`（holo）
- 第二教师：`OBS6E9`，`shift@0.14`
- 2P 教师：`T65-RINGBEAD`，`2:standard@0.30`
- 靶向：`--rareOnly=holo,shift --rareFrac=0.35`
- 桌形：`2:standard@4,3:multi,3:long,5:multi,5:long,8:multi,8:long`（2P 占 40%）
- 训练：`--onlySeg=skillHead --rolloutMode=game --groups=2000 --steps=180 --lr=0.0003 --seed=20261130 --objective=cand --dagger=1 --smoke=40 --shapeBal=1 --classPow=0.5 --classCap=6`
- 输出：`scratch/arms/nov26-util-dr-head-s30.bak`、`scratch/arms/nov26-util-rod-head-s30.bak`

## 止损与验收

- 上游 selftest3 红即不开训；第一枚产物立即验尸。
- 候选必须重新通过 selftest3，才进入昂贵验收。
- Stage 1：holo/shift 各 ≥3 格，合计份额 ≥2.5%，L1 ≥0.30。
- 2P rule/legacy 各 4 seed：允许 legacy 改善，rule 不得比 DR-R3E 基座退化超过 3pt；若 rule 仍 >5pt，淘汰。
- Arena B 不低于基座超过 5.8pt；promote 0 阻断、seatKill=0。
- 5P multi/long 用 probe-pool 主体席配对，无显著回退。
- 过线才走完整准入链；不扫步骤/学习率，不为单粒早期快照挽留。
