# RESULTS · 2026-11-25 · 2P 单包普查、尺子校准与池替换模拟

## 结论

- **rule 与 legacy 不是同一把强度尺**：v7 锚都能复现历史量程，但 28 枚池成员的排序相关只有 Pearson `0.38 / 0.41`、Spearman `0.26 / 0.24`。后续必须两列并报，不能合成一个“2P 强度”。
- **逐包均值能预测整池阶梯**：hard/regular/simple 的预测与 8 seed 实测差最大 `0.56pt`，说明替换模拟可信。
- **内部换位不能同时让三档都单向变好**，但能让倒挂变成正确次序；普通档基本不动，hard 变强、simple 变更容易。
- 最强且自动人席安全的 2P 候选是 `nov21-armor-tzt2d → nov21-purify-dsp0`，代价是 hard 有效并集 `26→25`（丢 `transfer`）。若 hard 覆盖不能丢，保守候选是 `HL-G1 → nov21-purify-dsp0`，但 2P 台阶较弱。
- 本轮只做普查与 `--banddef` 临时视图实跑，**未改池表、未改产品代码**。

原始件在 [`evidence-2026-11-25-2p-census/`](evidence-2026-11-25-2p-census/)。

## 一、v7 锚校准

按历史同口径复跑 `js/bundled-champion.js`，1000 局、seed `77000/90210`：

| 替身 | 77000 | 90210 | 历史值 | 判断 |
|---|---:|---:|---|---|
| rule | 81.4% | 79.0% | 81.2 / 79.8% | 复现，偏差 ≤0.8pt |
| legacy | 16.7% | 18.9% | 16.2 / 16.6% | 量程一致，90210 高 2.3pt |

两把尺各自都能复现 v7 的“规则替身很难打、legacy 替身较容易打”的量程，但跨池排序低相关，说明它们奖励的是不同行为风格。

## 二、28 枚池成员普查

口径：固定包、`n=2 standard`、rule/legacy、4 seed、每档 500 局；同时测 hard 与 simple 两种探索剂量。

| 带 | rule hard 剂量 | rule simple 剂量 | legacy hard 剂量 | legacy simple 剂量 |
|---|---:|---:|---:|---:|
| hard 15 | 53.557% | 55.037% | 25.390% | 25.290% |
| soft 13 | 50.150% | 53.308% | 29.565% | 28.619% |

- rule：hard 比 soft 弱 `3.41pt`。
- legacy：hard 比 soft 强 `4.18pt`。
- 两把尺给出相反带级结论，与低排序相关一致。

预测校验：

| 替身 | hard 预测/实测 | regular 预测/实测 | simple 预测/实测 |
|---|---|---|---|
| rule | 53.557 / 53.413 | 51.853 / 52.412 | 53.308 / 52.925 |
| legacy | 25.390 / 25.700 | 27.478 / 27.412 | 28.619 / 28.337 |

最大偏差 `0.56pt`，逐包均值可直接用于换位投影。

## 三、替换模拟与临时带位实跑

模拟了全部 `15×13=195` 个 hard/soft 换位；两枚联动替换也没有“三档都单向改善”的组合。因此改用最终次序 `hard < regular < simple` 与最小台阶排序，再对四个代表候选做 8 seed、1000 局/档的真实抽签临时视图（`--banddef`，表未动）。

### 3.1 2P 投影与实跑

| 换位 | rule H/R/S | legacy H/R/S | rule 有序 seed | legacy 有序 seed |
|---|---|---|---:|---:|
| armor-tzt2d → MX6-GD-TF20 | 50.58 / 52.40 / 55.65 | 24.06 / 27.39 / 30.21 | 5/8 | 7/8 |
| armor-tzt2d → purify-dsp0 | 49.16 / 52.10 / 56.08 | 23.50 / 27.43 / 30.76 | 5/8 | 8/8 |
| R-GD12 → purify-dsp0 | 51.26 / 52.54 / 54.08 | 26.20 / 27.40 / 28.53 | 4/8 | 3/8 |
| HL-G1 → purify-dsp0 | 50.79 / 52.28 / 53.79 | 26.00 / 27.41 / 28.21 | 5/8 | 3/8 |

