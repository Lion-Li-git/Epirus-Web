# HANDOFF · 2026-11-21 通宵班（GLM 双线执行方案：2.0 收口 + 1.8 server 盲扫精配）

> 接力前序：[GOAL-2026-11-19-ruler-resolution.md](../GOAL-2026-11-19-ruler-resolution.md) ‖ [STATUS-2026-11-20-night-zcode.md](STATUS-2026-11-20-night-zcode.md) §十一 ‖ [MAP-PACK-INVENTORY.md](../MAP-PACK-INVENTORY.md) ‖ [TRAINING-RUN-LOG.md](../TRAINING-RUN-LOG.md)  
> 旋钮权威定义仅见 [`training/TRAINING-KNOBS.md`](../../training/TRAINING-KNOBS.md)（本交接不复抄）；每新跑一臂必须按规矩记入 [TRAINING-RUN-LOG.md](../TRAINING-RUN-LOG.md)。

---

## 一、当前交接基线（2026-11-21 22:05）

- **产品冠军池（27 枚：`hard 13 / soft 14`，`27/27` 全员在盘，`seatUnknown = 0`）**，全图共 **1,006 点**（`v1.8` `831` + `2.0` `175`；在盘 `571` = `485` 原封 `sha256` 一致 + `86` `META.ts` 归一化 `wid` 等价；无路径 `19`；**缺失 `416`** = `400` 早期 `1.8` `server` 批 + `16` `2.0` `KDO5-seed` 未播种随机根链已证死）。
- **全池必补技能已 100% 破零**：
  - `purify`（净化）：[`nov21-purify-dsp0.bak`](../artifacts/nov21-purify-dsp0.bak)（`hard`，`arenaB=+14.04pt`，`seatKill=0`，对活咒源条件净化 `0.27/局`，默认 Stage 1 夹具少咒源仅 `2` 次）；
  - `taunt`（挑衅）：[`nov21-taunt-dsp0b.bak`](../artifacts/nov21-taunt-dsp0b.bak)（`hard`，`arenaB=+17.92pt`，`seatKill=0`，Stage 1 **`95/120` 格 / `1,822` 次**）；
  - `rod`（避雷针）：[`nov21-rod-tzt2d-r10.bak`](../artifacts/nov21-rod-tzt2d-r10.bak)（`soft`，`arenaB=-30.4pt`，`promote` 0 阻断，`seatKill=2` 点名入池，Stage 1 **`17/120` 格 / `151` 次**）；
  - `mirror`（镜面反射）：已在 `GOAL` 书面裁定「可没有」，不排训练。

---

## 二、主线 A：2.0 冠军池 DoD 收口训练（按 A1 → A3 顺序执行）

> 统一红线：当前尺 DoD 完成前**不换尺**；所有入池改动走完整链 `promote --dry --support=2` → `measure-point --bake` → `pool-add` → `build-pool-bundle` → `pool-skill-report --bake` → `gate-all --auto`（`AGENTS.md §20`）；每跑一臂均登记至 [`docs/TRAINING-RUN-LOG.md`](../TRAINING-RUN-LOG.md)。

### A1（头号任务 · 一箭双雕达成 DoD #2 & #3）：训 `armor` 强载体，替换最后一枚软带负资产 `night2-X2b-fuse`

