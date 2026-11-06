#!/usr/bin/env bash
# 冒烟（11-04 晨班）：HOLDOUT_SEG 的段档案 META 现在必须带 ts —— 这是 dedupe 定主名的唯一凭据
set -u
REPO="D:/code/Epirus-Web"; mkdir -p "$REPO/scratch/segts-smoke"
( cd "$REPO" || exit 3
  export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
  export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK='scratch/night4/CB-s13.js' EPIRUS_SEED=13
  export EPIRUS_ARM='SMOKESEGT' EPIRUS_BAND_DIR="$REPO/scratch/segts-smoke" EPIRUS_HOLDOUT_SEG=2
  export EPIRUS_T3P_OUT="$REPO/scratch/segts-smoke/SMOKESEGT.js"
  node tools/train-3p.mjs 6 3 4 4 > "$REPO/scratch/segts-smoke/SMOKESEGT.log" 2>&1
  echo "SMOKESEGT rc=$?" )
echo "--- 段档案落了几枚："
ls "$REPO/scratch/segts-smoke" | grep -c 'seg.*\.bak$'
echo "--- 每枚的 META 首行（必须含 \"ts\"）："
for F in "$REPO"/scratch/segts-smoke/*seg*.bak; do printf '%-16s ' "$(basename "$F")"; sed -n '2p' "$F" | cut -c1-150; done
