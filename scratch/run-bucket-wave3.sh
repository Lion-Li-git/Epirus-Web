#!/usr/bin/env bash
# 波次 3：两刀修法（激光眼"没人防御就不放" + 靶向采集也作用于 DAgger 轮）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
UP=scratch/arms/OB3S-C2-s7.bak
FLAGS="--groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"
echo "### 回归腿：默认 chain 必须仍 md5 逐位同 $(date +%H:%M:%S)"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --out=scratch/arms/REG-chain-1101b.bak > scratch/reg-chain-1101b.log 2>&1
md5sum scratch/arms/REG-chain-1101b.bak scratch/arms/gd3b-ks-sb.bak
echo "### 蒸馏 3A：teacher=bigt + DAgger×靶向（学生自访轮也只收 bigT 组）"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --teacher=bigt --dagger=2 --rareOnly=bigT --rareFrac=0.5 --out=scratch/arms/GD3-BIGT2.bak > scratch/gd3-bigt2.log 2>&1
grep -E "逐键|留出|稀有|产物" scratch/gd3-bigt2.log | tail -5
echo "### 蒸馏 3B：teacher=lasereye v2（有防才放）"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --teacher=lasereye --out=scratch/arms/GD3-LASER2.bak > scratch/gd3-laser2.log 2>&1
grep -E "逐键|留出|产物" scratch/gd3-laser2.log | tail -4
echo "### 审计（六判据 + 考卷 + 落地份额）"
for p in scratch/arms/GD3-BIGT2.bak scratch/arms/GD3-LASER2.bak; do
  n=$(basename $p .bak)
  node tools/proto2/skill-mastery.mjs --pack=$p --games=40 --out=scratch/mt-$n.json > scratch/mastery-$n.log 2>&1
  echo "--- $n ---"
  grep -E "会大雷|会激光眼|会电磁炮|珠经济" scratch/mastery-$n.log | tail -4
  f5=$(node tools/eval-5p.mjs 12 5 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  f3=$(node tools/eval-5p.mjs 12 3 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  printf "%-14s 5P=%-6s 3P=%s\n" "$n" "$f5" "$f3"
done
node tools/proto2/breadth2.mjs --pack=scratch/arms/GD3-BIGT2.bak,scratch/arms/GD3-LASER2.bak 2>&1 | tail -4
echo "### done $(date +%H:%M:%S)"
