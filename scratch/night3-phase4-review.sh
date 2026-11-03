#!/usr/bin/env bash
# night3 Phase 4 终审电池（臂完成后跑）：四骰干净口径（5P×4seed + 3P）‖ 8P 量具 ‖ 宽复读 ‖ 镜 ‖ mastery
set -u
cd /d/code/Epirus-Web || exit 1
mkdir -p scratch/night3
ARMS="scratch/night3/GD3ALL-G5-s7.js scratch/night3/GD3ALL-G5-s13.js scratch/night3/GD3ALL-G5-s41.js"
ARMS8="scratch/night3/GD3ALL-G5-8p-s13.js scratch/night3/GD3ALL-G5-8p-s41.js"
LOG=scratch/night3/phase4-review.log
: > $LOG
echo "### 终审开始 $(date +%H:%M)（全部干预全关口径 --shipbigt=0 --shipdrain=0）" >> $LOG

for P in $ARMS $ARMS8; do
  [ -f "$P" ] || { echo "  ⛔ 缺 $P ⇒ 跳过" >> $LOG; continue; }
  n=$(basename $P .js)
  echo "  ---- $n" >> $LOG
  # 5P 四骰（seed 77000/77111/77222/77333，12/combo）
  tot=0; cnt=0
  for d in 77000 77111 77222 77333; do
    r=$(node tools/eval-5p.mjs 12 5 $d "$P" --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    echo "    5P seed=$d = ${r}%" >> $LOG
    tot=$(node -e "console.log(($tot)+(${r:-0}))"); cnt=$((cnt+1))
  done
  node -e "console.log('    5P 四骰均值 = ' + (($tot)/$cnt).toFixed(1))" >> $LOG
  # 3P
  r3=$(node tools/eval-5p.mjs 12 3 77000 "$P" --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  echo "    3P seed=77000 = ${r3}%" >> $LOG
  # 8P 量具（10/combo=40 局）
  r8=$(node tools/eval-5p.mjs 10 8 81000 "$P" --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  echo "    8P seed=81000 = ${r8}%" >> $LOG
  # 宽复读（n=40，isWideVs 同谓词，参照=起点）
  node scratch/wide-check.mjs --ref=scratch/arms/GD3-SWORD.bak --packs="$P" --games=40 > scratch/night3/wide-$n.log 2>&1
  sed -n '2,6p' scratch/night3/wide-$n.log | sed 's/^/    [宽] /' >> $LOG
  # 镜（breadth2）
  node tools/proto2/breadth2.mjs --pack="$P" > scratch/night3/breadth-$n.log 2>&1
  sed -n '4p' scratch/night3/breadth-$n.log | sed 's/^/    [镜] /' >> $LOG
  # mastery 桶线
  node tools/proto2/skill-mastery.mjs --pack="$P" > scratch/night3/mastery-$n.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济|会枪|会剑" scratch/night3/mastery-$n.log | sed 's/^/    [桶] /' >> $LOG
done
echo "### done $(date +%H:%M)" >> $LOG
cat $LOG
