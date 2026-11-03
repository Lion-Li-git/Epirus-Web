#!/usr/bin/env bash
# 11-03 午后 qoder 接续 DS 被停的两批（DS `STATE-2026-11-03-evening-ds.md` §二5/§四1 的"下一班"）
#   BREAD-W05-{s13,s7,s41} = WIDTH_W 0.5（v7 时代在册剂量）起点 L5-D4a-s13
#   CBG-{s13,s7,s41}        = 从 11 种的 CB-s13 续训（起点按 DS 的 STATE 记载取；它自己的日志没印 seedpack ⇒ 文档口径不是产物口径）
# 两条改动相对 DS 那批：
#   1) 全部带 EPIRUS_HOLDOUT_SEG=25 ⇒ 每 25 代**当场**落 <ARM>-seg<k>.bak（11-03 修：原来只攒内存，被停就全丢）
#   2) 日志写 scratch/qoder-afternoon/，不覆盖 DS 留在 scratch/*.log 的原件
set -u
REPO="D:/code/Epirus-Web"
OUT="$REPO/scratch/ga-arms"
LOGD="$REPO/scratch/qoder-afternoon"
mkdir -p "$LOGD"

run() {
  local arm="$1" seed="$2" width="$3" pack="$4"
  local bd="$REPO/scratch/ga-bands/$arm"
  mkdir -p "$bd"
  # ⚠ 别把 `${width:+EPIRUS_WIDTH_W=…}` 当赋值词写：bash 在**展开前**判赋值词法，展开出来的 `NAME=value`
  #    会被当成**命令名** ⇒ rc=127 command not found（14:09 那次六臂全秒退就是这个）。用显式 export。
  ( cd "$REPO" || exit 3
    export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1'
    export EPIRUS_MUT_MODE='seg'
    export EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1
    export EPIRUS_SEEDPACK="$pack"
    export EPIRUS_SEED="$seed"
    export EPIRUS_ARM="$arm"
    export EPIRUS_HOLDOUT_SEG=25
    export EPIRUS_BAND_DIR="$bd"
    export EPIRUS_T3P_OUT="$OUT/$arm.js"
    if [ -n "$width" ]; then export EPIRUS_WIDTH_W="$width"; fi
    node tools/train-3p.mjs 150 5 8 8 > "$LOGD/$arm.log" 2>&1
    echo "$arm rc=$?" )
}

echo "发批时刻 $(date '+%H:%M:%S') ‖ 6 臂并发（150 代 × 5P × pop8 × 8 局/代 ‖ HOLDOUT_SEG=25）"
pids=()
run BREAD-W05-s13 13 0.5 scratch/ga-arms/L5-D4a-s13.js & pids+=($!)
run BREAD-W05-s7  7  0.5 scratch/ga-arms/L5-D4a-s13.js & pids+=($!)
run BREAD-W05-s41 41 0.5 scratch/ga-arms/L5-D4a-s13.js & pids+=($!)
run CBG-s13 13 '' scratch/night4/CB-s13.js & pids+=($!)
run CBG-s7  7  '' scratch/night4/CB-s13.js & pids+=($!)
run CBG-s41 41 '' scratch/night4/CB-s13.js & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done
echo "收批时刻 $(date '+%H:%M:%S')"
ls -la "$OUT" | grep -E 'BREAD-W05|CBG' || echo '⚠ 没有产物写出（去看各臂日志）'
for f in "$LOGD"/*.log; do echo "--- $(basename "$f")：快照 $(grep -c '代快照' "$f") 个 ‖ 尾行 $(tail -1 "$f" | cut -c1-60)"; done
