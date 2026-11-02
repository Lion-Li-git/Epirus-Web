#!/usr/bin/env bash
# run-dda-150.sh — 防御线（对手面）与摄魂线（教师/示范）的**短臂对拍**（qoder 11-02 午后，用户点头"都先开短的并行"）
# 唯一变量各一臂：
#   ctrl = 现配方（GATE4b 那套：GD3-SWORD 热启动 + GATE=3/GAMES=6/BAND=0.13 + WIDE_FINAL + HALL_TRACE + BIGT_PUSH=12 + 8 型 counter opps）
#   gun  = ctrl + `EPIRUS_COUNTER_OPPS` 里**多一型 gunFocus**（只枪·击杀优先；10-23 定过的口径——gunSpam 是"打最肥"，不是真只枪）
#   dra  = ctrl + 示范族（教师 aggro：它的第一优先就是 `hp<=1 ∧ 出得起 ⇒ 摄魂`；only=drain ⇒ 只在那张卡上覆盖/计分；FRAC=1 ⇒ 全程退火窗，β(gen0)>0 由消费点行为式读回，否则 exit 7）
# 长度 150 代（400 代的 3/8），三臂并发；产物落 scratch/ga-arms/，日志落 scratch/。
cd "$(dirname "$0")/.." || exit 1
GENS=150
COMMON=(EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE=seg EPIRUS_HOTSTART=1
  EPIRUS_SEEDPACK=scratch/arms/GD3-SWORD.bak
  EPIRUS_COUNTER_OPPS=targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver
  EPIRUS_GA_GATE=3 EPIRUS_GA_GATE_GAMES=6 EPIRUS_GA_BAND=0.13 EPIRUS_WIDE_FINAL=1 EPIRUS_HALL_TRACE=1
  EPIRUS_BIGT_PUSH=12 EPIRUS_SEED=13)
run() { # $1=臂名 $2..=额外 env
  local arm="$1"; shift
  echo "[start] $arm $(date +%H:%M:%S)" >> scratch/dda-150.log
  env "${COMMON[@]}" "$@" EPIRUS_ARM="$arm" EPIRUS_T3P_OUT="scratch/ga-arms/$arm.js" \
    node tools/train-3p.mjs "$GENS" 3 8 8 > "scratch/$arm.log" 2>&1
  echo "[end]   $arm 退出码=$? $(date +%H:%M:%S)" >> scratch/dda-150.log
}
: > scratch/dda-150.log
run DDA-150-ctrl-s13 &
run DDA-150-gun-s13 EPIRUS_COUNTER_OPPS=targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver,gunFocus &
run DDA-150-dra-s13 EPIRUS_IMIT_OVERRIDE=1 EPIRUS_IMIT_TEACHER=aggro EPIRUS_IMIT_ONLY=drain EPIRUS_IMIT_FRAC=1 &
wait
echo "[done] $(date +%H:%M:%S)" >> scratch/dda-150.log
