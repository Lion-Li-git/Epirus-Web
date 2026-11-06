#!/usr/bin/env bash
# 泛用性矩阵 v2：好包 × {人数 × 血量模式}
set -u
cd /d/code/Epirus-Web || exit 1
: > scratch/night4/generality-matrix.txt
PACKS="scratch/night3/GD3ALL-POPP-s17.js scratch/night3/GD3ALL-PUSHON-s13.js scratch/night3/GD3ALL-PUSHON-s41.js scratch/night3/GD3ALL-G5-8p-s41.js scratch/night4/EFFG-s41.js scratch/night4/EFFG-s7.js scratch/night4/EFFG-s5.js scratch/night4/G5DEF-s41.js scratch/night4/D-a-s13.js scratch/night4/DSTR-s13.js scratch/night5/L5-1200-s13.js scratch/night5/D1200-s13.js scratch/night4/CB-s13.js"
for P in $PACKS; do
  n=$(basename "$P" .js)
  [ -f "$P" ] || continue
  row="$n"
  for cfg in "3 multi" "4 multi4" "5 long" "8 multi" "10 multi"; do
    set -- $cfg
    r=$(node tools/eval-5p.mjs 8 $1 77000 "$P" --mode=$2 --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    row="$row | ${1}人$2=${r:-NA}%"
  done
  echo "$row" >> scratch/night4/generality-matrix.txt
  echo "$row"
done
echo "=== 泛用性矩阵完成 $(date +%H:%M)" >> scratch/night4/generality-matrix.txt
