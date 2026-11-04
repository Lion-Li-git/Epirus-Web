#!/usr/bin/env bash
# 波 D 读账（11-04 千问）：三臂冷启动产物一次量齐 ⇒ 判"好方法能不能让冷启动跑长代出有用的包"
# 每臂四件事：① promote --dry（全部阻断项）‖ ② 强度 200 局 long/multi‖ ③ 同尺键份额（chain-usage-1104.mjs）
#              ‖ ④ 存段复排用的段档案（HOLDOUT_SEG=100 已落，这里只点名有几枚）
# 判据（PREREG §八 先写死的）：差项数 ≤1 ∧ % 类超限 ≤15pt ⇒ "有用"；
#   覆盖锚要赢还须：种数 ≥ 裸臂 ∧ railgun+charge > 0 ∧ 强度与裸臂差 ≥ −3pt。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/promote-1104"; mkdir -p "$OUT"
for N in CB13 CG13 CA13; do
  P="scratch/ga-arms/$N.js"
  [ -f "$P" ] || { echo "$N ⇒ 无产物（看 $N.log 尾部原因）"; continue; }
  echo "── $N $(date +%H:%M)"
  node tools/promote-champion.mjs "$P" --dry > "$OUT/$N.txt" 2>&1
  printf '   阻断 %s ‖ ' "$(grep -oE '体检未过（[0-9]+ 项阻断条件）|体检通过|自检通过' "$OUT/$N.txt" | tail -1)"
  for M in long multi; do
    v=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode=$M --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    printf '强度%s=%s ‖ ' "$M" "${v:-NA}"
    printf '%s\t200\t%s\n' "$N" "${v:-0}" >> "scratch/night6/strength-$M-fix.tsv"
  done
  printf '段档案 %s 枚\n' "$(ls scratch/ga-bands/$N/*seg*.bak 2>/dev/null | wc -l)"
done
echo "=== 同尺键份额（对脚本场 60 局）==="
node scratch/chain-usage-1104.mjs scratch/ga-arms/CB13.js scratch/ga-arms/CG13.js scratch/ga-arms/CA13.js 2>&1 | tail -8
echo "=== 全库一张表 ==="
node scratch/morning1104-g45-gap.mjs scratch/night6/promote,scratch/promote-1104 2>&1 | sed -n '1,6p;29,34p'
