#!/usr/bin/env bash
# §A 的三条仪器腿（PREREG-2026-11-02-SEL-DEF §二末）：默认关逐字同 ‖ 下限 999 ⇒ 全不达标 ⇒ 与关档逐位同 ‖ 40 代开/关有可读数差异
set -u
cd /d/code/Epirus-Web || exit 1
L=scratch/seldef-checks.log
: > $L
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_BIGT_PUSH=0 EPIRUS_DRAIN_PUSH=0   # 全程关注入（裁定①），并留 deployKnobs 字据

echo "### ① 默认关 ⇒ HEAD 版 vs 新版同 env 同种子 6 代 ⇒ 轨迹必须逐字同、[防御选人] 打印 0 行" >> $L
git show HEAD:tools/train-3p.mjs > tools/.sdhead.mjs
EPIRUS_ARM=SD-headoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=scratch/ga-arms/SD-headoff.js EPIRUS_BAND_DIR=scratch/ga-bands/SD-headoff \
  node tools/.sdhead.mjs 6 3 8 8 > scratch/sd-headoff.log 2>&1
rm -f tools/.sdhead.mjs
EPIRUS_ARM=SD-refoff EPIRUS_SEED=7 EPIRUS_T3P_OUT=scratch/ga-arms/SD-refoff.js EPIRUS_BAND_DIR=scratch/ga-bands/SD-refoff \
  node tools/train-3p.mjs 6 3 8 8 > scratch/sd-refoff.log 2>&1
echo "  新轨退出码=$?  [防御选人] 行数=$(grep -c '防御选人' scratch/sd-refoff.log)（必须 0）" >> $L
if diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/sd-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/sd-refoff.log) >/dev/null 2>&1; then
  echo "  TRAJECTORY-IDENTICAL（HEAD vs 新版，默认关）✔" >> $L
else
  echo "  ⛔ 轨迹不同 ⇒ 默认关被动到了" >> $L
  diff <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/sd-headoff.log) <(grep -oE "^gen [0-9]+ bestFit=[0-9.]+" scratch/sd-refoff.log) | head -6 >> $L
fi

echo "### ② 牙：SEL_DEF_MIN=999 ⇒ 必然全不达标 ⇒ 产物与关档逐位同 + 自己打印 selDefAllBelow" >> $L
EPIRUS_ARM=SDstarve EPIRUS_SEED=7 EPIRUS_SEL_DEF=1 EPIRUS_SEL_DEF_MIN=999 EPIRUS_SEL_DEF_GAMES=10 EPIRUS_SEL_DEF_MODE=multi \
  EPIRUS_T3P_OUT=scratch/ga-arms/SD-starve.js EPIRUS_BAND_DIR=scratch/ga-bands/SD-starve \
  node tools/train-3p.mjs 6 3 8 8 > scratch/sd-starve.log 2>&1
grep -E "\[防御选人\]" scratch/sd-starve.log | tail -1 | cut -c1-260 | sed 's/^/  /' >> $L
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const m=(f)=>JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*?\});\n/s.exec(fs.readFileSync(f,'utf8'))[1]).recipe;
const a=w('scratch/ga-arms/SD-starve.js'), b=w('scratch/ga-arms/SD-refoff.js');
console.log('  权重摘要 恒不达标档='+a+' 关档='+b+' '+(a===b?'逐位同 ✔（全不达标⇒回到原生次序）':'不同 ⇒ 饿退路径偷偷改了产物'));
console.log('  meta.selDef（恒不达标档）= '+JSON.stringify(m('scratch/ga-arms/SD-starve.js').selDef));
console.log('  meta.selDef（关档）= '+JSON.stringify(m('scratch/ga-arms/SD-refoff.js').selDef)+'（必须 null）');
console.log('  meta.deployKnobs（关档）= '+JSON.stringify(m('scratch/ga-arms/SD-refoff.js').deployKnobs));
" >> $L 2>&1

echo "### ③ 40 代：开档（下限 0.10）vs 关档 ⇒ 至少一处可读数差异（4 代/40 代的产物分辨力不足，§五③ 已记）" >> $L
for mode in off gate; do
  if [ "$mode" = gate ]; then export EPIRUS_SEL_DEF=1 EPIRUS_SEL_DEF_MIN=0.10 EPIRUS_SEL_DEF_GAMES=20 EPIRUS_SEL_DEF_MODE=multi; else unset EPIRUS_SEL_DEF EPIRUS_SEL_DEF_MIN EPIRUS_SEL_DEF_GAMES EPIRUS_SEL_DEF_MODE; fi
  EPIRUS_ARM=SD-40-$mode EPIRUS_SEED=7 EPIRUS_T3P_OUT=scratch/ga-arms/SD-40-$mode.js EPIRUS_BAND_DIR=scratch/ga-bands/SD-40-$mode \
    node tools/train-3p.mjs 40 3 8 8 > scratch/sd-40-$mode.log 2>&1
  echo "  $mode 退出码=$?" >> $L
  grep -E "\[防御选人\]|量具同代" scratch/sd-40-$mode.log | tail -3 | cut -c1-300 | sed 's/^/    /' >> $L
done
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const r=(f)=>JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\\{.*?\\});\\n/s.exec(fs.readFileSync(f,'utf8'))[1]).recipe;
const a=w('scratch/ga-arms/SD-40-off.js'), b=w('scratch/ga-arms/SD-40-gate.js');
const sd=r('scratch/ga-arms/SD-40-gate.js').selDef, sdx=r('scratch/ga-arms/SD-40-off.js').selDef;
console.log('  腿③通过条件＝键进了选择路并留了账：开档 meta.selDef 非 null 且关档为 null');
console.log('    开档 selDef=' + JSON.stringify(sd ? {band:sd.band,of:sd.of,min:sd.min,usage:sd.usage,picked:sd.picked,allBelow:sd.allBelow,changed:sd.changedWinner,share:sd.pickedShare} : null));
console.log('    关档 selDef=' + JSON.stringify(sdx) + '（必须 null）');
console.log('  40 代权重摘要 off='+a+' gate='+b+(a===b?' ⇒ 产物同（带内无人达标⇒不改判，是键的**零作用**而非空转；换人能力由 bandPickByFloor 合成表第 2 条钉）':' ⇒ 产物不同 ✔ 下限真的换了人'));
" >> $L 2>&1
echo "### done $(date +%H:%M)" >> $L
cat $L
