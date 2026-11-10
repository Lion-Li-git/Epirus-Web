#!/bin/bash
# MSB8 定向轮一键发射（11-11 夜 · 技能覆盖 cohort）—— 用法: bash launch-msb8.sh <起点包>
# 每技能一个独立驱动器（--branches=1 --arm=MSB8-<技能>，state 按 ARM 分家不互踩）；
# 配方 = rotation-obs5（--recipe=）+ 每臂技能覆盖 env；臂自带 triplet 台账 + 轮末 C 重测。
set -e
cd "$(dirname "$0")/../.."
START="${1:?用法: launch-msb8.sh <起点包>}"
GENS="${2:-200}"

launch() { # name base env...
  local name="$1" base="$2"; shift 2
  echo "[msb8] 发射 $name (base=$base)"
  env "$@" node scratch/night-adapt2/msbatch2.mjs --base=$base --start="$START" \
    --rounds=1 --branches=1 --gens=$GENS --arm=MSB8-$name --margin=0.03 \
    > /dev/null 2>&1 &
}

launch guard  501 EPIRUS_GUARD_HIT_W=1.5            MSB_COURSE_PACK=docs/artifacts/night-adapt/KDG-B-Q-s13.js
launch sword  502 EPIRUS_STYLE_TABLE=sword EPIRUS_STYLE_FRAC=0.3 MSB_COURSE_PACK=docs/artifacts/night-adapt/KDG-B-Q-s13.js
launch reflect 503 EPIRUS_REFLECT_W=1.5             MSB_COURSE_PACK=scratch/ds-1109/G5J-50.js
launch bigT   504 EPIRUS_BIGCARD_W=1.0
launch bagua  505 MSB_COURSE_PACK=scratch/ds-1109/WSEL9-200.js
launch holo   506 EPIRUS_HPSEED=0.3                 MSB_COURSE_PACK=docs/artifacts/night-adapt/CTRL2-Q-s7.js
launch charge 507 EPIRUS_SEQ_W=2.0                  MSB_COURSE_PACK=scratch/ds-1109/G5C-100.js
launch railgun 508 EPIRUS_STYLE_TABLE=railgun EPIRUS_STYLE_FRAC=0.3 MSB_COURSE_PACK=scratch/ds-1109/G5C-100.js
echo "[msb8] 8 臂全部发射（起点=$START）——判读: card-usage 逐臂 + C 读数在 msbatch2.log"
wait
echo "[msb8] 全部收臂"
