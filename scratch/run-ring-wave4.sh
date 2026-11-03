#!/usr/bin/env bash
# 波次 4：环优先蒸馏（正式档）+ 三桶审计 —— 验"环是经济底座，不是第三个技能"
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
UP=scratch/arms/OB3S-C2-s7.bak
echo "### 蒸馏 4：teacher=ring 正式档（groups=800 与在册配方同）$(date +%H:%M:%S)"
node tools/proto2/supfit-gd.mjs --upstream=$UP --groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key --teacher=ring --out=scratch/arms/GD3-RING.bak > scratch/gd3-ring.log 2>&1
grep -E "逐键|耗时|产物" scratch/gd3-ring.log | tail -4
echo "### 审计 GD3-RING"
node tools/proto2/skill-mastery.mjs --pack=scratch/arms/GD3-RING.bak --games=40 --out=scratch/mt-GD3-RING.json > scratch/mastery-GD3-RING.log 2>&1
grep -E "会聚能环|会大雷|会电磁炮|会激光眼|会小雷|会过载炮|珠经济" scratch/mastery-GD3-RING.log | tail -8
f5=$(node tools/eval-5p.mjs 12 5 77000 scratch/arms/GD3-RING.bak 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
f3=$(node tools/eval-5p.mjs 12 3 77000 scratch/arms/GD3-RING.bak 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
printf "GD3-RING 5P=%s 3P=%s\n" "$f5" "$f3"
node tools/proto2/breadth2.mjs --pack=scratch/arms/GD3-RING.bak,scratch/arms/SMOKE-ring.bak 2>&1 | tail -4
echo "### 环提供的门：longrange-offer 在 GD3-RING 上的提供率"
EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1 node tools/proto2/longrange-offer.mjs --perShape=6 --keys=ring,bigT,laserEye,miniT,railgun --packs=scratch/arms/GD3-RING.bak 2>&1 | tail -8
echo "### done $(date +%H:%M:%S)"
