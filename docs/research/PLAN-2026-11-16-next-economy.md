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
