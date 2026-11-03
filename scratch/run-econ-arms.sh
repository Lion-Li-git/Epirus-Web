#!/usr/bin/env bash
# PREREG-2026-11-01-ECON-LOCK 的发臂批（千问 · 11-01 下午）
#   A = --bandEntropy 的回归腿与牙   B = P-E3 四档   C = P-E4 开窗/关窗两臂
#   D = P-E2 的配对骰分母（GD3-SWORD 与 GD3-ECON 各四骰 + 3P）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
LOG=scratch/econ-arms.log
: > $LOG

echo "### D：配对骰分母（P-E2 先拿到同骰基线，不许用别人的单骰）" >> $LOG
for p in GD3-SWORD GD3-ECON; do
  [ -f scratch/arms/$p.bak ] || { echo "  ⛔ 缺起点 $p ⇒ 整批停" | tee -a $LOG; exit 1; }
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s scratch/arms/$p.bak > scratch/e5p-ECON-$p-$s.log 2>&1
    echo "  $p 5P seed=$s 1st=$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-ECON-$p-$s.log | head -1 | cut -d= -f2) 种类=$(grep -oE '出手种类=[0-9]+' scratch/e5p-ECON-$p-$s.log | head -1 | cut -d= -f2)" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 scratch/arms/$p.bak > scratch/e5p-ECON-$p-3p.log 2>&1
  echo "  $p 3P seed=77000 1st=$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-ECON-$p-3p.log | head -1 | cut -d= -f2)" >> $LOG
  echo "  $p 枪+剑合计检查（R2-2 同尺）：" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-ECON-$p-77000.log 2>&1 | tail -1 >> $LOG
done

echo "### A1：回归腿 —— bandEntropy 不给 ⇒ RB2P-s13 原命令产物必须逐字节同" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/BANDREG-s13.bak > scratch/bandreg-s13.log 2>&1
md5sum scratch/arms/BANDREG-s13.bak scratch/arms/RB2P-s13.bak >> $LOG 2>&1
grep -c "当选面覆盖熵" scratch/bandreg-s13.log | sed 's/^/  关档时熵tie-break打印行数（必须 0）= /' >> $LOG

echo "### A2：牙（太窄=白开）—— bandEntropy=0.0005 期望 swaps=0 并自己报警" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --bandEntropy=0.0005 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/BANDNARROW-s13.bak > scratch/bandnarrow-s13.log 2>&1
grep -E "当选面覆盖熵" scratch/bandnarrow-s13.log | tail -1 >> $LOG

echo "### A3：牙（宽档必须换位、且产物必须不同）" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --bandEntropy=0.05 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/BANDWIDE-s13.bak > scratch/bandwide-s13.log 2>&1
grep -E "当选面覆盖熵" scratch/bandwide-s13.log | tail -1 >> $LOG
md5sum scratch/arms/BANDWIDE-s13.bak scratch/arms/RB2P-s13.bak >> $LOG 2>&1

echo "### B：P-E3 四档（起点 gd3b-ks-sb 一维高分桶专家 ‖ 货币 net ‖ 默认 mild 11 桌形采集）" >> $LOG
BASE="--mode=cem --evals=6006 --pop=48 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=net --seed=7 --start=scratch/arms/gd3b-ks-sb.bak"
for be in 0 0.005 0.01 0.02; do
  tag="BAND-$be"
  if [ "$be" = "0" ]; then EX=""; else EX="--bandEntropy=$be"; fi
  node tools/probe-cem-arm.mjs $BASE $EX --out=scratch/arms/$tag.bak > scratch/$tag.log 2>&1
  echo "  $tag 退出码=$?" >> $LOG
  grep -E "当选面覆盖熵" scratch/$tag.log | tail -1 >> $LOG
  node tools/eval-5p.mjs 12 5 77000 scratch/arms/$tag.bak > scratch/e5p-$tag.log 2>&1
  echo "  $tag 5P=$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-$tag.log | head -1 | cut -d= -f2) 种类=$(grep -oE '出手种类=[0-9]+' scratch/e5p-$tag.log | head -1 | cut -d= -f2)" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-$tag.log 2>&1 | tail -1 >> $LOG
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/$tag.bak --field=mirror --games=30 --out=scratch/offer-$tag.json > scratch/offer-$tag.log 2>&1
  sed -n '2,3p' scratch/offer-$tag.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT" scratch/offer-$tag.log | sed 's/^/    /' >> $LOG
done

echo "### C：P-E4 开窗/关窗两臂（起点 GD3-SWORD ‖ 货币 first ‖ 同预算）" >> $LOG
CBASE="--mode=cem --evals=6006 --pop=48 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=first --seed=7 --start=scratch/arms/GD3-SWORD.bak"
node tools/probe-cem-arm.mjs $CBASE --arenaShapes=5:long,3:long,5:multi --out=scratch/arms/ECONCUR-open.bak > scratch/econcur-open.log 2>&1
echo "  open 退出码=$?" >> $LOG
node tools/probe-cem-arm.mjs $CBASE --arenaShapes=5:multi,3:multi --out=scratch/arms/ECONCUR-closed.bak > scratch/econcur-closed.log 2>&1
echo "  closed 退出码=$?" >> $LOG
for tag in ECONCUR-open ECONCUR-closed; do
  [ -f scratch/arms/$tag.bak ] || { echo "  ⛔ $tag 无产物" >> $LOG; continue; }
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s scratch/arms/$tag.bak > scratch/e5p-$tag-$s.log 2>&1
    echo "  $tag 5P seed=$s =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-$tag-$s.log | head -1 | cut -d= -f2)" >> $LOG
  done
  node scratch/exam-effkinds.mjs scratch/e5p-$tag-77000.log 2>&1 | tail -1 >> $LOG
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/$tag.bak --field=mirror --games=30 --out=scratch/offer-$tag.json > scratch/offer-$tag.log 2>&1
  sed -n '2,3p' scratch/offer-$tag.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT" scratch/offer-$tag.log | sed 's/^/    /' >> $LOG
  node tools/proto2/skill-mastery.mjs --pack=scratch/arms/$tag.bak > scratch/mastery-$tag.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|珠经济" scratch/mastery-$tag.log | sed 's/^/    /' >> $LOG
done
echo "### E：净分同尺（P-E3 的『强度不许卖』那半条）——四档 + 起点一次跑完（mild 440 局/枚）" >> $LOG
node tools/proto2/chain-price.mjs --gamesPerShape=40 --strat=mild --phase=frozen \
  --packs=scratch/arms/gd3b-ks-sb.bak,scratch/arms/BAND-0.bak,scratch/arms/BAND-0.005.bak,scratch/arms/BAND-0.01.bak,scratch/arms/BAND-0.02.bak \
  > scratch/chainprice-band4.log 2>&1
grep -E "^\S+ ‖ [0-9]+ 局|净分|gd3b|BAND" scratch/chainprice-band4.log | head -20 >> $LOG
echo "### done" >> $LOG
