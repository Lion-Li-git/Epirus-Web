#!/usr/bin/env bash
# read-dda-150.sh — 给 run-dda-150.sh 那三臂出**判读**（qoder 11-02 午后）
# 判据（与 §十一 的定价表对上）：① 只枪桌 native 有没有抬起来 ② 考卷/5P/8P 强度不降 ③ 防御族份额与 HP=2 那格的手数 ④ 摄魂出手/局
# ⚠ 这是"行为 + 强度"的 pilot 读数，不出综合加权（arena2 11 桌形 × 3 温度太贵，等挑出赢家再单跑）
cd "$(dirname "$0")/.." || exit 1
L=scratch/dda-150-read.log
: > $L
for arm in DDA-150-ctrl-s13 DDA-150-gun-s13 DDA-150-dra-s13; do
  P=scratch/ga-arms/$arm.js
  echo "### $arm" >> $L
  if [ ! -f "$P" ]; then echo "  ⛔ 产物不存在（臂没落盘或被去重闸拦下）" >> $L; continue; fi
  echo "  权重摘要=$(node -e "
const fs=require('fs'),cr=require('crypto');const t=fs.readFileSync('$P','utf8');const i=t.indexOf('\"a\":[');const j=t.indexOf(']',i);
process.stdout.write(cr.createHash('md5').update(t.slice(i,j+1)).digest('hex').slice(0,10));")" >> $L
  for s in 77000 77111 77222 77333; do
    echo -n "  5P seed=$s = " >> $L; node tools/eval-5p.mjs 12 5 $s "$P" --shipbigt=0 --shipdrain=0 2>&1 | grep -oE "[0-9]+\.[0-9]%" | head -1 >> $L
  done
  echo -n "  8P seed=81000 = " >> $L; node tools/eval-5p.mjs 10 8 81000 "$P" --shipbigt=0 --shipdrain=0 2>&1 | grep -oE "[0-9]+\.[0-9]%" | head -1 >> $L
  echo -n "  3P seed=77000 = " >> $L; node tools/eval-5p.mjs 12 3 77000 "$P" --shipbigt=0 --shipdrain=0 2>&1 | grep -oE "[0-9]+\.[0-9]%" | head -1 >> $L
  for t in strat train; do
    echo "  -- def-drain-trace table=$t" >> $L
    node tools/proto2/def-drain-trace.mjs --pack="$P" --table=$t --games=40 2>&1 | tail -6 | sed 's/^/    /' >> $L
  done
  echo "  -- 白防质量（考卷桌分层）" >> $L
  node scratch/def-quality-gen3.mjs --pack="$P" --games=40 2>&1 | tail -5 | sed 's/^/    /' >> $L
  for n in 5 3; do
    echo "  -- 反事实定价 n=$n（native ‖ def@满血 ‖ def@HP=2 ‖ def@HP=2∧刚挨打 ‖ drain）" >> $L
    node scratch/counterfactual-value.mjs --pack="$P" --n=$n --games=400 2>&1 | grep -E "^(train|strat|onlygun) \| (native|def@满血 剂量 1/1|def@HP-1 剂量 1/1|def@HP-1∧刚挨打|drain@≤1 剂量 1/1)" | sed 's/ \+/ /g' | cut -c1-118 | sed 's/^/    /' >> $L
  done
  echo >> $L
done
echo "[done] $(date +%H:%M:%S)" >> $L
