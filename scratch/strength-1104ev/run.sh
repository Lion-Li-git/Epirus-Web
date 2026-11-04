#!/usr/bin/env bash
# ① 同尺强度对齐（11-04 晚 · 千问）：与午后 afternoon-verdict-qoder.sh 逐字同口径
#   eval-5p 200 局/combo（4 组合 ⇒ 800 局/格）· --shipbigt=0 --shipdrain=0
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="scratch/strength-1104ev"; mkdir -p "$OUT"
TSV="$OUT/strength.tsv"; : > "$TSV"
for SPEC in "KDFULL400-s13:scratch/ga-arms/KDFULL400-s13.js" "线上包:js/bundled-champion-3p.js"; do
  NAME="${SPEC%%:*}"; P="${SPEC#*:}"
  [ -f "$P" ] || { echo "$NAME ⇒ 无产物" | tee -a "$OUT/MISSING.txt"; continue; }
  for D in 77000 77111; do
    for M in long multi; do
      [ "$NAME" = "线上包" ] && [ "$D" = 77111 ] && continue   # 参照只跑一副骰
      F="$OUT/$NAME-$M-$D.txt"
      node tools/eval-5p.mjs 200 5 "$D" "$P" --mode=$M --shipbigt=0 --shipdrain=0 > "$F" 2>&1
      v=$(grep -oE '\[冠军\] 1st=[0-9.]+' "$F" | head -1 | cut -d= -f2)
      printf '%s\tdice=%s\tmode=%s\t1st=%s\n' "$NAME" "$D" "$M" "${v:-NA}" | tee -a "$TSV"
    done
  done
done
echo "== 收尾 $(date +%H:%M) ⇒ 6 格应全在 $TSV"
