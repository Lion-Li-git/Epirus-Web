#!/usr/bin/env bash
# night3 加赛臂（01:5x 用户"继续训练"）：两支不依赖 M-3 的臂
#   C 臂 = 8P 线补第三粒种子（GD3ALL-G5-8p-s7）
#   D 臂 = 合流新点：最强起点 GA2R-sword-s13 × GATE4b 门槛配方 × N=5（产品主考桌）
#          —— GATE4b 原起点是 GD3-SWORD；换最强起点 = "蒸馏带的宽 + 门槛守宽"能否同池的又一步
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
export EPIRUS_WIDE_FINAL=1 EPIRUS_HALL_TRACE=1
export EPIRUS_BIGT_PUSH=0 EPIRUS_DRAIN_PUSH=0 EPIRUS_CURSE_PUSH=0 EPIRUS_SUPPORT_PRIOR=0
LOG=scratch/night3/phase4b.log
: > $LOG
echo "### 0) 加赛臂开 $(date +%H:%M)（C=8P s7 ‖ D=GA2R起点×GATE4b×N5）" >> $LOG

( cd /d/code/Epirus-Web && EPIRUS_ARM=GD3ALL-G5-8p-s7 EPIRUS_SEED=7 \
    EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak \
    EPIRUS_T3P_OUT=scratch/night3/GD3ALL-G5-8p-s7.js EPIRUS_BAND_DIR=scratch/night3/bands/GD3ALL-G5-8p-s7 \
    node tools/train-3p.mjs 400 8 8 8 > scratch/night3/armC-8p-s7.log 2>&1; \
  echo "  C(8P s7) 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &

( cd /d/code/Epirus-Web && EPIRUS_ARM=GD3ALL-G5-n5-s41 EPIRUS_SEED=41 \
    EPIRUS_SEEDPACK=scratch/ga-arms/GA2R-sword-s13.js \
    EPIRUS_T3P_OUT=scratch/night3/GD3ALL-G5-n5-s41.js EPIRUS_BAND_DIR=scratch/night3/bands/GD3ALL-G5-n5-s41 \
    node tools/train-3p.mjs 400 5 8 8 > scratch/night3/armD-n5-s41.log 2>&1; \
  echo "  D(N5 s41 GA2R起点) 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &
wait
echo "### done $(date +%H:%M)" >> $LOG
