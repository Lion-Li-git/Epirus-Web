#!/usr/bin/env bash
# §十：DAgger × 靶向打在"攒/花"这一格（判据 cc15cf26，先于本批）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
LOG=scratch/econ-dagger.log
: > $LOG
SUP="--upstream=scratch/arms/GD3-RATION.bak --teacher=ration4 --groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"
need() { [ -f "$1" ] || { echo "  ⛔ 缺产物 $1 ⇒ 该臂读数跳过" | tee -a $LOG; return 1; }; return 0; }

readarm() {  # $1=标签 $2=包
  local t="$1" p="$2"
  need "$p" || return 0
  echo "  ---- $t（$(basename "$p")）" >> $LOG
  node tools/proto2/offer-trace.mjs --pack="$p" --field=mirror --games=30 --out=scratch/offer-dg-$t.json > scratch/offer-dg-$t.log 2>&1
  sed -n '2,3p' scratch/offer-dg-$t.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^bigT|^ring|^gun |^sword" scratch/offer-dg-$t.log | sed 's/^/    /' >> $LOG
  tail -2 scratch/offer-dg-$t.log | sed 's/^/    /' >> $LOG
  node tools/proto2/breadth2.mjs --pack="$p" > scratch/breadth2-dg-$t.log 2>&1
  sed -n '4p' scratch/breadth2-dg-$t.log | sed 's/^/    [镜 breadth2] /' >> $LOG
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s "$p" > scratch/e5p-dg-$t-$s.log 2>&1
    echo "    5P seed=$s =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-dg-$t-$s.log | head -1 | cut -d= -f2)%" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 "$p" > scratch/e5p-dg-$t-3p.log 2>&1
  echo "    3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-dg-$t-3p.log | head -1 | cut -d= -f2)%" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-dg-$t-77000.log 2>&1 | tail -1 | sed 's/^/    /' >> $LOG
  node tools/eval-5p.mjs 12 5 77000 "$p" --field=gunwall > scratch/e5p-dg-$t-gunwall.log 2>&1
  echo "    gunwall（该场只 12 局 ⇒ 一格=8.3%，只记录不入判据）=$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-dg-$t-gunwall.log | head -1 | cut -d= -f2)%" >> $LOG
  node tools/proto2/skill-mastery.mjs --pack="$p" > scratch/mastery-dg-$t.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|会激光眼|珠经济" scratch/mastery-dg-$t.log | sed 's/^/    /' >> $LOG
}

echo "### 1) 两腿蒸馏（唯一差别 = 有没有靶向）" >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --dagger=2 --out=scratch/arms/ECON-DG-s7.bak > scratch/econ-dg.log 2>&1
echo "  DG 退出码=$?" >> $LOG
grep -E "粒子自证|轮 [0-9] ‖ 学生态|产物 →|教师标签的种类|最稀有的非ジ" scratch/econ-dg.log | tail -6 | sed 's/^/    /' >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --dagger=2 --rareOnly=railgun,charge --rareFrac=0.5 --out=scratch/arms/ECON-DGR-s7.bak > scratch/econ-dgr.log 2>&1
echo "  DGR 退出码=$?" >> $LOG
grep -E "粒子自证|轮 [0-9] ‖ 学生态|产物 →|教师标签的种类|最稀有的非ジ" scratch/econ-dgr.log | tail -6 | sed 's/^/    /' >> $LOG
md5sum scratch/arms/ECON-DG-s7.bak scratch/arms/ECON-DGR-s7.bak scratch/arms/GD3-BEAD.bak 2>/dev/null | sed 's/^/    /' >> $LOG

echo "### 2) P-D1..D4 读数（对照 = 已在册的 GD3-BEAD：蓄能 35.6% ‖ 炮进菜单 0 ‖ 浪费 98.4% ‖ 5P 11.1）" >> $LOG
readarm DG scratch/arms/ECON-DG-s7.bak
readarm DGR scratch/arms/ECON-DGR-s7.bak
echo "### done" >> $LOG
