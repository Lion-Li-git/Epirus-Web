HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../../../.." && pwd)   # 归仓版：根 = 本脚本所在仓
cd "$REPO" || exit 9
BASES=987654,987655,987656,987657,987658,987659,987660,987661,987662,987663,987664,987665
LOG=${1:-$HERE/selband-batch.rerun.log}
DUMP=${2:-$HERE/selband-batch.rerun.tsv}   # 原始矩阵已进仓 = champion-map/selband-2026-10-18.tsv；复跑默认不覆盖它
: > "$LOG"
node champion-map/evaln-noise.mjs docs/artifacts/e100-out/B5-10-31.bak docs/artifacts/e234-out/D4a.js docs/artifacts/e234-out/E3.js docs/artifacts/e608-out/G12H1.js docs/artifacts/kept/e78-out__G08-71.bak docs/artifacts/kept/e70-out__D02-31.bak docs/artifacts/e521-out/R-s123.js docs/artifacts/e521-out/S-s120.js docs/artifacts/eval-out/win-Ldemo.bak docs/artifacts/e528-out/T8-s114.js docs/artifacts/v7bead1-93.bak docs/artifacts/v7cmin3-93.bak docs/artifacts/kept/e124-out__blk0t40-s31.bak docs/artifacts/E59-land-902.bak docs/artifacts/e106-out/N5L-30.bak docs/artifacts/eval-out/win-R311.bak docs/artifacts/eval-out/sel80.bak docs/artifacts/e504-out/SP-s30.js docs/artifacts/e539-out/U-s216.js docs/artifacts/v7bead3-82.bak docs/artifacts/v7force-34.bak docs/artifacts/v7l2c-101.bak docs/artifacts/v7n1-93.bak docs/artifacts/v7new5_005-81.bak docs/artifacts/v7ringB1-93.bak docs/artifacts/v7role1-91.bak docs/artifacts/v7u1-82.bak docs/artifacts/v7wall2-97.bak --bases=$BASES --dump=$DUMP > "$LOG" 2>&1
echo "SELBAND_DONE $(date +%H:%M:%S)" >> "$LOG"
