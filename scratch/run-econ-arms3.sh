#!/usr/bin/env bash
# 第三批：ration5 的 P-E6 腿 + --bandEntropy v2（产物棘轮同带取宽）的剂量-代价曲线
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
LOG=scratch/econ-arms3.log
: > $LOG
need() { [ -f "$1" ] || { echo "  ⛔ 缺产物 $1 ⇒ 该格跳过" | tee -a $LOG; return 1; }; return 0; }

echo "### R5：ration5 蒸馏（教它攥着等）+ P-E6a..d" >> $LOG
node tools/proto2/supfit-gd.mjs --upstream=scratch/arms/GD3-RATION.bak --teacher=ration5 --groups=800 --steps=400 --lr=0.02 \
  --pool=1200 --shapeBal=1 --keySplit=1 --objective=key --out=scratch/arms/GD3-HOLD.bak > scratch/gd3-hold.log 2>&1
echo "  蒸馏退出码=$?" >> $LOG
grep -E "逐键（留出）|产物 →" scratch/gd3-hold.log | sed 's/^/    /' >> $LOG
if need scratch/arms/GD3-HOLD.bak; then
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/GD3-HOLD.bak --field=mirror --games=30 --out=scratch/offer-HOLD-mirror.json > scratch/offer-HOLD-mirror.log 2>&1
  sed -n '2,3p' scratch/offer-HOLD-mirror.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT|^ring|^gun|^sword" scratch/offer-HOLD-mirror.log | sed 's/^/    /' >> $LOG
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/GD3-HOLD.bak --field=scripts --games=30 --out=scratch/offer-HOLD-scripts.json > scratch/offer-HOLD-scripts.log 2>&1
  grep -E "^charge|^railgun" scratch/offer-HOLD-scripts.log | sed 's/^/    [脚本场] /' >> $LOG
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s scratch/arms/GD3-HOLD.bak > scratch/e5p-ECON-GD3-HOLD-$s.log 2>&1
    echo "  GD3-HOLD 5P seed=$s =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-ECON-GD3-HOLD-$s.log | head -1 | cut -d= -f2)" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 scratch/arms/GD3-HOLD.bak > scratch/e5p-ECON-GD3-HOLD-3p.log 2>&1
  echo "  GD3-HOLD 3P =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-ECON-GD3-HOLD-3p.log | head -1 | cut -d= -f2)" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-ECON-GD3-HOLD-77000.log 2>&1 | tail -1 >> $LOG
  node tools/proto2/skill-mastery.mjs --pack=scratch/arms/GD3-HOLD.bak > scratch/mastery-GD3-HOLD.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" scratch/mastery-GD3-HOLD.log | sed 's/^/    /' >> $LOG
  node tools/proto2/breadth2.mjs --pack=scratch/arms/GD3-HOLD.bak > scratch/breadth2-HOLD.log 2>&1
  sed -n '3p' scratch/breadth2-HOLD.log | sed 's/^/    [镜像 breadth2] /' >> $LOG
fi

echo "### A1'：关档回归（v2 之后必须仍与 RB2P-s13 逐字节同）" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/B3REG-s13.bak > scratch/b3reg-s13.log 2>&1
echo "  退出码=$?" >> $LOG
md5sum scratch/arms/B3REG-s13.bak scratch/arms/RB2P-s13.bak >> $LOG 2>&1
node tools/probe-cem-arm.mjs --mode=cem --evals=60 --pop=14 --games=4 --arena2=1 --bandEntropy=0.05 --masteryKey=miniT --start=scratch/arms/gd3b-ks-sb.bak --out=scratch/arms/B3TEETH.bak 2>&1 | tail -1 | sed 's/^/  [互斥闸] /' >> $LOG

echo "### B3：--bandEntropy v2 剂量-代价（起点 gd3b-ks-sb ‖ net ‖ mild 11 桌形 ‖ fit 量子=1/games=0.25 ⇒ 档位按量子铺）" >> $LOG
BASE="--mode=cem --evals=6006 --pop=48 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=net --seed=7 --start=scratch/arms/gd3b-ks-sb.bak"
PACKS="scratch/arms/gd3b-ks-sb.bak"
for be in 0 0.005 0.5 1.0; do
  tag="B3-$be"
  if [ "$be" = "0" ]; then EX=""; else EX="--bandEntropy=$be"; fi
  node tools/probe-cem-arm.mjs $BASE $EX --out=scratch/arms/$tag.bak > scratch/$tag.log 2>&1
  echo "  $tag 退出码=$?" >> $LOG
  grep -E "当选面覆盖熵" scratch/$tag.log | tail -1 | sed 's/^/    /' >> $LOG
  need scratch/arms/$tag.bak || continue
  PACKS="$PACKS,scratch/arms/$tag.bak"
  md5sum scratch/arms/$tag.bak | sed 's/^/    /' >> $LOG
  node tools/eval-5p.mjs 12 5 77000 scratch/arms/$tag.bak > scratch/e5p-$tag.log 2>&1
  node scratch/exam-effkinds.mjs scratch/e5p-$tag.log 2>&1 | tail -1 >> $LOG
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/$tag.bak --field=mirror --games=30 --out=scratch/offer-$tag.json > scratch/offer-$tag.log 2>&1
  grep -E "^charge|^railgun" scratch/offer-$tag.log | sed 's/^/    /' >> $LOG
done

echo "### E3：净分同尺（各档必须是不同的包了）" >> $LOG
node tools/proto2/chain-price.mjs --gamesPerShape=40 --strat=mild --phase=frozen --packs=$PACKS > scratch/chainprice-b3.log 2>&1
grep -E "^代 3 ‖" scratch/chainprice-b3.log | head -6 >> $LOG
echo "### done" >> $LOG
