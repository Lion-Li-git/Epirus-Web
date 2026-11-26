# 2026-11-26 `hard` 2P 短板替换与 `17/17` 池收编（v2.1.32）

> 结论先行：不拆池、不按人数路由（遵守 `D-34`/`D-35`），沿 `DR-R3E` 洁净底座以 `--rolloutMode=game` + 单技能 `--rareOnly` + `2:standard` 配比训出 **`MT-DR`**、**`JN-DR`**、**`MN-DR`** 与 **`PUR-2P`**（[`MT-DR.bak`](../artifacts/MT-DR.bak) / [`JN-DR.bak`](../artifacts/JN-DR.bak) / [`MN-DR.bak`](../artifacts/MN-DR.bak) / [`PUR-2P.bak`](../artifacts/PUR-2P.bak)）入 **`hard`**，将 `2P` 弱包 `OBS6E9`、`RG-MN`、`R-GD12` 下放 **`soft`** 并退役在新标尺下 `seatKill=3` 触发 `D234` 阻断的 `nov22-c3g-s300k`。终态全池 **34 枚（`hard 17 / soft 17`）**，`pool-add --audit` 与四视图 `map-selfcheck` 全绿；`2P rule` `困难` 档由 `v2.1.31` 的 `47.5%` 改善至 **`37.5%`**。两条 2P 阶梯与两条 5P 阶梯严格单调；`5P multi` 400 局那组的普通/简单档差 `0.25pt (0.1σ)`，按噪声内并列读。

---

## 一、问题诊断与测绘链路修复

1. **训练诊断两项发现**：
   - 将高频基础技能（`drain,ring`）塞入 `--rareOnly` 会稀释真正稀疏的标签（`mine`/`purify` 滑落至 `0–8` 格）；将 `--rareOnly` 收窄到单个目标稀有技能可保留高密度信号。
   - 缺省 `step` rollout 模式（未传 `--rolloutMode=game`）下 `teacher2` 多回合前置条件难以完整 rollout；改为 `--rolloutMode=game` 后，`miniT`（36–37 次）、`jinshield`（445 次）、`mine`（129 次）全部稳定学会。
