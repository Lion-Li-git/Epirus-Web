#!/usr/bin/env bash
# 强度大考试补车道：night5 的 EFFG/G5DEF 四枚（主车道写的是 night4 旧路径 ⇒ 0/NA）
set -u
cd /d/code/Epirus-Web || exit 1
MODE="${1:?用法: night6-strength-fix.sh <long|multi>}"
OUT="scratch/night6/strength-$MODE-fix.tsv"
PACKS="scratch/night5/EFFG-s41.js scratch/night5/EFFG-s7.js scratch/night5/EFFG-s5.js scratch/night5/G5DEF-s41.js"
echo -e "pack\tgames\tfirst" > "$OUT"
for P in $PACKS; do
  n=$(basename "$P" .js)
  [ -f "$P" ] || { echo -e "$n\t0\tNA" >> "$OUT"; continue; }
  r=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode="$MODE" --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  echo -e "$n\t200\t${r:-NA}" >> "$OUT"
  echo "fix-$MODE $n = ${r:-NA}%"
done
echo "=== 补考 $MODE 完成 $(date +%H:%M)" >> "$OUT"
