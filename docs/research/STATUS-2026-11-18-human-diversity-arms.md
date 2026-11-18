# STATUS (2026-11-18) — 人类替身重做、风格差异化与 B 轴（bp1118）联动训练进展

> 本轮围绕两大问题展开：① 现役人类替身失真（随机指人且无局势判断，把 5P 难度阶梯跑反）；② 冠军池风格高度趋同（`EQ-S4`/`GD6A` 单系，对 `聚能环` 缺施压、反墙弱、`heavy/holo` 稀缺），结合 GLM 昨晚 B 轴（`PLAN-2026-11-17-baxis-next-glm.md` / `bp1118` 五墙）跑出对照与多营训练产物。配置旋钮定义遵循 [`training/TRAINING-KNOBS.md`](../../training/TRAINING-KNOBS.md)。

---

## 一、真人对局 vs 替身 vs 现役池（问题定位）

1. **真人 9 局实盘（`results/obs6.5/*.txt` 去重统计）**：
   - 人类 P1 夺冠 **4/9（~44%）**（含困难档 2/4）；P1 出招分布集中在：`ジ 97` · `聚能环 60（6.7/局）` · `真正的落雷 22（2.4/局）` · `枪 11` · `激光剑 8` · `狙击枪 6` · `摄魂指法 6` · `反弹 5` · `蓄能 4 / 电磁炮 4` · `地雷 3` · `原型制御 2`。P1 定向攻击 **57/57** 指在 `ep ≥ 3` 或高威胁目标。
   - 同桌 AI 席（~45 席次累计）：`聚能环 0`、`过载炮 0`、`真正的落雷 2`、`摄魂 1`，而无目标压力的 `枪 218` + `八卦/反弹/防御 204` 占主导；`脚本·杂货铺` 虽席少却贡献了 `过载炮 6`、`藤甲 2`、`无极变速 2`、`全息屏障 1`——印证「脚本反而更擅长施压」。
2. **规则理解型人类替身落地**（未修改旧 `makeMimic` 与 `selfTest`，`D209`/`D153` 保持不变）：
   - [`tools/human-pool.mjs`](../../tools/human-pool.mjs) 新增导出 `makeRuleHuman(W, opts, rnd)`：实现规则穿透/反弹规避、护甲与原型识别、残血优先 `摄魂`/穿透斩杀、有珠即兑现、开局忍耐至 `3 ジ` 开 `聚能环` 连滚、对 `ringStreak/ep` 高威胁席打 `落雷/小雷/狙击`、被挑衅与符咒自清逻辑。
   - [`tools/probe-diff-ladder.mjs`](../../tools/probe-diff-ladder.mjs) 新增 `--surrogate=legacy|rule`（默认保持 `legacy` 不变）。
3. **5P 难度阶梯 `--pool=1`（300 局/档）替身对照**：
   - `--surrogate=legacy`（`multi`）：简单 `16.0%` → 普通 `16.7%` → 困难 `18.0%`（完全翻序）。
   - `--surrogate=rule`（`multi`）：困难 `18.7%` < 简单 `21.0%` < 普通 `21.3%`；`long`：困难 `18.0%` < 简单 `21.3%` < 普通 `25.7%`（困难恢复最硬，而 `简单` 因 0.7 概率掺入 `st:toolkit` 对开环人类施压反而略硬于 90% 纯池包的 `普通`）。

---

## 二、结合 GLM B 轴（`EXTA..EXTE`）的差异化风格训练与同尺对照

> 以下全部 A/B' 得分均在同口径 **3 轮 · `seed=77000`** 跑出（`X4m = multi`，`X4l = long`，`bpM = EXTA..EXTE` 5 墙均分）；规则人类施压胜率口径为 **5P `long` · 80 局轮座（1 席 `makeRuleHuman` vs 4 席被测）**。