2. **`measure-point.mjs` 投影表头修复**：
   - `v2.1.31` 向 `champion-map/data/projections.tsv` 追加 `xt318..zt320` 后，[`measure-point.mjs`](../../champion-map/pipeline/measure-point.mjs#L397-L406) 仍硬编码把 `VERSION_PROJ_COLS` 拼在 `zt3` 之后（使 `xt318` 排在 `xt20` 之前），导致 `add-point.mjs` 报错 `projections 表头不一致`。
   - 改为动态读取 `champion-map/data/projections.tsv` 现役表头列序（再仅追加缺失新列），重新执行完整测绘 + `rebuild-map` 后通过四视图 `101 PASS / 0 FAIL`。

---

## 二、4 枚新入 `hard` 成员与被替包对照

统一 2P 单包口径：`node tools/probe-diff-ladder.mjs --tiers=lv:hard --n=2 --mode=standard --games=500 --seed=95001`（替身夺冠越低 = AI 越强）。

| 成员 | 状态 / 职责 | wid | Stage 1 并集（主要新增覆盖） | Arena B (pt) | 2P rule (500g) | 2P legacy (500g) | `promote --dry` | `90210/90211` seatKill |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`MT-DR`** | 新入 `hard`（补齐 `hard miniT`） | `dc222c8e7a090b40` | `16/30`（`miniT 5/120` 36 次、`ring 29`、`bigT 15`、`drain 6`） | `+28.1189` | `17.4%` | `19.2%` | 通过（`G4 0%/1%` `G5 0%/0%`） | `0` |
| **`JN-DR`** | 新入 `hard`（替代 `OBS6E9`） | `27923b8d6ee584e8` | `18/30`（`jinshield 25/120` 445 次、`miniT 3/120` 37 次、`ring 35`） | `+37.4287` | `21.8%` | `12.4%` | 通过（`G4 0%/2.3%` `G5 0%/1%`） | `0` |
| `OBS6E9` | `hard` → `soft` | `d2a64af418b85949` | `13/30`（`jinshield 20/120`、`tank 14/120`） | `+14.024` | `93.0%` | `28.8%` | `pass` | `0` |
| **`MN-DR`** | 新入 `hard`（替代 `RG-MN`） | `452ae508bd062653` | `15/30`（`mine 14/120` 129 次、`shift 5`、`charge 15`） | `+13.5873` | `22.0%` | `19.6%` | 通过（`G4 0%/0.3%` `G5 0%/0%`） | `0` |
| `RG-MN` | `hard` → `soft` | `7e4628cbec354183` | `14/30`（`mine 38/120`、`ring 26`） | `+11.3764` | `89.4%` | `41.6%` | `pass` | `0` |
| **`PUR-2P`** | 新入 `hard`（替代 `R-GD12`） | `25140b2b9bc576e6` | `17/30`（`purify 1/120` 10 次、`rod 2`、`ring 14`） | `+34.6941` | `16.2%` | `13.6%` | 通过（`G4 0%/0%` `G5 0%/0%`） | `0` |
| `R-GD12` | `hard` → `soft` | `7e55abc3894ca3e2` | `13/30`（`ring 33/120`、`railgun 30`） | `+15.8858` | `62.6%` | `14.6%` | `pass` | `0` |

> 淘汰探索臂说明（保留于 `scratch/arms/`，未入池）：`nov26-cn2-s25`（高剂量 `cannon 84/120`）在 `Arena B` 退化至 `-16.54pt` 并刷 `90210` 反弹格；以 `RG-CN` 为师的 `--rolloutMode=game` 臂未传出 `cannon`，暂继续由现役 `RG-CN` 在 `hard` 承载 `cannon`。

> `MN-DR` 复核：promote 回执中的「五道地板 · 场B清场 0/局」是**只记录诊断项**，不是 promote 的实际阻断集合；实际阻断走 G4/G5。2026-11-26 复跑 [`promote-MN-DR-recheck.txt`](../artifacts/promote-MN-DR-recheck.txt) 为 exit 0、G4/G5 全过。

---

## 三、`nov22-c3g-s300k` 退役与 `34` 池终态

- `OBS6E9`/`RG-MN`/`R-GD12` 下放 `soft` 后，`soft` 带内中位抬升，原在册自动成员 `nov22-c3g-s300k`（`Arena B -27.5473pt`，`multi 只防御 41.0% / 只枪压制 57.5% / 自适应 45.5%`）在带内人席参照下从 `seatKill=0` 变为 **`seatKill=3`** 触发 `D234` 红牌。
- 已将 `champion-map/data/skill-report/nov22-c3g-s300k.json` 备份至仓外隔离目录 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-26\` 后执行 `pool-add --retire=nov22-c3g-s300k`（`.bak` 原件保留于 `docs/artifacts/nov22-c3g-s300k.bak`）。
- 终态池：**34 枚（`hard 17 / soft 17`）**；`node tools/pool-add.mjs --audit` 报 `untracked=0, dupWid=0, blockedAuto=0, seatKilledAuto=0, arenaFloor=1, bad=[]`。
- Stage 1 并集：`all(34)` `>=3` 格 **`28/30`**（`miniT` 合计 `14`、`purify` `7`、`jinshield` `45`、`mine` `94`）；`hard(17)` `>0` 格 `28/30`、`>=3` 格 **`27/30`**（恢复 `hard miniT` 覆盖：`MT-DR 5 + JN-DR 3`）；`soft(17)` `27/30`。

---

## 四、终态 `34` 池难度阶梯（`probe-diff-ladder --pool=1`）

| 桌型 / 口径 | 局数 / seed | 困难（`lv:hard`） | 普通（`lv:regular`） | 简单（`lv:sparring`） | 档间差（vs `lv:regular`） |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `2P standard` · `rule` 替身 | `1500g` / `95001` | **`37.5%`** | `46.4%` | `59.5%` | `-8.87 ±3.34pt (5.2σ)` ‖ `+13.07 ±3.51pt (7.3σ)` |
| `2P standard` · `legacy` 替身 | `1500g` / `95001` | **`21.3%`** | `25.9%` | `30.3%` | `-4.60 ±2.73pt (3.3σ)` ‖ `+4.33 ±3.02pt (2.8σ)` |
| `5P multi` · `rand` 替身 | `800g` / `95002` | **`2.8%`** | `12.5%` | `16.5%` | `-9.75 ±2.48pt (7.7σ)` ‖ `+4.00 ±3.35pt (2.3σ)` |
| `5P multi` · `rand` 替身 | `400g` / `95001` | **`3.8%`** | `15.3%` | `15.0%` | `-11.50 ±3.76pt (6.0σ)` ‖ `-0.25 ±4.88pt (0.1σ)` |
| `5P long` · `rand` 替身 | `400g` / `95001` | **`6.8%`** | `9.5%` | `17.3%` | `-2.75 ±3.56pt (1.5σ)` ‖ `+7.75 ±4.35pt (3.5σ)` |
