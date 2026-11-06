#!/usr/bin/env bash
# 11-03 午后（用户："拿一个旧路径复现训练，中途留节点对照"）
# 目的：判"v7 又宽又强"到底归给谁 —— 架构（v7 路径 vs 2.0/arch2）还是世界（multi vs long）。
# 已知混淆（先记下来，不许事后赖账）：
#   · 起点不同：v7 路径热启动读**线上 v7 冠军**；2.0 路径热启动只认 v:92 包 ⇒ 用 L5-D4a-s13。
#     "换路径"这件事本身必然连带换起点，所以本批读的是**路径+起点**这个整体，不是纯架构。
#   · 预算差一个量级：池里 v7 成员 META 多为 gens=300/pop=24/games=24（≈172,800 个体局），
#     本批与今早那六臂都是 150/8/8（=9,600）⇒ 若要判"预算"这条得另跑一支 300/24/24（约 30× 时长，等裁）。
# 六臂全带 EPIRUS_HOLDOUT_SEG=25 ⇒ 每 25 代**当场**落一个深度档案，可画"种数随深度"的曲线。
set -u
REPO="D:/code/Epirus-Web"
OUT="$REPO/scratch/ga-arms"
LOGD="$REPO/scratch/qoder-v7repro"
mkdir -p "$LOGD"

run() {
  local arm="$1" seed="$2" mode="$3" arch="$4"
  local bd="$REPO/scratch/ga-bands/$arm"
  mkdir -p "$bd"
  ( cd "$REPO" || exit 3
    export EPIRUS_TRAIN_MODE="$mode"
    export EPIRUS_MUT_MODE='seg'
    export EPIRUS_HOTSTART=1
    export EPIRUS_SEED="$seed"
    export EPIRUS_ARM="$arm"
    export EPIRUS_HOLDOUT_SEG=25
    export EPIRUS_BAND_DIR="$bd"
    export EPIRUS_T3P_OUT="$OUT/$arm.js"
    if [ -n "$arch" ]; then export EPIRUS_ARCH2="$arch"; else unset EPIRUS_ARCH2; fi
    if [ -n "$arch" ]; then export EPIRUS_SEEDPACK='scratch/ga-arms/L5-D4a-s13.js'; else unset EPIRUS_SEEDPACK; fi
    node tools/train-3p.mjs 150 5 8 8 > "$LOGD/$arm.log" 2>&1
    echo "$arm rc=$?" )
}

ARCH='S1ob:input=obs3b,gen=3,keySplit=1'
echo "发批 $(date '+%H:%M:%S') ‖ 6 臂 = {v7路径, 2.0路径} × {multi, long} × 种子{13,41}（2.0×long 今早已跑，本批不重复）"
pids=()
run V7M-s13 13 multi ''      & pids+=($!)
run V7M-s41 41 multi ''      & pids+=($!)
run V7L-s13 13 long  ''      & pids+=($!)
run V7L-s41 41 long  ''      & pids+=($!)
run G3M-s13 13 multi "$ARCH" & pids+=($!)
run G3M-s41 41 multi "$ARCH" & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done
echo "收批 $(date '+%H:%M:%S')"
ls -la "$OUT" | grep -E 'V7M|V7L|G3M' || echo '⚠ 没有产物'
for f in "$LOGD"/*.log; do echo "--- $(basename "$f")：快照 $(grep -c '代快照' "$f") ‖ $(tail -1 "$f" | cut -c1-50)"; done
