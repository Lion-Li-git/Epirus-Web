#!/usr/bin/env bash
# night3 Phase 2 基线电池（00:5x，用户裁定干预全关口径）
# 三个读数层：
#   A) 5P 四骰重测 ×2 口径（--shipbigt=0 --shipdrain=0 干预全关 ‖ 不设旗标=引擎默认档即带大雷兑现）
#      ⇒ 两口径差 = BIGT_PUSH=12 在这些包身上的真实价签（审计既往 bigT 读数污染面）
#   B) 8P 首测（干预全关，GAMES=10×4combo=40 局/包，seed 81000）
#   C) v7 冠军参照（只 5P；8P 已知瞎，不重测）
set -u
cd /d/code/Epirus-Web || exit 1
mkdir -p scratch/night3
PACKS="scratch/ga-arms/GA2R-sword-s13.js scratch/ga-arms/GA2R-sword-s41.js scratch/ga-arms/GATE4b-s13.js scratch/ga-arms/GATE4b-s41.js scratch/ga-arms/GA-ration-s41.js"
echo "=== A) 5P 四骰（12/combo，seed 77000）×2 口径 ==="
printf "%-22s %-10s %-10s\n" "包" "干预全关" "带兑现档"
for p in $PACKS js/bundled-champion-3p.js; do
  n=$(basename $p .js)
  c=$(node tools/eval-5p.mjs 12 5 77000 $p --shipbigt=0 --shipdrain=0 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  d=$(node tools/eval-5p.mjs 12 5 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  node tools/eval-5p.mjs 12 5 77000 $p --shipbigt=0 --shipdrain=0 > scratch/night3/eval5-$n-clean.txt 2>&1
  printf "%-22s %-10s %-10s\n" "$n" "$c" "$d"
done
echo "=== B) 8P 首测（10/combo=40 局，seed 81000，干预全关）==="
printf "%-22s %-10s %-10s\n" "包" "8P 1st%" "局长"
for p in $PACKS; do
  n=$(basename $p .js)
  out=$(node tools/eval-5p.mjs 10 8 81000 $p --shipbigt=0 --shipdrain=0 2>/dev/null)
  echo "$out" > scratch/night3/eval8-$n-clean.txt
  r=$(echo "$out" | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  rl=$(echo "$out" | grep -oE '平均[ 0-9.]+回合|rounds?=[0-9.]+' | head -1)
  printf "%-22s %-10s %-10s\n" "$n" "$r" "$rl"
done
echo "=== C) GATE4b-s13 / GA2R-s13 干净口径 skill report（3P，6 局/条件）==="
node tools/skill-report.mjs 3 6 scratch/night3/sr-GATE4b-s13-clean.html --champ=scratch/ga-arms/GATE4b-s13.js --json=scratch/night3/sr-GATE4b-s13-clean.json --shipbigt=0 --shipdrain=0 2>&1 | tail -3
node tools/skill-report.mjs 3 6 scratch/night3/sr-GA2R-s13-clean.html --champ=scratch/ga-arms/GA2R-sword-s13.js --json=scratch/night3/sr-GA2R-s13-clean.json --shipbigt=0 --shipdrain=0 2>&1 | tail -3
echo "=== done $(date +%H:%M:%S)"
