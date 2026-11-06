#!/bin/bash
# 训练队列第 5 段（ZCode 11-06 晨续三）：两条新信号的种子扩充（各 +2 粒，成对）。
#   MIX8-s15 / MIX8-s17：MIX8=4（8P 桌混 fitness）——单种子 59.0% 待验证
#   CR8-s16 / CTRL-s16：课程席成对第 4 粒
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
run() { local arm=$1 seed=$2; shift 2
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_SEED=$seed EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js \
    node tools/train-3p.mjs 60 5 24 8 > scratch/zcode-1106/$arm.log 2>&1
  echo "=== $arm rc=$? $(date +%H:%M:%S) ==="
}
run MIX8-s15 15 EPIRUS_MIX8=4
run MIX8-s17 17 EPIRUS_MIX8=4
run CR8-s16  16 EPIRUS_COURSE_EVERY=8
run CTRL-s16 16
echo QUEUE5-ALL-DONE
