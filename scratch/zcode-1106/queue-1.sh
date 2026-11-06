#!/bin/bash
# 夜班训练队列第 1 段:2P 产线两粒(串行)。2.0 线必须带 EPIRUS_ARCH2(照 P2ONLY meta)
cd /d/code/Epirus-Web
export EPIRUS_ARCH2="S1ob:input=obs3b,gen=3,keySplit=1"
export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=scratch/ga-arms/KDFULL400-s13.js EPIRUS_TRAIN_MODE=multi
set -x
EPIRUS_ARM=P2A-s13 EPIRUS_SEED=13 EPIRUS_T3P_OUT=scratch/ga-arms/P2A-s13.js \
node tools/train-3p.mjs 60 2 24 8 > scratch/zcode-1106/p2a-s13.log 2>&1
echo "P2A rc=$?"
EPIRUS_ARM=P2A-s41 EPIRUS_SEED=41 EPIRUS_T3P_OUT=scratch/ga-arms/P2A-s41.js \
node tools/train-3p.mjs 60 2 24 8 > scratch/zcode-1106/p2a-s41.log 2>&1
echo "P2B rc=$?"
echo QUEUE1-DONE
