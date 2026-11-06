#!/usr/bin/env bash
# §十一 + §十二（钩子位置修正后 v2）：GA2R-sword 原配方 + 演化期健康门槛接在**父母抽取处**
# 判据 d22d993c（§十一）+ §十二 位置勘误（判据不变、线不变：eff1 ≥ 4、band 0.13、每代 top-3 × 6 局镜）
set -u
R=/d/code/Epirus-Web
cd "$R" || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=4 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
LOG=$R/scratch/ga-gate2.log
: > $LOG

echo "### 1) 三粒臂（并发）" >> $LOG
for s in 7 13 41; do
  ( cd "$R" && EPIRUS_ARM=GATE2-s$s EPIRUS_SEED=$s \
      EPIRUS_T3P_OUT=$R/scratch/ga-arms/GATE2-s$s.js \
      EPIRUS_BAND_DIR=$R/scratch/ga-bands/GATE2-s$s \
      node tools/train-3p.mjs 400 3 8 8 > $R/scratch/gate2-s$s.log 2>&1; \
    echo "  s$s 退出码=$?" >> $LOG ) &
done
wait
for s in 7 13 41; do
  grep -E "\[GA 门槛\]" $R/scratch/gate2-s$s.log | tail -1 | sed "s/^/  s$s /" >> $LOG
done

echo "### 2) P-G1..G4（对照在册 GA2R-sword-s7/s13/s41：镜 eff1 5/1/3 ‖ 炮进菜单 0 ‖ 5P 53.3/67.5/64.1 ‖ 3P 70.2/76.9/79.9）" >> $LOG
for s in 7 13 41; do
  P=$R/scratch/ga-arms/GATE2-s$s.js
  [ -f "$P" ] || { echo "  ⛔ 缺 GATE2-s$s ⇒ 跳过" >> $LOG; continue; }
  echo "  ---- GATE2-s$s" >> $LOG
  node tools/proto2/breadth2.mjs --pack="$P" > $R/scratch/breadth2-gate2-s$s.log 2>&1
  sed -n '4p' $R/scratch/breadth2-gate2-s$s.log | sed 's/^/    [镜 breadth2] /' >> $LOG
  node tools/proto2/offer-trace.mjs --pack="$P" --field=mirror --games=30 --out=$R/scratch/offer-gate2-s$s.json > $R/scratch/offer-gate2-s$s.log 2>&1
  sed -n '2,3p' $R/scratch/offer-gate2-s$s.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT|^ring|^gun |^sword" $R/scratch/offer-gate2-s$s.log | sed 's/^/    /' >> $LOG
  tail -2 $R/scratch/offer-gate2-s$s.log | sed 's/^/    /' >> $LOG
  for d in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $d "$P" > $R/scratch/e5p-gate2-s$s-$d.log 2>&1
    echo "    5P seed=$d =$(grep -oE '\[冠军\] 1st=[0-9.]+' $R/scratch/e5p-gate2-s$s-$d.log | head -1 | cut -d= -f2)%" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 "$P" > $R/scratch/e5p-gate2-s$s-3p.log 2>&1
  echo "    3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' $R/scratch/e5p-gate2-s$s-3p.log | head -1 | cut -d= -f2)%" >> $LOG
  node scratch/exam-effkinds.mjs $R/scratch/e5p-gate2-s$s-77000.log 2>&1 | tail -1 | sed 's/^/    /' >> $LOG
  node tools/proto2/skill-mastery.mjs --pack="$P" > $R/scratch/mastery-gate2-s$s.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" $R/scratch/mastery-gate2-s$s.log | sed 's/^/    /' >> $LOG
  node -e "
    const fs=require('fs'),cr=require('crypto');
    const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
    console.log('    权重摘要 本臂='+w('$R/scratch/ga-arms/GATE2-s$s.js')+' 对照='+w('$R/scratch/ga-arms/GA2R-sword-s$s.js')+'（必须不同，否则处理又没落地）');
  " >> $LOG 2>&1
done
echo "### done" >> $LOG
