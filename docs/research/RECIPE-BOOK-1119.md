# RECIPE BOOK · 2026-11-19 深夜（zcode 夜班）——从四 harness 会话记录复原的训练配方账

> 来源：Gemini antigravity brain transcripts（`5ae79190`=11-14/15 班 ‖ `90bc45b8`=11-19 恢复班 ‖ `d7f91659`=11-15 V3a 班）+ ZCode db.sqlite。
> 用途：①3 枚 B 轴缺锚的逐位复现；②P2 批量重产（missing 668 里可复现件）。**命令一律照抄原文，路径改动会破坏逐位复现性——凡 `scratch/arms/` 原路径缺失的依赖，先核对 wid 再替换。**

## 一、B 轴缺锚链（P0 核心）

### 1.1 V3a（snap0 缺 ⇒ V3S2 缺 ⇒ DIV-V3-ANTIDEF / DIV-LH6-HEAVY-S2 卡）

**原始命令**（2026-11-15 20:4x，`d7f91659` transcript；输出 `scratch/arms/OBS6-SHAPEDIST-V3a.bak`，45 秒级）：

```bash
node training/proto2/supfit-gd.mjs \
  --upstream=scratch/arms/OBS6-SHAPEDIST-V2.snap0.bak \
  --teacher=pack:scratch/arms/OBS6-SHAPEDIST.bak \
  --teacher2=pack:js/bundled-champion.js --teacher2frac=0.95 --teacher2Shapes=2:standard \
  --teacher3=pack:docs/artifacts/v7blk1-92.bak --teacher3frac=0.92 --teacher3Shapes=2:long,3:multi,3:long,5:multi,5:long \
  --teacher4=pack:docs/artifacts/e528-out/T8-s114.js --teacher4frac=0.48 --teacher4Shapes=3:multi,3:long,5:multi,5:long \
  --arenaShapes=2:standard,2:long,3:multi,3:long,5:multi,5:long,8:multi,8:long \
  --shapeBal=1 --rolloutMode=game --objective=cand --classPow=0.25 --classCap=3 \
  --groups=3200 --pool=4800 --steps=320 --lr=0.0012 --dagger=1 --snapEvery=1 --seed=1131 \
  --out=scratch/arms/OBS6-SHAPEDIST-V3a.bak
```

- **判据**（FINDING-2026-11-15-shapedist-v2 §五）：6400 组标签 `charge=505, bigT=26, railgun=21, ring=2`。
- **已知保真风险**：①`js/bundled-champion.js` 是 11-18 重烘版（11-15 原版用 `git show a0feae0f:js/bundled-champion.js` 提取）；②代码漂移（a0feae0f=21:53 提交，V3a=20:42 生成，中间可能有未提交改动）。
- **meta 真值**（在盘 V3a.bak META）：seed=1131 ‖ steps=320 ‖ lr=0.0012 ‖ detDose=3（当时默认）‖ objective=cand ‖ keySplit=0。
- 首发探针（23:45，current code+现行 bundle）：`charge=416, bigT=21, railgun=21, ring=0` —— railgun 已中，charge −89/bigT −5/ring −2 ⇒ 与 teacher2 重烘强相关。
- 第一发产物（不含 snap0 正确性）：`scratch/arms/repro1119/V3a.snap0.bak`；融合试金 `15e1f924a4b7d418 ≠ 669145027f8020ae`（预期，标签未中）。
- 深挖线索：另一条早期带 `--arch=2 --obs6=1 --hidden=64 --hidden2=32` 的同型命令（第一次尝试形态，其 --teacher3 路径为 docs 版）。

**V3S2 融合**（recipe 真值在 `08c29d18:scratch/zcode-1113-deps/fix-v3s2-provenance-1116.mjs`）：

```
V3S2 = 0.25·V2.snap0 + 0.20·SHAPEDIST + 0.15·V2.snap1 + 0.15·V3a.snap0 + 0.15·V3a.snap1 + 0.10·V3b.snap1
```

