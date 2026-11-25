# RESULTS · 2026-11-25 下午–傍晚：`rod` / `purify` 补盲与 2P 定向巩固（`ROD-DR` 入 `hard` / `PUR-DR` 入 `soft` / 退役 `nov21-rod-tzt2d-r10`）

> 基线：`12332e5e`（`v2.1.27`，27 枚 `hard 14 / soft 13`，全池 `>=3` 并集 `27/30`，`hard` `25/30` 缺 `miniT,rod,purify,dualGun,mirror`）。
> 目标：解决池缺口中的 `purify`（全池 0 格）、`rod`（`hard` 0 格 + 替换 `seatKill=2` 老件 `nov21-rod-tzt2d-r10`），并测试老 `hard` 成员 `2P standard` 补强方案。

---

## 一、`rod` 避雷针替代（两粒种子复现 → `ROD-DR` 入 `hard`，退役 `nov21-rod-tzt2d-r10`）

以 `selftest3` 全绿底座 [`docs/artifacts/DR-R3E.bak`](../artifacts/DR-R3E.bak) 起跑：`--teacher=pack:DR-R3E.bak`、`--teacher2=rod@0.35 (3:multi,3:long,5:long,8:long)`、`--teacher3=pack:T65-RINGBEAD.bak@0.25 (2:standard)`、`--rareOnly=rod,drain,ring --rareFrac=0.35`，桌面配置 `ringspam,beadburst` 等电系威胁与人席/真包混合（`2000 组 / 240 步 / lr=4e-4 / dagger=1`）：

| 候选 / 种子 | `selftest3` | `Arena B`（6 粒中位） | `Stage 1` 并集 & 关键覆盖（`>=3` 格） | `2P standard`（rule / legacy） | `90210 / 90211` 最坏漏格 | `promote --dry` |
|---|---|---|---|---|---|---|
| `nov25-rod-dr-s25` (`s=20261125`) | **6/6 全绿 (`0.00`)** | **`+23.3074pt`**（6/6 正，极差 `73.55pt`） | `16/30`（`rod 19/120` / `454` 次，`drain 14/120` / `152` 次，`ring 40/120`，`bigT 20/120`，实池 `32.0%`） | `43.3%` / — | `0.5%/3.5%` · `0.0%/3.5%`（`sk=0`） | `exit 0`（G4 `0%/0%`，G5 `0%`） |
| **`nov25-rod-dr-s26`（`s=20261126` → `ROD-DR`）** | **6/6 全绿 (`0.00`)** | **`+23.3499pt`**（6/6 正，极差 `34.10pt`） | **`17/30`**（`rod 14/120`，`drain 10/120`，`ring 31/120`，`bigT 8/120`，`railgun 2/120`） | **`20.8% / 19.8%`** | `0.5%/2.5%` · `1.0%/3.0%`（**`sk=0`**） | **`exit 0`**（`G(multi)=4.12 / G(long)=5.97`，G4 `0%/1%`，G5 `0%`，`环@安全 61.5%`） |

- 择优将 `nov25-rod-dr-s26` 固化为 [`docs/artifacts/ROD-DR.bak`](../artifacts/ROD-DR.bak)（`wid=c5f68b29031ab56c`）入 `hard`：`measure-point --bake` `100 PASS / 0 FAIL`（`H=60.0, S=1.48`，`arS=+0.2101 / arR=+0.3302`，`a-long h2=89.50% / h5=43.65% / h8=32.95%`），Stage 2 `24` 技（消融 `8`）。
- 同步执行 `pool-add --retire=nov21-rod-tzt2d-r10` 从 `soft` 退役带 `seatKill=2` 的老避雷针载体。

---

## 二、`purify` 净化补盲与 `2:standard` 回合占比机制定位

