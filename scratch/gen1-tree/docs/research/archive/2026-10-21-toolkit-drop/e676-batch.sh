#!/usr/bin/env bash
# §E676 臂批驱动（qoder 10-21 早班）
#   几何逐字照 §E675（argv 120 3 8 8 ‖ EPIRUS_POOL_OPPS=2 ‖ 热启动 ‖ seed 88010/88011 ‖ 先验档 2 = 现网训练侧默认）
#   ⇒ base 格应当撞上 §E589 去重守卫（EXIT=9）：那正是"本班新增的旋钮在默认关时没动过任何分布"的自证。
#   band 一律写到仓库外（记忆那条：实验 .bak 不许落共享产物池，会红 D191）。
#
# ⚠ 复跑规矩（归档规矩第 3 条）：原件是证据，重跑是动作 ⇒ **默认写 *.rerun**，要覆盖原件请自己点名 `OVERWRITE=1`。
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO="${WT:-$(cd "$HERE/../../../.." && pwd)}"
TAG=""                       # 复跑时的后缀
[ -z "${OVERWRITE:-}" ] && TAG=".rerun"
OUT=$REPO/docs/artifacts/e676-out
BAND=${EPIRUS_BAND_ROOT:-/tmp/wt-e676-scratch}
LOGD="$OUT/logs$TAG"; mkdir -p "$LOGD" "$BAND" "$OUT"
STATUS="$OUT/status$TAG.tsv"; DRIVER="$OUT/driver$TAG.log.txt"
: > "$STATUS"

run_one() { # $1=arm $2=seedpack $3=cellenv $4=seed
  local arm="$1" pack="$2" cellenv="$3"
  local log="$LOGD/$arm.log"
  env EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$pack" EPIRUS_POOL_OPPS=2 \
      EPIRUS_SUPPORT_PRIOR=2 EPIRUS_SEED="$4" EPIRUS_ARM="$arm" \
      EPIRUS_BAND_DIR="$BAND/$arm" EPIRUS_T3P_OUT="$OUT/$arm.js" \
      $(printf '%s' "$cellenv") node "$REPO/tools/train-3p.mjs" 120 3 8 8 > "$log" 2>&1
  local rc=$?
  printf '%s\t%d\t%s\n' "$arm" "$rc" "$(date +%H:%M:%S)" >> "$STATUS"
  echo "[driver] $arm EXIT=$rc $(date +%H:%M:%S)" >> "$DRIVER"
}

ORIGINS=("beadseed|$REPO/docs/artifacts/v7beadseed-82.bak" "bead15|$REPO/docs/artifacts/v7bead15-93.bak" \
         "teach|$REPO/docs/artifacts/v7teach-32.bak" "lctl|$REPO/docs/artifacts/eval-out/win-Lctl.bak")
# base 只跑两枚起点（beadseed ‖ teach）——另两枚的 base 直接引 §E675 在册的 p2 产物（前提是本臂日志点名"已在 e675-out/…p2.js"）
CELLS=("base|" "tk|EPIRUS_TOOLKIT_OPPS=1" "drop|EPIRUS_HOLO2PROTO=drop")
SEEDS=(88010 88011)

cd "$REPO" || exit 3
echo "[driver] 发车 $(date +%H:%M:%S) ‖ 最多 20 臂 ‖ 4 路并发 ‖ REPO=$REPO ‖ TAG='${TAG:-（覆盖原件）}'" >> "$DRIVER"
i=0
for o in "${ORIGINS[@]}"; do
  oname="${o%%|*}"; opath="${o#*|}"
  for c in "${CELLS[@]}"; do
    cname="${c%%|*}"; cenv="${c#*|}"
    if [ "$cname" = "base" ] && [ "$oname" != "beadseed" ] && [ "$oname" != "teach" ]; then continue; fi
    for s in "${SEEDS[@]}"; do
      arm="e676-$oname-$cname-s$s"
      if [ ! -f "$opath" ]; then echo "[driver] 缺起点原件 $arm $opath" >> "$DRIVER"; continue; fi
      run_one "$arm" "$opath" "$cenv" "$s" &
      i=$((i+1))
      if [ $((i % 4)) -eq 0 ]; then wait; fi
    done
  done
done
wait
echo "[driver] 收摊 $(date +%H:%M:%S) ‖ 发出 $i 臂" >> "$DRIVER"
