#!/usr/bin/env bash
# score13 上线门全检批 v2（修正路径 + densityOf gen-3 装载）
set -u
cd /d/code/Epirus-Web || exit 1
: > scratch/night4/score13-batch.txt
for P in scratch/night3/GD3ALL-POPP-s17.js scratch/night3/GD3ALL-PUSHON-s13.js scratch/night3/GD3ALL-PUSHON-s41.js scratch/night3/GD3ALL-G5-8p-s41.js scratch/night4/DSTR-s13.js scratch/night4/D-a-s13.js scratch/night4/W0-ctrl-s13.js scratch/ga-arms/GA-ration-s41.js; do
  n=$(basename "$P" .js)
  echo "== $n" >> scratch/night4/score13-batch.txt
  node tools/score13.mjs --pack="$P" --run >> scratch/night4/score13-batch.txt 2>&1
done
echo "=== score13 批完成 $(date +%H:%M)" >> scratch/night4/score13-batch.txt
