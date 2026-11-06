#!/usr/bin/env bash
# 波次 5：环底座包（GD3-RING）拿去买强度 —— 唯一变量还是对手面（RICH 13 席 vs 产品 7 席）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
RICH='names:random,defend,wall,antidef,farmer,heavyfire,deepsaver,targeter,gunspam,ringspam,earlypressure,deadlineburst,protomine'
COMMON='--mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=first --arenaHold=60 --arenaShapes=3:multi,5:multi'
START=scratch/arms/GD3-RING.bak
for s in 7 13; do
  for tag in RICH CTRL; do
    pool=$RICH; [ "$tag" = CTRL ] && pool=product
    node tools/probe-cem-arm.mjs $COMMON --arenaPool=$pool --seed=$s --start=$START --out=scratch/arms/${tag}-ring-s$s.bak > scratch/$tag-ring-s$s.log 2>&1
    if [ ! -f "scratch/arms/${tag}-ring-s$s.bak" ]; then echo "⛔ ${tag}-ring-s$s 没落盘"; tail -3 "scratch/$tag-ring-s$s.log"; exit 8; fi
    h=$(node -e "const m=require('./scratch/arms/${tag}-ring-s$s.bak.meta.json');console.log('holdFirst='+m.holdoutFirst+' roster='+(m.arena||{}).roster)")
    printf "%-14s %s\n" "${tag}-ring-s$s" "$h"
  done
done
echo "### 审计四枚（六判据 + 考卷 + 落地份额）"
for p in RICH-ring-s7 RICH-ring-s13 CTRL-ring-s7 CTRL-ring-s13; do
  node tools/proto2/skill-mastery.mjs --pack=scratch/arms/$p.bak --games=40 --out=scratch/mt-$p.json > scratch/mastery-$p.log 2>&1
  f5=$(node tools/eval-5p.mjs 12 5 77000 scratch/arms/$p.bak 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  tg=$(node tools/eval-5p.mjs 40 5 77000 scratch/arms/$p.bak --field=targeter 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  line=$(grep -hE "会聚能环|会大雷|会激光眼|会电磁炮" scratch/mastery-$p.log | tr '\n' ' ' | cut -c1-190)
  printf "%-14s 5P=%-6s targeter=%-6s %s\n" "$p" "$f5" "$tg" "$line"
done
node tools/proto2/breadth2.mjs --pack=scratch/arms/RICH-ring-s7.bak,scratch/arms/RICH-ring-s13.bak,scratch/arms/CTRL-ring-s7.bak,scratch/arms/CTRL-ring-s13.bak 2>&1 | tail -6
echo "### done $(date +%H:%M:%S)"