- **为什么最紧迫**：`night2-X2b-fuse`（`arenaB=-87.2pt`，废贴 `0/671`）是全池仅剩的负资产，但同时是**全池唯一的 `armor` 活跃载体（`1/27`）**——未补出合格 `armor` 替代品前直接 `--retire` 会导致 `armor` 重新归零。
- **实施步骤**：
  1. 在 [`training/proto2/supfit-gd.mjs`](../../training/proto2/supfit-gd.mjs) 检查或新增仅键道触发的 `armorPick`（当 `castCount(state, pid, R.SK.ARMOR) < 2` 且存在未处于 `fireWeakNow`/`fireWeakNext` 的高血量活敌时，对最高 HP 活敌出 `R.SK.ARMOR`；其余局面返回 `null` 交由主教师保底；改完即跑 `node --check training/proto2/supfit-gd.mjs` 与默认路径对证）。
  2. 采用已验证的 **DS-P0 强锚单键道公式**：以 `docs/artifacts/obs6-coldstart/EQ-S4-E9.bak`（或 `OBS6E9.bak`，自带 `tank 13/120` 活跃格）作 `--up` 与 `--teacher=pack:...`（占 `0.70`），配 `--teacher2=armor --teacher2keys=armor --teacher2frac=0.30 --rareOnly=armor --rareFrac=0.35 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6`：
     ```bash
     node training/train.mjs --mode=supfit --up=docs/artifacts/obs6-coldstart/EQ-S4-E9.bak --teacher=pack:docs/artifacts/obs6-coldstart/EQ-S4-E9.bak --teacher2=armor --teacher2keys=armor --teacher2frac=0.30 --rareOnly=armor --rareFrac=0.35 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6 --out=scratch/arms/nov21-armor-dsp0.bak --tag=nov21-armor-dsp0
     ```
  3. 第一枚产物落盘即验血统（`v:92 / arch:S1o / 16561`），测 `node tools/arena-noise-floor.mjs --json`、`node tools/promote-champion.mjs ... --dry --support=2` 与双种子 `node tools/probe-human-seat.mjs --seed=90210/90211`。
  4. 若过线且 Stage 1 `armor` 活跃（`≥1` 格）：拷贝入 `docs/artifacts/` 并 `git add -f`，走完整链入池（若 `arenaB ≥ 0pt` 且 `seatKill=0` 进 **`hard`**，否则进 `soft`），随后立即执行：
     ```bash
     node tools/pool-add.mjs --retire=night2-X2b-fuse
     node tools/build-pool-bundle.mjs
     node champion-map/rebuild-map.mjs
     node tools/pool-skill-report.mjs --bake
     ```
     完成对最后负资产的彻底清零。

### A2（次优任务）：补强 `hard` 带其余 `0/13` 技能（`firestorm / cannon / mine / rod`）或书面裁定

- **现状**：这 4 张卡在 `soft` 带均已有过线载体，但 `hard` 带活跃格数仍为 `0/13`（`GOAL` DoD #2 允许「补到有覆盖，或给出"不做"的书面裁定」）。
- **配方切入点（优先挑可快速冲击 `hard` 带 `≥0pt` 的项）**：
  1. **`firestorm`**：在 `EQ-S4-E9`（`+14.3pt`）或 `MX5-GD-T2STR`（`+20.5pt`）上下压 `detonate` 专科份额至 `0.18–0.22`；或以现役 `night2-E1-det-strong`（`-30.4pt`，引爆率 `122%`）起跑短程真强包混训 PG（`--arenaPool=names:pack:EQ-S4-E9,pack:OBS6P9-S4000,pack:MX5-GD-T2STR,aggro,wall --games=1500 --lr=1e-4 --klW=0.12`），验证能否保留闭环且将 `arenaB` 抬过 `0pt`。
  2. **`cannon` / `mine`**：在 `EQ-S4-E9` 上复用 DS-P0（`--teacher2=cannon --teacher2keys=cannon --teacher2frac=0.25 --rareOnly=cannon --rareFrac=0.35`，及同理新增的仅键道 `minePick`），尝试直出 `arenaB ≥ 0pt` 的 `hard` 带载体。
  3. 若实测某张卡跨进 `hard` 带必定洗塌战力或夜班预算不划算，可在 `GOAL` 明确记录机制与不做 `hard` 载体的书面裁定（保留 `soft` 带专门展示）。

### A3（留观加固）：修复 `nov21-rod-tzt2d-r10` 的 `multi` 人席 2 格弱点

- **病灶**：`nov21-rod-tzt2d-r10` 点名入 `soft` 带，但 `G4[multi]=49.7%` 骑线，且在 `multi` 人席被「只枪压制」（`76.5%/70.5%`）与「全程只防御」（`43.5%/37.5%`）克制（`seatKill=2`）。
- **单变量修法**：固定 `TZT2D` 底座与 `rod@0.25 + ring@0.10 + rareOnly=rod,ring@0.45` 不变，仅下压训练剂量（先试 `--steps=250` 或 `--lr=0.001`）：
  ```bash
  node training/train.mjs --mode=supfit --up=docs/artifacts/obs6-coldstart/TZT2D.bak --teacher=pack:docs/artifacts/obs6-coldstart/TZT2D.bak --teacher2=rod --teacher2keys=rod --teacher2frac=0.25 --teacher3=ring --teacher3keys=ring --teacher3frac=0.10 --rareOnly=rod,ring --rareFrac=0.45 --groups=2400 --steps=250 --lr=0.0015 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6 --out=scratch/arms/nov21-rod-tzt2d-r10b.bak --tag=nov21-rod-tzt2d-r10b
  ```
  若新产物 `promote` 0 阻断、`seatKill=0` 且 Stage 1 `rod ≥ 10/120` 格，则完整链入池并 `--retire=nov21-rod-tzt2d-r10`。

