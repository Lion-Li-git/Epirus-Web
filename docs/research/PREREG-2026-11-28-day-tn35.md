# PREREG · 2026-11-28 · `TN35-S`：绿色低废珠跨亲蒸馏替换 `MX8-TN35-KL3`（清零 `seatKill=2`）

> 立项时间：2026-11-28 10:36（UTC+8）。
> 基线：`main` 当前规则指纹 `c61298e6`，池 35 枚（`hard 17 / soft 18`）。
> 方法论对账（`AGENTS.md §15, §21`）：
> - [`RESULTS-2026-11-28-phase6-soft-screen.md`](RESULTS-2026-11-28-phase6-soft-screen.md) / [`PREREG-2026-11-28-mx8tn-pg.md`](PREREG-2026-11-28-mx8tn-pg.md) 已证：从 `MX8-TN35-KL3` 本身做保覆盖 PG 可过覆盖与胜率，但总废珠仅降至 `63.35%`（超 `≤60%` 硬门 `3.35pt`）；且已收口不重开 `taunt/tank/railgun/transfer` 直接注入或弱剂量扫参。
> - **清单外新假设**：用绿色低废珠 soft 底座 [`L1B-S1200`](../artifacts/L1B-S1200.bak)（`selftest3` 全绿、废珠仅 `14.63%`、已持 `ring:15 / holo:6 / bigT:16 / railgun:9`）作主体，按 `FS-DR`/`JN-DR` 多教师不相交键道配方跨亲蒸馏：
>   - `teacher2=pack:FS2-LE26.bak`（`teacher2keys=charge,laserEye,firestorm`：补齐 `charge#boom → laserEye` 与 `firestorm` 低废双闭环）；
>   - `teacher3=pack:MX8-TN35-KL3.bak`（`teacher3keys=proto,holo,jinshield`：迁入 `proto / holo / jinshield` 覆盖而不带入其 `90.2%` 蓄电废珠）；
>   - 并设 `--winOnly=0`（臂 A）vs `--winOnly=1`（臂 B，[`METHODOLOGY.md §149`](../METHODOLOGY.md) 胜局语境集中器对照——此前仅在 `S6` 测 `tank`，未测于 `laserEye/proto/holo` 多技能蒸馏）。

## 1. 固定配方（最多 2 并行子进程，`AGENTS.md §12`）

- 公共参数：
  - `--up=docs/artifacts/L1B-S1200.bak`（`1c5b2d627add3862`）
  - `--teacher=pack:docs/artifacts/L1B-S1200.bak`
  - `--teacher2=pack:docs/artifacts/FS2-LE26.bak --teacher2frac=0.45 --teacher2keys=charge,laserEye,firestorm`
  - `--teacher3=pack:docs/artifacts/obs6-coldstart/MX8-TN35-KL3.bak --teacher3frac=0.55 --teacher3keys=proto,holo,jinshield`
  - `--rareOnly=laserEye,proto,holo --rareFrac=0.30`
  - `--rolloutMode=game --objective=cand --dagger=1 --snapEvery=1 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6`
  - `--arenaShapes=2:standard@3,3:multi,5:multi,5:long@2,8:long`
  - `--groups=1600 --steps=220 --lr=0.0004 --seed=20261128`
- **臂 A（`TN35-L1B`）**：`--winOnly=0 --out=scratch/arms/TN35-L1B.bak --tag=day28-tn35-l1b`
- **臂 B（`TN35-WIN`）**：`--winOnly=1 --out=scratch/arms/TN35-WIN.bak --tag=day28-tn35-win`

## 2. 验收硬门（与 `PREREG-2026-11-28-mx8tn-pg.md` 同尺并新增 `seatKill` 门）

1. **首件血统与梯度自证（`AGENTS.md §16`）**：`snap0` 产出立即核 `v:92 / S1o / 16561` 且 `selftest3` 六腿全绿（终点快照亦须全绿）。
2. **Stage 1（`fx-pool1126d` 同夹具）**：
   - `laserEye ≥ 10`、`proto ≥ 6`、`ring ≥ 8`、`holo ≥ 12`、`selfUnionN ≥ 18`；
   - `Stage 1 胜率 ≥ 40%`；
   - `总废珠率 ≤ 60%`（严格优于 `63.35%` 淘汰线）且花珠绝对量 ≥ `MX8-TN35-KL3` 底座（`301`）的 `80%`（即 ≥ `241`）；
