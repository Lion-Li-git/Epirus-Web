#!/usr/bin/env bash
# §A 四臂：GATE6-off 配方 × 唯一变量 EPIRUS_SEL_DEF 开/关 × seed 13/41（判据 PREREG-2026-11-02-SEL-DEF §二，先于臂已提交 b53ffe8e）
#   A-1 推得动吗（含残血分层） ‖ A-2 不是白防（probe-wasted-play 空挡率） ‖ A-3 强度账 ‖ A-4 3P/8P/宽窄只报
#   全程关注入（EPIRUS_BIGT_PUSH=0），两臂 meta 各留 deployKnobs 字据
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
export EPIRUS_WIDE_FINAL=1 EPIRUS_HALL_TRACE=1
export EPIRUS_BIGT_PUSH=0 EPIRUS_DRAIN_PUSH=0 EPIRUS_CURSE_PUSH=0 EPIRUS_SUPPORT_PRIOR=0
LOG=scratch/seldef-arms.log
: > $LOG
echo "### 0) 开臂 $(date +%H:%M)（4 粒并发：on/off × seed 13/41）" >> $LOG

for seed in 13 41; do
  for mode in off on; do
    if [ "$mode" = on ]; then SD="EPIRUS_SEL_DEF=1 EPIRUS_SEL_DEF_MIN=0.10 EPIRUS_SEL_DEF_GAMES=20 EPIRUS_SEL_DEF_MODE=multi"; else SD=""; fi
    ( cd /d/code/Epirus-Web && env EPIRUS_ARM=DEF2-$mode-s$seed EPIRUS_SEED=$seed $SD \
        EPIRUS_T3P_OUT=scratch/ga-arms/DEF2-$mode-s$seed.js EPIRUS_BAND_DIR=scratch/ga-bands/DEF2-$mode-s$seed \
        node tools/train-3p.mjs 400 3 8 8 > scratch/def2-$mode-s$seed.log 2>&1; \
      echo "  DEF2-$mode-s$seed 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &
  done
done
wait
for seed in 13 41; do
  for mode in off on; do
    grep -E "\[防御选人\]|\[wide-final\] \*\*换人" scratch/def2-$mode-s$seed.log | tail -2 | cut -c1-250 | sed "s/^/  [$mode s$seed] /" >> $LOG
  done
done
echo "### 1b) 臂段结束 $(date +%H:%M)" >> $LOG

echo "### 2) 字据 + 摘要对账" >> $LOG
node -e "
const fs=require('fs'),cr=require('crypto');
const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
const r=(f)=>JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*?\});\n/s.exec(fs.readFileSync(f,'utf8'))[1]).recipe;
for(const s of [13,41]) for(const m of ['off','on']){
  const f='scratch/ga-arms/DEF2-'+m+'-s'+s+'.js';
  if(!fs.existsSync(f)){console.log('  ⛔ 缺 '+f);continue;}
  const rc=r(f);
  console.log('  DEF2-'+m+'-s'+s+' 摘要='+w(f)+' 起点=be18fe715c'+(w(f)==='be18fe715c'?' ⚠=起点(noOp)':'')+
    ' ‖ knob='+JSON.stringify(rc.deployKnobs.EPIRUS_BIGT_PUSH)+' ‖ selDef='+(rc.selDef?JSON.stringify({band:rc.selDef.band,min:rc.selDef.min,picked:rc.selDef.picked,wasWinner:rc.selDef.wasWinner,changed:rc.selDef.changedWinner,allBelow:rc.selDef.allBelow}):'null')+
    ' ‖ wide='+(rc.wideFinalPick?JSON.stringify(rc.wideFinalPick):'?'));
}
" >> $LOG 2>&1

echo "### 3) A-2 空挡率（probe-wasted-play：有效/被穿透=半/白防 三档，走 defense-quality 单源）" >> $LOG
node tools/probe-wasted-play.mjs --packs=scratch/ga-arms/DEF2-off-s13.js,scratch/ga-arms/DEF2-on-s13.js,scratch/ga-arms/DEF2-off-s41.js,scratch/ga-arms/DEF2-on-s41.js,js/bundled-champion-3p.js --games=60 > scratch/wasted-def2.log 2>&1
grep -E "防御|空挡|有效" scratch/wasted-def2.log | head -14 | cut -c1-210 | sed 's/^/  /' >> $LOG

echo "### 4) A-1 分层被选率（残血时也防吗）+ 宽 + 强度" >> $LOG
for seed in 13 41; do for mode in off on; do
  f=scratch/ga-arms/DEF2-$mode-s$seed.js
  [ -f "$f" ] || continue
  node scratch/pressure-source.mjs --pack=$f --table=strat --mode=multi --n=5 --games=40 > scratch/ps6-$mode-s$seed.log 2>&1
  grep -oE "分层被选率.*|残血时它实际选了什么.*" scratch/ps6-$mode-s$seed.log | sed "s/^/  [def2 $mode s$seed] /" | cut -c1-235 >> $LOG
done; done
node scratch/wide-check.mjs --ref=scratch/arms/GD3-SWORD.bak --packs=scratch/ga-arms/DEF2-off-s13.js,scratch/ga-arms/DEF2-on-s13.js,scratch/ga-arms/DEF2-off-s41.js,scratch/ga-arms/DEF2-on-s41.js --games=40 > scratch/wide-check-def2.log 2>&1
sed -n '1,7p' scratch/wide-check-def2.log | sed 's/^/  /' >> $LOG
for seed in 13 41; do for mode in off on; do
  f=scratch/ga-arms/DEF2-$mode-s$seed.js
  [ -f "$f" ] || continue
  SUM=0; N=0
  for d in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $d $f --shipbigt=0 --shipdrain=0 > scratch/e5p-def2-$mode-$seed-$d.log 2>&1
    V=$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-def2-$mode-$seed-$d.log | head -1 | cut -d= -f2)
    SUM=$(node -e "console.log($SUM+${V:-0})"); N=$((N+1)); printf "%s " "$V"
  done
  echo "  [def2 $mode s$seed] 5P 四骰 = $(node -e "console.log(($SUM/4).toFixed(1))")%（散布见上一行列）" >> $LOG
  node tools/eval-5p.mjs 12 3 77000 $f --shipbigt=0 --shipdrain=0 > scratch/e3p-def2-$mode-$seed.log 2>&1
  echo "    3P=$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e3p-def2-$mode-$seed.log | head -1)  8P=$(node tools/eval-5p.mjs 10 8 81000 $f --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1)" >> $LOG
done; done
echo "### done $(date +%H:%M)" >> $LOG
