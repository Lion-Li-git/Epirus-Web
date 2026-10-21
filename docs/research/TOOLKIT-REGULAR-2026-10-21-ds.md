# 杂货铺进普通档：机制、读数与权重建议（2026-10-21 晚，DS）

> 问题：把 `st:toolkit`（杂货铺）掺进 `lv:regular`（普通档）要怎么做、给多少权重。
> 结论先说：**机制上只有"整席"这一种单位**（`scriptMix.seats`）；按 8 粒 × 1000 局实测，
> **k=1 是唯一不把普通↔困难打翻的固定席数**，但它在 long 把台阶二打到 **1.0~1.6pt（判不开）**；
> 想要更小的权重只能新增**概率型** `scriptMix.p`（约 2–3 小时含门），建议 **p≈1/4**。

## 一、机制（现有代码）

- 档位表：`js/train/bots.js` 的 `DIFF_TIERS`。简单档已有
  `scriptMix: { seats: 2, min: 1, ids: ['st:toolkit','st:mix'] }`；普通档没有 `scriptMix`。
- 推导单一来源：`js/pool-draw.js` 的 `scriptSeats(tier, aiSeats, styles)` →
  `{seats, ids, note}`；`compose(...)` 在抽好的包阵容上**盖掉 k 席**（同 salt 下包阵容不变）。
- **三个硬 cap**：
  1. `k = min(sm.seats, aiSeats - min)`（默认 `min=1` ⇒ 至少留 1 席包）；
  2. 再 `Math.min(k, ids.length)` ⇒ **想掺 2 席杂货铺就得在 ids 里写两遍**（`['st:toolkit','st:toolkit']`）；
  3. 2 人桌只有 1 席 AI ⇒ **永远是 0 席**（普通档在 2P 上不会变）。
- 所以"权重"在现有机制里 = 席数 / AI 席数：n=3/4/5 时 k=1 ⇒ **50% / 33% / 25%**（离散、且 n=3 最小非零就是 50%）。

## 二、实测（`tools/probe-diff-ladder.mjs --pool=1 --games=1000`，8 seed 77000..77007，逐局配对）

研究旗标：`--mixadd='lv:regular>k>st:toolkit[,st:toolkit]'`（本批新加，只在本进程生效；产品档位表没动）。

Δ普通 = 不掺时的普通档夺冠率 − 掺 k 席后的夺冠率（**正 = 更难**）：

| n | 模式 | k=0 简单/普通/困难 | k=1 Δ普通 | k=2 Δ普通 |
|---|---|---|---|---|
| 3 | multi | 28.8 / 24.8 / 21.9 | **−0.90 ±0.86（−2.1σ，反而更软）** | — |
| 3 | long | 23.9 / 24.3 / 19.9 | **+2.76 ±1.18（4.6σ）** | — |
| 4 | multi | 20.9 / 19.7 / 17.5 | +0.12 ±1.29（0.2σ） | +0.89 ±0.91（1.9σ） |
| 4 | long | 20.0 / 20.9 / 16.3 | **+3.64 ±0.86（8.3σ）** | **+4.72 ±0.89（10.4σ）** |
| 5 | multi | 17.2 / 16.0 / 13.9 | +0.46 ±0.83（1.1σ） | **+2.09 ±0.97（4.2σ）** |
| 5 | long | 16.4 / 15.4 / 13.0 | +1.32 ±1.18（2.2σ） | **+2.91 ±0.82（7.0σ）** |

对台阶的影响（简单−普通 / 普通−困难）：

- **k=1**：long 的台阶二从 4.36/4.69/2.32 掉到 **1.60 / 1.05 / 1.00pt**（全部判不开）；multi 基本不动（3 档差 ≤1σ，n=3 还变好）。
- **k=2**：long n=4 普通 16.2 vs 困难 16.3 ⇒ **台阶二 −0.04（翻序在边上）**；long n=5 −0.59、multi n=5 +0.04 ⇒ **k=2 不能要**。
- 机制解释：杂货铺在 long 里比软带冠军硬（§E627 已有同向读数），它买的是**广度**（§E612：n=30 时 21 种出手），不是难度。

## 三、建议

1. **不要 k=2**（n=4/5 的 long 台阶二会被打翻）。
2. **固定席数只有 k=1 可选**；代价是 long 台阶二 1.0~1.6pt（在册声称要改成"分不开"），multi 几乎无代价（n=3 甚至 −0.9）。
3. 若想保住 long 的台阶二：新增**概率型权重** `scriptMix.p`（每 AI 席以 p 概率变成杂货铺，仍保 `min` 席包）：
   - 预估（按 k=1 效应线性缩放）：p=1/4 ⇒ long 普通档 Δ≈+0.3/+0.9/+0.3，台阶二 ≈4.0/4.2/2.2pt（仍分得开）；
   - 实现点：`scriptSeats` 增 `p` 字段 + `compose` 逐席掷（用同一个 rand，可复现），**签名 `sigOf` 必须把 p 加进去**（否则 D227④a 的账会静默过期）。
4. 落地清单（若选 k=1）：
   - `bots.js` 的 `lv:regular` 加 `scriptMix: { seats: 1, min: 1, ids: ['st:toolkit'] }` + note 文案；
   - `sigOf` 已含 `scriptMix` ⇒ **D227④a 立刻红**，需重跑 `--pairs=1 --games=1500 --pool=1`（另跑一遍不带 `--pool=1`）并更新 `tools/diff-ladder-claims.mjs`；
   - D227④d（简单 vs 困难）不受影响；`ui-contract`/页面装配标签、`POOL-CONTRACT` 那句"掺席买可玩性不买难度"要改成"普通档这席会抬难度（long +1.3~3.6pt）"；
   - README 难度段与 CHANGELOG 补数。
5. 2 人桌不受影响（只有 1 席 AI ⇒ scriptSeats 返回 0 席），2P 的台阶/谱不用重测。

## 四、复现

```bash
node tools/probe-diff-ladder.mjs --n=4 --games=1000 --pool=1 --mode=long --seed=77000 --mixadd='lv:regular>1>st:toolkit'
# k=2 需要 ids 写两遍：--mixadd='lv:regular>2>st:toolkit,st:toolkit'
```
原始 128 臂读数：`C:/Users/14765/AppData/Local/Temp/epi-toolkit-regular.json`（本机，未入仓）。
