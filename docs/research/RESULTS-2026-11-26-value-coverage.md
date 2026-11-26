# 研究结果：高浪费低胜率包的价值×覆盖重构与 `FS-DR` 替换 `FC-G1`（2026-11-26 收口版）

> **对应计划**：[`PLAN-2026-11-26-value-coverage.md`](PLAN-2026-11-26-value-coverage.md) · [`PREREG-2026-11-26-use-value-pilot.md`](PREREG-2026-11-26-use-value-pilot.md)  
> **证据目录**：[`evidence-2026-11-26-value-coverage/`](evidence-2026-11-26-value-coverage/)  
> **状态**：**已完成并收口至 `v2.1.33`**（A1 归因修复与全池验证完成 · A2 `N=100` 完整先导通过全部对照 · `FS-DR` 完整走完入池链并替代退役 `FC-G1`，全池维持 `34` 枚 `17/17`）。

---

## 1. A1：技能“出手-结算闭环”与归因口径修复（34 枚全池完成）

### 1.1 修复的三类事件归因口径（[`tools/pool-skill-report.mjs`](../../tools/pool-skill-report.mjs)）
1. **`rod`（避雷针）**：除旧 `rodBlock` 事件外，[`js/core/resolve.js`](../../js/core/resolve.js) 中 mode `'A'` 避雷针通过 `e.type === 'rod' && e.mode === 'A' && Array.isArray(e.pids) && e.pids.includes(seat) && e.voided && e.voided.length > 0` 记录真实无效化落雷。修复后，`ROD-DR` `rod` 闭环从原先误记的 `1/78 (1.3%)` 修正为 `fx-pool1126a` 下 `12/78 (15.4%)`（`2:multi 10/10`）、`fx-pool1126b` 下 `12/79 (15.2%)`（`2:multi 10/10`）；而 `TF2-RD` `rod` 仍为 `0/95 (0%)`（真实无引雷命中）。
2. **`mine`（地雷）**：`js/core/resolve.js` 的间接炸弹伤害将雷主数组写在 `e.from` 中；改按 `e.from === seat || (Array.isArray(e.from) && e.from.includes(seat))` 归因。修复后，`MN-DR` `mine` 闭环在 `fx-pool1126b` 下为 `28/106 (26.4%)`。
3. **`taunt`（挑衅）**：结合每回合 `roundActors` 追踪，`tauntCheck` 事件按 `!e.ok`（违规扣血）或 `roundActors.has(seat)`（对手按要求攻击指定席位）计入已兑现。`nov21-taunt-dsp0b` 的 `taunt` 闭环率从 `180/811 (22.2%)` 修正为 `fx-pool1126a` `811/811 (100%)`、`fx-pool1126b` `792/792 (100%)`。

### 1.2 验证结果
- **旧夹具回归对照（`fx-pool1126a`）**：[`validate-a1.mjs`](evidence-2026-11-26-value-coverage/validate-a1.mjs) 输出 `A1_VALIDATE_OK packs=34 legacyFieldsIdentical=15 chargeLedgerReconciled=34 holoPositiveControl=46/151`。
- **现役夹具汇总（`fx-pool1126b` · `AR-TK2,DR-R3E,FS-DR,FS-G2,FS2-LE26` · [`closure.tsv`](evidence-2026-11-26-value-coverage/closure.tsv) / [`replacement-priority.tsv`](evidence-2026-11-26-value-coverage/replacement-priority.tsv)）**：
  - `charge`（按事件）：`hard` 17 枚中位数仍分化显著——`TK-FS4` 浪费率 `16.7%`（`45/270`）、`T65-RINGBEAD` `17.1%`（`58/340`）、`FS2-LE26` `18.5%`（`329/1780`），`FS-DR` `53.9%`（`281/521`）；而 `nov21-taunt-dsp0b`（`97.8%`, `668/683`）、`nov21-purify-dsp0`（`97.3%`, `1821/1871`）、`RG-CN`（`95.6%`, `1517/1587`）仍居 `hard` 珠浪费前列，留作下一轮局部替换排序依据。

---

## 2. A2：`use-value` 单点替换反事实试验（`N=100` 先导完成）

