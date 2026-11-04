#!/usr/bin/env bash
# 波 F（11-04 千问）：把"AK3 配方过线率"数到 n=5 —— 判据先写在 PREREG §十四（跑完不许改）
#   配方与 AK3-s7/s13/s41 **逐字同**（ANCHOR=3 + SEL_KEEP=0.2 charge,railgun，起点 CB3-s13，150×5×24×8），只差种子。
#   线：≥3/5 过线才叫"配方能稳定出货"；k≤1 ⇒ 写"撒包不是路"，回到改目标函数/改桌面。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/ak3dice-1104"; mkdir -p "$OUT"
START=scratch/night6/CB3-s13.js
[ -f "$START" ] || { echo "起点不在盘上：$START ⇒ 不起臂"; exit 4; }

arm() {  # $1=seed
  local S="$1" NAME="AK3-s$S"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$START" EPIRUS_SEED="$S"
    export EPIRUS_OPP_SWEEP=1 EPIRUS_PAIRED=1 EPIRUS_EFFSKILL_MIN=6 EPIRUS_EFFSKILL_SHARE=0.005
    export EPIRUS_HOLDOUT_SEG=25 EPIRUS_ANCHOR=3 EPIRUS_ARM="$NAME"
    export EPIRUS_SEL_KEEP=0.2 EPIRUS_SEL_KEEP_KEYS='charge,railgun'
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$NAME"
    export EPIRUS_T3P_OUT="scratch/ga-arms/$NAME.js"
    node tools/train-3p.mjs 150 5 24 8 > "$OUT/$NAME.log" 2>&1
    echo "$NAME rc=$? $(date +%H:%M:%S)" ) &
}
for S in 5 17; do arm "$S"; done
wait
echo "=== 落盘与当选读数 ==="
for S in 5 17; do
  L="$OUT/AK3-s$S.log"; [ -f "$L" ] || { echo "AK3-s$S 缺日志"; continue; }
  printf 'AK3-s%-3s ' "$S"
  grep -oE "保留 [0-9]+/[0-9]+ 粒|冠军 [0-9]+ 种有效技能|各粒：[0-9,]+|1st=[0-9.]+%|耗时 [0-9.]+s" "$L" | tr '\n' ' ' | cut -c1-200; echo
done
ls -1 scratch/ga-arms/AK3-s5.js scratch/ga-arms/AK3-s17.js 2>/dev/null | sed 's|^|产物入库：|'
echo "=== 体检（逐格数字行是新尺）==="
for S in 5 17; do
  P="scratch/ga-arms/AK3-s$S.js"
  [ -f "$P" ] || { echo "AK3-s$S 无产物 ⇒ 看日志尾部"; continue; }
  node tools/promote-champion.mjs "$P" --dry > "scratch/promote-1104/AK3-s$S.txt" 2>&1
  printf 'AK3-s%-3s 阻断 %s ‖ ' "$S" "$(grep -oE '体检未过（[0-9]+ 项阻断条件）|自检通过' "scratch/promote-1104/AK3-s$S.txt" | tail -1)"
  grep -oE "G[45]\[AK3-s$S/(long|multi)\] (最克「[^」]*」|防席夺冠) [0-9.]+%/[0-9]+%（[^）]*）" "scratch/promote-1104/AK3-s$S.txt" | tr '\n' ';'
  for M in long multi; do
    v=$(node tools/eval-5p.mjs 200 5 77000 "$P" --mode=$M --shipbigt=0 --shipdrain=0 2>/dev/null | grep -oE '\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
    printf '强度%s=%s ‖ ' "$M" "${v:-NA}"
    printf '%s\t200\t%s\n' "AK3-s$S" "${v:-0}" >> "scratch/night6/strength-$M-fix.tsv"
  done
  echo
done
node scratch/chain-usage-1104.mjs scratch/ga-arms/AK3-s5.js scratch/ga-arms/AK3-s17.js 2>&1 | tail -6
echo "=== 五粒一张表（判 ≥3/5 这条线）==="
node scratch/morning1104-g45-gap.mjs scratch/promote-1104 2>&1 | grep -E "^AK3|满足|判据（用户"
echo "WAVE_F_DONE $(date +%H:%M)"
