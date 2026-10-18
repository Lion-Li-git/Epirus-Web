#!/usr/bin/env bash
# §E643 首轮四臂（asis/churn/weak/rand × 2 桌形，150 局/格）。原始产出 = 本目录 gtc.log
# 归仓版（2026-10-18）改动只有两处：① 根 = 本脚本所在仓（旧版 `cd /d/wt-qoder-1018` 是某台机器的测量 worktree，干净克隆里不存在）；
#   ② 复跑默认写 <脚本名>.rerun.log，不覆盖进仓的原始日志（要覆盖就自己传路径）。
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
cd "$REPO" || exit 9
LOG=${1:-$HERE/gtc-batch.rerun.log}
: > "$LOG"
for shape in "focusfire,focusfire,focusfire,focusfire" "aggro,gunspam,focusfire,deepsaver"; do
  for arm in asis churn weak rand; do
    echo "=== shape=[$shape] arm=$arm" >> "$LOG"
    node tools/guard-the-charger.mjs --arm=$arm --games=150 --seats="$shape" >> "$LOG" 2>&1
  done
done
echo "GTC_DONE $(date +%H:%M:%S)" >> "$LOG"
