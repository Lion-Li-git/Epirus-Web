#!/usr/bin/env bash
# 只跑 ① 那条默认关回归（② ③ 已在 scratch/ga-gate-v2.log 有结果）
set -u
R=/d/code/Epirus-Web
cd "$R" || exit 1
L=$R/scratch/ga-offreg.log
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
: > $L
git show HEAD:tools/train-3p.mjs > tools/.v2head.mjs
EPIRUS_ARM=V2-headoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=$R/scratch/ga-arms/V2-headoff.js EPIRUS_BAND_DIR=$R/scratch/ga-bands/V2-headoff \
  node tools/.v2head.mjs 6 3 8 8 > $R/scratch/v2-headoff.log 2>&1
rm -f tools/.v2head.mjs
EPIRUS_ARM=V2-refoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=$R/scratch/ga-arms/V2-refoff.js EPIRUS_BAND_DIR=$R/scratch/ga-bands/V2-refoff \
  node tools/train-3p.mjs 6 3 8 8 > $R/scratch/v2-refoff.log 2>&1
echo "新轨退出码=$? 门槛打印=$(grep -c 'GA 门槛' $R/scratch/v2-refoff.log)（必须 0）" >> $L
if diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-refoff.log) > /dev/null 2>&1; then
  echo "TRAJECTORY-IDENTICAL（HEAD 版 vs 新版，同 env 同种子，6 代）✔" >> $L
else
  echo "⚠ 轨迹不同 ⇒ 默认关被动到了" >> $L
  diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-refoff.log) | head -8 >> $L
fi
grep -E "^gen [0-9]+ bestFit" $R/scratch/v2-refoff.log | sed 's/^/  /' >> $L
echo done >> $L
