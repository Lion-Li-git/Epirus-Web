# 预登记：CEM48 第二轮（从 CEM48-s13 热启动，24k）（DS · 2026-10-30 晚）

> 第一轮（`RESULTS-2026-10-30-CEM48-ds.md`）：CEM+pop48+fx16/12k 冷启动四条判据全过——
> s13 Δclean **+0.151**、CLI 夺1 **20.0%**、agree 27.3%；s7 Δ+0.077、CLI 夺1 **25.5%**；
> 对照 ESA pop14 三粒全平（agree 69~95%、Δ+0.007~+0.012）。

## 一、干预

- 起点 = `scratch/arms/CEM48-s13.bak`（CLI clean −0.190、夺1 20.0%、agree 27.3%）；
- 同配方：`--mode=cem --pop=48 --fxGames=16 --arenaLex=1 --arenaCur=clean --targetGames=24000`；
- 3 粒 s7/s11/s13；`--verifGate --headGate` 照开。

## 二、判据（合取）

1. ≥2/3 粒 **Δclean ≥ +0.05**（相对起点 −0.206 的训练期 clean）；
2. ≥2/3 粒 **CLI 夺1 ≥ 25%**（起点 20.0%）；
3. **CLI clean ≥ −0.15**（起点 −0.190 之上）；
4. **3/3 headGate 绿**（agree <60%）。

## 三、停线

- 1 不过 ⇒ 热启动链在第一轮就饱和（CEM 只买到初速度），转"shaped 接受分"或更大种群；
- 2、3 过、1 不过 ⇒ 夺1 涨而 clean 不动，属"死者胜"变多，需双键；
- 全过 ⇒ CEM48 立为代 2 标准配方，继续第三轮。
