# SEAT-2026-11-19 · 7 枚新成员的人席补测（provisional）

> 目的：GOAL-2026-11-19 的 DoD 第 4 项——把 7 枚 `seatKill=-1` 的成员补上人席读数。
> 状态：**已量，未写进 `pool-members.tsv`**——按刷新后的 band 口径，两枚自动成员会被 D234 ③ 判死，需先做入池决定。

## 方法

- `node tools/probe-human-seat.mjs --packs=<7 枚> --games=200 --modes=multi,long --seed=90210/90211`
- `champion-map/seat-parse.mjs` 落表（`champion-map/data/build/seat-new-*.tsv`，14 行/seed）
- 把新行并入 `pool-seat-90210/90211.tsv` 的内存副本，用 `seatKillIndexBand`（本带同伴参照）重算

## 结果（band 口径，provisional）

| id | tier | 现 seatKill | 刷新后 |
|---|---|---|---|
| RING-MINIT-CONT | hard | -1 | **2**（自动成员 ⇒ D234 ③ 会红） |
| day1119-cannon-pg | soft | -1 | **4**（自动成员 ⇒ D234 ③ 会红） |
| night2-S6 | soft | -1 | **8**（invited=1，D234 允许） |
| night2-X2b-fuse | soft | -1 | **0** |
| RINGB11 | soft | -1 | **0** |
| RINGB9 | soft | -1 | **2** |
| TZT2D | soft | -1 | **2** |

## 可信度

- 只用旧表（不加 7 枚）重算 25 枚：**22/25 与原 seatKill 一致**；3 枚（DEF-s16 / MX5-GD-LE40 / MX8-R6B-KL）旧值本来就与当前 band 均值不符 ⇒ 这套重算不是逐字节复现历史值，数量级可参考。
- 加入 7 枚后 band 均值移动，另有 7 枚旧成员的 kills 也变（如 DEF-s16 1→0、LE40 2→0） ⇒ **全池 refresh 会动 10 个值**，不是只填 7 个空。

## 待决定

1. 两枚自动成员（RING-MINIT-CONT、day1119-cannon-pg）按刷新值会被判死：点名保留（写 invite 原话）／退役／先不写。
2. 是否接受全池 refresh（10 个值变化）并同步跑 D234。
3. 若只填 7 个空、其余保持旧值，Band 口径会混两批（不推荐，但可先记录为 provisional）。

## 产物

- `champion-map/data/build/seat-new-90210.tsv` / `seat-new-90211.tsv`（14 行/seed，未入库）
- 本文件只记录，不改池表。