| 包名 / 产物 | 来源 / 训练法 | `X4m` | `X4l` | `bpM` (`EXTA/B/C/D/E`) | 规则人类胜率 | `promote --dry` / 行为特点 |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| `EQ-S4-E9` | 现役主线对照 | `0.2896` | `0.3746` | `0.0596` (`EXTC=-0.108`) | `23.8%` | 高 A 轴、`bpM` 偏低、对开环零施压（`防御35.3%/环0%/昏手13.4%`） |
| `OBS6E9` | 池内真伤代表 | `0.2124` | `0.1894` | `0.0490` (`EXTE=-0.139`) | `6.3%` | 强施压（`snipe 2.59/seat`）、`holo 1.40`、`EXTE` 短板 |
| `OBS6P9-S4000` | 仓内已过线高 `bpM` 基底 | `0.2148` | `0.3427` | `0.1289` (`EXTB=-0.034`) | `2.5%` | `promote.tsv` 已 `pass`、未入池；高长程与双穿压制（`镜像破局 0%`） |
| `OBS6-SHAPEDIST-V3S2` | 反墙基底（原 `block:3`） | `0.2222` | `0.1216` | `0.1357`（五墙全正） | `15.0%` | 珠经济未闭环、长程偏软 |
| **`DIV-V3-PRESSURE.seg2000`** | `V3S2` + `pg-train` 2000 局（反墙+异源强包） | `0.1542` | **`0.2438`** | **`0.1560`**（五墙全正：`+0.165/+0.039/+0.247/+0.284/+0.045`） | `12.5%` | `X4l` 较基底翻倍；五道可行性与广度（`5.34/5.13`）全过，G4 中位失分 **2.0%–4.7%**，仅卡在 `G4/G5[只防御]`（`64%–70%`） |
| **`DIV-V3-ANTIDEF`** | `DIV-V3-PRESSURE.seg2000` + `pg-train` 加 `defend/wall` | `0.1629` | `0.0926` | **`0.1354`**（五墙最均衡：`+0.140/+0.091/+0.205/+0.160/+0.082`） | `18.8%` | 4×AI vs 1 `pickDefend` 压到 `2%`，仍因自对局偏防（`defense 83.6%, tank=0`）在 G4/G5（4×`defend` vs 1 AI）卡 `60%–69%` |
| `OBS6-LH6` | 重火力基底（`heavy=16.65`） | `0.0411` | `0.1378` | `0.1253` (`EXTE=-0.012`) | `1.3%` | 极强压制，但卡 `墙/场A/multi广度` |
| **`DIV-LH6-HEAVY.seg2000`** | `LH6` + `pg-train` 2000 局（`klTilt` 重火力+花珠） | **`0.1809`** | `0.1617` | **`0.1315`**（五墙全正：`EXTE=+0.096`） | **`2.5%`** | **花珠率闭环 50.9%**（`17得/12耗`），`X4m` 由 `0.04` 抬至 `0.18`，但 `multi` 广度 `2.88 < 3` 及 `场A/墙` 仍待提 |
| **`DIV-P9-PRESSURE.seg2000`** | `P9` + `pg-train` 2000 局（`holo/bigT/railgun` 倾斜） | `0.1092` | **`0.2957`** | `0.0976` | **`3.8%`** | 全息 `0.5/局`、`G_role=3.48`、反弹墙 `3.95/局`（狙 79）、反退化 `22.1%`，卡 `场B 清场` 与 `G5[defend]` |
| `DIV-SYNERGY-P9` (`supfit-gd`) | `P9` + `ringEcon/ration6/antiReflect` 直蒸 | `0.1383` | `0.1948` | `-0.0731` | `40.0%` | 虽学会 `charge/railgun/holo` 闭环，但 `lr=2e-3` 冲垮旧权重（证实高 `bpM` 包不宜用强监督蒸馏直盖） |

---

## 三、异源混桌实证：多风格组合明显改善施压（5P `long` × 100 局）

- **5× `EQ-S4-E9`（现状单调）**：规则人类胜率 **`25.0%`**，平均局长 `27.8`，AI `bigT 0.00/局 · railgun 0.09/局`。
- **4-Camp 异源组合**（`DIV-V3-PRESSURE.seg2000` + `DIV-LH6-HEAVY.seg2000` + `OBS6P9-S4000` + `OBS6E9`）：规则人类胜率骤降至 **`3.0%`**（−22.0pt，平均局长 `50.8`）。
- **5-Camp 异源组合**（再加 `DIV-P9-PRESSURE.seg2000` 与 `MX8-R6C-KL`）：规则人类胜率 **`12.0%`**，`AI railgun` 升至 `0.17/局`。

---

## 四、后续接力建议（未改动在册池/registry/bundle）

