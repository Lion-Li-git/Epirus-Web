#!/usr/bin/env bash
# 验 DAgger 修法：①默认路径 md5 不许变 ②dagger=1 必须换粒（否则当场 exit 7）③换粒之后大雷是否解锁
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
UP=scratch/arms/OB3S-C2-s7.bak
FLAGS="--groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"
echo "### ① 默认路径回归腿 $(date +%H:%M:%S)"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --out=scratch/arms/REG-chain-1101c.bak > scratch/reg-chain-1101c.log 2>&1
md5sum scratch/arms/REG-chain-1101c.bak scratch/arms/gd3b-ks-sb.bak
echo "### ② dagger=1 + 靶向（bigT）"
node tools/proto2/supfit-gd.mjs --upstream=$UP $FLAGS --teacher=bigt --dagger=1 --rareOnly=bigT --rareFrac=0.5 --out=scratch/arms/GD3-BIGT3.bak > scratch/gd3-bigt3.log 2>&1
grep -E "粒子自证|轮 1|逐键|产物|⛔" scratch/gd3-bigt3.log | tail -6
md5sum scratch/arms/GD3-BIGT3.bak scratch/arms/GD3-BIGT.bak 2>/dev/null
echo "### ③ 审计（大雷解锁了吗）"
node tools/proto2/skill-mastery.mjs --pack=scratch/arms/GD3-BIGT3.bak --games=40 --out=scratch/mt-GD3-BIGT3.json > scratch/mastery-GD3-BIGT3.log 2>&1
grep -E "会大雷|会聚能环|会电磁炮|会激光眼|珠经济" scratch/mastery-GD3-BIGT3.log | tail -5
f5=$(node tools/eval-5p.mjs 12 5 77000 scratch/arms/GD3-BIGT3.bak 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
f3=$(node tools/eval-5p.mjs 12 3 77000 scratch/arms/GD3-BIGT3.bak 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
printf "GD3-BIGT3 5P=%s 3P=%s\n" "$f5" "$f3"
node tools/proto2/breadth2.mjs --pack=scratch/arms/GD3-BIGT3.bak 2>&1 | tail -3
echo "### done $(date +%H:%M:%S)"
