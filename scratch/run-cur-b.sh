#!/usr/bin/env bash
# §八 B：只换采集桌桌形的经济课程（开窗 vs 同形不开窗）——判据 PREREG-2026-11-01-ECON-LOCK §八（97743a76，先于本批）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
LOG=scratch/econ-cur-b.log
: > $LOG
need() { [ -f "$1" ] || { echo "  ⛔ 缺产物 $1 ⇒ 该臂后续腿跳过" | tee -a $LOG; return 1; }; return 0; }
SUP="--upstream=scratch/arms/GD3-RATION.bak --teacher=ration2 --groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"

echo "### 1) 两臂蒸馏（唯一变量 = --arenaShapes）" >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --arenaShapes=3:long,5:long,5:multi --out=scratch/arms/GD3-CURW.bak > scratch/gd3-curw.log 2>&1
echo "  CURW 退出码=$?" >> $LOG
grep -E "采集覆盖|桌形|产物 →" scratch/gd3-curw.log | head -3 | sed 's/^/    /' >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --arenaShapes=3:multi4,5:multi,3:multi --out=scratch/arms/GD3-CURC.bak > scratch/gd3-curc.log 2>&1
echo "  CURC 退出码=$?" >> $LOG
grep -E "采集覆盖|桌形|产物 →" scratch/gd3-curc.log | head -3 | sed 's/^/    /' >> $LOG
md5sum scratch/arms/GD3-CURW.bak scratch/arms/GD3-CURC.bak scratch/arms/GD3-SWORD.bak 2>/dev/null | sed 's/^/    /' >> $LOG

echo "### 2) P-B1/B2/B3：镜像 offer-trace（电磁炮进菜单 = 有珠∧ep≥门槛 的直接量）" >> $LOG
for t in CURW CURC; do
  need scratch/arms/GD3-$t.bak || continue
  node tools/proto2/offer-trace.mjs --pack=scratch/arms/GD3-$t.bak --field=mirror --games=30 --out=scratch/offer-$t-mirror.json > scratch/offer-$t-mirror.log 2>&1
  echo "  ---- $t" >> $LOG
  sed -n '2,3p' scratch/offer-$t-mirror.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT|^ring|^gun|^sword" scratch/offer-$t-mirror.log | sed 's/^/    /' >> $LOG
  tail -2 scratch/offer-$t-mirror.log | sed 's/^/    /' >> $LOG
  node tools/proto2/breadth2.mjs --pack=scratch/arms/GD3-$t.bak > scratch/breadth2-$t.log 2>&1
  sed -n '3p' scratch/breadth2-$t.log | sed 's/^/    [镜 breadth2] /' >> $LOG
done

echo "### 3) P-B4/B5：考卷 4 骰 + 3P + 有效种类" >> $LOG
for t in CURW CURC; do
  need scratch/arms/GD3-$t.bak || continue
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s scratch/arms/GD3-$t.bak > scratch/e5p-CUR-$t-$s.log 2>&1
    echo "  $t 5P seed=$s =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-CUR-$t-$s.log | head -1 | cut -d= -f2)" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 scratch/arms/GD3-$t.bak > scratch/e5p-CUR-$t-3p.log 2>&1
  echo "  $t 3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-CUR-$t-3p.log | head -1 | cut -d= -f2)" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-CUR-$t-77000.log 2>&1 | tail -1 >> $LOG
  node tools/eval-5p.mjs 12 5 77000 scratch/arms/GD3-$t.bak --field=gunwall > scratch/e5p-CUR-$t-gunwall.log 2>&1
  echo "  $t gunwall =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-CUR-$t-gunwall.log | head -1 | cut -d= -f2)" >> $LOG
done

echo "### 4) 桶线与珠账（mastery 的 chargeProfile 单源）" >> $LOG
for t in CURW CURC; do
  need scratch/arms/GD3-$t.bak || continue
  node tools/proto2/skill-mastery.mjs --pack=scratch/arms/GD3-$t.bak > scratch/mastery-$t.log 2>&1
  echo "  ---- $t" >> $LOG
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" scratch/mastery-$t.log | sed 's/^/    /' >> $LOG
done

echo "### 5) 门禁复跑（同旗标同产物 ⇒ 只为拿 --smoke 的判词）" >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --arenaShapes=3:long,5:long,5:multi --smoke=30 --out=scratch/arms/GD3-CURW-smokechk.bak > scratch/gd3-curw-smoke.log 2>&1
echo "  冒烟复跑退出码=$? 产物=$([ -f scratch/arms/GD3-CURW-smokechk.bak ] && echo 有 || echo 无)" >> $LOG
grep -E "行为冒烟|冒烟红|教师标签的种类|最稀有的非ジ" scratch/gd3-curw-smoke.log | sed 's/^/    /' >> $LOG
if [ -f scratch/arms/GD3-CURW-smokechk.bak ]; then
  md5sum scratch/arms/GD3-CURW.bak scratch/arms/GD3-CURW-smokechk.bak | sed 's/^/    确定性对账 /' >> $LOG
fi
echo "### done" >> $LOG
