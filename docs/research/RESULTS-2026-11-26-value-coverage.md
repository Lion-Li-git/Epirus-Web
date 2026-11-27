# 研究结果：高浪费低胜率包的价值×覆盖重构与 `FS-DR` 替换 `FC-G1`（2026-11-26 收口版）

> **对应计划**：[`PLAN-2026-11-26-value-coverage.md`](PLAN-2026-11-26-value-coverage.md) · [`PREREG-2026-11-26-use-value-pilot.md`](PREREG-2026-11-26-use-value-pilot.md)  
> **证据目录**：[`evidence-2026-11-26-value-coverage/`](evidence-2026-11-26-value-coverage/)  
> **状态**：**已完成并收口至 `v2.1.37`**（v2.1.33 完成 A1/A2 与 `FS-DR` 替换 `FC-G1` · v2.1.34 修复 [`training/proto2/pg-train.mjs`](../../training/proto2/pg-train.mjs) 反 REINFORCE 梯度符号并纳入 `PG-DR` · v2.1.35 用真电珠闭环 **`PG-CN`** 替换 `CN-DR` · v2.1.36 按人数修技能剖面并以 **`TK-PG`** 替换 `MX8-R6C-KL` · v2.1.37 在 **`hard`** 替换三名高废珠主力 **`MT-DR`/`MN-DR`/`ROD-DR`** → **`MT-PG`/`MN-PG`/`RD-PG`** 并补全 `PG-DR.json` Stage 2，全池维持 `34` 枚 `17/17`）。

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

---

## 5. `v2.1.34` 续波：修复 `pg-train.mjs` 梯度反号 Bug ＆ `CN-DR` / `PG-DR` 替换 `RG-CN` / `nov21-purify-dsp0`