---

## 三、主线 B：`v1.8` `fam=1..6` 早期 `server` 74 批（400 枚）盲扫精配考古

- **目标清单**：`scratch/v7-mined/server-jobs-blind.tsv`（共 `74` 批，覆盖 `400` 枚唯一可追 `1.8` 缺件：`fam=4` `109`、`fam=6` `107`、`fam=5` `94`、`fam=3` `43`、`fam=1` `28`、`fam=2` `19`；注：`fam=19/20` 共 `16` 枚由未播种 `KDO5-seed` 永久阻断，不追）。
- **四条硬性操作纪律**：
  1. **严禁裸盲扫**：昨夜两轮无 env 覆写的裸盲扫已 `0` 命中，仅靠 `POOL_*` 阶梯猜测不可行。
  2. **先精配 `EPIRUS_*` 再扫**：每批开跑前，对照同族/邻批幸存者包内的 `EPIRUS_CHAMPION_3P_META.recipe.env`、[`docs/research/TRAINING-RECORDS-2026-11-20.md`](TRAINING-RECORDS-2026-11-20.md)、[`docs/research/COMMAND-CHECKUP-2026-11-20.md`](COMMAND-CHECKUP-2026-11-20.md) 与 [`docs/research/session-records-2026-11-20/`](session-records-2026-11-20/)，将批对应的 env 覆写（如 `EPIRUS_ECO_TARGET`、`EPIRUS_ECO_CAP`、`EPIRUS_ECO_DIVW`、`EPIRUS_DIV_W`、`EPIRUS_DIV_K`、`EPIRUS_DIV_ROLEW`、`EPIRUS_DIV_CATW`、`EPIRUS_WALL_FILTER`、`EPIRUS_TRAIN_GAMES` 等）精确注入 `ring2-run` 驱动 env。
  3. **回放与验真防坑**：
     - 每个 `seed` 前强制重新铺设时代槽根包（如 `e379c62ccd2648fa`），绝不跨 `seed` 链式热启动；
     - 凡产出 `wid === BASE`（`e379c62ccd2648fa`）一律判无效（落盘被拦后拷出了未变的槽，如 `v7wall-34` 案例）；
     - 命中真 `wid` 后：将 `META.ts` 归一化回 `champion-map/data/registry.tsv` 在册 `ts`，`git add -f` 入库，并同步更新 `registry.tsv` `sha256` 与 `docs/ARTIFACT-LOSS-1119.tsv`（`missing -> ok`）。
  4. **特殊子批处理**：
     - 缺 20 对手名单的 `v7big1 / v7press1 / v7press2`（18 枚）需先从 `e68ffc09..7134b299` 间历史或会话日志确认 20 人名单后再扫；
     - 若遇时代配方完整但多候选 `era` 均未命中（疑夹在会话未提交编辑中态的批次，如 `v7l2c / v7w3c / v7seat24`），保留记录，必要时按会话日志时序回放 `Write/Edit` 重构工作树。

---

## 四、通宵班并发与收工核验纪律

- **后台并发上限**：同时在跑后台任务/子代理严格 **≤ 2**（例如：1 路跑 2.0 训练或评测，1 路跑精配后的 `server` 批次回放；或双端口 `RING2_PORT` 错峰跑精配 `server` 批）。
- **夜班直接裁定执行（`AGENTS.md §23`）**：满足 DoD 且门禁全过的包直接入池/替换/入库留痕，不留待裁列表。
- **隔离搬迁铁律（`AGENTS.md §24`）**：禁止 `rmSync` / `Remove-Item` 物理删除旧权重或临时目录，一律保留相对路径挪入 `D:\code\Epirus-Web-artifacts-quarantine\`。
- **收工前必跑门禁**：
  ```bash
  node tools/map-audit.mjs
  node champion-map/rebuild-map.mjs
  node tools/gate-all.mjs --auto
  ```