1. **优先低成本入池候选**：`OBS6P9-S4000.bak` 在 `promote.tsv` 已 `pass`，且具备 `bpM=+0.1289`（3 轮）与 `RuleHuman=2.5%` 的跨营优势，可直接做 **完整 100 轮 `exam-4n` + `probe-pool --banddef` 评估**后再由用户裁定是否纳入 `pool-members.tsv`。
2. **打穿 `V3` 系最后一个门（`G4/G5 只防御`）**：`DIV-V3-PRESSURE.seg2000` / `DIV-V3-ANTIDEF` 除 `pickDefend` 外已横扫 6/8 脚本且五墙全正；根因是 `sword` 被 `guard` 挡且 `tank=0`。下一步可用极小比例 `--onlySeg`（只训 `act` 头或极低 `teacher2=breakAll/antiReflect` 混合极低 `lr` + `defense` 罚项），只把 `tank/snipe/bigT` 对 `GUARD` 破防补齐，避免重走 `DIV-SYNERGY-P9` 冲垮 B 轴权重。
3. **重火力线（`LH6`）与合作线（`holo`）**：`LH6` 的 `50.9%` 花珠率证明 `pg-train` 可以保住重火力闭环，下一步需加 `--arenaPool` 里的 `protowall/reflectspam` 比重并略降 `guard` 倾斜以拉高 `multi` `G_eff` ≥ 3.2 与反弹墙伤害 ≥ 0.6/局。

---

## 五、门禁与工作区状态

- 改动代码与在册池资产：`tools/human-pool.mjs`、`tools/probe-diff-ladder.mjs`、`champion-map/data/page/pool-members.tsv`、`js/bundled-champion-pool.js`、`champion-map/index.html`。
- 实验训练产物统一存放在 `scratch/arms/style1118/`。

---

## 六、OBS6P9-S4000 正式入池 + 小雷开环 / 过载炮 / P9 续训对照（14:35–14:43）

1. **`OBS6P9-S4000` 入池落地**：
   - 10 轮 `exam-4n`：`multi X4m = 0.1397`（`skU=12/skE=12`）、`long X4l = 0.2722`（`skU=13/skE=12`），`promote.tsv` 为 `pass（—）`，`display.tsv` `bpM = +0.0847`（3 轮 `+0.1289`）。
   - 已通过 `pool-add.mjs --tier=hard --invite` 纳入 `hard` 带（`pool-members.tsv` 现 **21 枚：`hard 8 ‖ soft 13`**），重编 `js/bundled-champion-pool.js`（6394 KB）并同步演化图，`D234` 单项实测通过。
2. **三线接着训练同尺实测（A/B' 均 3 轮 `seed=77000`；`G5m_def` 为 1 `pickDefend` vs 4 AI 60 局）**：

| 产物 / 基底 | 来源 / 路线 | `X4m` | `X4l` | `bpM`（`EXTA–E`） | 特殊技能出手（60 局） / 防清 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `OBS6P9-S4000`（入池基底） | `promote=pass` | `0.2148` | `0.3427` | `+0.1289` | `holo=3, snipe=87` |
| `P9-CONT.seg2000` | `P9` + `gunspam/defend/V3` | `0.2072` | `0.1832` | `+0.1064` | `G5m_def = 52%`（PG 拉高偏防，反而不如原 `P9`） |
| `P9-CONT.bak` | 同上 4000 局 | `0.2021` | `0.1615` | `+0.1126` | `G5m_def = 58%` |
| `MX8-CN-M`（过载炮基底） | `soft` 在册 `cannon` 线 | **`0.3662`** | **`0.2889`** | `-0.0780` | `cannon=1, snipe=76`, `G5m_def = 13%` |
| `CN-CONT.seg2000` | `CN-M` + `EQ-S4/RINGB9/walls` | `0.2602` | `0.1360` | `-0.0706` | `railgun=2, snipe=87`, **`G5m_def = 8%`** |
| `CN-CONT.bak` | 同上 4000 局 | `0.2912` | `0.0951` | `-0.1143` | `cannon=3, railgun=1, snipe=90`, **`G5m_def = 7%`** |
| `RINGB9`（开环+T1基底） | `soft` 在册 T1 全三条 | `0.3595` | **`0.3679`** | `-0.0684` | `ring=24, bigT=5, rg=10, laser=21`, **`G5[long]=0%`** |
| **`RING-MINIT-CONT.seg2000`** | `RINGB9` + PG 2000 局（`ringspam/TF20`） | **`0.4102`** | **`0.3357`** | `-0.0660` | **`ring=31, rg=13, bigT=5, snipe=60`**, **`G5m_def=0% / G5l_def=3%`** |
| `RING-MINIT-SFT.bak` | `RINGB9` + `minit` SFT | `-0.0371` | `-0.0238` | `-0.1628` | `laser=101, rg=22, miniT=0`（再次印证高LR SFT 会洗塌结构） |
| `MX6-GD-TF20`（小雷+转移基底） | `soft` 在册 | `0.3535` | `0.2380` | `+0.0225` | `miniT=6, rg=7, cannon=1, snipe=34` |
| **`TF20-MINIRING.seg1500`** | `TF20` + PG 1500 局（`miniT+ring` 塑形） | **`0.3756`** | `0.2125` | `+0.0209` | `miniT=2, rg=7, transfer=11, snipe=32` |

