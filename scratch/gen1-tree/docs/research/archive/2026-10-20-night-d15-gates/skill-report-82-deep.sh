#!/usr/bin/env bash
# §E664 加深档：同一枚包在短(multi·3血)/长(long·5血)两档上把局/组从 6 抬到 30
#   （skill-report 自己报的"要把全部卡辨到 2pt 需 ~30 局/组"⇒ 这不是改判据，是把这把尺的分辨率抬到它自己写的目标）
# 串行跑（同机并发会把秒数与读数洗掉）。判活看这份日志的 ALLDONE 行。
cd /d/code/Epirus-Web || exit 3
A=docs/research/archive/2026-10-20-night-d15-gates
OUT=$A/skill-report-82-deep.log.txt
: > "$OUT"
for M in multi long; do
  S=$(date +%s)
  node tools/skill-report.mjs 5 30 "$A/skill-report-82-$M-deep.html" \
    --champ=docs/artifacts/v7beadseed-82.bak --mode=$M \
    --json="$A/skill-report-82-$M-deep.json" >> "$OUT" 2>&1
  RC=$?
  echo "@@ mode=$M games=30 rc=$RC wall=$(( $(date +%s) - S ))s" >> "$OUT"
done
echo "ALLDONE $(date '+%F %T')" >> "$OUT"
