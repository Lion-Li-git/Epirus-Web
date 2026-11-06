#!/usr/bin/env bash
# 波 G（11-04 千问 · 16:05 登记，判据先写在 PREREG §十五）：
#   把 `guardSpam` 那一席从**训练桌**再搬进**当选面**（`EPIRUS_SEL_COUNTER=1` ⇒ 选拔桌 36 对 → 55 对）。
#   病写在 `tools/train-3p.mjs:2547`：只放训练桌不放选拔桌 ⇒ 当选仍按脚本/池分数挑。
# 三批按种子配对：AK3（都不加）→ GK（上桌）→ GKS（上桌 + 进当选面），每次只差一格。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/gks-1104"; mkdir -p "$OUT"
START=scratch/night6/CB3-s13.js
[ -f "$START" ] || { echo "起点不在盘上：$START ⇒ 不起臂"; exit 4; }

arm() {  # $1=seed
  local S="$1" NAME="GKS-s$S"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$START" EPIRUS_SEED="$S"
    export EPIRUS_OPP_SWEEP=1 EPIRUS_PAIRED=1 EPIRUS_EFFSKILL_MIN=6 EPIRUS_EFFSKILL_SHARE=0.005
    export EPIRUS_HOLDOUT_SEG=25 EPIRUS_ANCHOR=3 EPIRUS_ARM="$NAME"
    export EPIRUS_SEL_KEEP=0.2 EPIRUS_SEL_KEEP_KEYS='charge,railgun'
    export EPIRUS_COUNTER_OPPS='guardSpam' EPIRUS_SEL_COUNTER=1
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$NAME"
    export EPIRUS_T3P_OUT="scratch/ga-arms/$NAME.js"
    node tools/train-3p.mjs 150 5 24 8 > "$OUT/$NAME.log" 2>&1
    echo "$NAME rc=$? $(date +%H:%M:%S)" ) &
}
for S in 7 13 41; do arm "$S"; done
wait

echo "=== ① 生效自证（横幅必须印 55 对；印 36 对 ⇒ 整批判'未测到'）==="
for S in 7 13 41; do
  printf 'GKS-s%-3s ' "$S"
  grep -oE "名人堂验证（[0-9]+ 对|判据原型已进训练桌：[^⇒]*" "$OUT/GKS-s$S.log" 2>/dev/null | tr '\n' ' ' | cut -c1-120; echo
done

echo "=== ②③ 逐臂体检（新尺逐格数字）+ 强度 $(date +%H:%M) ==="
for S in 7 13 41; do
  P="scratch/ga-arms/GKS-s$S.js"
  [ -f "$P" ] || { echo "GKS-s$S ⇒ 无产物（看日志尾部原因）"; continue; }
  node tools/promote-champion.mjs "$P" --dry > "scratch/promote-1104/GKS-s$S.txt" 2>&1
  printf 'GKS-s%-3s 阻断 %s ‖ ' "$S" "$(grep -oE '体检未过（[0-9]+ 项阻断条件）|自检通过' "scratch/promote-1104/GKS-s$S.txt" | tail -1)"
  grep -oE "G[45]\[GKS-s$S/(long|multi)\] (最克「[^」]*」|防席夺冠) [0-9.]+%/[0-9]+%（[^）]*）" "scratch/promote-1104/GKS-s$S.txt" | tr '\n' ';'
  for M in long multi; do
    v=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode=$M --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    printf ' 强度%s=%s' "$M" "${v:-NA}"
    printf '%s\t200\t%s\n' "GKS-s$S" "${v:-0}" >> "scratch/night6/strength-$M-fix.tsv"
  done
  echo
done
node scratch/chain-usage-1104.mjs scratch/ga-arms/GKS-s7.js scratch/ga-arms/GKS-s13.js scratch/ga-arms/GKS-s41.js 2>&1 | tail -6
echo "GKS_DONE $(date +%H:%M)"
