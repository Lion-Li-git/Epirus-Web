# 2026-11-26 价值覆盖 A1：兑现表、珠浪费与逐包替换顺序

## 结论

- A1 已落地并全池重扫：34 包的 Stage 1 新增 `closure`，旧有 15 个字段逐项不变，电珠账 34/34 对平。
- A2 小样在 RNG 自证上通过，但“死蓄能必须不赚”的已知答案对照未达到预注册的 `<=0`；按停止条件**不扩全池 A2、不跑 A3、不开训练**。
- 珠浪费不能直接翻成 hard 阻断。按用户裁定改为**逐包替换**：先处理覆盖冗余、强度又低的高浪费包，再处理独守技能载体。
- 本轮**未改池、未改 promote、未改任何 `*_BLOCK`**。

## 一、全 120 格行为多样性

夹具统一为 `fx-pool1126a` 后，包含 5 个真包对手重算：

| 组 | n | 组内 pairwise L1 中位 |
|---|---:|---:|
| 全池 | 34 | 0.3487 |
| hard | 17 | 0.2864 |
| DR-R3E 续训线 | 10 | **0.1823** |
| fam25 其他线 | 7 | 0.3094 |
| fam24 | 14 | 0.2627 |

DR 线仍明显更同质，但已不再是混夹具读数。证据：[`diversity-full-summary.tsv`](evidence-2026-11-26-value-coverage/diversity-full-summary.tsv)。

## 二、A1 兑现表

- 新增 `stage1.closure[key] = {uses, paid, wasted, unit, rate, readable, byShape}`。
- `unit=games`：至少出过该键的局数 vs 其中至少兑现一次的局数；`unit=events`：目前仅 charge，用珠获得/花掉/过期事件。
- 分母 `<20` 时 `rate=null / readable=false`，不把“读不出”当 0 或 1。
- 自证：
  - 同 seed 重跑 closure 逐位相同；
  - DR-R3E 旧字段逐项不变，charge 对账 `73/343`；
  - HL-G1 全息正对照 `46/151 = 30.5%`。首版曾把全息错误记为 0，原因是只检查 champion 自己的 `blocked`，漏掉盾目标的 `blocked`；已修正并全池重扫。

证据：[`closure.tsv`](evidence-2026-11-26-value-coverage/closure.tsv)、[`a1-validation.txt`](evidence-2026-11-26-value-coverage/a1-validation.txt)。

## 三、珠浪费与优先级

| 包 | 带 | Stage1 胜率 | 电珠过期率 | charge 兑现率 | 关键覆盖 | 处理顺序 |
|---|---|---:|---:|---:|---|---|
| **FC-G1** | hard | 36.4% | **99.4%** | 0.5% | firestorm 100%、curse 90.6% | **第一优先**：天火覆盖不唯一，且 hard 最弱；但它是特邀包，降带/替换需单独留痕 |
| nov21-taunt-dsp0b | hard | 44.0% | 98.0% | 1.0% | taunt 22.2% | 第二梯队：需要保留 taunt 的低浪费替代 |
| nov21-purify-dsp0 | hard | 40.4% | 97.3% | 1.3% | purify | 第二梯队：需要保留 purify 的替代 |
| RG-CN | hard | 44.5% | 95.5% | 4.0% | cannon/ring | 第二梯队：需要保留 cannon 的替代 |
| TF-DR | hard | 48.6% | 93.8% | 6.3% | transfer | 第二梯队：需要保留 transfer 的替代 |
| MN-DR / MT-DR | hard | 53.3% / 49.3% | 92.1% / 91.2% | 5.1% / 8.8% | mine / miniT | 暂缓：强度高且技能载体作用明确 |
| DR-R3E / JN-DR | hard | 50.3% / 53.4% | 77.6% / 77.1% | 21.3% / 19.8% | drain / jinshield | 最后处理：主线强包，先找低浪费供体 |
| T65-RINGBEAD | hard | 47.7% | 16.5% | 83.2% | ring/bead/2P | 低浪费供体 |
| TK-FS4 | hard | 40.1% | 16.6% | 82.7% | firestorm 100%、armor/tank | 低浪费供体 |
| FS2-LE26 | hard | 38.8% | 18.6% | 80.3% | firestorm 100%、laserEye | 低浪费供体 |
| HL-G1 | hard | 45.8% | 24.1% | 75.4% | holo 30.5% | 低浪费供体 |

完整表见 [`replacement-priority.tsv`](evidence-2026-11-26-value-coverage/replacement-priority.tsv)。机械候选表只按“浪费更低、胜率不低 1pt”筛选，**没有检查技能覆盖，不可直接当替换结论**。

## 四、A2 停止回执

预注册见 [`PREREG-2026-11-26-use-value-pilot.md`](PREREG-2026-11-26-use-value-pilot.md)。

- 原招 vs 原招：`maxAbs=0`，通过。
- 死蓄能对照（400 局 × 4 次续打）：`mean=+0.00875`，`SE=0.01042`，95% CI `[-0.01168, +0.02918]`。
- 预注册要求点估计 `<=0`，因此**未通过**。CI 跨 0 只能说明“没有显著为正”，不能替代已知答案控制。
- 按停止条件停在 A1；小样本排序稳定性读数不作为结论。

证据：[`a2-smoke.log`](evidence-2026-11-26-value-coverage/a2-smoke.log)、[`a2-control-smoke.log`](evidence-2026-11-26-value-coverage/a2-control-smoke.log)。

## 五、逐包替换建议

1. **先替换 FC-G1 的天火 hard 席位，但不在没有替代包时直接降带。** 它同时满足“浪费最高、hard 强度最低、天火覆盖冗余”三条；替代臂应以 `TK-FS4` 或 `FS2-LE26` 为低浪费供体，保留 firestorm/curse 闭环。
2. **taunt / purify / cannon / transfer 各自单独立项**，不要用一个“低浪费通用包”顶掉多个独守技能。
3. **MN/MT/DR/JN 暂缓**：它们浪费高，但当前分别承担 mine/miniT/drain/jinshield，且强度更高；先做覆盖冗余包符合“逐步更替”。
4. 每个替代包仍走完整链：`selftest3 → Stage1/closure → 2P/5P → Arena B → promote --dry → measure-point --bake → pool-add → 定向门`。一次只换一枚，换后重测池级阶梯。