- 在盘 5 路（wid 已核）：`ca8d81c6`/`97a9254e`/`74cdf345`/`94f1343c`/`4237f96c`；目标 wid `669145027f8020ae`。
- 试金器：`scratch/v3s2-fuse-test.mjs <v3as0候选>`（--noround 试无舍入变体）。

### 1.2 OBS6-LH6（32 发未中 ⇒ 白班教师栈全错，原始命令 11-15 13:04 出土）

```bash
node training/proto2/supfit-gd.mjs \
  --upstream=docs/artifacts/obs6-coldstart/OBS6E9.bak \
  --teacher=pack:scratch/arms/OBS6-LH2.bak \
  --teacher2=pack:docs/artifacts/obs6-coldstart/OBS6E9.bak --teacher2frac=0.76 \
    --teacher2keys=ji,gun,sword,tank,snipe,guard,reflect,bagua,shift,proto,holo,dualGun \
  --teacher3=pack:scratch/arms/GD16m-D1.bak --teacher3frac=0.14 \
    --teacher3keys=ring,bigT,railgun,charge,ji \
  --teacher4=lasereye --teacher4frac=0.06 --teacher4keys=laserEye,charge \
  --rolloutMode=game --objective=cand --dagger=0 \
  --groups=3200 --pool=4800 --steps=120 --lr=0.01 \
  --shapeBal=1 --classPow=0.25 --classCap=3 \
  --out=scratch/arms/OBS6-LH6.bak --tag=OBS6-LH6
```

- **白班 32 发全错的原因**：他们不知道 t1=**OBS6-LH2**（干净蒸馏底座）与 t4=lasereye 脚本教师的存在，C1 用了 t1=GD16m/t2=E9@0.76 无键过滤/groups=1200/steps=400/lr=0.02。
- **依赖链**：LH6 ← LH2 ← OBS6-GA2PG-8K（均缺，配方见下）‖ GD16m-D1 已恢复（wid `332e009f`）‖ lasereye 脚本教师在 `buildTeacherPick` 注册表（核实现版还在）。
- **无 --seed 旗标** ⇒ 用当时默认（核实 a0feae0f/e2816572 的 seed 缺省值）。
- 产出后核 wid `b768758160541e66`。

### 1.3 OBS6-LH2（LH6 的上游，2026-11-15 白天）

```bash
node training/proto2/supfit-gd.mjs \
  --upstream=docs/artifacts/obs6-coldstart/OBS6-GA2PG-8K.bak \
  --teacher=pack:docs/artifacts/obs6-coldstart/OBS6-GA2PG-8K.bak \
  --teacher2=pack:scratch/arms/GD16m-D1.bak --teacher2frac=0.35 \
    --teacher2keys=ring,bigT,railgun,charge,ji \
  --teacher3=pack:docs/artifacts/obs6-coldstart/OBS6E9.bak --teacher3frac=0.25 \
    --teacher3keys=gun,sword,snipe,reflect,guard,bagua,shift \
  --teacher4=lasereye --teacher4frac=0.10 --teacher4keys=laserEye,charge \
  --rolloutMode=game --objective=cand --dagger=1 --pool=4000 --groups=2000 \
  --steps=200 --lr=0.012 --shapeBal=1 \
  --arenaPool=names:random,defend,wall,farmer,heavyfire,deepsaver,earlypressure \
  --arenaShapes=2:long,3:long,5:long,5:multi,8:multi \
  --out=scratch/arms/OBS6-LH2.bak --tag=OBS6-LH2
```

- 依赖：OBS6-GA2PG-8K.bak（**缺失**，创建命令未在 5ae 班——11-14 或更早，待挖 ZCode db/其余 brain）。

### 1.4 OBS6-LH6P（✅ 原始命令出土 · 2026-11-15 13:06）

