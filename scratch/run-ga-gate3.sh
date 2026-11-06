#!/usr/bin/env bash
# §十四 v3 三臂：GA2R-sword 原配方 + 演化期门槛（判据 = 两模式 effSkills≥3 ∧ 两模式 effSkillsLand≥起点−0.10）
#   与 §十一/§十二 唯一变的量 = 判据函数（GATE 由 4→3、带内排序键由出手熵→净兑现之和；起点/压力面/预算/种子逐字同）
#   对照 = 在册 GA2R-sword-s7/s13/s41（5P 53.3/67.5/64.1 ‖ 3P 70.2/76.9/79.9 ‖ 镜见 RESULTS §廿四）
# ⚠ 喂 node 的路径一律仓库相对（§十三 那条 msys 路径自伤不许重犯）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
export EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
export EPIRUS_COUNTER_OPPS='targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver'
export EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13
LOG=scratch/ga-gate3.log
: > $LOG
echo "### 0) 开臂时刻 $(date +%H:%M)（三臂并发，判据 §十四）" >> $LOG

echo "### 1) 三粒臂" >> $LOG
for s in 7 13 41; do
  ( cd /d/code/Epirus-Web && EPIRUS_ARM=GATE3-s$s EPIRUS_SEED=$s \
      EPIRUS_T3P_OUT=scratch/ga-arms/GATE3-s$s.js EPIRUS_BAND_DIR=scratch/ga-bands/GATE3-s$s \
      node tools/train-3p.mjs 400 3 8 8 > scratch/gate3-s$s.log 2>&1; \
    echo "  s$s 退出码=$? @$(date +%H:%M)" >> /d/code/Epirus-Web/$LOG ) &
done
wait
for s in 7 13 41; do
  grep -E "\[GA 宽门槛\]" scratch/gate3-s$s.log | tail -1 | sed "s/^/  s$s /" >> $LOG
done
echo "### 1b) 臂段结束 $(date +%H:%M)" >> $LOG

echo "### 2) P-G1′..G5′（n=40 判宽 + 镜 + 5P 四骰 + 3P + 落地份额 + 摘要对账）" >> $LOG
node scratch/wide-check.mjs --ref=scratch/arms/GD3-SWORD.bak \
  --packs=scratch/ga-arms/GATE3-s7.js,scratch/ga-arms/GATE3-s13.js,scratch/ga-arms/GATE3-s41.js \
  --games=40 > scratch/wide-check-gate3.log 2>&1
sed -n '2,10p' scratch/wide-check-gate3.log | sed 's/^/  [isWideVs] /' >> $LOG
for s in 7 13 41; do
  P=scratch/ga-arms/GATE3-s$s.js
  [ -f "$P" ] || { echo "  ⛔ 缺 GATE3-s$s ⇒ 跳过" >> $LOG; continue; }
  echo "  ---- GATE3-s$s" >> $LOG
  node tools/proto2/breadth2.mjs --pack="$P" > scratch/breadth2-gate3-s$s.log 2>&1
  sed -n '4p' scratch/breadth2-gate3-s$s.log | sed 's/^/    [镜 breadth2] /' >> $LOG
  node tools/proto2/offer-trace.mjs --pack="$P" --field=mirror --games=30 --out=scratch/offer-gate3-s$s.json > scratch/offer-gate3-s$s.log 2>&1
  grep -E "^railgun|^charge|^gun |^sword|非ジ出手种类" scratch/offer-gate3-s$s.log | sed 's/^/    /' >> $LOG
  for d in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $d "$P" > scratch/e5p-gate3-s$s-$d.log 2>&1
    echo "    5P seed=$d =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-gate3-s$s-$d.log | head -1 | cut -d= -f2)%" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 "$P" > scratch/e5p-gate3-s$s-3p.log 2>&1
  echo "    3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-gate3-s$s-3p.log | head -1 | cut -d= -f2)%" >> $LOG
  node tools/proto2/skill-mastery.mjs --pack="$P" > scratch/mastery-gate3-s$s.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" scratch/mastery-gate3-s$s.log | sed 's/^/    /' >> $LOG
  node -e "
    const fs=require('fs'),cr=require('crypto');
    const w=(f)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);return cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10);};
    const a=w('scratch/ga-arms/GATE3-s$s.js'), b=w('scratch/ga-arms/GA2R-sword-s$s.js'), sd=w('scratch/arms/GD3-SWORD.bak');
    console.log('    权重摘要 本臂='+a+' 对照='+b+' 起点='+sd+' ⇒'+(a===b?' ⛔与对照全等⇒处理没落地':' '+(a===sd?' ⚠ 产物=起点（lineage.noOp，不许读成『门槛买到了稳』）':' 新个体 ✔')));
  " >> $LOG 2>&1
done
echo "### done $(date +%H:%M)" >> $LOG