在 [`probe-use-value-pilot.mjs`](evidence-2026-11-26-value-coverage/probe-use-value-pilot.mjs) 中将采样从烟雾 `N=1` 扩至正式 **`N=100`**，扩展至 10 个核心技能（`charge,gun,sword,guard,reflect,bagua,snipe,curse,firestorm,holo`），并将正对照组修正为 `snipe vs 4×guard`（替代早先无效的 `wall/ji` 对照）、死卡零对照扩至 `400g × 4R` 并按 95% 置信区间检验零效应（[`a2-pilot-full.log`](evidence-2026-11-26-value-coverage/a2-pilot-full.log) / [`use-value-pilot.tsv`](evidence-2026-11-26-value-coverage/use-value-pilot.tsv)）。

- **四项对照全过**：
  - `selfMaxAbs = 0`（`selfPass = true`）；
  - 正对照 `snipe vs 4×guard`：`n = 80`，`mean = +1.9625 ±0.1710`，`95% CI = [1.6273, 2.2977]`（`posPass = true`）；
  - 死卡零对照 `deadCharge`：`n = 1600`，`mean = +0.00875 ±0.01042`，`95% CI = [-0.01168, +0.02918]` 覆盖 0（`deadPass = true`）；
  - 跨种子稳定性（`95001` vs `95002`，23 格）：**`Spearman = 0.8419`**（`stabilityPass = true`）。
- **已检出的跨种子负价值动作（95% CI 全负）**：
  - **`FC-G1 curse`**：`seed 95001` **`-0.295`**（`n=100, 95% CI [-0.489, -0.101]`）、`seed 95002` **`-0.258`**（`n=100, 95% CI [-0.423, -0.092]`）——乱贴咒不闭环/误时机是净负收益，直接解释其 `99.4%` 废珠与全 `hard` 垫底胜率；
  - **`MX8-R6C-KL charge`**：`seed 95001` **`-0.1725`**（`[-0.313, -0.032]`）、`seed 95002` **`-0.1925`**（`[-0.322, -0.063]`）；`MX8-R6C-KL guard` 在 `95001` 亦为 **`-0.3372`**（`[-0.551, -0.123]`）。

---

## 3. 池成员优化：训练 `FS-DR` 并替换退役 `FC-G1`

### 3.1 问题定位与训练排查
- 原 **`FC-G1`**（`invited=1`, `promoteVerdict=block`）在 `hard` 中同时居于 `charge` 废珠率最高（`99.4%`）与 `fx-pool1126a Stage 1` 胜率最低（`36.4%`），且 `Arena B` 噪声地板显著偏弱。
- 从 `FS2-LE26.bak`（`selftest3` `6/6`，`TK-FS4.bak` 腿 C 失败故不用作续训底座）出发做多教师 `supfit` 蒸馏发现：**若次级教师（`DR-R3E` / `T65-RINGBEAD`）携带 `charge` 键，其 `charge#elec` 会覆写 `FS2-LE26` 的 `charge#boom → laserEye` 闭环，使 `boomGained` 跌回 `0`、废珠率飙至 `82.0%–94.8%`**；在 `--teacher2keys` 与 `--teacher3keys` 中剔除 `charge` 后保留 `boom 108/108`（`0` 过期）。

