#!/usr/bin/env bash
# 验 --selCap：①默认关 ⇒ 与在册 RB2P-s13 产物逐字节同 ②开 cap ⇒ 挡下集中度过高的粒子并印数
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
CO="--mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaPool=product --arenaCur=first --arenaShapes=3:multi,5:multi"
echo "### ① 回归腿（不开 selCap，重跑昨夜 RB2P-s13 的原命令）$(date +%H:%M:%S)"
node tools/probe-cem-arm.mjs $CO --seed=13 --start=scratch/arms/gd3repro-OB3RB2s23.bak --out=scratch/arms/SELREG-s13.bak > scratch/selreg-s13.log 2>&1
md5sum scratch/arms/SELREG-s13.bak scratch/arms/RB2P-s13.bak
grep -c "当选面上限" scratch/selreg-s13.log | sed 's/^/  默认路径印 cap 行的条数（必须是 0）: /'
echo "### ② 开 cap 的臂（波次 7：起点 GD3-RATION × RICH 13 席）$(date +%H:%M:%S)"
for s in 7 13; do
  node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
    --arena2=1 --arenaCur=first --arenaHold=60 --arenaShapes=3:multi,5:multi \
    --arenaPool=names:random,defend,wall,antidef,farmer,heavyfire,deepsaver,targeter,gunspam,ringspam,earlypressure,deadlineburst,protomine \
    --selCap=0.45 --seed=$s --start=scratch/arms/GD3-RATION.bak --out=scratch/arms/CAP-ration-s$s.bak > scratch/cap-ration-s$s.log 2>&1
  [ -f scratch/arms/CAP-ration-s$s.bak ] || { echo "⛔ s$s 没落盘"; tail -3 scratch/cap-ration-s$s.log; exit 8; }
  grep -E "当选面上限" scratch/cap-ration-s$s.log | head -1
  echo "  holdFirst=$(node -e "console.log(require('./scratch/arms/CAP-ration-s$s.bak.meta.json').holdoutFirst)")"
done
echo "### done $(date +%H:%M:%S)"
