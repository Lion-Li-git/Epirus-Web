#!/bin/bash
arm(){ # $1=label $2=pop $3=elite $4=games $5=seed
  EPIRUS_ARCH2=S1ob:input=obs3b EPIRUS_MUT_MODE=seg node /d/code/Epirus-Web/tools/probe-cem-arm.mjs \
    --mode=cem --arena2=1 --arenaStrat=mild --targetGames=12000 --pop=$2 --elite=$3 --games=$4 --seed=$5 \
    --label=$1 --out=/d/code/Epirus-Web/scratch/arms/$1-s$5.bak > /d/code/Epirus-Web/scratch/$1-s$5.log 2>&1
  echo "$1 s$5 rc=$?"
}
arm SPLIT-P48G4 48 4 4 $1 ; arm SPLIT-P12G16 12 2 16 $1 ; arm SPLIT-P6G32 6 2 32 $1
