# RESULTS · 2026-11-27 · 池 35：AR-TK2 回池 + PG-CN-S1200 追加（B 方案）

> 用户指令（m03280）：采用 B —— 保留 AR-TK2，同时保留 PG-CN-S1200，池扩到 35。
> 产品版本：v2.1.41。规则指纹不变：03a9cc97。

## 1. 裁定

v2.1.40 把 PG-CN-S1200 当作 AR-TK2 的“原位替换”，但两者不是角色等价：

- AR-TK2：soft，armor 120/120、tank 22/120、transfer 11 格；是 soft 侧 armor/tank 载体。
- PG-CN-S1200：soft，并集 17/30、胜率 54.17%，armor/tank 为 0；是强度/经济补强，不承担 armor/tank。

因此 v2.1.41 采用 B：

- 恢复 AR-TK2 到 soft；
- 保留 PG-CN-S1200 作为额外 soft 成员；
- 不再使用“PG-CN-S1200 替换 AR-TK2”的表述。

## 2. 当前池

    members=35
    hard=17
    soft=18
    bad=[]
    blockedAuto=0
    seatKilledAuto=0
    arenaOverBand=35
    decideBandPt=5.8

arenaOverBand=35 仍然表示：35 枚历史读数都超过 5.8pt 当选窗口，单次读数不能当池内排序键。

## 3. AR-TK2 刷新结果

按当前夹具 fx-pool1126d、指纹 03a9cc97 重跑 Stage 1（24s）：

| 指标 | 值 |
|---|---:|
| 并集 | 17/30 |
| 胜率 | 39.58% |
| armor | 120/120 格 |
| tank | 22/120 格 |
| transfer | 11 格 |
| stage2 | 22 技 |

旧 raw 的指纹是 bfd49045；本次已刷新为 03a9cc97，页面不再把它标成“指纹过期”。

## 4. 页面修复

现象：

- pool-members.tsv 与 skill-report/*.json 都是 34；
- skill-report.html 却有 35 张卡，多出旧 AR-TK2；
- 页面 header 写“在池 35/35”。

原因：页面在最终池替换之前烘焙（page mtime 19:51，pool mtime 20:00），旧 AR-TK2 卡残留。

本次 B 之后：

- 池真的变为 35（AR-TK2 + PG-CN-S1200 同时存在）；
- 重新烘焙 skill-report.html，35 张卡与池表/raw 一致；
- 页面不再是“34 池 + 旧卡”的陈旧态。

## 5. 验证

- node tools/pool-add.mjs --audit：35 枚 / 17+18 / bad=[]。
- node champion-map/pipeline/validate.mjs：通过（canonical matched 998 / mismatch 0）。
- node tools/spec-run.mjs：86/86。
- node tools/smoke.mjs：SMOKE OK，无 JS errors。
- node tools/battle-test.mjs：BATTLE OK，无 JS errors。
- node champion-map/rebuild-map.mjs：101 PASS / 0 FAIL。
- node tools/build-pool-bundle.mjs --split --ver=p1127a：bundle 35 枚，manifest 35 枚。
- skill-report：35 张卡，AR-TK2 与 PG-CN-S1200 同时存在。

## 6. 未做 / 边界

- 未改规则；指纹仍为 03a9cc97。
- 未做 2P 独立池或推理端路由（D-34 / D-35 仍有效）。
- 未重新调节 PG-CN-S1200 的 armor/tank 角色；它仍不是 tank/armor 载体。
- 全池有效并集仍受 dualGun/mirror 等历史缺口限制；本次只补回 AR-TK2 的 armor/tank 深度。
- 未跑本地整轮 gate-all；以上是定向验证。改动已本地提交为 v2.1.41，未推送。
