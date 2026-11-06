#!/usr/bin/env bash
# §十一 C 的三粒臂：GA2R-sword 原配方 + 演化期健康门槛（判据 d22d993c 先于本批；仪器 35170ce2）
set -u
R=/d/code/Epirus-Web
cd "$R" || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1'
export EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=4 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
LOG=$R/scratch/ga-gate.log
: > $LOG

echo "### 1) 三粒臂（并发；每代 top-3 × 6 局镜 ⇒ 预算 +28%，与对照 GA2R-sword 同形状）" >> $LOG
for s in 7 13 41; do
  ( cd "$R" && EPIRUS_ARM=GATE-s$s \
      EPIRUS_T3P_OUT=$R/scratch/ga-arms/GATE-s$s.js \
      EPIRUS_BAND_DIR=$R/scratch/ga-bands/GATE-s$s \
      EPIRUS_SEED=$s node tools/train-3p.mjs 400 3 8 8 > $R/scratch/gate-s$s.log 2>&1; \
    echo "  s$s 退出码=$?" >> $LOG ) &
done
wait
for s in 7 13 41; do
  grep -E "\[GA 门槛\]" $R/scratch/gate-s$s.log | tail -1 | sed "s/^/  s$s /" >> $LOG
  grep -E "写出|OUT=|产物" $R/scratch/gate-s$s.log | tail -1 | sed "s/^/    /" >> $LOG
  ls -la $R/scratch/ga-arms/GATE-s$s.js 2>/dev/null | awk -v t=s$s '{print "    " t ": " $5 " 字节"}' >> $LOG
done

echo "### 2) P-G1..G4 读数（对照在册 GA2R-sword-s7/s13/s41：镜 eff1 5/1/3 ‖ 炮进菜单 0/0/0 ‖ 5P 四骰 53.3/67.5/64.1）" >> $LOG
for s in 7 13 41; do
  P=$R/scratch/ga-arms/GATE-s$s.js
  [ -f "$P" ] || { echo "  ⛔ 缺 GATE-s$s ⇒ 跳过" >> $LOG; continue; }
  echo "  ---- GATE-s$s" >> $LOG
  node tools/proto2/breadth2.mjs --pack="$P" > $R/scratch/breadth2-gate-s$s.log 2>&1
  sed -n '4p' $R/scratch/breadth2-gate-s$s.log | sed 's/^/    [镜 breadth2] /' >> $LOG
  node tools/proto2/offer-trace.mjs --pack="$P" --field=mirror --games=30 --out=$R/scratch/offer-gate-s$s.json > $R/scratch/offer-gate-s$s.log 2>&1
  sed -n '2,3p' $R/scratch/offer-gate-s$s.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT|^ring|^gun |^sword" $R/scratch/offer-gate-s$s.log | sed 's/^/    /' >> $LOG
  tail -2 $R/scratch/offer-gate-s$s.log | sed 's/^/    /' >> $LOG
  for d in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $d "$P" > $R/scratch/e5p-gate-s$s-$d.log 2>&1
    echo "    5P seed=$d =$(grep -oE '\[冠军\] 1st=[0-9.]+' $R/scratch/e5p-gate-s$s-$d.log | head -1 | cut -d= -f2)%" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 "$P" > $R/scratch/e5p-gate-s$s-3p.log 2>&1
  echo "    3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' $R/scratch/e5p-gate-s$s-3p.log | head -1 | cut -d= -f2)%" >> $LOG
  node scratch/exam-effkinds.mjs $R/scratch/e5p-gate-s$s-77000.log 2>&1 | tail -1 | sed 's/^/    /' >> $LOG
  node tools/proto2/skill-mastery.mjs --pack="$P" > $R/scratch/mastery-gate-s$s.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" $R/scratch/mastery-gate-s$s.log | sed 's/^/    /' >> $LOG
done
echo "### done" >> $LOG