### 3.2 `FS-DR`（[`docs/artifacts/FS-DR.bak`](../artifacts/FS-DR.bak) · `wid=c46104966cb681fb`）完整入池验证
- **配方**：`--up=FS2-LE26.bak` + `--teacher=FS2-LE26.bak` + `--teacher2=DR-R3E.bak`（`--teacher2keys=ji,gun,sword,snipe,guard,reflect,bagua,ring,bigT,drain`）+ `--teacher3=T65-RINGBEAD.bak`（`--teacher3keys=ji,gun,sword,snipe,guard,reflect,bagua,ring`），`--rareOnly=firestorm --rareFrac=0.25 --rolloutMode=game --objective=cand --keySplit=1 --dagger=1 --snapEvery=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=2000 --steps=180 --lr=0.0002 --seed=20261134`，取 `snap0`。
- **`promote --dry --support=2`**（[`docs/artifacts/promote-FS-DR.txt`](../artifacts/promote-FS-DR.txt)）：**`0` 阻断**，`A 60.4%`，`G(multi)=4.92 / G(long)=5.30`，`S=1.840 / G_eff=6.29`，40g 珠经济闭环 `65.7%`（浪费 `34%`）、天火经济 `27/27`（`局闭环 79%`、空爆 `0`），`G4 long 1% / multi 8.7%`，`G5 long 0% / multi 1%`。
- **人席探针（`90210/90211`）**：`90210` `multi ≤13.0% / long ≤4.5%`，`90211` `multi ≤12.5% / long ≤4.3%`，**`seatKill=0`**。
- **测绘与前线地板**：`measure-point --bake` 落图（`H=60.8, S=1.581, arS=0.0685, arL=0.0795, arR=0.2733`），6 粒 seed `arena-noise-floor-1118.tsv` **`Arena B = +14.4545pt`**（极差 `63.23pt`）。
- **普查与闭环（`fx-pool1126b`）**：Stage 1 并集 `15/30`（有效 `13` 技），`charge` `521` 次得珠 `239` 次已花 / `281` 过期（浪费 `53.9%`，较 `FC-G1` `99.4%` 大幅下降），`firestorm 233/233 (100%)`；[`firestorm-closure-1124.tsv`](../../champion-map/data/firestorm-closure-1124.tsv) 统计贴手 `594` / 爆手 `510`（引爆率 `86%`、抓手率 `51%`、局闭环 `92%`）。
- **`FC-G1` 退役与池级校验**：`FC-G1.json` 按 `AGENTS.md §24` 备份至仓外隔离目录 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-26\` 后通过 `pool-add --retire=FC-G1` 退出；`pool-add --audit` **`members=34 (hard 17 / soft 17), untracked=0, dupWid=0, blockedAuto=0, seatKilledAuto=0, bad=[]`**。

### 3.3 更新后 `34` 池结构、并集与难度阶梯（`fx-pool1126b`）
- **带内指标（`pool-xray` / `diversity-full`）**：
  - `hard`（17 枚）：`arenaB` 中位 **`16.6pt`**，Stage 1 有效并集 **`27` 技**，簇内成对 L1 中位 `0.293`（质心距中位 `0.219`）；
  - `soft`（17 枚）：`arenaB` 中位 **`2.3pt`**，Stage 1 有效并集 **`27` 技**，簇内成对 L1 中位 `0.457`。
- **难度阶梯（`probe-diff-ladder.mjs --pool=1`）**：
  - **`2P`（1500 局，`seed=95001`）**：
    - `rule`：困难 **`37.4%`** < 普通 **`46.1%`** < 简单 **`59.5%`**（`-8.73 ±3.33pt, 5.1σ` / `+13.33 ±3.50pt, 7.5σ`）；
    - `legacy`：困难 **`21.0%`** < 普通 **`25.9%`** < 简单 **`30.3%`**（`-4.93 ±2.73pt, 3.5σ` / `+4.33 ±3.03pt, 2.8σ`）。
  - **`5P`**：
    - `multi`（800 局，`seed=95002`）：困难 **`3.1%`** < 普通 **`13.4%`** < 简单 **`16.5%`**（`-10.25 ±2.59pt, 7.8σ` / `+3.13 ±3.36pt, 1.8σ`）；
    - `long`（400 局，`seed=95001`）：困难 **`6.8%`** < 普通 **`9.0%`** < 简单 **`17.3%`**（`-2.25 ±3.56pt, 1.2σ` / `+8.25 ±4.28pt, 3.8σ`）。

---

## 4. 后续可继续的优先级队列

按 [`replacement-priority.tsv`](evidence-2026-11-26-value-coverage/replacement-priority.tsv)，后续可按「一次一替换 + 完整入池链 + 重测阶梯」继续优化高废珠成员：
1. `hard` 侧高废珠载体（`nov21-taunt-dsp0b` `97.8%`、`nov21-purify-dsp0` `97.3%`、`RG-CN` `95.6%`）做净收益与珠闭环蒸馏；
2. `soft` 侧 `MX8-R6C-KL`（A2 已证 `charge`/`guard` 负收益 + 高废珠 `93.3%`）在保住 `armor`/`rod` 覆盖的前提下替换升级；
3. 将 `probe-use-value-pilot.mjs` 中的 `use-value` 反事实诊查纳入后续候选包筛查流程。
