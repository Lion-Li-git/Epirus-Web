#!/bin/bash
# 夜班训练队列第 2 段:R63 新规则下全量重跑。串行;产物 scratch/ga-arms/,日志 scratch/zcode-1106/
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi EPIRUS_SEED=13
run() { # arm gens players games pop extraEnv...
  local arm=$1 gens=$2 pl=$3 ga=$4 pop=$5; shift 5
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js \
    node tools/train-3p.mjs $gens $pl $ga $pop > scratch/zcode-1106/$arm.log 2>&1
  echo "=== $arm rc=$? $(date +%H:%M:%S) ==="
}
run P2A-s13  60 2 24 8
run P2A-s41 60 2 24 8 EPIRUS_SEED=41
run P8-s13   60 8 24 8
run CR4-s13  60 5 24 8 EPIRUS_COURSE_EVERY=4
run CR8-s13  60 5 24 8 EPIRUS_COURSE_EVERY=8
run MX25-s13 60 5 24 8 EPIRUS_MIX2_EVERY=2
run CTRL-s13 60 5 24 8
echo QUEUE2-ALL-DONE
