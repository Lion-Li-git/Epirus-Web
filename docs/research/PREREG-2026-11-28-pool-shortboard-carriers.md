# PREREG · 2026-11-28 · `TM-S2`（替 `MX6-GD-TF20`）＆ `TN-S2`（替 `nov21-taunt-dsp0b`）

> 立项时间：2026-11-28 16:20（UTC+8，先已完成 23..27 家族重划与 `map-selfcheck` 0 FAIL）。
> 基线：`v2.1.48`（`56c581da` 上完成家族 23..27 拆分，池 35 枚 `hard 17 / soft 18`，规则指纹 `c61298e6`）。
> 方法论核对（`AGENTS.md §15`）：
> - `docs/METHODOLOGY.md §148.6` / `training/README.md §五`：`nov21-taunt-dsp0b` `selftest3` 腿 C 红，严禁作为直接梯训起点，改从全绿低废底座热启并仅作教师；
> - `PREREG-2026-11-28-day-split-v7.md` 已证实「干净强底座 + 关键技能键道教师（禁采 `charge`）+ 多形合成 + Stage C `ridge` PG (`2400g`)」可把高废/偏座包一次洗绿；本轮针对全池最突出的两处真短板（唯一 `seatKill=1` 兼 `soft` 唯一 `miniT` 载体 `MX6-GD-TF20`、唯一 `hard taunt` 载体兼结构红 `nov21-taunt-dsp0b`）复用该已证通路。

## 1. 两臂配方

1. **P0 · `TM-S1 → TM-S2`（替代 `soft` 池 `MX6-GD-TF20`：`seatKill=1`, 废 `96.69%`, 胜 `39.08%`, `miniT 0/16`）**：
   - **Stage 1（`TM-S1`，`supfit-gd`）**：
     - `--up=docs/artifacts/L1B-S1200.bak --teacher=pack:docs/artifacts/L1B-S1200.bak`
     - `--teacher2=pack:docs/artifacts/obs6-coldstart/MX6-GD-TF20.bak --teacher2frac=0.40 --teacher2keys=transfer,jinshield,shift`（严禁携带 `charge`）
     - `--teacher3=pack:docs/artifacts/MT-PG.bak --teacher3frac=0.30 --teacher3keys=miniT`（补入真闭环 `miniT` 23/30）
     - `--rareOnly=transfer,miniT,jinshield,ring --rareFrac=0.30 --rolloutMode=game --objective=cand --dagger=0 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1400 --steps=160 --lr=0.0002 --seed=20261128`
   - **Stage C（`TM-S2`，`pg-train`）**：`--up=scratch/arms/TM-S1.bak --games=2400 --batch=48 --lr=0.0003 --baseline=ridge --lamC=0 --lamF=0 --seatDrop=0 --seatL2=0 --segEvery=600 --klW=0.05 --klTilt=transfer,miniT,jinshield,shift --klTiltMul=3 --seed=20261128`（择优段位 `seg600/1200/1800/2400/终`）。

2. **P1 · `TN-S1 → TN-S2`（替代 `hard` 池 `nov21-taunt-dsp0b`：`selftest3` 腿 C 红, 废 `98.01%`, `taunt=92`）**：
   - **Stage 1（`TN-S1`，`supfit-gd`）**：
     - `--up=docs/artifacts/PG-DR.bak --teacher=pack:docs/artifacts/PG-DR.bak`（`hard` 全绿低废底座：`52.17%`, 废 `21.43%`）
     - `--teacher2=pack:docs/artifacts/nov21-taunt-dsp0b.bak --teacher2frac=0.50 --teacher2keys=taunt,jinshield,curse`（严禁携带 `charge`）
     - `--rareOnly=taunt,jinshield,curse --rareFrac=0.30 --rolloutMode=game --objective=cand --dagger=0 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1400 --steps=160 --lr=0.0002 --seed=20261128`
   - **Stage C（`TN-S2`，`pg-train`）**：`--up=scratch/arms/TN-S1.bak --games=2400 --batch=48 --lr=0.0003 --baseline=ridge --lamC=0 --lamF=0 --seatDrop=0 --seatL2=0 --segEvery=600 --klW=0.05 --klTilt=taunt,jinshield,curse --klTiltMul=3 --seed=20261128`（择优段位）。

## 2. 准入硬门（两臂独立判决，真过线才进完整入池链）

- **结构与安全**：`v:92 / S1o / 16561`、`selftest3` 六腿全绿、`promote --dry --support=2` **0 阻断**（含场 B 清场 `≥ 0.3/局`）、`human-seat-probe`（`90210 / 90211`）**`seatKill = 0`**、`总废珠 ≤ 60%`、`Stage 1 胜率 ≥ 40%`。
- **P0（`TM-S2`）专项**：`transfer ≥ 12`、`jinshield ≥ 8`、`miniT ≥ 4`（优先要求 `miniT` 闭环 `> 0` 或非零突破）、替换 `MX6-GD-TF20` 后 `2P/5P` 阶梯保序不掉分。
- **P1（`TN-S2`）专项**：`taunt ≥ 30`、`jinshield ≥ 8`、替换 `nov21-taunt-dsp0b` 后 `2P/5P` 阶梯保序不掉分。
- **完整入池链（`AGENTS.md §20`）**：`promote --dry` → `measure-point --bake`（归入家族 `27`）→ `pool-add`（先按 `§24` 备份旧成员至仓外隔离区）→ `probe-diff-ladder --pool=1` → `pool-skill-report` → `build-pool-bundle --split` → `rebuild-map` → `gate-all --auto`。

## 3. 追加 P2 · `TA-S1 → TA-S2`（响应用户指示：低废强底座追补 `tank + armor` + `jinshield`）

- **Stage 1（`TA-S1`，`supfit-gd`）**：
  - `--up=docs/artifacts/L1B-S1200.bak --teacher=pack:docs/artifacts/L1B-S1200.bak`
  - `--teacher2=pack:docs/artifacts/AR-TK2.bak --teacher2frac=0.35 --teacher2keys=armor,tank`（严禁携带 `charge`，只采 `armor` 与条件 `tank` 连携）
  - `--teacher3=pack:docs/artifacts/TM-S2.bak --teacher3frac=0.25 --teacher3keys=jinshield`
  - `--rareOnly=armor,tank,jinshield --rareFrac=0.25 --rolloutMode=game --objective=cand --dagger=0 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1400 --steps=160 --lr=0.0002 --seed=20261134`
- **Stage C（`TA-S2`，`pg-train`）**：`--up=scratch/arms/TA-S1.bak --games=2400 --batch=48 --lr=0.0003 --baseline=ridge --lamC=0 --lamF=0 --dmgW=0.04 --defTax=0.02 --seatDrop=0 --seatL2=0 --segEvery=600 --seed=20261134`
- **目标**：废珠 `≤ 50%`、`Stage 1 胜率 ≥ 45%`、`tank ≥ 8` ＆ `armor ≥ 25`（且保持有效 `armor->tank` 火弱连携）、`jinshield ≥ 8`、`promote` 0 阻断（含 `场B ≥ 0.3`）、`seatKill=0`，具备替换高废 `AR-TK2`（97.27% 废）/ `OBS6E9`（95.85% 废，结构红）的能力。
