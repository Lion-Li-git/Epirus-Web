#!/usr/bin/env bash
# RICH 对手面臂（PREREG-2026-11-01-OPPONENT-FACE §三）：一次一条，顺序跑，各自落盘 .bak+meta
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
RICH='names:random,defend,wall,antidef,farmer,heavyfire,deepsaver,targeter,gunspam,ringspam,earlypressure,deadlineburst,protomine'
COMMON='--mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=first --arenaHold=60 --arenaShapes=3:multi,5:multi'
run() { # $1=tag $2=pool $3=start $4=seed
  echo "### $1 s$4 start=$3"
  node tools/probe-cem-arm.mjs $COMMON --arenaPool=$2 --seed=$4 --start=$3 --out=scratch/arms/$1-s$4.bak > scratch/$1-s$4.log 2>&1
  if ! grep -q "指纹" "scratch/$1-s$4.log"; then echo "⛔ $1-s$4 没建桌 ⇒ 停整批"; sed -n '1,4p' "scratch/$1-s$4.log"; exit 9; fi
  if [ ! -f "scratch/arms/$1-s$4.bak" ]; then echo "⛔ $1-s$4 没落 .bak ⇒ 停整批"; tail -3 "scratch/$1-s$4.log"; exit 8; fi
  echo "  → scratch/arms/$1-s$4.bak OK"
}
# RICH 组（13 席：产品 7 + 6 个从没上场的压力源）
run RICH-b41 "$RICH" scratch/arms/BROAD-tkCH-s41.bak 7
run RICH-b41 "$RICH" scratch/arms/BROAD-tkCH-s41.bak 13
run RICH-rb2 "$RICH" scratch/arms/gd3repro-OB3RB2s23.bak 7
run RICH-rb2 "$RICH" scratch/arms/gd3repro-OB3RB2s23.bak 13
# 对照组 CTRL（同起点同预算，只换对手面=产品 7；链起点的对照在册已有 RB2P-*）
run CTRL-b41 product scratch/arms/BROAD-tkCH-s41.bak 7
run CTRL-b41 product scratch/arms/BROAD-tkCH-s41.bak 13
echo "### 全部跑完 $(date +%H:%M:%S)"