### 5.1 根因定位：`training/proto2/pg-train.mjs` 反 REINFORCE 符号翻转
- **现象**：按 §4 队列向 `DR-R3E` / `RG-CN` 施加 `--penDeadElec` / `--lamExp` 后，`死电/局` 不降反倍增（`0.65 → 1.24`），且总净分退化。
- **定位与验证**：[`training/proto2/pg-lib.mjs`](../../training/proto2/pg-lib.mjs) `dLogPi` 返回 **`+∂logπ/∂logits`**（`selftest3` 六腿核实与 `DR-R3E` 单步试探证实：`pv -= 0.0001*grad` 不升反降，`pv += 0.0001*grad` 将被选动作概率从 `0` 升至 `0.314870`）；`pg-train.mjs` KL 锚（`-qk·u`）与 `supfit-gd.mjs`（`-w·u`）均已取负以配合 Adam 的 `pv[d] -= LR*step`，唯独第 518 行 REINFORCE 写作 `g[j] *= A`（漏负号）。
- **修复与锁死**：在 [`pg-train.mjs`](../../training/proto2/pg-train.mjs#L517-L518) 改为 `g[j] *= -A;`，并在 [`tools/gates/meta-repo.mjs`](../../tools/gates/meta-repo.mjs) `L3` 加静态正则与 `pg-lib.mjs` 单步上升数值回归门。修号后同配方立即奏效：`DR-R3E` 首臂（`nov26-pg-dr-s2`，`--klModes=standard --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15`）将 `死电/局` 压至 `0.049`、电珠过期 `267 (77.6%) → 30 (32.6%)`；对照 `FS2-LE26` 同配方将总废珠率压至 `10.8%`（`boom 658/647/6`, `fs 225/225`）。

### 5.2 两枚入 `hard` 替代包验证与退池交接（`fx-pool1126c`）
- **`CN-DR`（[`docs/artifacts/CN-DR.bak`](../artifacts/CN-DR.bak) · `wid=7b92bfbbfdc5d756`，替 `RG-CN`）**：`DR-R3E` 底 + PG 减珠 `nov26-pg-rgcn-s1.seg2400` + `T65(2:standard@0.80)`；6 粒 `Arena B +30.9588pt`（6/6 正，较 `RG-CN -1.99pt` 大幅跃升）、`fx-pool1126c` Stage 1 **`51.3%`** / `18/30` / `Stage 2 = 25 技`、`elec` 过期 `86`（较 `RG-CN 1517` 降 `17.6×`）、保留 `hard` 唯一 `cannon` 覆盖，`2P 19.0%/16.3%`（原 `RG-CN 77.0%`），`promote` **0 阻断**、`seatKill=0`、`H=49 / S=1.77`。
- **`PG-DR`（[`docs/artifacts/PG-DR.bak`](../artifacts/PG-DR.bak) · `wid=93064163aa5e563b`，替 `nov21-purify-dsp0`）**：`nov26-pg-dr-s2.seg2400` + `DR-R3E(2:standard@0.85)` 短程 2P 抛光；6 粒 `Arena B +15.9117pt`（`H=58.3 / S=1.46`）、`fx-pool1126c` Stage 1 `16/30` / `Stage 2 = 24 技`、`charge` `84` 次得珠 **`65` 已花 / `19` 过期（花珠闭环 `77.4%`、废珠 `22.6%`）**（原 `nov21-purify-dsp0 97.3% / 1821 过期`），`2P 21.0%/18.7%`，`promote` **0 阻断**、`seatKill=0`。
- 退役两包的 `.json` 均先备份至仓外隔离目录 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-26\champion-map\data\skill-report\` 再执行 `pool-add --retire`（`.bak` 保留在 `docs/artifacts/`），同时修复 [`champion-map/viewer.mjs`](../../champion-map/viewer.mjs) `roundTrip()` 的 `st.color = 'fam'` 隔离（4 视图 `map-selfcheck` 均 `101 PASS / 0 FAIL`）。

### 5.3 `fx-pool1126c` 更新后 `34` 池结构与难度阶梯（`hard 17 / soft 17` · `bad=[]`）
- **带内指标（`pool-xray` / `diversity-full`）**：`hard`（17 枚）`arenaB` 中位升至 **`17.9pt`**（v2.1.33 `16.6pt`），并集维持 **`27` 技**，簇内成对 L1 中位 `0.292`（质心 `0.215`）；`soft`（17 枚）`arenaB` 中位 **`2.3pt`**，并集 **`27` 技**，簇内成对 L1 中位 `0.454`。
- **难度阶梯（`probe-diff-ladder.mjs --pool=1`）**：
  - `2P rule`（1500g `95001`）：困难 **`32.8%`** < 普通 **`45.5%`** < 简单 **`59.5%`**（`-12.67 ±3.21pt, 7.7σ` / `+14.00 ±3.54pt, 7.7σ`）；
  - `2P legacy`（1500g `95001`）：困难 **`21.7%`** < 普通 **`25.0%`** < 简单 **`30.3%`**（`-3.27 ±2.70pt, 2.4σ` / `+5.27 ±3.03pt, 3.4σ`）；
  - `5P multi`（800g `95002`）：困难 **`2.5%`** < 普通 **`11.4%`** < 简单 **`16.5%`**（`-8.88 ±2.44pt, 7.1σ` / `+5.13 ±3.37pt, 3.0σ`）；
  - `5P long`（400g `95001`）：困难 **`3.0%`** < 普通 **`8.0%`** < 简单 **`17.3%`**（`-5.00 ±3.06pt, 3.2σ` / `+9.25 ±4.09pt, 4.4σ`）。
- **下轮优先队列（[`replacement-priority.tsv`](evidence-2026-11-26-value-coverage/replacement-priority.tsv)）**：`hard` 侧高废珠前排现剩 `nov21-taunt-dsp0b`（`97.8%`）、`TF-DR`（`94.0%`）、`MN-DR`（`91.8%`）、`MT-DR`（`91.2%`）；`soft` 侧仍为 `MX8-R6C-KL`（保 `armor/rod` 覆盖下升级）。

---

## 6. `v2.1.35` 收口：`PG-CN` 补全 `3/5/8P` 电珠闭环＆重构 `skill-report.html` 闭环口径

- **根因诊断**：[`CN-DR`](../artifacts/CN-DR.bak) 对 `RG-CN` 只砍掉了蓄电频次（`1587 → 99`，过期 `1517 → 86`），但全游戏唯一消费电珠的技能只有 `railgun`（[`js/core/state.js:157`](../../js/core/state.js#L157)），`CN-DR` 在 `3/5/8P` 的 `railgun` 出手为 `0`（仅 `2:multi 10/10`），直接再跑 PG 无法采样花珠（电珠闭环仍停 `10%`）。
- **两步解法与入池验证（[`PG-CN.bak`](../artifacts/PG-CN.bak) · `wid=7e2ac4666074c364`）**：
  1. 先以 `CN-DR`（`G5 0%/0%`）为底、`3:multi,5:long,8:long` 向 `PG-DR` 借 `charge,railgun` 唤醒 `3/5/8P` 电磁炮（`nov26-cnrg-r1`，`G4 0.7%/0%`, `G5 1%/0%`, `2P 14.0%`）；
  2. 再以 `nov26-pgcn2-pg.seg1800` 接两段 `--beadSpendW=0.50 --penDeadElec=0.70 --lamExp=1.10 --klModes=standard` Stage C PG，训得 `PG-CN`（`nov26-pgcn2-pg3.seg2400`）：
     - `fx-pool1126d` `Stage 1`：**胜率 `57.3%`**、`17/30`、`Stage 2 = 25 技 消融 6`、**`电珠闭环 50.5% (56/111, 仅过期 53)`**、**`贴爆闭环 50% (5/10)`**、`cannon 151 (18 格)`；
     - `2P 19.3%/16.0%`，6 粒 `Arena B +30.3824pt`（6/6 正，`H=49.7/S=1.76`），`promote --dry --support=2` **0 阻断**，`90210/90211 seatKill=0`。
  3. `CN-DR.json` 依 `AGENTS.md §24` 备份至仓外隔离目录后退池，`fx-pool1126d`（`AR-TK2,DR-R3E,FS-DR,FS-G2,FS2-LE26`）全池阶梯：`2P rule 33.7% < 43.4% < 59.5%`、`2P legacy 21.8% < 24.7% < 30.3%`、`5P multi 3.0% < 12.4% < 16.5%`、`5P long 4.0% < 6.3% < 17.3%`。
- **页面消除混读（[`champion-map/build-skill-page.mjs`](../../champion-map/build-skill-page.mjs)）**：新增单卡顶部 `.clbar` 显式拆分 `电珠闭环` / `爆珠闭环` / `贴爆闭环`，将 `贴贴/天火` 的 `局闭环` 统一正名为 `贴爆闭环`，并区分 `<1%` 占比进入 `强制` 对照的 `蓄能` 行与真正闭环率。

## 7. `v2.1.36` 通宵班：人数剖面、坦克覆盖与 `TK-PG` 替换 `MX8-R6C-KL`

### 7.1 人数剖面结论

- 全池电磁炮 `uses/game` 在 multi 为 `2P .047 < 3P .076 < 5P .100 < 8P .115`，long 为 `.021 < .146 < .166 < .193`；2P 最少符合产品形状。
- `PG-CN` 电珠闭环：2P `24/24`，3P `12/22`，5P `15/36`，8P `5/29`；3/5/8P 合并 `32/87 = 36.8%`。总闭环 `50.5%` 不能代表人数剖面。
- 合法窗口诊断：`PG-CN` 在 3/5/8P 只要电磁炮合法且可负担，选择率接近 100%；瓶颈是电珠机会，不是键选择。
- 坦克：全池原始使用 `591`、非零格 `143`、兑现 `355/422 = 84.1%`；转移伤害原始使用 `1114`、非零格 `204`、兑现 `153/695 = 22.0%`。坦克优先按选择/机会窗口处理。
- transfer 诊断：TF-DR 声明兑现约 `0–42%`（long 多格为 0），AR-TK2 约 `19–100%`；不把更多 transfer 出手当目标。

### 7.2 训练线与淘汰

- R1（PG-DR 形状 PG）：3P 电珠事件 0、8P 仅 8 次，少蓄少废，淘汰。
- R2（PG-DR + FS2 charge/railgun）：蓄电事件 `84→3799`，仅 67 次兑现，胜率 `52.1%→39.8%`，淘汰。
- T1（FS-G2 + TK-FS4 tank）：坦克 `185` 次 / `49` 格 / `91.6%`，但电珠闭环 `58.0%→9.3%`，淘汰。
- T2（T1 上 PG 修珠经济）：坦克 `213` 次 / `56` 格 / `92.6%`、胜率 `42.8%`，电珠闭环仅 `15.3%`，转 T3。
- T3（T2 坦克教师蒸回 PG-DR，0.30）：坦克 `586` 次 / `66` 格 / `91.8%`、胜率 `54.8%`，但电珠/电磁炮归零，2P hard/regular `71–75%`、simple `60–63%`，阶梯倒挂，淘汰。
- T4（T3 低剂量镜像，0.10）：坦克 `27` 次 / `13` 格 / `95.8%`，Stage 1 `48.5% / 18/30`，电珠闭环 `40.8%`；2P rule/legacy 有序， promote 0 阻断，Arena B `+21.4494pt`，seatKill=0，入 soft。
- W1（PG-DR + taunt 0.25）：taunt `83` 格 / `100%`，但胜率 `37.0%`、电珠闭环 `12.9%`、电磁炮近乎归零，淘汰。
- W2（W1 低剂量镜像 0.10）：taunt `54` 格 / `99.0%`，但胜率 `41.2%`、电珠闭环 `22.4%`、电磁炮近乎归零，taunt 线收口。
- T5（T4 同剂量换 T3 教师）：坦克 `40` 次 / `19` 格 / `97.2%`、电珠闭环 `65.0%`、胜率 `46.8%`，2P/promote/Arena/seat 均过；但 5P long 单包 `38.5%`，比 MSB11/RINGB11/AR-TK2 都弱，暂不入池。
- T6（PUR-DR + T5 坦克教师）：selftest3 腿 C NaN，净化覆盖 `8→6` 格、兑现 `38/40→2/7`，淘汰。
- R3（RINGB11 railgun 教师 → PG-DR）：教师标签 railgun `154` 次，部署仅 `33` 次 / `5` 格，3P 归零，淘汰。
- T7（OBS6E9 强长程坦克教师 → PG-DR）：教师命中 tank `6` 次、标签 `2` 次，部署坦克 `0`，淘汰；坦克线收口。
- W3（MT-DR PG 珠经济修复）：废珠 `91.2%→74%`，未达 60% 目标；miniT 有效格 `14→11`，属于少蓄少废，淘汰。
- W4（TF2-RD transfer 教师 → PG-DR）：教师标签 transfer `116` 次，学生自访 `0%`、部署 `0`，胜率 `38.2%`，淘汰；高废珠训练线全部收口。

### 7.3 `TK-PG` 入池与净变化

- `TK-PG`（`wid=4fb5b59cb4e5a446`）入 soft，替换 `MX8-R6C-KL`；旧 raw 已按 `AGENTS.md §24` 移至仓外隔离目录。
- 废珠：`MX8-R6C-KL 93.3% → TK-PG 59.2%`；soft Arena B 中位 `2.3→4.1pt`；hard/soft 覆盖并集仍各 `27`，全池有效并集 `29/30` 不变。
- 2P 八 seed：rule `32.3% < 44.5% < 56.9%`，legacy `20.5% < 26.0% < 29.3%`。rule simple 较替换前下降约 `3.7pt`，但仍高于今晚起点 `54.5%`。
- 5P 八 seed（每 seed 400 局/档）：multi `0.7% < 13.0% < 18.5%`，long `1.7% < 15.5% < 26.1%`。对比替换前，hard 不变；multi 普通 `-0.44pt`、简单 `+0.47pt`；long 普通 `-1.34pt`、简单 `-0.41pt`。long 普通档软化约 `2.6σ`，其余变化在噪声内。
- 同抽签替换模拟（基线树只把 MX8 权重换成 TK-PG）：5P long 普通 `-1.06pt（4.4σ）`、简单 `-0.06pt`，确认普通档软化真实但幅度有限。RINGB11 替选模拟为普通 `-0.88pt`、简单 `+0.38pt`，但会移除全池最强 railgun 载体（1001 次）且原废珠仅 53%，故仍选 MX8。
- 同抽签 2P 替换模拟：rule 普通 `-0.88pt（9.1σ）`、简单 `-1.75pt（10.3σ）`；legacy 普通 `-0.13pt`、简单 `-0.34pt`。TK-PG 替 MX8 会让 rule 低档略软，但幅度小于池抽签重排造成的表观变化。
- 5P long 带级：hard 单带 `1.5%`，soft 单带 `24.5%`；低档回退主要来自 soft 带变软，不是 hard 不够强。

### 7.4 后续

- 防御消融：PG-DR 禁 guard/reflect/bagua 分别掉 `25.0/16.7/8.3pt`；TK-PG 禁 guard 掉 `8.3pt`、reflect 约 0、bagua 反增 `8.3pt`（12 局小样本）。防御并非整体白给，今晚不开 defTax 压制臂。
- soft 同抽签替换矩阵：MX8→TK-PG 的 5P long 普通/简单 `-1.06/-0.06pt`、2P rule 普通/简单 `-0.88/-1.75pt`；RINGB11 为 `-0.88/+0.38pt`、`-0.98/-1.71pt`；MSB11 为 `-0.88/-0.31pt`、`-1.41/-2.35pt`；AR-TK2 为 `-1.19/-1.84pt`、`-2.47/-3.40pt`。MX8 与 RINGB11 的难度代价接近，但 MX8 原废珠 93.3% 且 A2 已证 charge/guard 负收益，故仍选 MX8，保留最强 railgun 载体 RINGB11。
- 全池 `selftest3` 普查：34 枚中 17 绿 / 17 红；hard `8/9`、soft `9/8`。红只禁止继续梯度训练，不单独否决冻结推理；下一班选起点先查 `selftest3-pool-census.txt`，不再现场撞门。
- soft 5P long 探索性相关（n=17）：`tankShare` 与长程替身夺冠率 Spearman `+0.59`（坦克越多、长程越软）；`chargeClosure` 为 `-0.36`（闭环越好、长程越强）；`chargeShare` Pearson `+0.46`。样本小、多比较，只作为下一班假设：坦克候选必须同时保住电珠闭环，不能只看坦克格数。
- 高废珠前排仍为 `nov21-taunt-dsp0b 97.8%`、`TF-DR 94.0%`、`MN-DR 91.8%`、`MT-DR 91.2%`。
- soft 5P long 弱成员：`AR-TK2 33.25%`、`RINGB11 29.75%`、`MX8-R6B-KL 26.75%`、`MSB11 25.75%`；下一轮应优先用 soft fallout 或换带修复低档，而不是继续堆 hard。
- A2 仍只作探索性诊断；原预注册死卡 `v<=0` 与正式脚本判据不一致，未作为今晚入池依据。

---

## 8. 日班收口：主攻 `hard` 高废珠三连换代（`v2.1.37` · `MT-PG`/`MN-PG`/`RD-PG`）

- **补完 `PG-DR.json` Stage 2**：恢复前班截断的 24 技 / 9 消融原始普查并重烘 `skill-report.html`。
- **三条 `hard` 换代线（均过 `promote 0 阻断` + `90210/90211 seatKill=0` + `fx-pool1126d`）**：
  1. **`MT-PG`**（`wid=ac6271b6e10a6381`，替 `MT-DR`）：在绿色 `MT-DR` 上跑两段 Stage C PG（`s1 beadSpendW=0.50` → `s2 0.65`），`Stage 1` 胜率 **`56.3%`**、`16/30`、`miniT=39 (6 格)`、电珠 **`41.9% (13/31, 仅过期 18 vs MT-DR 271)`**、`Arena B +42.9809pt`（`6/6` 正，极差 `14.93pt`，全池第一）。
  2. **`MN-PG`**（`wid=a7272467c05792ea`，替 `MN-DR`）：`MN-DR` 属 `selftest3` 红线不直接跑 PG；改在绿色 `PG-DR` 注入 `MN-DR` `3/5/8P mine@0.65` 再用 `DR-R3E(2:standard@0.85)` 2P 抛光，`Stage 1` 胜率 **`54.5%`**、`17/30`、**`mine=302 (21 格 / 结算 25.9%)`**、电珠 **`66.7% (10/15, 仅过期 4 vs MN-DR 236)`**、`Arena B +40.7633pt`（`6/6` 正，极差 `60.52pt`，全池第二）。
  3. **`RD-PG`**（`wid=653e6bd461e6b6d9`，替 `ROD-DR`）：绿色 `ROD-DR` 单段 PG（选 `seg2700` 以消去 `seg1800` 90211 `multi 只防御 22.5%` 波动），`Stage 1` 胜率 **`52.3%`**、`17/30`、`rod=312 (14 格 / 结算 13.9%, 2:multi 10/10)`、电珠 **`38.8% (19/49, 仅过期 26 vs ROD-DR 121)`**、`Arena B +19.5179pt`。
- **对照放弃与 `soft` 下沉裁定**：`nov27-pgta-r1` 因 `G5[long] 37% > 25%` 阻断、`nov27-pgtf-r1` 因 `selftest3` 红与电珠跌回 `18.7%` 放弃；已退位的 `MT-DR / MN-DR / ROD-DR`（`Arena B +13.6..+28.1pt`、废珠 `82.9–91.8%`）不下沉至 `soft` 而直接退役，避免向 `soft` 回灌高废珠并压扁 `5P long` 阶梯。
- **全池变化与阶梯复核**：`hard`（17 枚）`Arena B` 中位 **`+19.52pt`**、废珠中位 **`51.85%`**、并集 `27` 技；`soft`（17 枚）`Arena B` 中位 **`+4.09pt`**、并集 `27` 技；3 个替换位 `Stage 1` 过期电珠合计 **`628 → 48`（降 `13.1×`）**。`probe-diff-ladder --pool=1`：`2P rule`（1500g `95001`）`32.93% < 42.40% < 57.07%`、`2P legacy` `21.20% < 25.27% < 27.73%`、`5P multi`（800g `95002`）`3.63% < 12.00% < 17.13%`、`5P long`（400g `95001`）`3.75% < 7.25% < 13.25%`，四桌形全过。
