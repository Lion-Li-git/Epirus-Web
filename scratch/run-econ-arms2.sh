#!/usr/bin/env bash
# 第二批（PREREG-2026-11-01-ECON-LOCK §六 勘误后）：ration4 的 P-E5 腿 + --bandEntropy 绝对点四档 + 仪器回归/牙
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
LOG=scratch/econ-arms2.log
: > $LOG
need() { [ -f "$1" ] || { echo "  ⛔ 缺产物 $1 ⇒ 后续该格跳过（不拿旧文件充数）" | tee -a $LOG; return 1; }; return 0; }

echo "### R：ration4 蒸馏 + P-E5 判据腿" >> $LOG
node tools/proto2/supfit-gd.mjs --upstream=scratch/arms/GD3-RATION.bak --teacher=ration4 --groups=800 --steps=400 --lr=0.02 \
  --pool=1200 --shapeBal=1 --keySplit=1 --objective=key --out=scratch/arms/GD3-BEAD.bak > scratch/gd3-bead.log 2>&1
echo "  蒸馏退出码=$?" >> $LOG
grep -E "逐键（留出）|产物 →" scratch/gd3-bead.log | sed 's/^/    /' >> $LOG
if need scratch/arms/GD3-BEAD.bak; then
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/GD3-BEAD.bak --field=mirror --games=30 --out=scratch/offer-BEAD-mirror.json > scratch/offer-BEAD-mirror.log 2>&1
  sed -n '2,3p' scratch/offer-BEAD-mirror.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT|^ring|^gun|^sword" scratch/offer-BEAD-mirror.log | sed 's/^/    /' >> $LOG
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/GD3-BEAD.bak --field=scripts --games=30 > scratch/offer-BEAD-scripts.log 2>&1
  grep -E "^charge|^railgun" scratch/offer-BEAD-scripts.log | sed 's/^/    [脚本场] /' >> $LOG
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s scratch/arms/GD3-BEAD.bak > scratch/e5p-ECON-GD3-BEAD-$s.log 2>&1
    echo "  GD3-BEAD 5P seed=$s =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-ECON-GD3-BEAD-$s.log | head -1 | cut -d= -f2)" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 scratch/arms/GD3-BEAD.bak > scratch/e5p-ECON-GD3-BEAD-3p.log 2>&1
  echo "  GD3-BEAD 3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-ECON-GD3-BEAD-3p.log | head -1 | cut -d= -f2)（P-E5d：起点 72.6 −5）" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-ECON-GD3-BEAD-77000.log 2>&1 | tail -1 >> $LOG
  node tools/proto2/skill-mastery.mjs --pack=scratch/arms/GD3-BEAD.bak > scratch/mastery-GD3-BEAD.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" scratch/mastery-GD3-BEAD.log | sed 's/^/    /' >> $LOG
fi

echo "### A1：回归腿（关档）—— 产物必须 ≡ RB2P-s13 且 meta 必须落盘" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/B2REG-s13.bak > scratch/b2reg-s13.log 2>&1
echo "  退出码=$?" >> $LOG
md5sum scratch/arms/B2REG-s13.bak scratch/arms/RB2P-s13.bak >> $LOG 2>&1
ls -la scratch/arms/B2REG-s13.bak.meta.json >> $LOG 2>&1 || echo "  ⛔ meta 仍没落盘 ⇒ packed 修复没生效" >> $LOG

echo "### A2：牙（0.0005 点 ⇒ 必须自己报警\"一次都没换\"）" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --bandEntropy=0.0005 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/B2NARROW-s13.bak > scratch/b2narrow-s13.log 2>&1
echo "  退出码=$?" >> $LOG
grep -E "当选面覆盖熵" scratch/b2narrow-s13.log | tail -1 | sed 's/^/    /' >> $LOG

echo "### A3：牙（0.05 点 ⇒ 必须换位、且产物必须与 RB2P-s13 不同）" >> $LOG
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --bandEntropy=0.05 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/B2WIDE-s13.bak > scratch/b2wide-s13.log 2>&1
echo "  退出码=$?" >> $LOG
grep -E "当选面覆盖熵" scratch/b2wide-s13.log | tail -1 | sed 's/^/    /' >> $LOG
md5sum scratch/arms/B2WIDE-s13.bak scratch/arms/RB2P-s13.bak >> $LOG 2>&1

echo "### B2：P-E3 绝对点四档（起点 gd3b-ks-sb ‖ 货币 net ‖ mild 11 桌形）" >> $LOG
BASE="--mode=cem --evals=6006 --pop=48 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=net --seed=7 --start=scratch/arms/gd3b-ks-sb.bak"
PACKS="scratch/arms/gd3b-ks-sb.bak"
for be in 0 0.005 0.02 0.05; do
  tag="B2-$be"
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

echo "### E2：净分同尺（一次跑完，各档必须不再是同一枚包）" >> $LOG
node tools/proto2/chain-price.mjs --gamesPerShape=40 --strat=mild --phase=frozen --packs=$PACKS > scratch/chainprice-b2.log 2>&1
grep -E "^代 3 ‖" scratch/chainprice-b2.log | head -10 >> $LOG
echo "### done" >> $LOG
