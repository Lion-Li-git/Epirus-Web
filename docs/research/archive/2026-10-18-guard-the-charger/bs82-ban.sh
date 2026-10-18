#!/usr/bin/env bash
# 配对消融重复：同一 seed 同一名次表上比 as-is / 拿掉送盾 / 拿掉蓄能 ⇒ 只报可解析行
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../../../.." && pwd)   # 归仓版：根 = 本脚本所在仓（旧版 cd 到某台机器的临时工作树）
cd "$REPO" || exit 9
LOG=${1:-$HERE/bs82-ban.rerun.log}   # 原始产出 = 本目录 bs82-ban.log；复跑默认不覆盖它
: > "$LOG"
run() {  # $1=mode $2=seed $3=arm-flag $4=games
  local tag="mode=$1 seed=$2 arm=${3:-as-is}"
  local out
  out=$(node tools/eval-5p.mjs "$4" 5 "$2" docs/artifacts/v7beadseed-82.bak $3 --mode="$1" 2>&1)
  local first=$(echo "$out" | grep -oE "^\[(冠军|消融[^]]*)\] 1st=[0-9.]+%" | grep -oE "[0-9.]+%" | head -1)
  local sent=$(echo "$out" | grep -oE "被拿掉的技能在可负担集里 [0-9]+ 次 = [0-9.]+%" | head -1)
  local holo=$(echo "$out" | grep -E "^ *全息屏障" | head -1 | tr -s ' ')
  local rnd=$(echo "$out" | grep -oE "平均回合[^ ]* ?[0-9.]+" | head -1)
  echo "ROW $tag games=$4 1st=$first | 哨兵=$sent | 出牌=$holo | $rnd" >> "$LOG"
}
for s in 77000 77001 77002; do
  run multi $s "" 200; run multi $s "--ban=holo" 200; run multi $s "--ban=ji" 200
done
for s in 77000 77001; do
  run long $s "" 200; run long $s "--ban=holo" 200
done
echo "BS82_DONE $(date +%H:%M:%S)" >> "$LOG"
