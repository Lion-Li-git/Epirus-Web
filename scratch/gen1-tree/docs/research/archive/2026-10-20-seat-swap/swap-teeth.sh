#!/usr/bin/env bash
# §E668 · 这把"换席尺"的四趟自证（预注册 = docs/research/PREREG-2026-10-20-seat-swap-qoder.md §四）
#   动的是**分析器里给含该池的桌子加的偏移**，不改任何产品文件、不重跑一局 ⇒ 这是"坏了会不会红"的检查，不是读数。
cd /d/code/Epirus-Web || exit 3
A=docs/research/archive/2026-10-20-seat-swap
S=$A/seat-swap-analyze.mjs
BOOT=${BOOT:-20000}
# 只比"读数段"（换席边际 → 符号一致性）：变异档的横幅与"闸② 跳过"那行本来就该不同
NUM='sed -n "/^换席边际 M(x)/,/符号一致性/p"'

node "$S" --boot=$BOOT                      > "$A/swap-teeth-clean.txt.txt" 2>&1; echo "clean rc=$?"   # ⚠ 别写 swap-clean.txt.txt：那是权威的那一趟（BOOT=20000），变异趟只跑 8000，同名会把它盖掉
node "$S" --boot=$BOOT --mutate=random:0    > "$A/swap-mut0.txt.txt"        2>&1; echo "mut0 rc=$?"
node "$S" --boot=$BOOT --mutate=wall:15     > "$A/swap-mut-wall15.txt.txt"  2>&1; echo "mut-wall15 rc=$?"
node "$S" --boot=$BOOT --mutate=antidef:15  > "$A/swap-mut-antidef15.txt.txt" 2>&1; echo "mut-antidef15 rc=$?"
node "$S" --boot=$BOOT --mutate=random:2    > "$A/swap-mut-random2.txt.txt" 2>&1; echo "mut-random2 rc=$?"

echo "--- 自证 A（污染检查）：+0pt 的读数段必须与干净**逐字相同**"
diff <(eval "$NUM" < "$A/swap-teeth-clean.txt.txt") <(eval "$NUM" < "$A/swap-mut0.txt.txt") | head -8
echo "（上面空 = 相同）"
for P in wall15 antidef15 random2; do
  echo "--- 自证 B/C/D：变异 $P ⇒ 被扰动的那个池必须过 Bonferroni"
  eval "$NUM" < "$A/swap-mut-$P.txt.txt" | sed -n 2,9p
  grep -n "过线的对" "$A/swap-mut-$P.txt.txt"
  grep -n "vs " "$A/swap-mut-$P.txt.txt" | head -4
done
echo "ALLDONE $(date '+%F %T')"
