#!/bin/bash
# Wave 1（ZCode 11-07 凌晨）：三条训练侧假设 × s13 成对（对照 = 已有 CTRL2-s13 58.1%）
#   POOLOPP-s13  = EPIRUS_POOL_OPPS=6（hard 带成员进对手轮换；v1.7.83 在册机制）
#   MIXHP-s13    = EPIRUS_MIXHP_EVERY=4（每第 4 局换对偶桌：3血适应）
#   DEF-s13      = 防御侧 credit（WALL_BREAK 1 / REFLECT 0.5 / GUARD_HIT 0.5 / DEF_ADAPT 0.5）
#   COMBO-s13    = 三者全开（看是否叠加）
#   CTRL-s17     = 补 MIX8-s17 的成对对照
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
run() { local arm=$1 seed=$2; shift 2
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_SEED=$seed EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js \
    node tools/train-3p.mjs 60 5 24 8 > scratch/zcode-1106/$arm.log 2>&1
  local rc=$?
  echo "=== $arm rc=$rc $(date +%H:%M:%S) ==="
  node tools/dedupe-artifacts.mjs --audit 2>/dev/null | grep -o '"unregistered":[0-9]*\|"unregPaths":\[[^]]*\]' | head -2
}
run POOLOPP-s13 13 EPIRUS_POOL_OPPS=6 EPIRUS_POOL_OPPS_TIER=hard
run MIXHP-s13   13 EPIRUS_MIXHP_EVERY=4
run DEF-s13     13 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
run COMBO-s13   13 EPIRUS_POOL_OPPS=6 EPIRUS_POOL_OPPS_TIER=hard EPIRUS_MIXHP_EVERY=4 EPIRUS_WALL_BREAK_W=1 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5
run CTRL-s17    17
echo WAVE1-ALL-DONE