- **结论与下步方向**：
  - `RING-MINIT-CONT.seg2000` 把 `RINGB9` 的 `X4m` 推到 **`0.4102`**、`ring` 从 `24→31` 且 **G5 清纯防席 `multi 0% / long 3%`**，可作为下一批 `hard`/`soft` 扩充前重点完整体检的**开环经济线**强候选。
  - `MX8-CN-M`（`X4m=0.3662`）与 `RINGB9`（`0.3595`）在 `A` 轴很强但 `bpM` 同为 `-0.07` 量级（同属 `GD6A/EQ-S4` 营）；要把「过载炮/小雷」同时做到正 `bpM`，更优路线是直接以 `OBS6P9-S4000` 或 `OBS6E9` 为底用小道蒸馏注入 `cannon`/`miniT`，而不是从 `EQ-S4` 家族强行扭转。

---

## 七、B 轴切 `bp1118` 5 墙混合、锁前缀注入训练与 5 枚多样性包入图（15:42–16:45）

1. **演化图 B 轴正式切为 GLM `bp1118` 5 墙混合尺**：
   - 注册表切换：[`champion-map/data/rulers.tsv`](../../champion-map/data/rulers.tsv) 新增 `b-bp1118-long-1118`（`axis=B, status=current, EXTA..EXTE`），原 `b-f5-page-1114` 转为 `status=reference` 保留作短程（`multi`）参照；[`champion-map/data/batches.tsv`](../../champion-map/data/batches.tsv) 增补批次行。
   - 数据并入与补洞：修复 [`tools/attach-bp-1118.mjs`](../../tools/attach-bp-1118.mjs) 原 `.slice(1)` 漏掉首行 `B-s63 EXTA 77000` 并去重 `626` 条断点续传重复行（零冲突 `diff=0`），将 `champion-map/data/exam4n-bp-1118.tsv` 共 **975** 枚的 `x2/x3/x5/x8` 长程分格读数（`3900` 行）并入 `readings/current.tsv` 与 `display.tsv` / `archive/2026-11-18-swap/coords-gen5-1118.tsv`。
   - 视图与趋势联动：[`champion-map/viewer.mjs`](../../champion-map/viewer.mjs) 默认桌形切换为 `long`（`默认（5血长程 · 5墙B轴）`），对 `long` 口径关闭跨夹具 `Δε` 误减（`DE4(d, 'L')` 显示 `未测`），并同步更新 [`champion-map/pipeline/build-view.mjs`](../../champion-map/pipeline/build-view.mjs)、[`champion-map/pipeline/build-trends.mjs`](../../champion-map/pipeline/build-trends.mjs)、[`champion-map/pipeline/measure-point.mjs`](../../champion-map/pipeline/measure-point.mjs)（新点测量自动跑 5 墙 `bp1118` + 并入 `exam4n-bp-1118.tsv`）及 [`champion-map/rebuild-map.mjs`](../../champion-map/rebuild-map.mjs)。
