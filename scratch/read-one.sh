#!/usr/bin/env bash
# read-one.sh <臂名> — 单臂判读（强度 5P 四骰 + 8P + 3P ‖ 两世界分层 ‖ 反事实定价 n=5/3）
cd "$(dirname "$0")/.." || exit 1
arm="$1"; P="scratch/ga-arms/$arm.js"; L="scratch/read-$arm.txt"
: > "$L"
echo "### $arm" >> "$L"
if [ ! -f "$P" ]; then echo "  ⛔ 产物不存在" >> "$L"; exit 1; fi
for spec in "12 5 77000 5P" "12 5 77111 5P" "12 5 77222 5P" "12 5 77333 5P" "10 8 81000 8P" "12 3 77000 3P"; do
  set -- $spec; printf "  %s seed=%s: " "$4" "$3" >> "$L"
  node tools/eval-5p.mjs $1 $2 $3 "$P" --shipbigt=0 --shipdrain=0 2>&1 | grep -E "^\[冠军\]" | sed -E "s/.*1st=([0-9.]+)% 严胜=([0-9.]+)%.*/1st=\1% 严胜=\2%/" >> "$L"
done
for t in strat train; do echo "  -- def-drain-trace table=$t" >> "$L"
  node tools/proto2/def-drain-trace.mjs --pack="$P" --table=$t --games=40 2>&1 | tail -5 | sed 's/^/    /' >> "$L"; done
for n in 5 3; do echo "  -- 反事实定价 n=$n" >> "$L"
  node scratch/counterfactual-value.mjs --pack="$P" --n=$n --games=400 2>&1 | grep -E "^(train|strat|onlygun) \| (native|def@满血 剂量 1/1|def@HP-1 剂量 1/1|def@HP-1∧刚挨打|drain@≤1 剂量 1/1)" | sed 's/ \+/ /g' | cut -c1-120 | sed 's/^/    /' >> "$L"; done
echo "[done] $(date +%H:%M:%S)" >> "$L"
