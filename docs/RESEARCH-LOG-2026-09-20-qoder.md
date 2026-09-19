# 通宵研究日志（千问 · 2026-09-19 深夜 → 09-20 晨）— 分支 `qoder-research-0920`

> 用户授权：代替 DS 做一晚训练研究，无特别限制，09-20 09:00 前停工；本分支可推送。
> **规矩（自守）**：不 promote、不碰 `js/bundled-champion*.js` 与 `index.html`（ring2-run 会自动还原，仍不去赌）；
> `results/*` 是用户私档，永不 add；产物 `.bak/.log` 被 .gitignore 忽略，只在本文点名（D82 家族口径）；
> 每个臂的判据**跑前写死**；防失忆：每次状态变化都更新本文（本文件是唯一进度真源）。

## 状态灯（最近一次更新在标题行时间戳）

- [00:2x] **DONE** = Q1 臂训练过半（seed 31/81/82/91/92 完成，93 在跑 200/250；教师 accepted=true、CLEAR_W=0.1 到 worker、谱系与 v7gf1 逐字同）
- [00:2x] **DONE** = 小修三件（已 commit）：① G6 读回跨行正则；② `G4IMPL` 实现身份 id + D67 双绑（冻结豁免基准 `caecc92f`）；③ **ring2-run 谱系事实核查 + `RING2_HOT` 显式开关**（见 §5 的新发现）
- [DOING] 等臂完 → 评估 G4/场A/场B/anatomy/V4 → 预注册判据裁定 Q1
- [pending] Q3：`EPIRUS_RING_W` 接 econ-env（补丁文本已备 §5b）→ 3 seed 探臂 → 合格包消融
- [pending] 全门禁复跑 + 本日志收尾 + push

## 5. 新发现（训练进行中顺手查的）——**"热启动 = 最新冠军"在 NP 臂路线上其实是假**

事实链（全部可复核）：
1. `ring2-run.mjs:85` **无条件覆写** `process.env.EPIRUS_BUNDLE_IN = staging`，随后每次 seed 前 `copyFileSync(BASE, STAGE_IN)`，
   `BASE = docs/artifacts/champion-5p-v1.3.58.bak` ⇒ 外部传的 `EPIRUS_BUNDLE_IN=js/bundled-champion-3p.js`（HANDOFF §1.2/§3 的启动命令）**整条被吞**。
2. 用 `train-server.weightsId` 同款算法实测：`v1.3.58.bak → d13d3c856c6cff62`、线上包 → `03b35fca…`；
   而 `v7ws1-91 / v7big1-92 / v7gf1-92 / 线上包` 的 meta `hotstartFrom` **全是 d13d…** ⇒ 全部臂与线上包**同谱系**（都从 v1.3.58 旧种子长出来）。
3. ⇒ HANDOFF §1.2"热启动起点改用最新冠军"与 §2.2"热启动真的生效的硬凭据（五道门读数逐项相同）"**归因错了**：
   读数逐项相同恰恰是因为**起点根本没换**；"种群 G 中位 3.55 vs 2.4"的差若要成立，变量得另找（池子/CLEAR_W/recipe）。
   ⚠️ 我没有重跑 §2.2 的实验，这条只是**谱系记账与代码事实**，不是对"G 变高"的否定。
4. A/B 可比性**没坏**（所有近期臂同谱系）——坏的是那句话说的是另一件事。
5. 修法（本版已做）：`RING2_HOT=<路径>` 显式开关（不设 ⇒ 默认行为逐字不变），产物 meta 的 `hotstartFrom` 变成可核对的"所选起点的 weightsId"。
   **留给早上的裁定**：要不要真做一次"从线上冠军热启动"的臂（第一次让 `RING2_HOT=js/bundled-champion-3p.js` 成为实验而不是口号）；
   以及 2P 侧 `train-best.mjs:61` 的"3P 侧早就是热启动（= 最新冠军）"同样要按本节口径改写。

## 5b. Q3 待打补丁文本（等臂完才动 js/server）

- `server/econ-env.mjs`：`ECON_ENV_KEYS` 追加 `'EPIRUS_RING_W'`；`ECON_REWARD_KEYS` 追加 `'ringW'`；`readEconEnv` 返回加 `ringW: nv(e.EPIRUS_RING_W)`。
- `js/train/evo.js`：`setEconomyReward(o)` 开头加 `if (o.ringW != null) setRingReward(o.ringW);`（D77 的 1200 字符窗口教训：写函数最前面）；
  `economyReward()` 回读字段加 `ringW: RING_W`。
- 臂配方：v7gf1 逐字 + `EPIRUS_BIGCARD_W=0.2` + `EPIRUS_RING_W=0.25`（线上默认 0.10 的 2.5 倍）；先 3 seed（31,82,92）。
- 合格判据（§2 原文）达标者上跑 `ABLATE_KEY=ring` 的 `probe-ring-ablate`（n=600），只回答"环值不值钱"。


