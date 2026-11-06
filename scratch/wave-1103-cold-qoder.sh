#!/usr/bin/env bash
# 11-03 午后：把"路径"从"起点"里摘出来 —— 两条路径**都冷启动**、同世界(long)、同预算(150/8/8)、同存段(25)。
# 上一批的混淆（我自己点名的）：v7 路径热启动=线上冠军（自带防御族），2.0 路径热启动=L5-D4a-s13（已经窄）
#   ⇒ "换路径"必然换起点。本批两边都不热启动 ⇒ 剩下的差别只有参数化/变异算子这一层。
set -u
REPO="D:/code/Epirus-Web"; OUT="$REPO/scratch/ga-arms"; LOGD="$REPO/scratch/qoder-cold"; mkdir -p "$LOGD"
run() {
  local arm="$1" seed="$2" arch="$3"; local bd="$REPO/scratch/ga-bands/$arm"; mkdir -p "$bd"
  ( cd "$REPO" || exit 3
    export EPIRUS_TRAIN_MODE='long' EPIRUS_MUT_MODE='seg' EPIRUS_SEED="$seed" EPIRUS_ARM="$arm"
    export EPIRUS_HOLDOUT_SEG=25 EPIRUS_BAND_DIR="$bd" EPIRUS_T3P_OUT="$OUT/$arm.js"
    unset EPIRUS_HOTSTART; unset EPIRUS_SEEDPACK
    if [ -n "$arch" ]; then export EPIRUS_ARCH2="$arch"; else unset EPIRUS_ARCH2; fi
    node tools/train-3p.mjs 150 5 8 8 > "$LOGD/$arm.log" 2>&1; echo "$arm rc=$?" )
}
A='S1ob:input=obs3b,gen=3,keySplit=1'
echo "发批 $(date '+%H:%M:%S') ‖ 4 臂 = {v7, 2.0} × 种子{13,41} ‖ 全冷启动 ‖ long ‖ 150/8/8 ‖ HOLDOUT_SEG=25"
pids=()
run V7C-s13 13 ''  & pids+=($!); run V7C-s41 41 '' & pids+=($!)
run G3C-s13 13 "$A" & pids+=($!); run G3C-s41 41 "$A" & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done
echo "收批 $(date '+%H:%M:%S')"; ls -la "$OUT" | grep -E 'V7C|G3C' || echo '⚠ 没有产物'
for f in "$LOGD"/*.log; do echo "--- $(basename "$f")：参数 $(grep -o '参数=[0-9]*' "$f" | head -1) ‖ 快照 $(grep -c '代快照' "$f") ‖ $(grep -oE '1st=[0-9.]+%  top2=[0-9.]+%' "$f" | tail -1)"; done
