#!/usr/bin/env bash
# score13 全检批 v4：fa/feas/seat 三处解析修复后 + 各包强度实值（5P long 四骰均值）
set -u
cd /d/code/Epirus-Web || exit 1
: > scratch/night4/score13-batch.txt
runone() {
  n=$(basename "$1" .js)
  echo "== $n" >> scratch/night4/score13-batch.txt
  node tools/score13.mjs --pack="$1" --run --strength="$2" >> scratch/night4/score13-batch.txt 2>&1
}
runone scratch/night3/GD3ALL-POPP-s17.js 66.1
runone scratch/night3/GD3ALL-PUSHON-s13.js 61.5
runone scratch/night3/GD3ALL-PUSHON-s41.js 63.8
runone scratch/night3/GD3ALL-G5-8p-s41.js 42.9
runone scratch/night4/DSTR-s13.js 41.5
runone scratch/night4/D-a-s13.js 36.8
runone scratch/night4/W0-ctrl-s13.js 58.4
runone scratch/ga-arms/GA-ration-s41.js 58.3
echo "=== score13 v4 批完成 $(date +%H:%M)" >> scratch/night4/score13-batch.txt