```bash
node training/proto2/pg-train.mjs --up=scratch/arms/OBS6-LH6.bak \
  --games=3000 --batch=48 --lr=0.0002 --temp=0.5 --baseline=mean --lamC=0 --lamF=0.02 \
  --lamExp=0.04 --klW=0.06 --arenaPool=product --arenaShapes=2:multi,3:long,5:multi,5:long,8:multi \
  --segEvery=1000 --out=scratch/arms/OBS6-LH6P.bak --tag=OBS6-LH6P
```

- 无 `--seed`（默认 20261031）‖ e2816572 时代 pg-train 无 `--obs` 旗标（架构从包自读）；HANDOFF §3.1 的重构命令（--obs=obs6 --lamExp=0.04 --seed=7）是错的，首跑未中（`79c8b0ca`）。
- 核 wid `457e635123000e85`。

### 1.5 DIV-V3-PRESSURE-S2 → DIV-V3-ANTIDEF（V3S2 恢复后；HANDOFF §2.1 全文 + transcript 双源一致）

```bash
# ① PRESSURE（seed=11181，核 wid 1c726b7bfaf2f345）
node training/proto2/pg-train.mjs --up=docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3S2.bak \
  --obs=obs6 --games=6000 --segEvery=2000 --batch=48 --lr=3e-4 --seed=11181 \
  --arenaPool=names:pack:OBS6E9,pack:OBS6B2,pack:OBS6P9-S4000,ringspam,reflectspam,baguaspam,snipespam,protowall,targeter,heavyfire \
  --dmgW=0.06 --beadSpendW=0.06 --defTax=0.04 --lamC=0.01 --lamF=0.06 --penDeadElec=0.04 \
  --klW=0.12 --klTilt=snipe,sword,railgun,laserEye,bigT,miniT --klTiltMul=1.5 \
  --out=scratch/arms/style1118/DIV-V3-PRESSURE.bak
# 取 .seg2000；② ANTIDEF（seed=11186，核 wid 0c31e13f5ab6ba9c）
node training/proto2/pg-train.mjs --up=scratch/arms/style1118/DIV-V3-PRESSURE.seg2000.bak \
  --obs=obs6 --games=4000 --segEvery=2000 --batch=48 --lr=3e-4 --seed=11186 \
  --arenaPool=names:defend,guardspam,wall,reflectspam,ringspam,targeter,pack:OBS6E9,pack:OBS6P9-S4000 \
  --dmgW=0.05 --defTax=0.03 --beadSpendW=0.05 --lamF=0.05 \
  --klW=0.14 --klTilt=snipe,tank,railgun,laserEye,bigT,cannon --klTiltMul=2.0 \
  --out=scratch/arms/style1118/DIV-V3-ANTIDEF.bak
```

### 1.6 DIV-LH6-HEAVY-S2（LH6 恢复后；transcript S1297 原文，核 wid 6b7b5fc2dcba1834）

```bash
node training/proto2/pg-train.mjs --up=docs/artifacts/obs6-coldstart/OBS6-LH6.bak \
  --obs=obs6 --games=6000 --segEvery=2000 --batch=48 --lr=3e-4 --seed=11182 \
  --arenaPool=names:pack:OBS6E9,pack:OBS6-SHAPEDIST-V3S2,pack:OBS6P9-S4000,ringspam,reflectspam,targeter,heavyfire,swordspam,combocounter \
  --dmgW=0.03 --defTax=0.02 --lamExp=0.04 --lamF=0.04 --beadSpendW=0.04 \
  --klW=0.18 --klTilt=railgun,bigT,sword,tank,holo,miniT,snipe --klTiltMul=2.0 \
  --out=scratch/arms/style1118/DIV-LH6-HEAVY.bak
# 取 .seg2000 → 拷 docs/artifacts/obs6-coldstart/DIV-LH6-HEAVY-S2.bak
```

## 二、其他已复原配方（P2 批量重产原料）