`armor → purify` 的两级台阶最大：rule `2.94 / 3.98pt`，legacy `3.93 / 3.34pt`；分别有 `3/8、4/8` 与 `5/8、3/8` seed 达到 2σ。保守候选的台阶多数未达 2σ。

### 3.2 非 2P 代价

| 换位 | projected hard seatKill | hard 并集 | soft 并集 | 全池并集 | 5P ArenaB（出→入） |
|---|---:|---:|---:|---:|---|
| armor-tzt2d → MX6-GD-TF20 | **1** | **26→27** | 25→24 | 28 | −12.20 → +4.09 |
| armor-tzt2d → purify-dsp0 | 0 | **26→25** | 25→25 | 28 | −12.20 → +14.04 |
| R-GD12 → purify-dsp0 | 0 | 26→26 | 25→25 | 28 | +15.89 → +14.04 |
| HL-G1 → purify-dsp0 | 0 | 26→26 | 25→25 | 28 | −1.83 → +14.04 |

补充：

- `armor → MX6` 把 hard 的 `miniT` 补上，但 MX6 在 hard 带参照下 projected `seatKill=1`，自动入池会被拦，需要额外人席复核或点名。
- `armor → purify` 丢 hard 的 `transfer` 覆盖；全池仍 28/30。
- `R-GD12 → purify` 两带覆盖都不丢，但 2P 增益小且不显著。
- `HL-G1 → purify` 两带覆盖都不丢、5P ArenaB 改善、人席安全，是保守选项；2P 台阶弱于 armor 路线。

## 四、建议

1. **若 2P 三档次序是当前最高优先级**：首选 `nov21-armor-tzt2d → nov21-purify-dsp0`，但需明确接受 hard `transfer` 覆盖下降。
2. **若 hard 覆盖不丢是硬约束**：首选 `HL-G1 → nov21-purify-dsp0`；它更稳，但 2P 改善有限。
3. **若愿意处理人席点名**：`nov21-armor-tzt2d → MX6-GD-TF20` 可增加 hard `miniT` 覆盖并改善 5P，但 projected `seatKill=1`，不能当普通自动成员。
4. 用户已批准第一方案；本轮执行 `nov21-purify-dsp0 → hard`、`nov21-armor-tzt2d → soft`，池仍为 28 枚 15/13。purify 的 `promote --dry --support=2` 通过，bundle/manifest、技能页与演化图已重烘；换带后的 2P/5P 实测见第六节。

## 五、转移伤害后续研究

换带前 hard 的 `transfer` 只有 `nov21-armor-tzt2d` 一个有效载体（7 格 / 76 手）；soft 侧为 `MX6-GD-TF20`（32 格 / 411 手）、`AR-TK2`（16 格 / 133 手）与 `MSB11-R1S130778313`（0 格 / 5 手）。换带后 hard 的 `transfer ≥3 格` 覆盖为 0，这是已接受的代价。

后续训练先回答两件事，不直接加单步奖励：

1. `transfer` 的合法窗口是否真的可达：记录声明时双方 HP/EP、护盾/反弹状态与后续是否发生伤害转移。
2. 现有载体是在什么序列下部署：以 `MX6-GD-TF20` / `AR-TK2` / armor 为冻结教师，按状态窗蒸馏，并用 2P/5P 双验收与 hard `transfer ≥3 格` 作目标。

## 六、换带后实测

产品真源表已换带，未使用临时 `--banddef`：

- 2P rule：hard `49.1625%` / regular `52.1000%` / simple `56.0750%`，5/8 seed 次序正确。
- 2P legacy：hard `23.5000%` / regular `27.4250%` / simple `30.7625%`，8/8 seed 次序正确。
- 5P multi（400 局）：hard `4.0%` / regular `16.8%` / simple `19.5%`；换带前为 `5.5 / 17.8 / 22.0`。
- 5P long（400 局）：hard `7.8%` / regular `19.3%` / simple `32.8%`；换带前为 `9.5 / 22.8 / 31.8`。

5P 的 hard 与 regular 均变强，simple 保持更软；没有观察到换带后退化。原始件在 `evidence-2026-11-25-2p-census/post-swap/`。

定向验收全部通过：D234、D82、map validate、pool-sync `--check`、bundle dry（28 枚 wid 逐条重算）、score13 `27/27`、浏览器 `SMOKE OK` 与 `BATTLE OK`。未跑本地整轮门禁。
