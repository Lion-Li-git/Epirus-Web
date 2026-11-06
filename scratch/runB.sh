#!/bin/bash
cd /d/code/Epirus-Web
gate(){ EPIRUS_ARCH2=S1ob:input=obs3b EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs \
  --mode=cem --pop=48 --games=4 --fxGames=16 --targetGames=24000 --arena2=1 --arenaStrat=mild \
  --start=scratch/arms/OB3CH-s7.bak --masteryKey=railgun --masteryLine=0.15 --masteryGate=best \
  --masteryGames=12 --masteryN=3 --masteryTable=long --seed=$1 --label=OB3RB2 \
  --out=scratch/arms/OB3RB2-s$1.bak > scratch/ob3rb2-s$1.log 2>&1; echo "gate s$1 rc=$?"; }
tune(){ EPIRUS_ARCH2=S1ob:input=obs3b EPIRUS_MUT_MODE=seg node tools/probe-cem-arm.mjs \
  --mode=cem --pop=48 --games=4 --targetGames=24000 --arena2=1 --arenaStrat=mild \
  --start=scratch/arms/supfit-w1.bak --seed=$1 --label=SUPTUNE \
  --out=scratch/arms/SUPTUNE-s$1.bak > scratch/suptune-s$1.log 2>&1; echo "tune s$1 rc=$?"; }
for s in $1; do gate $s & done; wait