## 0. 起点事实（HEAD = `c7076ac` · v1.5.134 · 指纹 `00e732a7`）

- 门禁基线：spec 45/45 · np-test 154/154（D67 走"已记录例外"：meta.gate4Pool=`960dfe0b` + 两行留痕）。
- DS 已证：珠爆发线 2P 重训后 100%→0%（我也用自己 6 条线复验 0 胜）；`forceAttack/aimGunner` 规则覆盖能两全
  （只枪 13%/0% + 场B 清场 1.00）⇒ **互斥是旋钮的性质不是游戏的**，差距在学习信号/形状。
- v1.5.134 §3：**瞄准是主因**（打枪手身上 3.27→5.00/局就 100% 拿下，不额外花钱；r=−0.82 跨 13 包）。
- 教师通道事实：`EPIRUS_IMIT_TEACHER=<名字>` 在 `evo.js` 的 `BOT_PICKS` 查表；`ring2-run.mjs` 是通用臂自跑器。
- 环奖励现状：`evo.js:1955 RING_W=0.10`（setRingReward，未接 econ-env ⇒ 臂间不可调）；贵卡 `EPIRUS_BIGCARD_W` 已接。

## 1. Q1 臂 ——「防守型瞄准教师」（预注册判据，跑前写死）

**假设**：模仿通道能直接买到"把伤害集中到压迫席身上 + 买得起就打"的行为（v1.5.134 §5 的形状假设的便宜替代）。
**实现**：`bots.js` 新 `pickAimDefender` —— 行为 = 击杀优先 → 否则打"本局对我方输出最高者"；出手 = 买得起枪就枪、
买得起狙且目标是攒珠型则狙；**不摆防御**（教师示范的是瞄准+花钱，不是龟）。evo `BOT_PICKS` 注册名 `aimdefender`。
**臂配方**：与 `v7gf1` 六臂**逐字相同**（池子/教师占比/热启动/CLEAR_W=0.1/DIV_W=0.3/24 席局），
**唯一变量 = `EPIRUS_IMIT_TEACHER=aimdefender`**（替掉 pickDeepSaver）⇒ 严格配对。seeds 31,81,82,91,92,93。
**通过（机制成立）**：≥2/6 seed 同时满足 ① G4[long] 只枪 ≤60% ② **场B 清场 ≥0.3**（不许用被动换绿）③ anatomy 基线行"打在枪手身上" ≥4.0/局。
**否证**：全 6 seed G4>60%，或凡 G4 绿者场B=0.00 ⇒ "模仿也只买得到躲"，此杠杆死刑、只剩形状法（Q2）。
**产物点名**：`v7aim1-{31,81,82,91,92,93}.bak`（预期；未 promote）。

## 2. Q3 臂 ——「既打环又会花贵卡」→ 重做环消融（预注册）

**假设**（handoff §4-2 原话）：要回答"环值不值钱"，需要**既打环、又会花贵卡**的包。
**实现**：给 `RING_W` 接 econ-env 单一来源（新键 `EPIRUS_RING_W`，D77 运行时往返自动盯）；臂 = v7gf1 配方 + `BIGCARD_W=0.1` + `RING_W` 抬到 0.25（奖惩不对称是环学不出来的阻力这条假设的正面检验）。
**合格判据（跑前定死）**：30 局自对局里 ring 出手 ≥100 次（线上包 346）且贵卡（大雷/地雷/净化/落雷/电磁炮）合计 ≥1%/回合、≥2 种非零。
**消融**：对**合格包**跑 `probe-ring-ablate`（V1/V2/V4 · n≥300 · 配对符号检验），如实报 pt 与 p——**只回答"环值不值钱"，不构成换包判据**。
**产物点名**：`v7rb1-{31,82,92}.bak`（先 3 seed 探路，长出合格包再补）。

## 3. 小修两件（不碰指纹文件优先）

1. `meta.g6` 恒 `{}`：`promote-champion` 的 G6 正则匹配标题行、值在 detail 行（v1.5.129 §7-3 自记）。
2. **G4POOL 实现缝**：把"实现身份"并入例外绑定的方式是设计题——直接改 `G4POOL_ID` 的哈希内容会让
   **在位包的 `--force` 例外瞬间失效**（D67 红）。方案：保留 `G4POOL_ID` 不动，**另发** `G4IMPL_ID`
   （对 COUNTERS 各格 chooser 源码 sha1），写进 meta；D67 判据改为"pool 与 impl 双绑，缺一即例外失效"。
   对已发货包做**一次性兼容**：无 `gate4Impl` 字段的旧 meta 只在**当前** id 组合下豁免（写死在门里，改一格实现即破豁免）。

## 4. 风险与回退

- 臂跑在 ring2-run 内（自带备份/还原 bundle 与 index.html）；我只额外保证：**不手改这两个文件**。
- np-test 若被我的改动弄红，红要在我自己的 commit 里闭环；闭环不了就回退该 commit。
- 明早 09:00 前：最终全门禁跑一遍 + 本文"状态灯"收尾盘点 + push。
