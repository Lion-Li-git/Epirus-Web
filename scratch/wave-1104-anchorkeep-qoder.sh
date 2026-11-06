#!/usr/bin/env bash
# 波 C（11-04 千问，接 DS 交接 §三.1）：λ=3 锚 + SEL_KEEP 保链，3 粒种子
# 起点/形状/剂量与 DS 的 ANCH2-*-a3 三粒**逐字同**（同 seed 配对 ⇒ 唯一变量是 SEL_KEEP），
# 判"既宽（λ=3 把种数推到 10~11）又保住链（railgun/charge 不被换成小价键）"成不成立。
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/anchorkeep-1104"; mkdir -p "$OUT"

arm() {  # $1=seed  $2=ANCHOR  $3=SEL_KEEP(0=关)
  local S="$1" A="$2" K="$3"
  local NAME="AK3-s$S"
  [ "$A" = "0" ] && NAME="NA-s$S"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK='scratch/night6/CB3-s13.js' EPIRUS_SEED="$S"
    export EPIRUS_OPP_SWEEP=1 EPIRUS_PAIRED=1 EPIRUS_EFFSKILL_MIN=6 EPIRUS_EFFSKILL_SHARE=0.005
    export EPIRUS_HOLDOUT_SEG=25 EPIRUS_ANCHOR="$A" EPIRUS_ARM="$NAME"
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$NAME"
    export EPIRUS_T3P_OUT="scratch/ga-arms/$NAME.js"
    if [ "$K" != "0" ]; then export EPIRUS_SEL_KEEP="$K" EPIRUS_SEL_KEEP_KEYS='charge,railgun'; else unset EPIRUS_SEL_KEEP EPIRUS_SEL_KEEP_KEYS; fi
    node tools/train-3p.mjs 150 5 24 8 > "$OUT/$NAME.log" 2>&1
    echo "$NAME rc=$? $(date +%H:%M:%S)" ) &
}
for S in 13 7 41; do arm "$S" 3 0.2; done      # 三粒：λ=3 + 保住 charge/railgun 落地量 ≥ 起点 80%
wait
echo "=== 落盘与当选读数（保链有没有换人 / 种数 / arena2）==="
for S in 13 7 41; do
  L="$OUT/AK3-s$S.log"; [ -f "$L" ] || { echo "AK3-s$S 缺日志"; continue; }
  printf 'AK3-s%-3s ' "$S"
  grep -oE "保留 [0-9]+/[0-9]+ 粒[^‖]*|冠军 [0-9]+ 种有效技能|各粒：[0-9,]+|veto 换人|没换人|1st=[0-9.]+%|arena2 [0-9.]+|耗时 [0-9.]+s" "$L" | tr '\n' ' ' | cut -c1-200; echo
done
ls -1 scratch/ga-arms/AK3-*.js 2>/dev/null | sed 's|^|产物入库：|'
