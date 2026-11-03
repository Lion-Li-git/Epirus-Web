#!/usr/bin/env bash
# 11-03 下午（用户"可以试试"）：把冷启动那枚"宽+满手反击+弱"的粒当**起点续训**，
# 用它测两件事：① 会赢的梯度是不是就是窄的梯度（反击族会不会被收掉）；② 用 6 个深度段把"收掉在第几代、值多少分"量成曲线。
# 只读现成件：EPIRUS_SEEDPACK + HOLDOUT_SEG，不改任何训练代码。
set -u
REPO="D:/code/Epirus-Web"; OUT="$REPO/scratch/ga-arms"; LOGD="$REPO/scratch/qoder-basin"; mkdir -p "$LOGD"
run() {
  local arm="$1" seed="$2" pack="$3"; local bd="$REPO/scratch/ga-bands/$arm"; mkdir -p "$bd"
  ( cd "$REPO" || exit 3
    export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$pack" EPIRUS_SEED="$seed" EPIRUS_ARM="$arm"
    export EPIRUS_HOLDOUT_SEG=25 EPIRUS_BAND_DIR="$bd" EPIRUS_T3P_OUT="$OUT/$arm.js"
    node tools/train-3p.mjs 150 5 8 8 > "$LOGD/$arm.log" 2>&1; echo "$arm rc=$?" )
}
echo "发批 $(date '+%H:%M:%S') ‖ 2 臂：宽粒 G3C-s13 续训（种子 13/41）‖ long ‖ 150/8/8 ‖ 存段 25"
pids=()
run BAS-s13 13 scratch/ga-arms/G3C-s13.js & pids+=($!)
run BAS-s41 41 scratch/ga-arms/G3C-s13.js & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done
echo "收批 $(date '+H:%M:%S')"; ls -la "$OUT" | grep BAS || echo '⚠ 无产物'
