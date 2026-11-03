#!/usr/bin/env bash
# 11-03 T1 接线臂（qoder）：配方 = CBG-s13 **逐字同**（同起点包 / 同 seed 13 / 同 150×5P×pop8×games8 / HOLDOUT_SEG=25），
#   唯一多出来的 = EPIRUS_SEL_GRID（当选面按族别签名分格取最稀格）。
# 两根腿（都在这一臂里同时读）：
#   ① 回归：`gen` 行必须与 scratch/qoder-afternoon/CBG-s13.log **逐字同**（这根键只碰演化之后的选择层 ⇒ 演化一字不动）；
#   ② 回执：`[分格选人] 整池格表` + 带内梯 + 改判/未改判 ⇒ 换任何带宽会选谁可离线重算（不必为试带宽再跑一臂）。
# 带宽取 8pt 是**诊断档**（要让 band3/band4 进得来），不是产品建议；产品档从格表里推。
set -u
REPO="D:/code/Epirus-Web"
ARM="CBGG-s13"
mkdir -p "$REPO/scratch/qoder-t1" "$REPO/scratch/ga-bands/$ARM"
( cd "$REPO" || exit 3
  export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1'
  export EPIRUS_MUT_MODE='seg'
  export EPIRUS_TRAIN_MODE='long'
  export EPIRUS_HOTSTART=1
  export EPIRUS_SEEDPACK='scratch/night4/CB-s13.js'
  export EPIRUS_SEED=13
  export EPIRUS_ARM="$ARM"
  export EPIRUS_HOLDOUT_SEG=25
  export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/$ARM"
  export EPIRUS_T3P_OUT="$REPO/scratch/ga-arms/$ARM.js"
  export EPIRUS_SEL_GRID=8
  export EPIRUS_SEL_GRID_MODE=long
  export EPIRUS_SEL_GRID_GAMES=12
  node tools/train-3p.mjs 150 5 8 8 > "$REPO/scratch/qoder-t1/$ARM.log" 2>&1
  echo "$ARM rc=$?" )
echo "--- ① 逐代行回归（应为空 = 演化一字未动）"
diff <(grep '^gen ' "$REPO/scratch/qoder-afternoon/CBG-s13.log") <(grep '^gen ' "$REPO/scratch/qoder-t1/$ARM.log") \
  && echo "gen 行逐字同 ✓（$(grep -c '^gen ' "$REPO/scratch/qoder-t1/$ARM.log") 行）"
echo "--- ② 分格选人回执"
grep -n '分格选人' "$REPO/scratch/qoder-t1/$ARM.log"
echo "--- 当选前后"
grep -n 'band-save\]\|已写入\|防御选人' "$REPO/scratch/qoder-t1/$ARM.log" | tail -10
