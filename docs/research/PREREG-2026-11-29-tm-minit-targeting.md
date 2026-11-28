# PREREG · 2026-11-29 · `TM-S5-a40` 小雷靶向精准化

> 立项时间：2026-11-29 00:20（UTC+8）。
> 基线：`main@d558abce`，规则指纹 `c61298e6`，夹具 `fx-pool1126d`。
> 边界：只训练两臂镜像对照；不改规则、不改池，未过全链不入池。

## 1. 动机与方法论对账

- 当前 `TM-S5-a40` 已入 soft，`selftest3` 全绿；Stage 1 `winRate=42.75%`、`miniT=4`、`transfer=20`、`jinshield=48`、废珠约 `41%`。
- 新固化探针实测：`32` 次直放小雷中 `28` 次非镜像无效化，但 `21` 次打 `ji`、`3` 次打 `gun`，仅得 **`8` 分 / `0.250` 分每次**；教师 `TM-S2` 为 **`11` 分 / `0.688` 分每次**。
- `METHODOLOGY §149` 已证 `winOnly` 是语境集中器，不是“胜局专属增强”。本臂只用 `winOnly=0/1` 做同配方镜像，判断语境收窄是否改善靶向；不再重证该节结论，也不扫第三档。

## 2. 唯一控制变量

- 学生底座：`docs/artifacts/TM-S5-a40.bak`（`922277a50709854e`）。
- 主教师：学生自身，护住 `transfer/jinshield/ring`。
- 专科教师：`docs/artifacts/TM-S2.bak`（`bf3a8c28c7e47349`），只开 `miniT` 键道，份额 `0.25`。
- 稀有采集：`miniT,transfer,jinshield`，份额 `0.30`。
- 两臂唯一差异：`--winOnly=0` vs `--winOnly=1`；其余 seed、桌形、步数、学习率、教师栈逐字相同。

## 3. 固定命令

```bash
node training/train.mjs --mode=supfit \
  --up=docs/artifacts/TM-S5-a40.bak \
  --teacher=pack:docs/artifacts/TM-S5-a40.bak \
  --selfTeacher=docs/artifacts/TM-S5-a40.bak \
  --teacher2=pack:docs/artifacts/TM-S2.bak --teacher2keys=miniT --teacher2frac=0.25 \
  --rareOnly=miniT,transfer,jinshield --rareFrac=0.30 \
  --rolloutMode=game --objective=cand --dagger=0 \
  --groups=1400 --steps=120 --lr=0.00015 --seed=20261129 \
  --shapeBal=1 --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --winOnly=0 --out=scratch/arms/TM-MINIT-A0.bak

node training/train.mjs --mode=supfit \
  --up=docs/artifacts/TM-S5-a40.bak \
  --teacher=pack:docs/artifacts/TM-S5-a40.bak \
  --selfTeacher=docs/artifacts/TM-S5-a40.bak \
  --teacher2=pack:docs/artifacts/TM-S2.bak --teacher2keys=miniT --teacher2frac=0.25 \
  --rareOnly=miniT,transfer,jinshield --rareFrac=0.30 \
  --rolloutMode=game --objective=cand --dagger=0 \
  --groups=1400 --steps=120 --lr=0.00015 --seed=20261129 \
  --shapeBal=1 --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:long \
  --winOnly=1 --out=scratch/arms/TM-MINIT-A1.bak
```

第一枚 `.bak` 落盘立即验 `v:92 / S1o / 16561` 与 `selftest3`；血统错或结构红立即淘汰，不跑后续 Stage 1。

## 4. 硬门与裁定

两臂先同看，不按早期快照挑优：

1. `selftest3` 六腿全绿；
2. Stage 1：`winRate ≥ 42%`、`miniT ≥ 4`、`transfer ≥ 15`、`jinshield ≥ 25`、总废珠 `≤ 35%`；
3. `probe-minit-effectiveness`：`totalPts ≥ 10` 且 `pts/cast ≥ 0.48`；
4. 通过后才跑 `promote --dry --support=2` 与 `90210/90211` 两批人席，要求 `0 阻断 / seatKill=0`；
5. 最后做 `TM-S5-a40` 同位替换的四组阶梯，全部保序才考虑入池。

任一硬门失败即淘汰；不扫 lr、frac、seed，不补第三臂。若需要降废，只能在较优一臂上补一段预注册短程 ridge PG，并重新过全套硬门。
