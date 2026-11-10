#!/bin/bash
# MSB8 steering 判读：8 枚定向包 + 起点冠军，合同口径卡谱（multi/60）——
# 判定 = 每臂「定向技能是否从 0 抬起 + distinct 是否 ≥9 + 防御占比是否守住」。
set -e
cd "$(dirname "$0")/../.."
P="docs/artifacts/night-adapt"
PACKS="$P/MSB8-guard-R1S1861674281.js,$P/MSB8-sword-R1S88974978.js,$P/MSB8-reflect-R1S1960226746.js,$P/MSB8-bigT-R1S501866988.js,$P/MSB8-bagua-R1S2059206767.js,$P/MSB8-holo-R1S745300182.js,$P/MSB8-charge-R1S0.js,$P/MSB8-railgun-R1S0.js"
# ⚠ 种子号以 msbatch2-MSB8-*-state.json 里实际派生的为准；跑之前先校准：
for f in scratch/night-adapt2/msbatch2-MSB8-*-state.json; do
  node -e "const s=require('./$f'); console.log('$f'.match(/MSB8-([a-z]+)/)[1], s.champion)"
done
echo "---卡谱（multi/60）---"
node tools/card-usage.mjs --packs="$PACKS,docs/artifacts/night-adapt/S916R2B-R1S685223462.js" --games=60 --mode=multi --out=scratch/zcode-1111-coverage/msb8-judge.tsv
echo "---C 读数（msbatch2.log 的 重测C MSB8 行）---"
grep -a "重测C MSB8" scratch/night-adapt2/msbatch2.log || true
