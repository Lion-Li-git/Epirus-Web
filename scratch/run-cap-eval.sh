#!/usr/bin/env bash
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
R='names:random,defend,wall,antidef,farmer,heavyfire,deepsaver,targeter,gunspam,ringspam,earlypressure,deadlineburst,protomine'
CO="--mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=first --arenaHold=60 --arenaShapes=3:multi,5:multi"
echo "### s13 开 cap"
node tools/probe-cem-arm.mjs $CO --arenaPool=$R --selCap=0.45 --seed=13 --start=scratch/arms/GD3-RATION.bak --out=scratch/arms/CAP-ration-s13.bak > scratch/cap-ration-s13.log 2>&1
grep -E "当选面上限" scratch/cap-ration-s13.log | head -1
echo "### 验收 两粒 cap 臂（SF-1 多线 / SF-2 强度 / SF-3 剂量）"
for p in CAP-ration-s7 CAP-ration-s13; do
  f=scratch/arms/$p.bak
  node tools/proto2/skill-mastery.mjs --pack=$f --games=40 --out=scratch/mt-$p.json > scratch/mastery-$p.log 2>&1
  v5=$(node tools/eval-5p.mjs 12 5 77000 $f 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  v3=$(node tools/eval-5p.mjs 12 3 77000 $f 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  gw=$(node tools/eval-5p.mjs 40 5 77000 $f --field=gunwall 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  sn=$(node tools/eval-5p.mjs 40 5 77000 $f --field=sniperwall 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  tg=$(node tools/eval-5p.mjs 40 5 77000 $f --field=targeter 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  meta=$(node -e "const m=require('./scratch/arms/$p.bak.meta.json');console.log('holdFirst='+(m.holdoutFirst||0).toFixed(3)+' selCap='+(m.selCap?JSON.stringify(m.selCap):'-')+' noOp='+(m.lineage||{}).noOp)")
  echo "--- $p  5P=$v5 3P=$v3 gunwall=$gw sniper=$sn targeter=$tg"
  echo "    $meta"
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" scratch/mastery-$p.log | cut -c1-64
  node tools/proto2/breadth2.mjs --pack=$f 2>/dev/null | sed -n '4p' | tr -s ' '
done
echo "### done $(date +%H:%M:%S)"
