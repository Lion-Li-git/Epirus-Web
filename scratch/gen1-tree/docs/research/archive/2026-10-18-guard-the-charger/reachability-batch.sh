#!/usr/bin/env bash
# 可达性表：机制上限桌（五席全脚本）+ 主语包在集火桌上的送盾触发
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../../../.." && pwd)   # 归仓版：根 = 本脚本所在仓（旧版 cd 到某台机器的测量 worktree）
cd "$REPO" || exit 9
LOG=${1:-$HERE/reachability-batch.rerun.log}   # 原始产出 = 本目录 reachability.log；复跑默认不覆盖它
: > "$LOG"
run() { # $1=tag $2=seats $3=mode $4=games
  echo "### $1" >> "$LOG"
  node tools/reachability.mjs --seats="$2" --mode="$3" --games="$4" >> "$LOG" 2>&1
}
run "上限桌A protowall+focusfire×4 · multi"  "protowall,focusfire,focusfire,focusfire,focusfire" multi 150
run "上限桌A 同桌 · long(5血)"               "protowall,focusfire,focusfire,focusfire,focusfire" long 150
run "上限桌B protowall+gunspam×4 · multi"    "protowall,gunspam,gunspam,gunspam,gunspam"         multi 150
run "对照桌  protowall×5（人人持盾没人集火）" "protowall,protowall,protowall,protowall,protowall"  multi 150
run "包+focusfire×4 · multi"                 "focusfire,focusfire,focusfire,focusfire"           multi 150
run "包+focusfire×4 · long"                  "focusfire,focusfire,focusfire,focusfire"           long  150
echo "REACH_DONE $(date +%H:%M:%S)" >> "$LOG"
