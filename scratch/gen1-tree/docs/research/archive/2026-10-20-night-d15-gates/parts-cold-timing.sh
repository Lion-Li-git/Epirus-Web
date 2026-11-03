#!/usr/bin/env bash
# §E659 拆分验收 · 冷跑逐部分墙钟（NP_NOCACHE=1 ⇒ 与 CI 同口径：CI 每趟都是冷的）
# 串行、单进程 ⇒ 不并发（并发会把秒数洗成没法引用，且 ship-feas 那条并发红就是这么来的）。
# 判活看这份日志的**收尾行 ALLDONE**，别看包装器的退出码。
cd /d/code/Epirus-Web || exit 3
OUT=docs/research/archive/2026-10-20-night-d15-gates/parts-cold.log.txt
: > "$OUT"
for P in train-pick train-breadth train-table train-econ train-evo; do
  S=$(date +%s)
  NP_NOCACHE=1 NP_TIME=1 node tools/np-test.mjs --part="$P" >> "$OUT" 2>&1
  RC=$?
  echo "@@ part=$P rc=$RC wall=$(( $(date +%s) - S ))s ‖ $(grep 'N人测试：通过' "$OUT" | tail -1)" >> "$OUT"
done
echo "ALLDONE $(date '+%F %T')" >> "$OUT"
