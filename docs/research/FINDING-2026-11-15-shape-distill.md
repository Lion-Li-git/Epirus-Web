# FINDING — 2026-11-15 按桌形分教师（shape-gated teacher）初测

> 结论先行：**首个“同一包在 2P 与多人桌同时不亏/上涨”的初测**。`OBS6-SHAPEDIST` 的 4N 总 X4P 短/长 = **0.2689 / 0.2644**（E9 基线 0.2085 / 0.2050，+0.060 / +0.059）；2P 短/长 **0.5169 / 0.3777**（E9 0.2408 / 0.2638），5P 短 −0.020 以外其余格不低于 E9。2P 考卷 89.8%（E9 69.1%），对只防御人机 100% 胜 / 10.2 回合。

## 动机

- `arena2.SHAPES` 的 2P 只有 `multi/multi4/long`，**没有产品默认的 2P `standard`** ⇒ 2P 训练与 2P 考卷长期对不上。
- 2P-only 蒸馏（v7 2P 教师）能把 2P 买到 89.4%，但 4N 的 3P/8P 塌（0.048/0.097 与 −0.020/0.057）；PG/soup 都救不回多人（见同日实验）。
- 假设（用户）：obs6 信息多、2P 状态空间小 ⇒ **按桌形分教师**比“一个教师全桌”更容易拟合。

## 实现

`training/proto2/supfit-gd.mjs` 新增 `--teacher2Shapes=<n,...>`（也接受小写 `--teacher2shapes`）：

- teacher2 只在指定人数的桌形出标签；其他桌形整手回落 teacher1。
- 默认空集 = 不设形门，旧路径逐字不变；meta 记 `teacher2shapes`。
- 配 `--rolloutMode=game`：一局一个教师，避免 2P/多人标签在同一局内互斥。

## 配方（shaped1）

~~~
upstream = docs/artifacts/obs6-coldstart/OBS6E9.bak
teacher  = pack:OBS6E9            # 多人桌自蒸馏（保持原风格）
teacher2 = pack:js/bundled-champion.js  # v7 2P（2P 考卷 98.4%）
teacher2Shapes = 2
arenaShapes = 2:standard,3:multi,5:multi,8:multi
shapeBal=1, rolloutMode=game, teacher2frac=0.9
groups=1200, steps=400, objective=cand, classPow=0.25, classCap=3
out = scratch/arms/OBS6-SHAPEDIST.bak
~~~

采集覆盖 4/4 桌形（308/307/312/273 组），t2 命中 538，形门只放 2P。

## 4N 三件套（100 轮 / 77000）

| 人数 | E9 短 | SHAPEDIST 短 | Δ短 | E9 长 | SHAPEDIST 长 | Δ长 |
|---|---:|---:|---:|---:|---:|---:|
| 2P | 0.2408 | **0.5169** | +0.276 | 0.2638 | **0.3777** | +0.114 |
| 3P | 0.1493 | 0.2157 | +0.066 | 0.0871 | 0.2211 | +0.134 |
| 5P | 0.2821 | 0.2625 | −0.020 | 0.2411 | 0.2607 | +0.020 |
| 8P | 0.0543 | 0.1286 | +0.074 | 0.2343 | 0.2343 | 0.000 |
| **X4P** | **0.2085** | **0.2689** | **+0.060** | **0.2050** | **0.2644** | **+0.059** |

## 2P 考卷与行为

- 2P 考卷（20 基准 × 40 局）：**89.8%**（eps=0），80.1%（eps=0.1）；最差 `guardgun 0%` / `reflectmix 23%`。
- 对只防御人机：**100% 胜 / 10.2 回合 / 3.68 攻击/局**。
- 用卡：**7 张 / 防御 35%**（2P-only 那版是 5 张 / 0%），多人教师把防御带回来了。

## 反证与边界

- 留出同枚 top-1 从 95.7% 掉到 **59.7%**：两种教师标签在同一学生上冲突，网络是按桌形折中；**低 top-1 不等于实战差**，以 4N 为准。
- 从 2P 专家起步的 shaped2（teacher=E9 回填多人）2P 考卷只有 **71.1%**，不如 shaped1；说明“先窄后宽”会把 2P 稀释。
- 同日反证：2P/5P/8P 混桌 PG 2P 69→63；2P 专家做多人 PG 多人不回；2P×E9 soup 25/50/75% 的 2P 只有 40/57/77%。

## 下一步

1. `groups=2400` + `dagger=1` 重跑 shaped1，目标补 5P 短（−0.020）与 `guardgun/reflectmix`。
2. 把 `2:standard` 正式加进 `arena2.SHAPES`（新列族 §E597），训练/考卷同形。
3. 验收固定四列：2P 考卷 20 基准全 >50% + 3P/5P/8P 的 C5 不低于 E9 3pt。
4. 若 2400 组稳定，再讨论入池；当前产物只在 `scratch/arms/`，未进池、未推送。
