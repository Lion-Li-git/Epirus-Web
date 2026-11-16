# PLAN · 2026-11-16 晚 · S4 进池后的下一轮：经济出口（单变量版）

> 背景：`EQ-S4-E9` 已进 hard 池（池 23：hard14 / soft9）。它是当前唯一 `promote --dry --support=2` 全过、selftest3 6/6 的单包；代价是珠经济 0、G4[multi] 余量 0.7pt。
> 本计划遵守 `METHODOLOGY.md` §148.9：全过包冻结，下一轮只改一个变量，任一旧门回退即回滚。

## 〇、冻结基线

- 基线：`docs/artifacts/obs6-coldstart/EQ-S4-E9.bak`（hard 池成员）。
- 已记录：2P 96.8% · 短 C .336 / 长 C .2555 · G5 16/4 · G4[multi] 59.3/60 · wall 17/局 · 珠经济 0。
- **不再**把 SPLDIST / Soup80 / G4 / breadth / ECON-PG 当起点或教师；它们分别坏在 G4、广度、selftest、2P。

## 一、为什么上一轮失败

- SPL 有珠经济（56.3%）但 selftest3 红；把它当教师蒸到 S4，G5 好了、G4 坏了；
- 修 G4 用 S4 教 2multi，广度/gun 又坏；补广度，selftest 红；
- 从 S4 直接 PG 加 `beadSpendW`，S4 根本没有“珠可花”的状态，奖励发不出去，还先坏 selftest/2P。
→ 结论：**先让候选进入“有珠可花”的状态，再谈花珠奖励**；且只改长桌，不碰 2P/2multi。

## 二、下一轮只做一个实验：5long/8long 经济教师

### 变量
只把 `5:long`、`8:long` 的教师换成有珠经济的 `EQ-SPL-75_S6m1`；其余全部保持 S4：

- `2:standard`、`2:long`、`2:multi` = S4；
- `3:multi`、`5:multi` = S4（不把 SPL 带进 multi，避免上一轮 G4 崩）；
- `5:long`、`8:long` = SPL 0.45 + S4 0.40 + breakAll 0.15；
- 11 桌形配额沿用 EQ-S4（2:standard ×3、2:long、2:multi、3:multi、5:multi、8:multi、3:long、5:long ×2、8:long）；
- 1500 组 / 180 步 / lr 4e-4 / dagger=1；
- 输出：`EQ-S4-ECOTEACH`。

### 预注册验收（任一破即回滚 S4）
1. `selftest3` 6/6 绿；
2. 2P ≥96%（允许 ±0.5）；
3. 长 C ≥0.25；
4. G5[long/multi] ≤25%；
5. G4[multi] ≤60%；
6. 广度 G(long) ≥3；
7. 只记录：花珠率/railgun/bigT 部署；不要求一次到 50%。

### 判定
- 若 1–6 全过且 5long/8long 出现珠/电磁炮部署 → 进入 Phase B；
- 若任一门回退 → 丢弃，回 S4，不追下一个门；
- 若 1–6 全过但无珠 → 说明 SPL 教师传不过来，停，不再试 SPL。

## 三、Phase B（只有 Phase A 成功才开）

从 `EQ-S4-ECOTEACH` 起，**只对 5long/8long** 开短 PG：

- `--shapeModes=long`（加 `arenaShapes=5:long,8:long`）；
- `--beadSpendW=0.08`、`--dmgW=0.03`、`--defTax=0.01`、`--lamExp=0.20`；
- `--klW=0.18`、`--klModes=standard`（锁 2P）；
- 1500–2000 局；先 `selftest3`，红就停。

## 四、强度/池位规则

- **hard**：全门通过 + 2P ≥95% + 长 C ≥0.25；前线 ≥0.25 只记录（S4 前线 .2562）；
- **soft**：全门通过但 2P <90% 或 长 C <0.25 或 前线 <0.20；
- 当前池无 mid；S4 归 hard（2P 96.8 / 长 C .2555 / 前线 .2562，门全过）；
- 新候选不得因为“2P 高”自动进 hard；必须同时看 4N C/G4/G5/前线。

## 五、执行顺序与停止条件

1. 冻结 S4；写本计划；
2. 跑 Phase A（只变 5long/8long 教师）→ `selftest3` → `promote --dry`；
3. 任一旧门回退 → 停，记录负结果；
4. Phase A 成功才开 Phase B；
5. 最多两发；不连续追门。

## 六、证据/工具

- 基线：`docs/artifacts/obs6-coldstart/EQ-S4-E9.bak`；
- 教师：`scratch/arms/EQ-SPL-75_S6m1.bak`（selftest3 红，只能当教师）；
- 训练：`training/proto2/supfit-gd.mjs`（shapeTeachers/breakAll）；
- 门：`selftest3`、`promote --dry --support=2`、`exam-4n`、`eval-pilot`。

## 六·补：关于“全过且有珠经济”的 T8-s114

