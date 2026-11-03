#!/usr/bin/env bash
# night3 Phase 4 终局臂（GD3-ALL 起点 × GATE4b 配方 × 双桌 3P/8P × 种子）
# 配方 = GATE3 原命令（run-ga-gate3.sh）+ EPIRUS_WIDE_FINAL=1 + EPIRUS_HALL_TRACE=1（=GATE4b）。
# 起点 = 在册 GD3-SWORD.bak（GATE4b 原配方起点）。※ 01:1x 改道记档：GD3-ALL 蒸馏产物三度冒烟红
#        （M-3 塌缩，见 RESULTS §四）⇒ 终局臂回到在册起点，今夜新变量 = 干预全关 + 8P 臂。
# 干预全关协议：四键全 0（train-3p 部署档）。
# 臂组 A（主）：N=3 × 400 代 × pop8 × games8 × 种子 7/13/41 —— 与 GATE4b 谱系连续（5P 主考）。
# 臂组 B（8P 证实）：N=8 × 400 代 × 同形状 × 种子 13/41 —— 8P 桌可行性 + 双枪等超多人技能观察。
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
export EPIRUS_WIDE_FINAL=1 EPIRUS_HALL_TRACE=1
export EPIRUS_BIGT_PUSH=0 EPIRUS_DRAIN_PUSH=0 EPIRUS_CURSE_PUSH=0 EPIRUS_SUPPORT_PRIOR=0
LOG=scratch/night3/phase4.log
: > $LOG
echo "### 0) 开臂时刻 $(date +%H:%M)（5 臂并发：A 组 3P×3 种子 ‖ B 组 8P×2 种子）" >> $LOG

for s in 7 13 41; do
  ( cd /d/code/Epirus-Web && EPIRUS_ARM=GD3ALL-G5-s$s EPIRUS_SEED=$s \
      EPIRUS_T3P_OUT=scratch/night3/GD3ALL-G5-s$s.js EPIRUS_BAND_DIR=scratch/night3/bands/GD3ALL-G5-s$s \
      node tools/train-3p.mjs 400 3 8 8 > scratch/night3/armA-s$s.log 2>&1; \
    echo "  A s$s 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &
done
for s in 13 41; do
  ( cd /d/code/Epirus-Web && EPIRUS_ARM=GD3ALL-G5-8p-s$s EPIRUS_SEED=$s \
      EPIRUS_T3P_OUT=scratch/night3/GD3ALL-G5-8p-s$s.js EPIRUS_BAND_DIR=scratch/night3/bands/GD3ALL-G5-8p-s$s \
      node tools/train-3p.mjs 400 8 8 8 > scratch/night3/armB-8p-s$s.log 2>&1; \
    echo "  B(8P) s$s 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &
done
wait
echo "### 1) 臂段结束 $(date +%H:%M)" >> $LOG
echo "### done $(date +%H:%M)" >> $LOG
