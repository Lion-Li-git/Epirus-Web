# HANDOFF (2026-11-20 12:10) —— 2.0 小族缺失权重逐位复现阶段收尾（24 / 40 已落仓）

> 前序：[STATUS-2026-11-20-night-zcode.md](STATUS-2026-11-20-night-zcode.md) §7.4
> 目标清单：40 枚 `2.0` 缺失包（`fam >= 14`），台账由本轮从 `566 -> 542`（-24）。

## 一、已完成并逐位核验落仓（24 / 40 · 8 个小族全部清零）

所有落仓文件均已验证 `champion-map/wid.mjs` 与在册 `lineage*.tsv` 逐位一致；含 `EPIRUS_CHAMPION_3P_META` 的文件已将 `.ts` 归一化回 `champion-map/data/registry.tsv` 在册值（`wid` 不变），`sha256` 已同步至 `registry.tsv`，`docs/ARTIFACT-LOSS-1119.tsv` 对应行已翻为 `ok`（15 枚 `docs/artifacts/**` 已 `git add -f`，9 枚 gitignored `scratch/` 按原路径写回磁盘）：

| 家族 | 完成度 | 产物 | 目标 wid | 复现 epoch / 备注 |
|---|---|---|---|---|
| `fam=14` | **5/5** | `scratch/arms/GD3-RATION.bak` | `12dc98cc2d37faa4` | `9a2ea202`（上游 `OB3S-C1/C2-s7` 逐位） |
| `fam=14` | **5/5** | `scratch/arms/GD3-SWORD.bak` | `04907be16715c376` | `b38e4f68` |
| `fam=14` | **5/5** | `scratch/arms/CLONE-D4a.bak` | `4de326c6c458fd1a` | `e48bcf32` |
| `fam=14` | **5/5** | `scratch/night4/D-a-s41-base.bak` | `3554dce2e90f6c38` | `1a5c02c3` |
| `fam=14` | **5/5** | `scratch/night4/CB-combo-v2.bak` | `67f23c7e371fdf97` | `018e68f6`（`348728e1` 过松闸前时代） |
| `fam=16` | **1/1** | `docs/artifacts/night-adapt/KD-Qg.bak` | `fa28800eae6a3d7c` | 已入库归位 |
| `fam=17` | **2/2** | `docs/artifacts/night-adapt/CTRL2-Q-s13.js` | `9b0cc330a1598a2a` | `90150d1b` |
| `fam=17` | **2/2** | `docs/artifacts/night-adapt/CTRL2-Q-s7.js` | `5a1d3ce77b2fd2c3` | `90150d1b` |
| `fam=21` | **3/3** | `scratch/arms/OBS6A4.seg1000.bak` | `926abc3011afa1c5` | 已入库归位 |
| `fam=21` | **3/3** | `scratch/arms/OBS6W2.seg1500.bak` | `0c644bba55163cf4` | 已入库归位 |
| `fam=21` | **3/3** | `scratch/arms/OBS6A5.seg1500.bak` | `5df273ff2c100d5c` | 已入库归位 |
| `fam=22` | **1/1** | `scratch/arms/OBS6D3.bak` | `3a4c893b9a286477` | 已入库归位 |
| `fam=23` | **10/10** | `OBS6-UNIFIED-{U1,U2.snap0,U4.snap0,U4,US1,US5}.bak` | `ccfb8317` / `1a442173` / `5439223b` / `71560b13` / `122ee611` / `a54cea42` | `eac2aeef` |
| `fam=23` | **10/10** | `EQ-E9-A1.bak`, `EQ-G-75S6.bak`, `EQ-SPL-75_S6m1.bak`, `EQ-S5-P9.bak` | `14b12342` / `6b221055` / `8d3c7ae3` / `f9fa26a0` | `08c29d18` |
| `fam=24` | **1/1** | `docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3H3.bak` | `e74ae5f8ef1c0d22` | `a0feae0f` |
| `fam=25` | **1/1** | `docs/artifacts/obs6-coldstart/TZPUR.bak` | `a222b68348f41260` | `96d523da`（经 `969d69f9` `MX7-T4-R` + `970f6eab` `EQ-S4-RINGEC6` 链复现） |

> 注：非缺失的前置依赖 `KDG-B-Q-s41.js`（`a36c5616ce4f470d`）与 `KDG-C-Q-s41.js`（`d82c2b8d938c13c1`）已在 `D:/code/wt-20-1114a` @ `fdb16eeb` 逐位复现并留存；`G5C-100.js` 在 `D:/code/wt-repro-1120k2/scratch/ds-1109/G5C-100.js`。

## 二、剩余 16 / 40 与本波收尾定性（`fam=19` 14 枚 + `fam=20` 2 枚）

### 1. 本波 `task-3978` 阻断定位：`KDO5C` 上游指纹偏差

- 在 `D:/code/wt-20-1114a` 跑了 `KDO5-seed` + `KDO5C`（@ `20cb5255`）→ `MSB2-R1S773345716` + `MSB2-R2S103437527`（@ `1cfed702`）：
  - `KDG-C-Q-s41.js` 逐位命中 `d82c2b8d938c13c1`。
  - 但 `KDO5C.bak` 产出 `wid=3c7c74e74faf1f67`，后续 `MSB2-R1S773345716.js` 产出 `wid=c87b75366bdded99`（三元组均值 `0.08355` vs `1cfed702:msbatch2-summary.json` 记录 `0.08905`）、`MSB2-R2S103437527.js` 产出 `wid=b5e0605d058737e2`。
  - 查 `champion-map/data/page/lineage.tsv` 第 927 行：`MSB2-R1S773345716` 在册真实父指纹为 **`2eecbe24`**，并非本次算出的 `3c7c74e74faf1f67`。
  - 因按用户指示收尾，已在跑第 3 步 `MSB2-R1S1494663071`（且单轮触发 `k 4→8` 名人堂重验耗时约 27 分钟）时中止任务并停表。
