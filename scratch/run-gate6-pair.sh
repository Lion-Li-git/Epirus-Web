#!/usr/bin/env bash
# §五分档对子：GATE4b 配方（门槛+WIDE_FINAL+指纹）× 唯一变量 EPIRUS_BIGT_PUSH=12 vs 0 × seed 13
# 判据先于臂：RESULTS-2026-11-02-DAY-qoder.md §五（K-1..K-4 + 停线）
# 对照 = 夜班无门槛孪生对 PUSHON-s13(61.5) / PLAIN-s13(43.0)
# ⚠ 喂 node 的路径一律仓库相对
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
export EPIRUS_WIDE_FINAL=1 EPIRUS_HALL_TRACE=1
LOG=scratch/ga-gate6.log
: > $LOG
K="charge,ring,railgun,bigT,sword,gun,tank,snipe,armor,curse,firestorm,mine,taunt,rod,holo,drain,cannon,laserEye,reflect,transfer,miniT,dualGun"

echo "### 0) 开臂 $(date +%H:%M)（两臂并发，唯一变量=训练时大雷兑现档）" >> $LOG
for mode in on off; do
  if [ "$mode" = on ]; then PB=12; else PB=0; fi
  ( cd /d/code/Epirus-Web && EPIRUS_ARM=GATE6-$mode-s13 EPIRUS_SEED=13 EPIRUS_BIGT_PUSH=$PB \
      EPIRUS_T3P_OUT=scratch/ga-arms/GATE6-$mode-s13.js EPIRUS_BAND_DIR=scratch/ga-bands/GATE6-$mode-s13 \
      node tools/train-3p.mjs 400 3 8 8 > scratch/gate6-$mode-s13.log 2>&1; \
    echo "  $mode(BIGT_PUSH=$PB) 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &
done
wait
grep -E "宽门槛\]|未下达|已下达" scratch/gate6-on-s13.log | tail -2 | sed 's/^/  [on] /' >> $LOG
grep -E "宽门槛\]|未下达|已下达" scratch/gate6-off-s13.log | tail -2 | sed 's/^/  [off] /' >> $LOG

echo "### 1) K-4 字据 + 停线检查" >> $LOG
node -e "
const fs=require('fs');
const j=(f)=>JSON.parse(/window\.EPIRUS_CHAMPION_3P_META = (\{.*?\});\n/s.exec(fs.readFileSync(f,'utf8'))[1]).recipe;
for(const [t,f] of [['on','scratch/ga-arms/GATE6-on-s13.js'],['off','scratch/ga-arms/GATE6-off-s13.js']])
  console.log('  '+t+' deployKnobs='+JSON.stringify(j(f).deployKnobs.EPIRUS_BIGT_PUSH)+' gaGate.healthyGens='+JSON.stringify(j(f).gaGate&&j(f).gaGate.healthyGens)+' wideFinal='+JSON.stringify(j(f).wideFinal||null));
" >> $LOG 2>&1
for f in on off; do
  echo "  [$f] 逐代 bestFit 前 3 与末 1：$(grep -oE '^gen [0-9]+ bestFit=[0-9.]+' scratch/gate6-$f-s13.log | head -3 | tr '\n' ' ') … $(grep -oE '^gen [0-9]+ bestFit=[0-9.]+' scratch/gate6-$f-s13.log | tail -1)" >> $LOG
done
if diff <(grep -oE '^gen [0-9]+ bestFit=[0-9.]+' scratch/gate6-on-s13.log) <(grep -oE '^gen [0-9]+ bestFit=[0-9.]+' scratch/gate6-off-s13.log) >/dev/null; then
  echo "  ⛔ 两臂逐代轨迹逐字同 ⇒ 判'这档没进训练路'（停线，不许读成'没差别'）" >> $LOG
else echo "  轨迹不同 ✔（这根档真进了训练路）" >> $LOG; fi

echo "### 2) K-1/K-2 二十二把键的菜单普查（脚本对手桌 · 读时关注入 · 30 局）" >> $LOG
for f in on off; do
  node tools/proto2/offer-trace.mjs --pack=scratch/ga-arms/GATE6-$f-s13.js --field=strat --games=30 --shipbigt=0 --shipdrain=0 --keys=$K > scratch/rarekey-GATE6-$f.log 2>&1
  echo "  ---- GATE6-$f  $(grep -oE '局均回合 [0-9.]+ ‖ 决胜率 [0-9.]+%' scratch/rarekey-GATE6-$f.log)" >> $LOG
  grep -E "^(charge|ring|railgun|bigT|sword|gun|tank|snipe|armor|curse|firestorm|mine|taunt|rod|holo|drain|cannon|laserEye|reflect|transfer|miniT|dualGun) " scratch/rarekey-GATE6-$f.log | awk '{if($3+0>0||$4+0>0) print "      "$1" 菜单"$2"("$3") → 自选"$4" ("$5")"}' >> $LOG
  grep -oE "非ジ出手种类=[0-9]+ ‖ 非ジ里最大单键份额 [0-9.]+" scratch/rarekey-GATE6-$f.log | sed 's/^/      /' >> $LOG
done

echo "### 3) 宽 / 强度（n=40 判宽 ‖ 5P 四骰 ‖ 3P ‖ 8P ‖ 镜 breadth2）" >> $LOG
node scratch/wide-check.mjs --ref=scratch/arms/GD3-SWORD.bak --packs=scratch/ga-arms/GATE6-on-s13.js,scratch/ga-arms/GATE6-off-s13.js --games=40 > scratch/wide-check-gate6.log 2>&1
sed -n '1,5p' scratch/wide-check-gate6.log | sed 's/^/  /' >> $LOG
for f in on off; do
  P=scratch/ga-arms/GATE6-$f-s13.js
  node tools/proto2/breadth2.mjs --pack=$P > scratch/breadth2-gate6-$f.log 2>&1
  sed -n '4p' scratch/breadth2-gate6-$f.log | sed "s/^/    [镜120局 $f] /" >> $LOG
  for d in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $d $P --shipbigt=0 --shipdrain=0 > scratch/e5p-gate6-$f-$d.log 2>&1
    echo "    $f 5P seed=$d =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-gate6-$f-$d.log | head -1 | cut -d= -f2)%" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 $P --shipbigt=0 --shipdrain=0 > scratch/e3p-gate6-$f.log 2>&1
  echo "    $f 3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e3p-gate6-$f.log | head -1 | cut -d= -f2)%" >> $LOG
  node tools/eval-5p.mjs 10 8 81000 $P --shipbigt=0 --shipdrain=0 > scratch/e8p-gate6-$f.log 2>&1
  echo "    $f 8P seed=81000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e8p-gate6-$f.log | head -1 | cut -d= -f2)%" >> $LOG
  node tools/proto2/skill-mastery.mjs --pack=$P > scratch/mastery-gate6-$f.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|会小雷|珠经济" scratch/mastery-gate6-$f.log | sed "s/^/    [$f] /" >> $LOG
done
echo "### done $(date +%H:%M)" >> $LOG
cat $LOG
