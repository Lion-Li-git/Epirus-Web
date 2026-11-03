#!/usr/bin/env bash
# 11-03 T1 接线冒烟：8 代小臂 × 开/关 ⇒ 逐代行必须逐字同，末段只多一张 [分格选人] 回执
set -u
REPO="D:/code/Epirus-Web"
mkdir -p "$REPO/scratch/qoder-t1"
smoke() {
  local mode="$1"
  ( cd "$REPO" || exit 3
    export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1'
    export EPIRUS_MUT_MODE='seg'
    export EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1
    export EPIRUS_SEEDPACK='scratch/night4/CB-s13.js'
    export EPIRUS_SEED=13
    export EPIRUS_ARM="SMOKEGRID-$mode"
    export EPIRUS_BAND_DIR="$REPO/scratch/qoder-t1/$mode"
    export EPIRUS_T3P_OUT="$REPO/scratch/qoder-t1/SMOKEGRID-$mode.js"
    if [ "$mode" = on ]; then export EPIRUS_SEL_GRID=3 EPIRUS_SEL_GRID_MODE=long; else unset EPIRUS_SEL_GRID EPIRUS_SEL_GRID_MODE; fi
    node tools/train-3p.mjs 8 3 4 4 > "$REPO/scratch/qoder-t1/SMOKEGRID-$mode.log" 2>&1
    echo "SMOKEGRID-$mode rc=$?" )
}
smoke off
smoke on
echo "--- 逐代行 diff（应为空）"
diff <(grep -E '^\[?gen |代快照|bestFit' scratch/qoder-t1/SMOKEGRID-off.log) <(grep -E '^\[?gen |代快照|bestFit' scratch/qoder-t1/SMOKEGRID-on.log) && echo "逐代行逐字同 ✓"
echo "--- 关档不许出现 [分格选人]"
grep -c '分格选人' scratch/qoder-t1/SMOKEGRID-off.log
echo "--- 开档回执"
grep -n '分格选人\|量具同代' scratch/qoder-t1/SMOKEGRID-on.log | head -8
tail -3 scratch/qoder-t1/SMOKEGRID-on.log