3. **2P 与人席与准入链（通过第 2 步后才跑）**：
   - `promote --dry --support=2`：`0` 阻断；
   - `human-seat-probe`（`90210/90211`）：**`seatKill = 0`**（真正消除 `MX8-TN35-KL3` 的 `seatKill=2`）；
   - `2P rule/legacy` 不跌破替换硬红线（`< 3pt` 软度对齐且保阶梯单调），`5P multi/long` 阶梯单调。

## 3. 硬止损

- 首件血统错或 `selftest3` 红：立即淘汰，不看后段。
- `Stage 1` 任何覆盖项、废珠 `≤ 60%` 或花珠 `< 241` 未达标：淘汰，**不扫 lr/frac/seed 挽救**；如实记录 `winOnly=0 vs 1` 对照结果。

## 4. H1 实测与淘汰（2026-11-28 10:41）

- **臂 A（`TN35-L1B`，`--winOnly=0`）**：
  - 终点 `TN35-L1B.bak`（16561/v92/obs6）因梯度饱和在 `selftest3` 腿 C 报红（可分辨坐标 0）；`snap0`（`TN35-L1B.snap0.bak`）`selftest3` 六腿全绿（`π=0.409`、可分辨 `2872`）。
  - Stage 1（`scratch/skill-eval/TN35-L1B.snap0.json`）：并集 `18/30`、胜率 `40.33%`、`proto=45 / holo=37 / jinshield=24 / ring=4`，成功迁入 `proto/holo/jinshield`；但 `charge#elec=93`（`elecGained=1910, elecExpired=1877`，废珠 **`98.3%`**）且 **`laserEye=0 / boomGained=0`**，命中止损淘汰。
- **臂 B（`TN35-WIN`，`--winOnly=1`）**：
  - `snap0` 与终点（`16561/v92/obs6`）均保持 `selftest3` 六腿全绿（终点 `π=0.937`、可分辨 `2883`，`--winOnly=1` 避免了过拟合饱和）；
  - Stage 1（`scratch/skill-eval/TN35-WIN.json`）：相比 `winOnly=0` 胜率由 `40.33% → 48.00%`（`+7.67pt`）、`proto 45→49 / holo 37→42 / railgun 1→9 / bigT 0→3`、换招 JS `0.0956 → 0.0586`；但同样因 `teacher2` 携带 `charge` 键污染 `elec`（`elecGained=1897, elecExpired=1806`，废珠 **`95.2%`**）且 **`laserEye=0 / boomGained=0`**，命中止损淘汰。
- **机制定位**：以无爆珠的 `L1B-S1200` 作底座并把 `charge` 放进 `teacher2keys` 时，`FS2-LE26` 在轮替下仍大量输出 `charge#elec#elec`（`51–56` 组）而 `laserEye=0`，复现了 [`RESULTS-2026-11-26-value-coverage.md §3.1`](RESULTS-2026-11-26-value-coverage.md) “跨亲不得共享/注入 `charge` 键道”的铁律。

## 5. H2 修正（反置主从：`FS2-LE26` 作主底座，副教师严格禁 `charge` 键）

- **新假设（清单外）**：改以 [`FS2-LE26`](../artifacts/FS2-LE26.bak)（`selftest3` 全绿、总废珠仅 **`18.4%`**、`laserEye:52 / firestorm:27 / curse:56`）作主底座与主教师，副教师严格**禁带 `charge`**：
  - `teacher2=pack:docs/artifacts/obs6-coldstart/MX8-TN35-KL3.bak --teacher2frac=0.55 --teacher2keys=proto,holo,jinshield`
  - `teacher3=pack:docs/artifacts/L1B-S1200.bak --teacher3frac=0.50 --teacher3keys=ring,bigT,drain`
  - `--rareOnly=proto,holo,ring --rareFrac=0.30`
  - `--arenaPool=names:human:rule,human:legacy,ringspam,beadburst,wall,gunspam,heavyfire,deepsaver,snipespam,defend,pack:docs/artifacts/FS2-LE26.bak,pack:docs/artifacts/L1B-S1200.bak`
  - `--arenaShapes=2:standard@3,3:multi,5:multi,5:long@2,8:long --rolloutMode=game --objective=cand --dagger=1 --snapEvery=1 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1600 --steps=200 --lr=0.0003 --seed=20261128`
