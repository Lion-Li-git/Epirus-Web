#!/bin/bash
# Wave 4（ZCode 11-07 深夜续）：零阻断配方的池深度臂（4 枚，s17/s19）
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
run() { local arm=$1 seed=$2; shift 2
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_SEED=$seed EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js EPIRUS_BAND_DIR=scratch/band-1107/ \
    node tools/train-3p.mjs 60 5 24 8 > scratch/zcode-1106/$arm.log 2>&1
  echo "=== $arm rc=$? $(date +%H:%M:%S) ==="
}
run COMBO-s17 17 EPIRUS_POOL_OPPS=6 EPIRUS_POOL_OPPS_TIER=hard EPIRUS_MIXHP_EVERY=4 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
run COMBO-s19 19 EPIRUS_POOL_OPPS=6 EPIRUS_POOL_OPPS_TIER=hard EPIRUS_MIXHP_EVERY=4 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
run DEF-s17 17 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
run DEF-s19 19 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
echo WAVE4-ALL-DONE
