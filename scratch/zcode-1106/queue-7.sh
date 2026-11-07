#!/bin/bash
# Wave 2（ZCode 11-07 凌晨）：剂量扫描 + 赢家种子批
#   DEF-half-s13   = 防御 credit 减半（0.5/0.25/0.25/0.25）—— 找"墙线保住 + 考卷少丢"的剂量点
#   DEF-WB-s13     = 只开 WALL_BREAK_W=1（墙专项，最小干预）
#   COMBO-half-s13 = POOL_OPPS=6 + MIXHP=4 + 减半防御 credit
#   COMBO-s15      = 均衡形状（COMBO）第 2 粒种子
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
run() { local arm=$1 seed=$2; shift 2
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_SEED=$seed EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js \
    node tools/train-3p.mjs 60 5 24 8 > scratch/zcode-1106/$arm.log 2>&1
  echo "=== $arm rc=$? $(date +%H:%M:%S) ==="
}
run DEF-half-s13   13 EPIRUS_WALL_BREAK_W=0.5 EPIRUS_REFLECT_W=0.25 EPIRUS_GUARD_HIT_W=0.25 EPIRUS_DEF_ADAPT_W=0.25
run DEF-WB-s13     13 EPIRUS_WALL_BREAK_W=1
run COMBO-half-s13 13 EPIRUS_POOL_OPPS=6 EPIRUS_POOL_OPPS_TIER=hard EPIRUS_MIXHP_EVERY=4 EPIRUS_WALL_BREAK_W=0.5 EPIRUS_REFLECT_W=0.25 EPIRUS_GUARD_HIT_W=0.25 EPIRUS_DEF_ADAPT_W=0.25
run COMBO-s15      15 EPIRUS_POOL_OPPS=6 EPIRUS_POOL_OPPS_TIER=hard EPIRUS_MIXHP_EVERY=4 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
echo WAVE2-ALL-DONE
