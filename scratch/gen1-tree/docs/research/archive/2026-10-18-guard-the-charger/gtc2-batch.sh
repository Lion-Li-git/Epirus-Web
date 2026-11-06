#!/usr/bin/env bash
# §E643 二 成对臂（churn vs churnSham，挑人规则一字不差、只差这一手给不给盾；300 局/格）。
# 原始产出 = 本目录 gtc2.data.log（+ 收尾行 gtc2.tail.log）。
# ⚑ 旧版这行写成了 `>> "$LOG 2>&1"` ⇒ bash 把 `2>&1` 吞进文件名 ⇒ 真数据落在字面叫 `gtc2.log 2>&1` 的文件里、
#   `$LOG` 里只剩收尾行。归仓时那两个文件都留了（改名 gtc2.data.log / gtc2.tail.log），2>&1 已收回引号外。
# 归仓版（2026-10-18）：根 = 本脚本所在仓；复跑默认写 .rerun.log。
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
cd "$REPO" || exit 9
LOG=${1:-$HERE/gtc2-batch.rerun.log}
: > "$LOG"
for shape in "aggro,gunspam,focusfire,deepsaver" "deepsaver,deepsaver,aggro,gunspam"; do
  for arm in churn churnSham asis; do
    echo "=== shape=[$shape] arm=$arm" >> "$LOG"
    node tools/guard-the-charger.mjs --arm=$arm --games=300 --seats="$shape" >> "$LOG" 2>&1
  done
done
echo "GTC2_DONE $(date +%H:%M:%S)" >> "$LOG"