2. **`--onlySeg=skillHead` 锁骨干蒸馏+微调实测**：
   - **`P9-CN-MINI-S4` / `P9-CN-MINI-CONT`**（以 `OBS6P9-S4000` 为底，`rolloutMode=game` + `shapeBal=1` + `teacher2=cannon`/`teacher3=minit` + `--onlySeg=skillHead`，随后 `--onlySeg=skillHead` 1600 局 PG）：3 轮同尺下 **`P9-CN-MINI-CONT` 将 `bpM` 维持并升至 `+0.0869`（`EXTA +0.2253 / EXTE +0.0199`）**，保留 `cannon + holo + curse + snipe + sword`（3 轮 100 轮实测：`X4m=0.1555, X4l=0.1585, bpM=+0.0686, Geff=8.71`）；验证「只训 `skillHead`、冻结 `selfEnc/seatEnc/attn/ctx`」可注入稀有动作而不冲垮高 `bpM` 嵌入。
   - **`RING-MINIT-CONT.seg2000` 全门体检过线**：`node tools/promote-champion.mjs ... --dry --support=2` **0 阻断通过全部 12 道门**（`G(multi)=4.97 / G(long)=7.09 / G_role=4.27 (7/8 类)`、珠经济闭环 **73.8%**、反弹墙 `19.00/局`、`场A 22.3%`、`场B 清场 3.21/局`、`G5[long] 15%/25%`、`G5[multi] 0%/25%`、`G4 最克 19.7%/60%`）。
   - 负对照 **`V3-TANK-PG`**：在 `--arenaPool` 加 `defend/guardspam/wall/reflectspam` 的全网络 PG（`bpM=+0.1358` 五墙全正）虽压住防桌对攻，却把自对局拉成 `defense 87.0% / 场B 清场 0.00 / G5[long] 73%`，确认全网络强加防阵易诱导消极防反，优于留用原高压分支。
3. **精选 5 枚多样性新包正式测齐并入图（全图 `994 → 999` 枚，`100 PASS / 0 FAIL`）**：

| 入图 ID | 权重文件 | 家族 / 父节点 | `X4m` (A短) | `X4l` (A长) | `bpM` (5 墙) | `Geff` | 体检 / 特色定位 |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| **`DIV-V3-PRESSURE-S2`** | [`DIV-V3-PRESSURE-S2.bak`](../../docs/artifacts/obs6-coldstart/DIV-V3-PRESSURE-S2.bak) | `fam=24` ← `OBS6-SHAPEDIST-V3S2` | `0.2289` | `0.2273` | **`+0.1114`** (5/5墙`+`) | `5.09` | V3 高压输出与五墙兼顾线 |
| **`DIV-V3-ANTIDEF`** | [`DIV-V3-ANTIDEF.bak`](../../docs/artifacts/obs6-coldstart/DIV-V3-ANTIDEF.bak) | `fam=24` ← `DIV-V3-PRESSURE-S2` | `0.2157` | `0.1976` | **`+0.1223`** (5/5墙`+`, `EXTE +0.0360`) | `3.97` | V3 五墙均衡最优（`G5m_def` 压低版） |
| **`DIV-LH6-HEAVY-S2`** | [`DIV-LH6-HEAVY-S2.bak`](../../docs/artifacts/obs6-coldstart/DIV-LH6-HEAVY-S2.bak) | `fam=22` ← `OBS6-LH6P` | `0.1096` | `0.1281` | **`+0.1041`** (5/5墙`+`, `EXTE +0.0223`) | `3.39` | 重火力+花珠闭环线（`50.9%`） |
| **`RING-MINIT-CONT`** | [`RING-MINIT-CONT.bak`](../../docs/artifacts/obs6-coldstart/RING-MINIT-CONT.bak) | `fam=25` ← `RINGB9` | **`0.2976`** | **`0.2356`** | `-0.0864` | `5.06` | **`promote --dry` 全门 `pass`**，T1+开环经济线（**17:38 编入 `soft` 带**，池现 `22` 枚：`hard 8 ‖ soft 14`） |
| **`P9-CN-MINI-CONT`** | [`P9-CN-MINI-CONT.bak`](../../docs/artifacts/obs6-coldstart/P9-CN-MINI-CONT.bak) | `fam=22` ← `OBS6P9-S4000` | `0.1555` | `0.1585` | **`+0.0686`** (`EXTA +0.1602`) | **`8.71`** | 正 `bpM` 过载炮+`holo` 超宽广度线 |

- **B 轴 `trends.html` 短长分离说明（17:38）**：昨晚 `run-bp-fullmap-1118.mjs` 仅跑了 `--exam=B --mode=long`（未跑 `--mode=multi`），故 `P5R` 仍为 `b-f5-page-1114`（全图均值 `-0.0758`），而 `P5RL` 切为 `b-bp1118-long-1118`（5 墙均值 `-0.1176`，前段 `#0–#750` 被强新墙压至 `-0.1388`、新锐 `#850–#998` 拉齐回 `+0.03`）。已将 [`build-trends.mjs`](../../champion-map/pipeline/build-trends.mjs) 图例明确标为 `P5R（短·F5旧参照）` 与 `P5RL（长·bp1118五墙）` 防止混读。

