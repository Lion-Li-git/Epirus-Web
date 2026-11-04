#!/usr/bin/env bash
# 波 E′ 读账（11-04 千问）：三粒 GK 产物一次量齐 ⇒ 判 guardSpam 上桌买不买得到 G5
#   判据先写在 PREREG §十二（跑完不许改）：配对三粒里 ≥2 粒 ΔG5 ≤ −10pt 且 ΔG4 ≤ 0。
# 顺序：① 先核"这杆真被调用"（横幅必须点名 cnt:guardSpam）——没上桌的臂一律判"未测到"；
#       ② promote --dry（带新尺的逐格数字行）；③ 200 局强度；④ 同尺键份额（种数/链）；⑤ 配对判读。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/gk-1104"; mkdir -p "$OUT"

echo "=== ① 上桌自证（每臂都要有 cnt:guardSpam 那一行，否则整批判'未测到'）==="
for S in 7 13 41; do
  printf 'GK-s%-3s ' "$S"
  grep -oE "判据原型已进训练桌：[^⇒]*|OPPS 从 [0-9]+ 个变 [0-9]+ 个" "$OUT/GK-s$S.log" 2>/dev/null | tr '\n' ' ' || echo -n "（日志缺）"
  echo
done

echo "=== ②③④ 逐臂体检 + 强度 + 键份额 $(date +%H:%M) ==="
for S in 7 13 41; do
  P="scratch/ga-arms/GK-s$S.js"
  [ -f "$P" ] || { echo "GK-s$S ⇒ 无产物（看 $OUT/GK-s$S.log 尾部原因）"; continue; }
  node tools/promote-champion.mjs "$P" --dry > "scratch/promote-1104/GK-s$S.txt" 2>&1
  printf 'GK-s%-3s 阻断 %s ‖ ' "$S" "$(grep -oE '体检未过（[0-9]+ 项阻断条件）|自检通过' "scratch/promote-1104/GK-s$S.txt" | tail -1)"
  for M in long multi; do
    v=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode=$M --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    printf '强度%s=%s ‖ ' "$M" "${v:-NA}"
    printf 'GK-s%s\t200\t%s\n' "$S" "${v:-0}" >> scratch/night6/strength-$M-fix.tsv
  done
  echo
done
node scratch/chain-usage-1104.mjs scratch/ga-arms/GK-s7.js scratch/ga-arms/GK-s13.js scratch/ga-arms/GK-s41.js 2>&1 | tail -8

echo "=== ⑤ 配对判读（主判据在这里）$(date +%H:%M) ==="
node scratch/gk-vs-ak3-paired-1104.mjs 2>&1
echo "GK_VERDICT_DONE $(date +%H:%M)"
