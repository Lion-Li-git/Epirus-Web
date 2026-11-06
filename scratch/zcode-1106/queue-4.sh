#!/bin/bash
# 训练队列第 4 段（ZCode 11-06 晨续二）：课程席的**成对** K 扫描 + 种子批（全部 R64 规则下）。
#   CR8R-s13   = 课程席 K=8 重跑（s13 配对：对照 = 已有的 CTRL2-s13 58.1%）
#   CR8K16-s13 = 课程席 K=16（K 扫描第三点：4 弱 ‖ 8 强? ‖ 16=?）
#   CTRL-s14 / CR8-s14 已有 56.9 ⇒ 补 CTRL-s14 配对
#   CTRL-s15 / CR8-s15 = 种子批第 3 粒（成对）
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
run() { local arm=$1 seed=$2; shift 2
  echo "=== $arm start $(date +%H:%M:%S) ==="
  env "$@" EPIRUS_ARM=$arm EPIRUS_SEED=$seed EPIRUS_T3P_OUT=scratch/ga-arms/$arm.js \
    node tools/train-3p.mjs 60 5 24 8 > scratch/zcode-1106/$arm.log 2>&1
  echo "=== $arm rc=$? $(date +%H:%M:%S) ==="
}
run CR8R-s13   13 EPIRUS_COURSE_EVERY=8
run CR8K16-s13 13 EPIRUS_COURSE_EVERY=16
run CTRL-s14   14
run CTRL-s15   15
run CR8-s15    15 EPIRUS_COURSE_EVERY=8
echo QUEUE4-ALL-DONE