- `T8-s114` 确实 `promote` 全过、珠经济 77.5%，是**全过 + 经济**的真实反例；我此前说“只有 S4 全过”不准确。
- 但它是 **v7 专家**：2P 仅 **74.5%**（min 0）、长 C **0.081**；用卡 charge 6%/railgun 4%。它全过的是**行为门**，不是统一 2P/8P 强度。
- 正确定位：T8 是**经济教师/5P 专家**，不是统一底座；用它替换 SPL 教 `5:long/8:long`，比用插值包合理。

## 七、Phase A 实测结果（2026-11-16 21:4x）
## 〇·补：2026-11-16 21:5x 筛选原则修正（用户裁定）

- **强度不是第一筛选**。2P/长 C 略降可以接受，后面再用蒸馏/热启动补；不能因为 C<0.25 就直接丢掉有 G5/经济能力的候选。
- 新顺序：selftest3 → G4/G5/广度/场A/B/珠经济 → 最后才看 2P/C 强度。
- 保留 T8/GD6a 这类“能力候选”继续修 G5；S-s120 selftest 红仍拒；R-s123 2P 50 单独评估。
- 下一轮目标从“保强度”改为“先拿到 G5+经济，再补强度”。


- `EQ-S4-ECOTEACH`：selftest3 **6/6 绿**；2P **98.5%**；长 C 四格均值 **0.199**（预注册线 ≥0.25）⇒ **挂**；
- 用卡 7 张 / 防御 14% / gun 30%，无 charge/railgun/bigT 部署；教师标签只有蓄能 20、电磁炮 4，经济没有迁过来；
- 按预注册直接回滚：**S4 基线不变**，ECOTEACH 留在 scratch，不进池；
- 结论：只换 5long/8long 教师不足以产生珠经济；下一步若还要做，必须换“经济教师/目标”，不是再加权重。

## 八、Phase A2 实测结果（T8 教师，2026-11-16 21:4x）

- `EQ-S4-T8ECOTEACH`：selftest3 **6/6 绿**；2P **97.6%**；长 C **0.2811**；
- 珠经济：花珠率 **16.7%**（比 SPL 的 0 好，有 charge 44/railgun 11 教师标签，但学生仍只花 1 颗/40 局）；
- **G5[long] 防席 38% > 25% ⇒ 阻断**；G5[multi] 1% 过，G4 全过；
- 按预注册回滚：S4 基线不变；T8ECOTEACH 留在 scratch。
- 结论：T8 比 SPL 更适合当经济教师（长 C/2P/珠都有改善），但会打破 G5[long]；下一步若继续，必须把“T8 经济教师 + G5 long 保持”作为新假设，而不是在 S4 上继续加权重。

## 九、多教师筛选结果（2026-11-16 21:5x，全部从 S4 起、只动 5long/8long）

| 教师 | selftest3 | 2P | 长 C | G5 long | 结论 |
|---|---:|---:|---:|---:|---|
| T8-s114 | 绿 | 97.6% | 0.2811 | **38% ✗** | 经济 16.7%，但 G5 挂 |
| GD6a-TILT | 绿 | 93.8% | 0.2223 | 未测 | 长 C < 0.25，预注册挂 |
| S-s120 | **红** | 88.5% | 0.2710 | 未测 | selftest 红，直接挂 |
| R-s123 | — | 50.2% | 0.0355 | — | 只测包，未训；纯经济专家 |

- 结论：T8 是这批里最接近的（2P/长 C/珠都改善），但 G5[long] 38%；GD6a/S 一代不如一代。

## 十、GD6a 教师：第一个“全门 + 珠经济 + 强度略降”候选（2026-11-16 21:5x）

`EQ-S4-GD6ATEACH`（S4 起，只改 5long/8long 教师为 GD6a）：

- selftest3 绿；promote `--dry --support=2` **0 阻断**；
- 2P **93.8%**；长 C **0.2223**（比 S4 低，但用户裁定强度可后补）；
- **G5[long/multi] = 1%/0%**；G4 = 13.7%/6.3%；广度 4.61；
- 反弹墙 17.9/局；珠经济 **花珠率 77.4% 闭环**（得珠31/花24，过期0.1/局）；
- 用卡 9 张：gun24、reflect7、snipe4、charge1；电磁炮/蓄能已出现。

**结论：这是当前唯一“行为门全过 + 珠经济闭环”的统一候选**，代价是 2P −3.0、长 C −0.033。按新原则保留，不因强度丢。

### 下一发（强度回收，单变量）
- 起点 `EQ-S4-GD6ATEACH`；
- **只把 2P/2long/2multi 的教师换回 S4**；5long/8long 仍用 GD6a（保经济）；
- 1500 组 / 180 步；预注册：selftest 绿、G5 1/0 保持、珠经济保持 >50%、G4/广度不回退；2P/长 C 允许优先恢复；
- 任一行为/经济门回退即回滚。

- 停止“换教师”路线：继续换包只会重复 T8 的 G5 交易，不是新信息。