1. **基座对比**：
   - `FS2-LE26` 底座（`nov25-purify-fs2-s25`）：训练虽采到 `304` 条 `purify` 标签并保住天火闭环（`96.3%`）与 `2P rule 17.0%`，但饱和退化致自对局伤害占比跌至 `0.9%`、`selftest3=8`（可分辨 0）、Stage 1 仅 `2` 次 `purify`、`promote exit=6`（`G(multi)=1.38 / G(long)=1.37 < 3`，`场B=0`）阻断。
   - **切换 `DR-R3E` 底座（`nov25-purify-dr-s25` → `PUR-DR`）**：
     - **`selftest3` 6/6 全绿（`0.00e+0`）**、`Arena B = +26.6586pt`（6/6 正）；
     - **`Stage 1` 120 格首破全池 `purify` 零格**：并集 `15/30`（**`purify = 6/120` 格 / `41` 次出手 / `8` 非零格**、`drain 19/120`、`ring 44/120`、实池 `34.0%`）；Stage 2 `22` 技（`drain rich Δ=+33.33% ±14.21%`）；
     - `promote --dry --support=2` **`exit 0`**（`G(multi)=4.25 / G(long)=4.64`，G4 `2.7%/0%`，G5 `0%`，`环@安全 61.1%`）；`90210/90211` **`seatKill=0`**（`multi ≤13.5% / long ≤5.0%`）；因 `2P rule = 88.3%` 偏弱，依授权定位正式合入 **`soft`** 补盲（[`docs/artifacts/PUR-DR.bak`](../artifacts/PUR-DR.bak)，`wid=7fd8b3c1d487dcdd`），图谱 `rebuild-map` `100 PASS / 0 FAIL`（`H=59.3, S=1.45`）。
   - 同配方第二种子 `nov25-purify-dr-s26`（`2:standard@3, T3@0.35`）：`Arena B +30.43pt`（6/6 正、极差 `22.68pt`）、`2P 37.8%`、`promote exit=0`，但 `purify` 回落至 `1/120`（`7` 次）且 `selftest3=8`。
2. **`2:standard` 回合数稀释定位与修复（`nov25-purify-2p-s27` vs `s28`）**：
   - 在 `2:standard@3, 5:long@2` 下因 `2P` 局仅 ~8–10 回合、`long` 达 ~45–60 回合，`teacher2` 实际标签仍只有 `504–651 / 40000` 步，`2P` 几乎不动（`nov25-purify-2p-s27` 仅 `88.3% → 81.0%`、`nov25-taunt-2p-s25` 仅 `68.0% → 62.3%`）。
   - 将桌面抽样与教师配额提高到 **`--arenaShapes=2:standard@10,3:multi,5:long@2,8:long --teacher2frac=0.90 --teacher2Shapes=2:standard`**（`s28`，`t2` 命中 `6,399` 手）后：
     - **`nov25-purify-2p-s28`**：`2P` 由 **`88.3%` 骤降至 `rule 20.0% / legacy 12.5%`**，`Arena B` 升至 **`+34.6941pt`**（6/6 正），`Stage 1` 并集 `17/30`（`purify 1/120`、`10` 次、`drain 9/120`、`railgun 3/120`、`rod 2/120`），`promote exit=0`（`G4 0%/0%`、`G5 0%`），`90210/90211` **`seatKill=0`**（全 28 格 `≤4.0%`）；留作高强 `hard` 储备候选，暂不叠加同族成员入 `hard`。

---

## 三、老 `hard` 成员 2P 升级试测（`taunt` / `FS-G2`）

| 试测臂 | 配方 | 2P 改善 | `selftest3` | 阻断原因 / 结论 |
|---|---|---|---|---|
| `nov25-taunt-2p-s25` | `nov21-taunt-dsp0b + DR-R3E/T65 @ 2:standard@3` | `68.0% → 62.3%`（`snap0 56.8%`） | **6/6 全绿** | 继承 `G5[long]=27% > 25%` 阻断；`Arena B +11.93pt`、`taunt 103/120` |
| `nov25-fsg2-2p-s25` | `FS-G2 + FS2-LE26@0.90 @ 2:standard@10` | **`59.3% → 16.5%`**（legacy `23.5%`） | **6/6 全绿** | `Arena B +4.36pt`（亲代 `−3.48pt`）、**双闭环全保**（珠 `75%`/天火 `63%`）、`promote exit=0`；**但 `90210/90211` `只枪压制` `multi 26%/30%`、`long 36.5%/44.5%`（`seatKill≥2`）**，按纪律拒入池 |

---

## 四、28 成员全池复查（`hard 15 / soft 13`）

- **`pool-add --audit`**：`members=28, hard=15, soft=13, untracked=0, dupWid=0, blockedAuto=0, seatKilledAuto=0, seatUnknown=0, bad=[]`（`soft` `seatKill>0` 成员由 3 降至 2）。
- **全池技能有效并集（Stage 1 `≥3` 格）**：**`28/30`**（仅缺 `dualGun`、`mirror`）；**`hard` = `26/30`**（补齐 `rod`）、`soft` = `25/30`（补齐 `purify`）。
- **28 池阶梯（`probe-diff-ladder --pool=1 --surrogate=rule`, 400 局/档）**：
  - `5P long`：困难 **`9.5%`** → 普通 **`22.8%`**（`5.1σ`）→ 简单 **`31.8%`**（`2.9σ`）
  - `5P multi`：困难 **`5.5%`** → 普通 **`17.8%`**（`5.4σ`）→ 简单 **`22.0%`**（`1.6σ`）
  - `2P standard`：普通 **`50.8%`** / 简单 **`51.8%`** / 困难 **`55.3%`**（`1.3σ`）
