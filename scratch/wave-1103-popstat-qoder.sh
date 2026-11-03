#!/usr/bin/env bash
# #46（11-03 晚 · 用户裁"这么跑一下吧"）：逐代**种群统计量**接好后重跑两臂，出一版不抖的演化曲线
#   两条臂 = 今天摆幅最大的两种起点：
#     PS-CBG-s13  = 起点在中间（CB-s13 防御族 6.1%）‖ 2.0 路径 ‖ long ‖ 种子 13
#     PS-V7M-s13  = v7 路径热启动线上冠军 ‖ multi  种子 13（今天摆幅 16.4pt，最大之一）
#   配方与今天那两条**逐字同**（同 seed / 同起点包 / 150×5P×pop8×games8 / HOLDOUT_SEG=25），
#   唯一多出来的 = EPIRUS_POPSTAT ⇒ 两根验收腿：① `gen` 行必须与各自基线日志**逐字同**（这档只加聚合与落盘，不碰演化）
#                ② JSONL 每代一行（150 行）+ 每 20 代一条 [种群统计] 打印。
set -u
REPO="D:/code/Epirus-Web"
OUT="$REPO/scratch/ga-arms"
LOGD="$REPO/scratch/qoder-popstat"
mkdir -p "$LOGD" "$REPO/scratch/popstat"

arm() {
  local name="$1" mode="$2" arch="$3" pack="$4" base="$5"
  local bd="$REPO/scratch/ga-bands/$name"; mkdir -p "$bd"
  ( cd "$REPO" || exit 3
    export EPIRUS_MUT_MODE='seg'
    export EPIRUS_TRAIN_MODE="$mode"
    export EPIRUS_HOTSTART=1
    export EPIRUS_SEED=13
    export EPIRUS_ARM="$name"
    export EPIRUS_HOLDOUT_SEG=25
    export EPIRUS_BAND_DIR="$bd"
    export EPIRUS_T3P_OUT="$OUT/$name.js"
    export EPIRUS_POPSTAT=1
    export EPIRUS_POPSTAT_K=3
    export EPIRUS_POPSTAT_OUT="$REPO/scratch/popstat/$name.jsonl"
    if [ -n "$arch" ]; then export EPIRUS_ARCH2="$arch"; else unset EPIRUS_ARCH2; fi
    if [ -n "$pack" ]; then export EPIRUS_SEEDPACK="$pack"; else unset EPIRUS_SEEDPACK; fi
    node tools/train-3p.mjs 150 5 8 8 > "$LOGD/$name.log" 2>&1
    echo "$name rc=$?" )
}

A='S1ob:input=obs3b,gen=3,keySplit=1'
echo "发批 $(date '+%H:%M:%S') ‖ 2 臂并发 ‖ 每臂 150 代 × pop8 × games8（预计 12~14 分钟）"
pids=()
arm PS-CBG-s13 long "$A" 'scratch/night4/CB-s13.js' scratch/qoder-afternoon/CBG-s13.log & pids+=($!)
arm PS-V7M-s13 multi '' '' scratch/qoder-v7repro/V7M-s13.log & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done
echo "收批 $(date '+%H:%M:%S')"
echo "--- ① 逐代行回归（空 = 演化一字未动）"
diff <(grep '^gen ' "$REPO/scratch/qoder-afternoon/CBG-s13.log") <(grep '^gen ' "$LOGD/PS-CBG-s13.log") && echo "PS-CBG-s13 gen 行逐字同 ✓"
diff <(grep '^gen ' "$REPO/scratch/qoder-v7repro/V7M-s13.log") <(grep '^gen ' "$LOGD/PS-V7M-s13.log") && echo "PS-V7M-s13 gen 行逐字同 ✓"
echo "--- ② JSONL 与打印"
for f in "$REPO"/scratch/popstat/PS-*.jsonl; do echo "$(basename "$f") 行数 $(wc -l < "$f")"; done
grep -c '种群统计' "$LOGD/PS-CBG-s13.log" "$LOGD/PS-V7M-s13.log"
echo "--- 尾行"
for f in "$LOGD"/*.log; do echo "$(basename "$f")：$(tail -1 "$f" | cut -c1-70)"; done
