#!/usr/bin/env bash
# §E644 一：把 §E643 那对成对臂的 churn 重复到 600 局/桌（因果量 +11.0/+14.0pt 的复量腿）。原始产出 = 本目录 gtc3.log
# 归仓版（2026-10-18）：根 = 本脚本所在仓；复跑默认写 .rerun.log。
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
cd "$REPO" || exit 9
LOG=${1:-$HERE/gtc3-batch.rerun.log}
: > "$LOG"
for shape in "deepsaver,deepsaver,aggro,gunspam" "aggro,gunspam,focusfire,deepsaver"; do
  echo "=== shape=[$shape] arm=churn games=600" >> "$LOG"
  node tools/guard-the-charger.mjs --arm=churn --games=600 --seats="$shape" >> "$LOG" 2>&1
done
echo "GTC3_DONE $(date +%H:%M:%S)" >> "$LOG"
