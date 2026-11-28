# PREREG · 2026-11-28 · `LE-S1` ＆ `PH-S1` 双载体分担替换 `MX8-TN35-KL3`（`seatKill=2` 清零）

> 立项时间：2026-11-28 11:58（UTC+8，获用户拍板授权执行）。
> 基线：`v2.1.47`（`678f7584`，规则指纹 `c61298e6`，池 35 枚 `hard 17 / soft 18`）。
> 目标：把 `MX8-TN35-KL3`（`soft`, `seatKill=2`, 废珠 `90.23%`, `laserEye:17 / proto:10 / holo:20 / ring:13 / jinshield:6`）的双端冲突职责拆分到两枚各自 `seatKill=0`、低废珠、`selftest3` 全绿的 `soft` 载体上（同步清退 `MX8-TN35-KL3` 及高废/伤带包 `MX8-R6B-KL` 或 `OBS6E9`）。

## 1. 两枚分离载体配方

1. **载体 1（`LE-S1` —— `laserEye + firestorm + ring` 纯火爆激光载体，隔离 `proto/holo`）**：
   - `--mode=supfit --up=docs/artifacts/FS2-LE26.bak --teacher=pack:docs/artifacts/FS2-LE26.bak`
   - `--teacher2=pack:docs/artifacts/L1B-S1200.bak --teacher2frac=0.35 --teacher2keys=ring,bigT,drain`（严禁携带 `charge`）
   - `--teacher3=pack:docs/artifacts/L1B-S1200.bak`？不允许重复教师 ⇒ 改单副教师 `L1B-S1200`，并用 `--teacher2Shapes=2:standard,3:multi,5:long,8:long`；同时 `--rareOnly=firestorm,laserEye --rareFrac=0.25`
   - `--rolloutMode=game --objective=cand --dagger=0 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1400 --steps=160 --lr=0.0002 --seed=20261128 --out=scratch/arms/LE-S1.bak`
2. **载体 2（`PH-S1` —— `proto + holo + jinshield + ring` 纯防辅环载体，隔离 `laserEye/charge#boom`）**：
   - `--mode=supfit --up=docs/artifacts/L1B-S1200.bak --teacher=pack:docs/artifacts/L1B-S1200.bak`
   - `--teacher2=pack:docs/artifacts/obs6-coldstart/MX8-TN35-KL3.bak --teacher2frac=0.50 --teacher2keys=proto,holo,jinshield`（严禁携带 `charge`）
   - `--rareOnly=proto,holo,ring --rareFrac=0.30 --rolloutMode=game --objective=cand --dagger=0 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1400 --steps=160 --lr=0.0002 --seed=20261128 --out=scratch/arms/PH-S1.bak`

## 2. 验收硬门（沿用前序口径，仅真过门才走完整入池链）

- **统一前提**：`v:92 / S1o / 16561` 且 `selftest3` 六腿全绿、`promote --dry --support=2` **0 阻断**、`human-seat-probe`（`90210/90211`）**`seatKill = 0`**、`总废珠 ≤ 60%`、`Stage 1 胜率 ≥ 40%`。
- **`LE-S1` 专项**：`laserEye ≥ 10`、`firestorm ≥ 15`、保持 `boom` 闭环不崩、`soft` 替换不破坏 `2P/5P` 全矩阵阶梯单调。
- **`PH-S1` 专项**：`proto ≥ 8`、`holo ≥ 15`、`jinshield ≥ 5`、`ring ≥ 8`（保 `L1B-S1200` 低废珠基底）、`soft` 替换不破坏 `2P/5P` 全矩阵阶梯单调。
- 如两枚达标，按 `AGENTS.md §20` 执行完整入池链：`promote --dry` → `measure-point --bake` → `pool-add` → `probe-diff-ladder --pool=1` → `pool-skill-report` → `build-pool-bundle --split` → `rebuild-map` → 门禁核验；旧成员报告依 `AGENTS.md §24` 迁至仓外隔离区。