---

## 八、B 轴升级为双程多人 Plackett-Luce Arena 尺（`b-arena-pl-1118`，17:50–18:20）

针对「单程更换 B 轴夹具导致短/长分离」与「固定夹具墙必有风格/座位偏置」两个根因，决定直接将演化图 B 轴升级为**无固定墙的多人 Plackett-Luce Arena 尺（`b-arena-pl-1118`）**：

1. **Arena 引擎与联盟标定**：
   - 新增 [`tools/arena-lib.mjs`](../../tools/arena-lib.mjs) 与 [`tools/arena-eval.mjs`](../../tools/arena-eval.mjs)（`rejectUnknownFlags` 严格校验，zero 新 env）。
   - 精选 **24 枚跨时代/多风格联盟锚点**（覆盖早期演化祖先、当前冠军池硬/软带与各风格分支）写入 [`champion-map/data/arena-league-1118.tsv`](../../champion-map/data/arena-league-1118.tsv)。
   - 联盟自对局标定 4,256 局后，`short` / `long` Arena 评分相关性达到 `corr(r_short, r_long) = 0.6696`。
2. **双程统一考卷设计与真值相关性验证（`n=24`）**：
   - 单点按 `2P:16 / 3P:24 / 5P:32 / 8P:16` 同时测 `short (multi, 88 局)` 与 `long (88 局)` 共 **176 局/包**，席位均匀抽样联盟锚点，并以多人 Plackett-Luce（MM 迭代，按对手已标定实力条件修正）估计 `rShort` / `rLong` 与零中心超额胜率 `arS` / `arL` / `arR`。
   - 对照 24 包 5 席多人桌真值与 1v1 轮转真值验证：
     - **`corr(Arena rAll, 5席桌战真值) = 0.6280`**（显著高于旧 5 墙 `bpM` 的 `0.5366`）；
     - **`corr(Arena rAll, 1v1 RR真值) = 0.5330`**，`corr(Arena long, 5席桌战) = 0.5701`，`corr(Arena short, 5席桌战) = 0.4788`；
     - `corr(Arena short, Arena long) = 0.5113`，且与 A 轴正交（**`corr(Arena rAll, A_long) = 0.0104`**）。
3. **全图重跑与双程曲线对齐**：
   - `node tools/arena-eval.mjs --all --jobs=14` 完成全部 **980/980**（`fail=0`）可用包的双程 Arena 评测（总计 `7,840` 行分格读数），产出 [`champion-map/data/exam4n-arena-1118.tsv`](../../champion-map/data/exam4n-arena-1118.tsv)。
   - 已将 `readings/current.tsv`（`57,524` 行）、`display.tsv`、`page/coords.tsv`、`rulers.tsv`（`b-arena-pl-1118` 设为 `current`）、`batches.tsv`、`viewer.mjs`（新增 `Arena分 arR` 着色档与剖面字段）、`build-trends.mjs`、`build-view.mjs`、`measure-point.mjs` 与 `rebuild-map.mjs` 全部接通，基线快照归档至 [`champion-map/archive/2026-11-18-arena/coords-gen6-arena-1118.tsv`](../../champion-map/archive/2026-11-18-arena/coords-gen6-arena-1118.tsv)。
   - **`trends.html` 双程对齐实测（全图 999 行按 `ts` 排序）**：
     - `P5R`（短·Arena B 轴）：全图均值 `-0.0718`（`early100 = -0.0939 → late100 = -0.0183`）
     - `P5RL`（长·Arena B 轴）：全图均值 `-0.1060`（`early100 = -0.1154 → late100 = -0.0076`）
     - `arS` vs `arL`：全图 `-0.0963` vs `-0.0933`（`early100 = -0.0924 vs -0.0934` → `late100 = -0.0223 vs -0.0006`）
     - `C5R` / `C5RL`：全图 `+0.0356` / `+0.0303`（`early100 = +0.0057 / -0.0080 → late100 = +0.1007 / +0.1154`），短长两条 B 轴曲线已落回同一尺度并一致刻画近端进化爬坡。


