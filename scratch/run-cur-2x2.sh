#!/usr/bin/env bash
# §九 采集覆盖 2×2：C = 3 形 × 2400 组 ‖ D = 11 形 × 2400 组（A/B 两格已在册，本批补 B 的 gunwall 同尺重跑）
# 判据 PREREG-2026-11-01-ECON-LOCK §九（47ba3f48，先于本批）
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
LOG=scratch/econ-2x2.log
: > $LOG
SUP="--upstream=scratch/arms/GD3-RATION.bak --teacher=ration2 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"
need() { [ -f "$1" ] || { echo "  ⛔ 缺产物 $1 ⇒ 该格读数跳过" | tee -a $LOG; return 1; }; return 0; }

measure() {  # $1 = 标签  $2 = 包路径
  local t="$1" p="$2"
  need "$p" || return 0
  echo "  ---- $t（$(basename "$p")）" >> $LOG
  node tools/proto2/offer-trace.mjs --pack="$p" --field=mirror --games=30 --out=scratch/offer-2x2-$t.json > scratch/offer-2x2-$t.log 2>&1
  sed -n '2,3p' scratch/offer-2x2-$t.log | sed 's/^/    /' >> $LOG
  grep -E "^charge|^railgun|^gun |^sword" scratch/offer-2x2-$t.log | sed 's/^/    /' >> $LOG
  tail -2 scratch/offer-2x2-$t.log | sed 's/^/    /' >> $LOG
  node tools/proto2/breadth2.mjs --pack="$p" > scratch/breadth2-2x2-$t.log 2>&1
  sed -n '4p' scratch/breadth2-2x2-$t.log | sed 's/^/    [镜 breadth2] /' >> $LOG
  node tools/eval-5p.mjs 12 5 77000 "$p" --field=gunwall > scratch/e5p-2x2-$t-gunwall.log 2>&1
  echo "    gunwall(4×主攻枪) =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-2x2-$t-gunwall.log | head -1 | cut -d= -f2)%" >> $LOG
  for s in 77000 77111 77222 77333; do
    node tools/eval-5p.mjs 12 5 $s "$p" > scratch/e5p-2x2-$t-$s.log 2>&1
    echo "    5P seed=$s =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-2x2-$t-$s.log | head -1 | cut -d= -f2)%" >> $LOG
  done
  node tools/eval-5p.mjs 12 3 77000 "$p" > scratch/e5p-2x2-$t-3p.log 2>&1
  echo "    3P seed=77000 =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-2x2-$t-3p.log | head -1 | cut -d= -f2)%" >> $LOG
  node scratch/exam-effkinds.mjs scratch/e5p-2x2-$t-77000.log 2>&1 | tail -1 | sed 's/^/    /' >> $LOG
  node tools/proto2/skill-mastery.mjs --pack="$p" > scratch/mastery-2x2-$t.log 2>&1
  grep -E "会聚能环|会大雷|会电磁炮|珠经济" scratch/mastery-2x2-$t.log | sed 's/^/    /' >> $LOG
}

echo "### 1) 两条新蒸馏腿（--groups=2400）" >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --groups=2400 --arenaShapes=3:multi4,5:multi,3:multi --out=scratch/arms/GD3-C2X2C.bak > scratch/gd3-2x2c.log 2>&1
echo "  C 退出码=$?" >> $LOG
grep -E "采集覆盖|产物 →" scratch/gd3-2x2c.log | head -2 | sed 's/^/    /' >> $LOG
node tools/proto2/supfit-gd.mjs $SUP --groups=2400 --out=scratch/arms/GD3-C2X2D.bak > scratch/gd3-2x2d.log 2>&1
echo "  D 退出码=$?" >> $LOG
grep -E "采集覆盖|产物 →" scratch/gd3-2x2d.log | head -2 | sed 's/^/    /' >> $LOG
md5sum scratch/arms/GD3-C2X2C.bak scratch/arms/GD3-C2X2D.bak scratch/arms/GD3-CURC.bak scratch/arms/GD3-SWORD.bak 2>/dev/null | sed 's/^/    /' >> $LOG

echo "### 2) 四格读数（A/B 的镜像与考卷四骰已在册，这里只补同批 gunwall 与全部 C/D）" >> $LOG
measure C scratch/arms/GD3-C2X2C.bak
measure D scratch/arms/GD3-C2X2D.bak
echo "  ---- B（GD3-SWORD，同批补 gunwall）" >> $LOG
node tools/eval-5p.mjs 12 5 77000 scratch/arms/GD3-SWORD.bak --field=gunwall > scratch/e5p-2x2-B-gunwall.log 2>&1
echo "    gunwall =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-2x2-B-gunwall.log | head -1 | cut -d= -f2)%" >> $LOG
echo "  ---- A（GD3-CURC，同批补 gunwall 复跑一致性）" >> $LOG
node tools/eval-5p.mjs 12 5 77000 scratch/arms/GD3-CURC.bak --field=gunwall > scratch/e5p-2x2-A-gunwall.log 2>&1
echo "    gunwall =$(grep -oE '\[冠军\] 1st=[0-9.]+' scratch/e5p-2x2-A-gunwall.log | head -1 | cut -d= -f2)%" >> $LOG
echo "### done" >> $LOG
