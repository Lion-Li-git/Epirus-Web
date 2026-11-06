# 预登记：夺1 货币（`--arenaCur=first`）3 粒（DS · 2026-10-30 晚）

> 动因（用户 18:5x）：「你现在的夺1是什么，是否要调整一下」。
> 现状：训练货币 = **clean**（win 且 hp>0），而产品面/报告读的是 **夺1**（win，不管 hp）。
> 代 2 从头练的三轮（random → G2-s11 → G2b-s13）夺1 一直在 **12.3~16.4%** 徘徊，v7 是 **42.0%**（分层场 mild）。

## 一、干预

`arena2` 新增 `scoreFirst = ((win?1:0) − 1/n)/(1−1/n)`，`cur` 允许 `first`；`probe-cem-arm --arenaCur=first` 时：
- 词典序地板 = v7 逐格 **firstScore**；
- 接受分 = 逐格 firstScore 词典序；
- holdout 报的 `first` 与 `cleanScore` 并列（互相对账）。

## 二、臂

- 起点 `scratch/arms/G2c-s7.bak`（24k 那批里唯一 Δclean>0 且 headGate 转绿：clean −0.312、**夺1 16.4%**、agree 45.4%）；
- 3 粒 s7/s11/s13，**24k 局**，`--arenaCur=first --arenaLex=1 --fxSelect=1 --fxGames=8 --verifGate=1 --headGate=1`；
- 起点分母：同场随机起点 夺1 12.3% / 净胜 −0.356。

## 三、判据（合取）

1. 3/3 粒 CLI（40 局/桌形、最佳温度）**夺1 ≥ 20%**；
2. 至少 2/3 粒 CLI 夺1 **≥ 起点 16.4% + 3pt**（即 ≥19.4%）；
3. clean 不崩：3/3 粒 CLI clean **≥ −0.20**；
4. 头没变平：至少 2/3 粒 headGate 绿（agree <60%）。

## 四、停线

- ① 不过 ⇒ "直接训夺1"在这个预算下也买不到；下一步试**混合货币**（first 作词典序第一键、clean 作第二键）或接受当前；
- ① 过、③ 不过 ⇒ 夺1 涨但 clean 塌（死者胜变多）⇒ 用 `clean+first` 双键；
- ③④ 都过且 ①② 过 ⇒ 写进代 2 标准配方（先夺1 后 clean）。

## 五、口径

- 夺1 = win（draw 记 0）；clean = win 且 hp>0；两者同尺（都按 1/n 基线归一）；
- 与 clean 货币的臂**不可横比**（目标不同），只与随机起点/v7 同场比较；
- 起点 `G2c-s7` 本身是 24k 干净货币练出来的，带着它的头；本轮只改货币。