- **OBS6LH11**（LH6P→LH11）：supfit `--upstream=docs/.../OBS6-LH6P.bak --teacher=pack:scratch/arms/OBS6LH9.bak --teacher2=pack:v7blk1-92@0.30 --rareOnly=ring,bigT,railgun@0.30 --arenaShapes=2:multi,3:multi,5:multi,8:multi,2:long,5:long,3:multi4,5:multi4 --pool=3300 --shapeBal=1 --dagger=1 --steps=250 --lr=0.012 --classPow=0.25 --classCap=3 --rolloutMode=game --snapEvery=1`
- **OBS6SHPL**：`--upstream=SHAPEDIST --teacher=pack:GD16m-D1 --rolloutMode=game --arenaShapes=5:long,8:long --pool=2400 --dagger=1 --steps=150 --lr=0.004 --classPow=0.25 --classCap=3 --snapEvery=1`
- **OBS6MB1**：同上但 `--upstream=SHAPEDIST-MB --onlySeg=modeBias --lr=0.01`
- **OBS6E1/E4a/E4e**（11-14 E 系）：E1=`--upstream=OBS6D3 --teacher=pack:v7blk1-92 --dagger=2 --keySplit=1 --steps=400 --groups=800 --seed=20261031 --rareOnly=bigT,ring@0.5`；E4a/E4e=`--upstream=OBS6D3/OBS6A4.seg1000 --teacher=pack:v7blk1-92 --teacher2=pack:v7seat24b-92@0.5/0.35 --shapeBal=1 --groups=1650 --pool=3300 --dagger=3 --dagtemp=0.15 --keySplit=1 --lr=0.012 --steps=250 --seatDrop=0.1 --seatL2=1e-4 --seed=20261114/20261118`
- **V2P**：pg-train `--up=V2.snap0 --arenaShapes=2:standard,2:long,3:multi,5:multi,5:long,8:multi --games=3000 --segEvery=1000 --lr=0.0002 --temp=0.5 --baseline=ridge --ridgeFeat=small --ridgeL2=0.1 --klW=0.08 --lamC=0.005 --lamF=0.05 --lamExp=0.04 --penDeadElec=0.15 --seed=1126`
- **UNIFIED U1–U4**（11-16，U1/U2 是 EQ 系祖先）：`--upstream=OBS6-V3S2-MB / V3H3-MB / V3S2 / U2.snap0 --arenaShapes=2:standard,2:long,3:multi,3:long,5:multi,5:long,8:multi,8:long --shapeBal=1 --rolloutMode=game --objective=cand --classPow=0.30/0.40 --classCap=4/6 --rareOnly=ring,railgun,bigT@0.18/0.28 --groups=4000 --pool=6000 --steps=260/240 --lr=0.0008/0.0006 --dagger=1 --snapEvery=1 --seed=2026111601/02/03/04`
- **EQ 链**（EQ-E9-A1 → S3 → S4 → S5/S6）：`--upstream=BASE-E9-MB5 --out=EQ-E9-A1 --objective=cand --teacher=pack:night-adapt/MSB14-railgun-R1S175656469.js`（后续 S3=蒸 A1、S4=蒸 S3、S5=蒸 S4、S6-CLEAN=蒸 S4）
- **RINGEC1/2、RINGPG1/2、DIV-SYNERGY 系、P9-CN-MINI 系、V3-TANK 系**：见 transcript 原文（`scratch/mine-commands.mjs` 可重提）。

## 三、还缺的配方（继续挖）

- **OBS6-GA2PG-8K**（LH2 上游；11-14 或更早，ZCode db 150 处提及但无 out= 命中——挖其余 brain/DeepSeek/qoder 存储）
- **OBS6-SHAPEDIST 原始**（v2s0/sd/v2s1 三路已在盘 ✓ 不需要）
- **v7seat24b-92**（E4a 教师之一；missing?）
- **GD16m-D1 的上游 GD16m/GD16**（GD16m-D1 已恢复 ✓ 不需要）
