#!/usr/bin/env bash
# §十四 的三条仪器腿（v3：判据换成 isWideVs 合取 + 旗标由剂量改开关）
#   ① 默认关 ⇒ 与 HEAD 版同 env 同种子逐代 bestFit 轨迹逐字同、门槛打印 0 行
#   ② 牙：GATE=99 ⇒ 有效种类下限 99 ⇒ 必然全饿退 ⇒ 产物必须与关档逐位同（= 这根等于没开，它要自己说出来）
#   ③ 40 代 开 vs 关 ⇒ 产物必须不同（位置还是接对的）
# ⚠ 喂 node 的路径一律仓库相对（§十三 那条 msys 路径自伤不许重犯）
set -u
cd /d/code/Epirus-Web || exit 1
L=scratch/ga-gate-v3.log
: > $L
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'

echo "### ① 默认关 ⇒ HEAD 版 vs 新版同 env 同种子 6 代 ⇒ 轨迹必须逐字同" >> $L
git show HEAD:tools/train-3p.mjs > tools/.v3head.mjs
EPIRUS_ARM=V3-headoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=scratch/ga-arms/V3-headoff.js EPIRUS_BAND_DIR=scratch/ga-bands/V3-headoff \
  node tools/.v3head.mjs 6 3 8 8 > scratch/v3-headoff.log 2>&1
rm -f tools/.v3head.mjs
EPIRUS_ARM=V3-refoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=scratch/ga-arms/V3-refoff.js EPIRUS_BAND_DIR=scratch/ga-bands/V3-refoff \
  node tools/train-3p.mjs 6 3 8 8 > scratch/v3-refoff.log 2>&1
echo "  新轨退出码=$?  门槛打印=$(grep -c 'GA 宽门槛' scratch/v3-refoff.log)（必须 0）" >> $L
if diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/v3-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/v3-refoff.log) > /dev/null 2>&1; then
  echo "  TRAJECTORY-IDENTICAL（HEAD vs 新版，同 env 同种子）✔" >> $L
else
  echo "  ⚠ 轨迹不同 ⇒ 默认关被动到了，看 diff" >> $L
  diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/v3-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/v3-refoff.log) | head -6 >> $L
fi

echo "### ② 牙：GATE=99 ⇒ 全饿退 ⇒ 产物与关档逐位同" >> $L
EPIRUS_ARM=V3STARVE EPIRUS_SEED=7 EPIRUS_GA_GATE=99 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13 \
  EPIRUS_T3P_OUT=scratch/ga-arms/V3-starve.js EPIRUS_BAND_DIR=scratch/ga-bands/V3-starve \
  node tools/train-3p.mjs 6 3 8 8 > scratch/v3-starve.log 2>&1
grep -E "\[GA 宽门槛\]" scratch/v3-starve.log | tail -1 | sed 's/^/  /' >> $L
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const a=w('scratch/ga-arms/V3-starve.js'), b=w('scratch/ga-arms/V3-refoff.js');
console.log('  权重摘要 饿退档='+a+' 关档='+b+' '+(a===b?'逐位同 ✔（全饿退⇒回到原生次序）':'不同 ⇒ 饿退路径偷偷改了产物'));
" >> $L 2>&1

echo "### ③ 40 代：开档 vs 关档 ⇒ 产物必须不同" >> $L
for mode in off gate; do
  if [ "$mode" = gate ]; then export EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13; else unset EPIRUS_GA_GATE EPIRUS_GA_GATE_GAMES EPIRUS_GA_BAND; fi
  EPIRUS_ARM=V3-40-$mode EPIRUS_SEED=7 EPIRUS_T3P_OUT=scratch/ga-arms/V3-40-$mode.js EPIRUS_BAND_DIR=scratch/ga-bands/V3-40-$mode \
    node tools/train-3p.mjs 40 3 8 8 > scratch/v3-40-$mode.log 2>&1
  echo "  $mode 退出码=$?" >> $L
  grep -E "\[GA 宽门槛\]" scratch/v3-40-$mode.log | tail -1 | sed 's/^/    /' >> $L
done
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const a=w('scratch/ga-arms/V3-40-off.js'), b=w('scratch/ga-arms/V3-40-gate.js');
console.log('  40 代权重摘要 off='+a+' gate='+b+' '+(a===b?'⛔ 仍逐位同 ⇒ 判据换了但位置又没接对':'不同 ✔ 新判据在塑形搜索'));
" >> $L 2>&1
echo "### done $(date +%H:%M)" >> $L
cat $L