- **臂 A2（`TN35-FS2`）**：`--winOnly=0 --out=scratch/arms/TN35-FS2.bak --tag=day28-tn35-fs2`
- **臂 B2（`TN35-FS2W`）**：`--winOnly=1 --out=scratch/arms/TN35-FS2W.bak --tag=day28-tn35-fs2w`
- **硬门同 §2–§3**：`selftest3` 全绿（先验 `snap0`）、`laserEye≥10 / proto≥6 / ring≥8 / holo≥12 / selfUnionN≥18`、`Stage 1 胜率≥40%`、`废珠≤60%`、`花珠≥241`，以及 `promote 0阻断 + seatKill=0 + 2P/5P 阶梯不破坏`。若仍不达标，立即收口停线，不扫剂量。

## 6. H2 实测与淘汰 ＆ H3 两阶段闭环 / `FS-DR` 无漂移嫁接（2026-11-28 10:47）

- **H2 实测结果（均命中止损淘汰）**：
  - `TN35-FS2W`（`--winOnly=1` 终点 `selftest3` 全绿）：Stage 1 并集 `20/30`，`firestorm=29 / laserEye=4 / holo=9 / ring=8 / proto=2 / purify=1`，`boom 89/90 (1 过期)`；但 `elecGained=1036, elecExpired=989`（总废珠 `87.9% > 60%`）且 `wr=38.17% < 40%`，淘汰。
  - `TN35-FS2`（`--winOnly=0` 终点 `selftest3` 全绿）：Stage 1 并集 `19/30`，`proto=19 / holo=28 / firestorm=33 / curse=71 / wr=41.08%`，`boom 18/18`；但 `elecExpired=767 (95.9%)` 且 `laserEye=0`，淘汰。
  - `TN35-FS2.snap0`（`--winOnly=0` `round 0` `selftest3` 全绿）：Stage 1 并集 `19/30`，`proto=15 / holo=29 / firestorm=30 / curse=73 / laserEye=7 / railgun=6 / boom 109/109 (0 过期)`，已接近全部覆盖要求，仅因 `elecExpired=936`（废珠 `86.3%`）与 `wr=38.67%` 未过门，且证实 **DAgger `round 1` 才是压掉 `laserEye (7→0)` 与 `boom (109→18)` 的漂移源**。
- **H3 两条新验证（与 §4/§5 机制正交，收口前最后一轮）**：
  1. **臂 C1（`TN35-PG` —— 复刻 `PG-CN` 两阶段闭环，接 `TN35-FS2.snap0` 做 Stage C 岭基线 PG）**：
     - 起点：`scratch/arms/TN35-FS2.snap0.bak`（`selftest3` 全绿，自带 `boom 109/109` 与 `proto=15 / holo=29 / laserEye=7`）；
     - 配方：`--mode=pg --games=2400 --batch=48 --lr=0.0003 --segEvery=600 --lamC=0 --lamF=0 --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15 --klW=0.35 --klCand=0.35 --klModes=standard --klTilt=laserEye,proto,holo,ring --klTiltMul=2.0 --baseline=ridge --ridgeFeat=small --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long --seed=20261128 --out=scratch/arms/TN35-PG.bak`。
  2. **臂 C2（`FSDR-PH` —— 从既有低废双闭环 `FS-DR` 无 DAgger `--dagger=0` 单轮嫁接 `proto/holo/jinshield`）**：
     - 起点：`docs/artifacts/FS-DR.bak`（`selftest3` 全绿，`boomExpired=0`，`waste=53.9%`，`laserEye=12 / firestorm=28 / railgun=12`）；
     - 配方：`--mode=supfit --up=docs/artifacts/FS-DR.bak --teacher=pack:docs/artifacts/FS-DR.bak --teacher2=pack:docs/artifacts/obs6-coldstart/MX8-TN35-KL3.bak --teacher2frac=0.45 --teacher2keys=proto,holo,jinshield --rareOnly=laserEye,proto,holo --rareFrac=0.25 --rolloutMode=game --objective=cand --dagger=0 --keySplit=1 --shapeBal=1 --classPow=0.5 --classCap=6 --groups=1400 --steps=160 --lr=0.0002 --seed=20261128 --out=scratch/arms/FSDR-PH.bak`。
- **止损不变**：C1/C2 任一若未过 `selftest3` 全绿或 `Stage 1` 覆盖+`waste ≤ 60%` 硬门，立即停线结题，不扫参追击。


