#!/usr/bin/env bash
# §十四 另一半：蒸馏路的珠冒烟改成**产品门 `bead` 同尺**（过期 ≤5 颗/局 绝对量 ‖ 得珠=0 ⇒ 不适用），
# 量具共用 `audit-lib.chargeProfile`（长程 n=40）。三条腿：
#   ① 默认关（不给 --smoke）⇒ 产物与 HEAD 版**逐字节同**（改动碰不到关档路径）
#   ② 牙：`--teacher=ration4`（在册"只攒不放"那档：得珠 1324 花 0）开 --smoke ⇒ 期望 **rc=14 拒写产物**
#   ③ 对照：`--teacher=ration3` 开 --smoke ⇒ 珠账行必须打印（证明真调用），判语按读数、不预设
# ⚠ 喂 node 的路径一律仓库相对
set -u
cd /d/code/Epirus-Web || exit 1
export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1'
LOG=scratch/bead-smoke.log
: > $LOG
SUPBASE="--upstream=scratch/arms/GD3-RATION.bak --groups=800 --steps=400 --lr=0.02 --pool=1200 --shapeBal=1 --keySplit=1 --objective=key"

sum() { node -e "const fs=require('fs'),cr=require('crypto');const t=fs.readFileSync(process.argv[1],'utf8');console.log(cr.createHash('md5').update(t).digest('hex').slice(0,12));" "$1"; }

echo "### ① 默认关 ⇒ HEAD vs 新版逐字节同" >> $LOG
git show HEAD:tools/proto2/supfit-gd.mjs > tools/proto2/.v3beadhead.mjs
node tools/proto2/.v3beadhead.mjs $SUPBASE --teacher=ration3 --out=scratch/arms/BEAD-head.bak > scratch/bead-head.log 2>&1
RH=$?
rm -f tools/proto2/.v3beadhead.mjs
node tools/proto2/supfit-gd.mjs $SUPBASE --teacher=ration3 --out=scratch/arms/BEAD-ref.bak > scratch/bead-ref.log 2>&1
RE=$?
echo "  HEAD rc=$RH  新版 rc=$RE  摘要 HEAD=$(sum scratch/arms/BEAD-head.bak) 新版=$(sum scratch/arms/BEAD-ref.bak)" >> $LOG
[ "$(sum scratch/arms/BEAD-head.bak)" = "$(sum scratch/arms/BEAD-ref.bak)" ] && echo "  逐字节同 ✔（默认关没被动到）" >> $LOG || echo "  ⛔ 不同 ⇒ 关档路径被动到了" >> $LOG
echo "  新版关档时珠账行打印=$(grep -c '与门 bead 同尺' scratch/bead-ref.log)（必须 0）" >> $LOG

echo "### ② 牙：ration4（在册只攒不放）+ --smoke ⇒ 期望 rc=14 且不写产物" >> $LOG
rm -f scratch/arms/BEAD-r4.bak
node tools/proto2/supfit-gd.mjs $SUPBASE --teacher=ration4 --smoke=40 --out=scratch/arms/BEAD-r4.bak > scratch/bead-r4.log 2>&1
echo "  rc=$?（期望 14）‖ 产物存在=$([ -f scratch/arms/BEAD-r4.bak ] && echo 是 || echo '否 ✔ 没写')" >> $LOG
grep -E "与门 bead 同尺|冒烟红" scratch/bead-r4.log | tail -3 | sed 's/^/    /' >> $LOG

echo "### ③ 对照：ration3 + --smoke ⇒ 珠账必须打印，判语按读数" >> $LOG
node tools/proto2/supfit-gd.mjs $SUPBASE --teacher=ration3 --smoke=40 --out=scratch/arms/BEAD-r3.bak > scratch/bead-r3.log 2>&1
echo "  rc=$? ‖ 珠账行=$(grep -c '与门 bead 同尺' scratch/bead-r3.log)（必须 1）" >> $LOG
grep -E "行为冒烟|与门 bead 同尺|冒烟红" scratch/bead-r3.log | tail -4 | sed 's/^/    /' >> $LOG
echo "### done $(date +%H:%M)" >> $LOG
cat $LOG
