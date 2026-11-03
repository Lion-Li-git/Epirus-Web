#!/usr/bin/env bash
# 强度大考扩编车道：弱带候选 8 枚（D 谱系专精 + PLAIN/POPP/G5/NGA2R 族），200 局 × 2 模式
set -u
cd /d/code/Epirus-Web || exit 1
MODE="${1:?用法: night6-strength-ext.sh <long|multi>}"
OUT="scratch/night6/strength-$MODE-ext.tsv"
PACKS="scratch/night4/D-b-hpseed-s13.js scratch/night4/DDEF-s13.js scratch/night4/DSTR4-s13.js scratch/night4/LE-s13.js scratch/night3/GD3ALL-PLAIN-s13.js scratch/night3/GD3ALL-POPP-s41.js scratch/night3/GD3ALL-G5-s13.js scratch/night3/GD3ALL-NGA2R-s41.js"
echo -e "pack\tgames\tfirst" > "$OUT"
for P in $PACKS; do
  n=$(basename "$P" .js)
  [ -f "$P" ] || { echo -e "$n\t0\tNA" >> "$OUT"; continue; }
  r=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode="$MODE" --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  echo -e "$n\t200\t${r:-NA}" >> "$OUT"
  echo "ext-$MODE $n = ${r:-NA}%"
done
echo "=== 扩编 $MODE 完成 $(date +%H:%M)" >> "$OUT"
