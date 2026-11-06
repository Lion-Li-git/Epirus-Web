#!/usr/bin/env bash
# 六臂批量四骰（5P 干净口径）——包席确权 6 对样本的收尾批
set -u
cd /d/code/Epirus-Web || exit 1
for s in 5 17 23; do
  for kind in POPP PLAIN; do
    P=scratch/night3/GD3ALL-$kind-s$s.js
    [ -f "$P" ] || { echo "GD3ALL-$kind-s$s 未落盘"; continue; }
    tot=0
    for d in 77000 77111 77222 77333; do
      r=$(node tools/eval-5p.mjs 12 5 $d $P --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
      tot=$(node -e "console.log(($tot)+(${r:-0}))")
    done
    node -e "console.log('GD3ALL-$kind-s$s ‖ 5P 四骰均值 = ' + (($tot)/4).toFixed(1))"
  done
done
echo "=== done $(date +%H:%M:%S)"
