#!/usr/bin/env bash
# §E644 二：成分分解 —— weakchurn（快死 ∧ 在搓招，用户原话字面）vs churnnoweak（在搓招 ∧ 未濒死），400 局 × 2 桌。
# 原始产出 = 本目录 gtc4.log。⇒ 结论"快死了是负信号（0/197）"就出自这两臂，别只抄表格不落脚本。
# 归仓版（2026-10-18）：根 = 本脚本所在仓；复跑默认写 .rerun.log。
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
cd "$REPO" || exit 9
LOG=${1:-$HERE/gtc4-batch.rerun.log}
: > "$LOG"
for arm in weakchurn churnnoweak; do
  for shape in "deepsaver,deepsaver,aggro,gunspam" "aggro,gunspam,focusfire,deepsaver"; do
    echo "=== arm=$arm shape=[$shape]" >> "$LOG"
    node tools/guard-the-charger.mjs --arm=$arm --games=400 --seats="$shape" >> "$LOG" 2>&1
  done
done
echo "GTC4_DONE $(date +%H:%M:%S)" >> "$LOG"
