# RESULTS · 2026-11-28 · TA 人席否决修正与安全回滚

> 完成时间：2026-11-28 21:01（UTC+8）。
> 预注册：[`PREREG-2026-11-28-ta-seat-fix.md`](PREREG-2026-11-28-ta-seat-fix.md)。
> 产品基线：v2.1.49 `9bbe4fad`；规则指纹 `c61298e6`；池 35 枚 `hard 17 / soft 18`。

## 1. 发现

v2.1.49 池表使用最终 `TM-S5-a40/TN-S5/TA-S3`，但 canonical 人席表仍只有初版 `TM-S2/TN-S2/TA-S2`。补测最终三枚后：

| 候选 | 90210 long 反弹三格 | 90211 long 反弹三格 | 复算 `seatKill` |
|---|---:|---:|---:|
| `TM-S5-a40` | 0% | 0% | 0 |
| `TN-S5` | 0% | 0.5% | 0 |
| `TA-S3` | 67.0% | 75.5% | **2** |

原始件：`evidence-2026-11-28-family-27/final-carriers-seat-90210/90211.{txt,tsv}`；重算件：`seat-recompute-v2149.json`。

## 2. 已有快照筛选

| 候选 | Stage 1 win | tank / armor / jin | 废珠 | 人席 long 反弹两批 | 结论 |
|---|---:|---|---:|---|---|
| `TA-S4-a30` | 44.75% | 23 / 89 / 0 | 58.7% | 15.0% / 17.5% | 人席过，P2 覆盖/经济门不过 |
| `TA-S4-a50` | 45.83% | 28 / 93 / 2 | 16.9% | 32.0% / 30.5% | 人席 `seatKill=2` |
| `TA-S4-a70` | 45.25% | 36 / 92 / 14 | 20.8% | 42.0% / 34.0% | 人席 `seatKill=2` |

`TA-S4-a70` 的 `selftest3` 六腿全绿，作为唯一同时满足 Stage 1 P2 门的起点进入修正臂。

## 3. `TA-SEAT-FIX`

- 配方：1600 局岭基线 PG，反弹特化对手表，`klW=0.35 / klCand=0.35 / klTilt=armor,tank,jinshield`。
- 首件 `seg400` 与终点 `selftest3` 全绿；终点 `wid=af3298e83100f5f3`。
- Stage 1：**win 45.42% / union 17**，`tank 26 / armor 97 / jinshield 15`，废珠 **18.2%**，全部过门。
- 人席：90210/90211 long 反弹三格 **36.0% / 47.0%**，复算 **`seatKill=2`**。
- 裁定：按预注册硬止损淘汰，不追 `seg400/800/1200`，不增加 PG 局数，不扫 lr/alpha/seed。

## 4. 安全回滚与验证

- TA 槽恢复 v2.1.48 的 `OBS6E9`（`wid=d2a64af418b85949`），池维持 35 枚 `17/18`，规则指纹不变。
- `TA-S3.json` 与 `js/pool-packs/TA-S3.js` 已整体挪到 `D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-28-ta-seat-rollback/`；`OBS6E9.json` 从既有隔离件恢复。
- `pool-add --audit`：`35 枚 / hard 17 + soft 18 / bad=[] / seatUnknown=0`。
- `probe-pool` soft 装配通过，四席全同 `0/280`。
- 回滚后阶梯：

| 视图 | hard | regular | simple |
|---|---:|---:|---:|
| 2P rule | 29.1% | 40.8% | 54.0% |
| 2P legacy | 19.8% | 24.3% | 26.5% |
| 5P multi | 3.4% | 11.1% | 15.8% |
| 5P long | 2.5% | 8.5% | 12.0% |

四组均保持 `hard < regular < simple`。发布版本：**v2.1.50**。
