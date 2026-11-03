#!/usr/bin/env bash
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2=S1ob:input=obs3b,keySplit=1
echo "### 回归腿：默认 --teacher=chain 必须与在册 gd3b-ks-sb 逐位同"
node tools/proto2/supfit-gd.mjs --upstream=scratch/arms/OB3S-C2-s7.bak --groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key --out=scratch/arms/REG-chain-1101.bak > scratch/reg-chain-1101.log 2>&1
md5sum scratch/arms/REG-chain-1101.bak scratch/arms/gd3b-ks-sb.bak | tee -a scratch/reg-chain-1101.log
echo "### 牙：未知教师名必须当场拒"
node tools/proto2/supfit-gd.mjs --upstream=scratch/arms/OB3S-C2-s7.bak --teacher=bogus --groups=20 --out=scratch/arms/TEETH-bogus.bak 2>&1 | tail -1
echo "### 新教师 bigt 冒烟（小档：groups=200）"
node tools/proto2/supfit-gd.mjs --upstream=scratch/arms/OB3S-C2-s7.bak --teacher=bigt --groups=200 --steps=200 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key --out=scratch/arms/SMOKE-bigt.bak > scratch/smoke-bigt.log 2>&1
grep -E "bigT|大雷|留出|agree" scratch/smoke-bigt.log | tail -6
echo "### 新教师 lasereye 冒烟"
node tools/proto2/supfit-gd.mjs --upstream=scratch/arms/OB3S-C2-s7.bak --teacher=lasereye --groups=200 --steps=200 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key --out=scratch/arms/SMOKE-laser.bak > scratch/smoke-laser.log 2>&1
grep -E "laser|激光|留出|agree" scratch/smoke-laser.log | tail -6
echo "### done $(date +%H:%M:%S)"
