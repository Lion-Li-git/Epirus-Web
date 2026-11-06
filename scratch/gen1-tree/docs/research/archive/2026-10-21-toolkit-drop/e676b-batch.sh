#!/usr/bin/env bash
# §E676 补 · 给 tk 格**加簇**（用户在册那条"要功效加簇不加 seed"）：4 枚新起点 × 2 seed = 8 臂，只发 tk 格。
#   base 侧引 §E675 在册的 p2 产物（同几何同 seed）⇒ 自证 = 拿本班 tk 臂的启动行与 §E675 那臂的启动行逐字对，
#   只差 `[toolkit-ops]` 那一行与桌大小（11→12）。核对过：两批都是 `送盾先验 = 2 ‖ 人数=3 代=120 种群=8 每代局数=8 ‖ pool:B5-10-31,pool:D4a`。
# ⚠ 复跑规矩同 `e676-batch.sh`：默认写 `*.rerun`，覆盖原件要 `OVERWRITE=1`。
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO="${WT:-$(cd "$HERE/../../../.." && pwd)}"
TAG=""; [ -z "${OVERWRITE:-}" ] && TAG=".rerun"
OUT=$REPO/docs/artifacts/e676-out
BAND=${EPIRUS_BAND_ROOT:-/tmp/wt-e676-scratch}
LOGD="$OUT/logs$TAG"; mkdir -p "$LOGD" "$BAND" "$OUT"
STATUS="$OUT/status-c2$TAG.tsv"; DRIVER="$OUT/driver-c2$TAG.log.txt"
: > "$STATUS"

run_one() { # $1=arm $2=seedpack $3=seed
  local arm="$1" pack="$2" s="$3" rc
  env EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$pack" EPIRUS_POOL_OPPS=2 EPIRUS_SUPPORT_PRIOR=2 \
      EPIRUS_TOOLKIT_OPPS=1 EPIRUS_SEED="$s" EPIRUS_ARM="$arm" \
      EPIRUS_BAND_DIR="$BAND/$arm" EPIRUS_T3P_OUT="$OUT/$arm.js" \
      node "$REPO/tools/train-3p.mjs" 120 3 8 8 > "$LOGD/$arm.log" 2>&1
  rc=$?
  printf '%s\t%d\t%s\n' "$arm" "$rc" "$(date +%H:%M:%S)" >> "$STATUS"
  echo "[driver] $arm EXIT=$rc $(date +%H:%M:%S)" >> "$DRIVER"
}

ORIGINS=("mix31|docs/artifacts/mix-31.bak" "K1|docs/artifacts/e234-out/K1.js" \
         "Gs82|docs/artifacts/e514-out/G-s82.js" "ws1|docs/artifacts/v7press3-31.bak")
SEEDS=(88010 88011)

cd "$REPO" || exit 3
echo "[driver] 发车 $(date +%H:%M:%S) ‖ 8 臂 ‖ 4 路并发 ‖ REPO=$REPO ‖ TAG='${TAG:-（覆盖原件）}'" >> "$DRIVER"
i=0
for o in "${ORIGINS[@]}"; do
  oname="${o%%|*}"; opath="${o#*|}"
  for s in "${SEEDS[@]}"; do
    arm="e676-$oname-tk-s$s"
    if [ ! -f "$REPO/$opath" ]; then echo "[driver] 缺起点原件 $arm $opath" >> "$DRIVER"; continue; fi
    run_one "$arm" "$REPO/$opath" "$s" &
    i=$((i+1)); if [ $((i % 4)) -eq 0 ]; then wait; fi
  done
done
wait
echo "[driver] 收摊 $(date +%H:%M:%S) ‖ 发出 $i 臂" >> "$DRIVER"
