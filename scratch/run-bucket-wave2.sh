#!/usr/bin/env bash
# 波次 2：大雷/激光眼桶线在代 3 上重训（用户 11-01 裁"不死守旧包"）——先出蒸馏物起点分母
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
UP=scratch/arms/OB3S-C2-s7.bak
FLAGS="--groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"
echo "### 蒸馏 1：teacher=bigt（靶向采集 bigT 50%）$(date +%H:%M:%S)"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --teacher=bigt --rareOnly=bigT --rareFrac=0.5 --out=scratch/arms/GD3-BIGT.bak > scratch/gd3-bigt.log 2>&1
tail -4 scratch/gd3-bigt.log
echo "### 蒸馏 2：teacher=lasereye $(date +%H:%M:%S)"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --teacher=lasereye --out=scratch/arms/GD3-LASER.bak > scratch/gd3-laser.log 2>&1
tail -4 scratch/gd3-laser.log
echo "### 起点分母：六判据 + 广度下限 + 考卷"
for p in scratch/arms/GD3-BIGT.bak scratch/arms/GD3-LASER.bak; do
  n=$(basename $p .bak)
  node tools/proto2/skill-mastery.mjs --pack=$p --games=40 --out=scratch/mt-$n.json > scratch/mastery-$n.log 2>&1
  grep -E "会大雷|会激光眼|会电磁炮|会小雷|语义" scratch/mastery-$n.log | tail -6
  f5=$(node tools/eval-5p.mjs 12 5 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  f3=$(node tools/eval-5p.mjs 12 3 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  printf "%-12s 5P=%-6s 3P=%s\n" "$n" "$f5" "$f3"
done
node tools/proto2/breadth2.mjs --pack=scratch/arms/GD3-BIGT.bak,scratch/arms/GD3-LASER.bak,scratch/arms/gd3b-ks-sb.bak 2>&1 | tail -6
echo "### done $(date +%H:%M:%S)"
