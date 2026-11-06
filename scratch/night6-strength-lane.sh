#!/usr/bin/env bash
# 强度大考单车道（ZCode · 11-04 凌晨）：13 候选包 × 200 局 × 固定 seed 77000 ⇒ 排名尺
# 用法: bash scratch/night6-strength-lane.sh <mode>   # mode = long | multi
# 落盘: scratch/night6/strength-<mode>.tsv  列: pack games first
set -u
cd /d/code/Epirus-Web || exit 1
MODE="${1:?用法: night6-strength-lane.sh <long|multi>}"
mkdir -p scratch/night6
OUT="scratch/night6/strength-$MODE.tsv"
PACKS="scratch/night3/GD3ALL-POPP-s17.js scratch/night3/GD3ALL-PUSHON-s13.js scratch/night3/GD3ALL-PUSHON-s41.js scratch/night3/GD3ALL-G5-8p-s41.js scratch/night4/EFFG-s41.js scratch/night4/EFFG-s7.js scratch/night4/EFFG-s5.js scratch/night4/G5DEF-s41.js scratch/night4/D-a-s13.js scratch/night4/DSTR-s13.js scratch/night5/L5-1200-s13.js scratch/night5/D1200-s13.js scratch/night4/CB-s13.js"
echo -e "pack\tgames\tfirst" > "$OUT"
for P in $PACKS; do
  n=$(basename "$P" .js)
  [ -f "$P" ] || { echo -e "$n\t0\tNA" >> "$OUT"; continue; }
  r=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode="$MODE" --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  echo -e "$n\t200\t${r:-NA}" >> "$OUT"
  echo "$MODE $n = ${r:-NA}%"
done
echo "=== 强度大考 $MODE 完成 $(date +%H:%M)" >> "$OUT"
