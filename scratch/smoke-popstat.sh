#!/usr/bin/env bash
# #46 冒烟：8 代小臂 关/开 各一次 ⇒ gen 行必须逐字同，开档多一个 JSONL 与 [种群统计] 行
set -u
REPO="D:/code/Epirus-Web"; mkdir -p "$REPO/scratch/popstat-smoke"
smoke() {
  local mode="$1"
  ( cd "$REPO" || exit 3
    export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK='scratch/night4/CB-s13.js' EPIRUS_SEED=13
    export EPIRUS_ARM="SMOKEPS-$mode" EPIRUS_BAND_DIR="$REPO/scratch/popstat-smoke/$mode"
    export EPIRUS_T3P_OUT="$REPO/scratch/popstat-smoke/SMOKEPS-$mode.js"
    if [ "$mode" = on ]; then export EPIRUS_POPSTAT=1 EPIRUS_POPSTAT_K=3 EPIRUS_POPSTAT_OUT="$REPO/scratch/popstat-smoke/SMOKEPS-on.jsonl"; else unset EPIRUS_POPSTAT EPIRUS_POPSTAT_K EPIRUS_POPSTAT_OUT; fi
    node tools/train-3p.mjs 8 3 4 4 > "$REPO/scratch/popstat-smoke/SMOKEPS-$mode.log" 2>&1
    echo "SMOKEPS-$mode rc=$?" )
}
smoke off; smoke on
echo "--- gen 行 diff（空 = 演化一字未动）"
diff <(grep '^gen ' scratch/popstat-smoke/SMOKEPS-off.log) <(grep '^gen ' scratch/popstat-smoke/SMOKEPS-on.log) && echo "逐字同 ✓"
echo "--- 关档不许出现 [种群统计]：$(grep -c '种群统计' scratch/popstat-smoke/SMOKEPS-off.log) 行"
echo "--- 开档 JSONL：$(wc -l < scratch/popstat-smoke/SMOKEPS-on.jsonl) 行 ‖ 首行：$(head -1 scratch/popstat-smoke/SMOKEPS-on.jsonl | cut -c1-260)"
