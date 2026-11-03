#!/usr/bin/env bash
# §十二 位置勘误后的仪器腿：默认关回归 + GATE=99 饿退 + 40 代小臂"门槛必须换产物"
set -u
R=/d/code/Epirus-Web
cd "$R" || exit 1
L=$R/scratch/ga-gate-v2.log
: > $L
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'

echo "### ① 默认关 ⇒ 与 HEAD 版（只有错位 hall 钩子那版）同 env 对跑，轨迹必须逐字同" >> $L
git show HEAD:tools/train-3p.mjs > tools/.v2head.mjs
EPIRUS_ARM=V2-headoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=$R/scratch/ga-arms/V2-headoff.js EPIRUS_BAND_DIR=$R/scratch/ga-bands/V2-headoff \
  node tools/.v2head.mjs 4 3 8 8 > $R/scratch/v2-headoff.log 2>&1
rm -f tools/.v2head.mjs
EPIRUS_ARM=V2-refoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=$R/scratch/ga-arms/V2-refoff.js EPIRUS_BAND_DIR=$R/scratch/ga-bands/V2-refoff \
  node tools/train-3p.mjs 4 3 8 8 > $R/scratch/v2-refoff.log 2>&1
echo "  新轨退出码=$?  门槛打印=$(grep -c 'GA 门槛' $R/scratch/v2-refoff.log)（必须 0）" >> $L
if diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-refoff.log) > /dev/null 2>&1; then
  echo "  TRAJECTORY-IDENTICAL（HEAD 版 vs 新版，同 env 同种子）✔" >> $L
else
  echo "  ⚠ 轨迹不同 ⇒ 默认关被动到了，先看 diff" >> $L
  diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" $R/scratch/v2-refoff.log) | head -6 >> $L
fi

echo "### ② 牙：GATE=99 ⇒ 必然全饿退，且产物必须与关档逐位同（= 这根等于没开，它要自己说出来）" >> $L
EPIRUS_ARM=V2STARVE EPIRUS_SEED=7 EPIRUS_GA_GATE=99 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13 \
  EPIRUS_T3P_OUT=$R/scratch/ga-arms/V2-starve.js EPIRUS_BAND_DIR=$R/scratch/ga-bands/V2-starve \
  node tools/train-3p.mjs 4 3 8 8 > $R/scratch/v2-starve.log 2>&1
grep -E "\[GA 门槛\]" $R/scratch/v2-starve.log | tail -1 | sed 's/^/  /' >> $L
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const a=w('scratch/ga-arms/V2-starve.js'), b=w('scratch/ga-arms/V2-refoff.js');
console.log('  权重摘要 饿退档='+a+' 关档='+b+' '+(a===b?'逐位同 ✔（全饿退⇒回到原生次序）':'不同 ⇒ 饿退路径偷偷改了产物'));
" >> $L 2>&1

echo "### ③ 40 代小臂：开档 vs 关档 ⇒ 产物必须不同（否则位置还是没接对）" >> $L
for mode in off gate; do
  if [ "$mode" = gate ]; then G="EPIRUS_GA_GATE=6 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13"; else G=""; fi
  env EPIRUS_ARM=V2-40-$mode EPIRUS_SEED=7 $G \
    EPIRUS_T3P_OUT=$R/scratch/ga-arms/V2-40-$mode.js EPIRUS_BAND_DIR=$R/scratch/ga-bands/V2-40-$mode \
    node tools/train-3p.mjs 40 3 8 8 > $R/scratch/v2-40-$mode.log 2>&1
  echo "  $mode 退出码=$?" >> $L
  grep -E "\[GA 门槛\]" $R/scratch/v2-40-$mode.log | tail -1 | sed 's/^/    /' >> $L
done
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const a=w('scratch/ga-arms/V2-40-off.js'), b=w('scratch/ga-arms/V2-40-gate.js');
console.log('  40 代权重摘要 off='+a+' gate='+b+' '+(a===b?'⛔ 仍逐位同 ⇒ 位置还是没接对':'不同 ✔ 门槛开始塑形搜索'));
" >> $L 2>&1
for m in off gate; do
  node tools/proto2/offer-trace.mjs --pack=scratch/ga-arms/V2-40-$m.js --field=mirror --games=20 2>/dev/null | grep -E "^railgun|^charge|非ジ出手种类" | sed "s/^/    [$m] /" >> $L
done
echo "### done" >> $L
