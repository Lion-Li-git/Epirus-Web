#!/usr/bin/env bash
# 验 --killKinds：①默认关 ⇒ 产物仍逐字节同 ②一维起点（RB2P 起点）预期中途被杀 ③多线起点预期存活
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
R='names:random,defend,wall,antidef,farmer,heavyfire,deepsaver,targeter,gunspam,ringspam,earlypressure,deadlineburst,protomine'
CO="--mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 --arena2=1 --arenaCur=first --arenaHold=60 --arenaShapes=3:multi,5:multi"
echo "### ① 回归腿：killKinds 关（RB2P-s13 原命令，产品 7 席、默认 holdout）"
node tools/probe-cem-arm.mjs --mode=cem --evals=6006 --pop=14 --games=4 --n=3 --elite=4 --sig=0.2 --targetGames=24000 \
  --arena2=1 --arenaPool=product --arenaCur=first --seed=13 --start=scratch/arms/gd3repro-OB3RB2s23.bak \
  --out=scratch/arms/KILLREG-s13.bak > scratch/killreg-s13.log 2>&1
md5sum scratch/arms/KILLREG-s13.bak scratch/arms/RB2P-s13.bak
echo "### ② 一维起点 + killKinds=4（链起点 gd3repro-OB3RB2s23，预期被杀）"
node tools/probe-cem-arm.mjs $CO --arenaPool=$R --killKinds=4 --killStreak=5 --seed=7 \
  --start=scratch/arms/gd3repro-OB3RB2s23.bak --out=scratch/arms/KILL-chain-s7.bak > scratch/kill-chain-s7.log 2>&1
echo "  退出码=$? 产物在? $([ -f scratch/arms/KILL-chain-s7.bak ] && echo 是 || echo '否（预期）')"
grep -E "低种类代|被中途淘汰" scratch/kill-chain-s7.log | tail -3
echo "### ③ 多线起点 + killKinds=4（BROAD-tkCH-s41，预期存活）"
node tools/probe-cem-arm.mjs $CO --arenaPool=$R --killKinds=4 --killStreak=5 --seed=7 \
  --start=scratch/arms/BROAD-tkCH-s41.bak --out=scratch/arms/KILL-broad-s7.bak > scratch/kill-broad-s7.log 2>&1
echo "  退出码=$? 产物在? $([ -f scratch/arms/KILL-broad-s7.bak ] && echo '是（预期）' || echo 否)"
grep -E "低种类代|被中途淘汰" scratch/kill-broad-s7.log | tail -2
if [ -f scratch/arms/KILL-broad-s7.bak ]; then
  echo "  幸存者 5P=$(node tools/eval-5p.mjs 12 5 77000 scratch/arms/KILL-broad-s7.bak 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2) 种类=$(node tools/eval-5p.mjs 12 5 77000 scratch/arms/KILL-broad-s7.bak 2>/dev/null | grep -oE '出手种类=[0-9]+'|head -1|cut -d= -f2)"
fi
echo "### ④ 配给起点 + killKinds=4（GD3-RATION，看它是被杀还是活着）"
node tools/probe-cem-arm.mjs $CO --arenaPool=$R --killKinds=4 --killStreak=5 --seed=7 \
  --start=scratch/arms/GD3-RATION.bak --out=scratch/arms/KILL-ration-s7.bak > scratch/kill-ration-s7.log 2>&1
echo "  退出码=$? 产物在? $([ -f scratch/arms/KILL-ration-s7.bak ] && echo 是 || echo 否)"
grep -E "低种类代|被中途淘汰" scratch/kill-ration-s7.log | tail -2
echo "### done $(date +%H:%M:%S)"