- **下一班第一件事**：先排查为何 `KDO5C` 真 `wid` 为 `2eecbe24`（核对 `KDO5-seed.bak` 的 `make-seed5.mjs` / `supfit-full.mjs` 实际执行 commit 与参数，如是否含未提交或不同 `steps`/`groups`/`seed`/`wKey`），拿到 `wid=2eecbe24...` 的 `KDO5C.bak` 后再跑 `MSB2` 链，**切勿直接沿用 `3c7c74e7`**。

### 2. `fam=19` 其余目标（14 枚）与 era 地图

- **第一程（上游 `KDO5C = 2eecbe24...` @ `1cfed702`）**：
  - `MSB2-R1S773345716.js` (`9af87c0242271767`) -> `MSB2-R2S103437527.js` (`95c7f5ac556956e5`) -> `MSB2-R1S1494663071.js` (`fadcd98fca6bea05`)
- **第二程（`MSB4` @ `d5bc275b`，`ADAPT/S916` @ `096c661d`）**：
  - `MSB4-R1S1928336850.js`（非缺失，串联上游 `MSB2-R1S1494663071` + `EPIRUS_FIT_CHAMP`）-> `K2-def-o5.bak`（教师 `docs/artifacts/kept/e70-out__D02-31.bak`）-> `ADAPT-DEF-O5-s916.js` (`90caef56fc1ea7dd`) -> 清除 `ADAPT-*` 环境变量后以干净 `rotation-obs5`（无 `HOLDOUT_SEG`）跑 `S916-R1S1704335642.js` (`829d9efa67c49d23`) -> `S916R2B-R1S685223462.js` (`8ae650b32e5e1009`)
- **第三程（`05e3e73b`，改用 `node training/train-3p.mjs 200 5 24 8` + `EPIRUS_HOLDOUT_SEG=50`）**：
  - `MSB6-R1S1628871127.js` (`693badb84c4892cd`) -> `MSB6-R2S501866988.js` (`5bca9995d72d1fa9`)、`MSB6-R2S297540638.js` (`d4fabbea581ccd6a`)
  - `MSB8-charge-R1S1861674281.js` (`6bd206eb57800661`，`EPIRUS_SEQ_W=2` + `EPIRUS_COURSE_PACK=scratch/ds-1109/G5C-100.js`)
  - `MSB8-bagua-R1S88974978.js` (`ff84eb7e4d632f68`，清掉 `EPIRUS_SEQ_W`，`EPIRUS_COURSE_PACK=scratch/ds-1109/WSEL9-200.js`)
  - `MSB9-R2S443656264.js` (`779a2165fa8fea49`，Round 1 保留 `MSB8-charge`，Round 2 从 `MSB8-charge` 以纯净 `rotation-obs5` 跑 `seed=443656264`)
  - `MSB10-R1S1149480262.js` (`f683e8d0c6537211`，`MSB8-bagua` + `EPIRUS_COURSE_PACK=scratch/ds-1109/WSEL9-200.js`)
  - `MSB12-beadplan-R1S666728707.js` (`a5f0e58c03edef98`，`MSB10` + `EPIRUS_BEAD_WASTE_W=1.0` + `EPIRUS_BIGCARD_W=0.5`)

### 3. `fam=20`（2 枚，下游接在 `MSB8-charge-R1S1861674281.js` 之后）

- `scratch/arms/GD6b-TILT-3p.bak` (`c9f9445217230402`)：在 `f349d0cd` 跑 `training/proto2/supfit-gd.mjs --upstream=docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js --teacher=ration --shapeBal=1 --keySplit=1 --rareOnly=bigT,ring --rareFrac=0.7 --steps=400 --groups=800 --lr=0.02 --out=scratch/arms/GD6b-TILT.bak --tag=GD6b-TILT`，再用 `1cc34488:scratch/zcode-1113-deps/proto2-to-3p-shell.mjs` 套 3P 外壳（权重不动，`wid` 保持 `c9f9445217230402`）。
- `docs/artifacts/MSB18-R1S826788378-seg2.bak` (`063bf6f23e7b5cc2`)：在 `f349d0cd` 以 `GD6b-TILT.bak` 为起点、`EPIRUS_HOLDOUT_SEG=50`、`EPIRUS_SEED=826788378` 跑 `gens=100` 取出 `-seg2.bak`。

## 三、门禁与仓状态验证

- `node tools/map-audit.mjs`：结构检查全过（在盘缺失 `566 -> 542`，字节 sha 不符保持 `86` 枚旧恢复件，本批 `24` 枚 `sha256` 全部精确对齐）。
- `node tools/gate-all.mjs --auto`（对应本批落仓修改）：**5 道全绿**——`np/meta 16/16 (15.7s)`、`spec 81/81 (0.3s)`、`smoke OK (13.6s)`、`battle OK (34.9s)`、`map OK (11.3s)`（注：按 `gate-all --auto` 规则仅为 `meta` 改动面门禁）。
- 临时复现 worktree（`wt-20-1114a`、`wt-20-1114b`、`wt-repro-*`）按 `AGENTS.md §24` 保守未做物理删库，主仓 `D:/code/Epirus-Web` 仅含本批 verified 产物与文书。
