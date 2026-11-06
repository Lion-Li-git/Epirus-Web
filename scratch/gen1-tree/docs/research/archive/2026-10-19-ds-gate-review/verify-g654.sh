#!/usr/bin/env bash
# §E654 验证驱动：先把 6 条红腿**单跑**（串行，一次一条，避免并发把归因搅浑），
# 再跑一遍全 16 部分并发（= 278 条腿都过一遍），点名台账落在仓库外。
# 规矩：每条命令的计数都从工具自己那行 `通过 X / Y` 抄，不手算；秒数只作"跑过"的证据（同机可能有别的活）。
set -u
cd "$(git rev-parse --show-toplevel)" || exit 9
HERE="$(cd "$(dirname "$0")" && pwd)"
LED="$HERE/../2026-10-19-e651-hp4fix/../2026-10-19-ds-gate-review/write-default.tsv"   # 就放在本目录
LED="$HERE/write-default.tsv"
: > "$LED"
LOG="$HERE/serial-legs.log.txt"
: > "$LOG"
echo "verify start $(date '+%F %T')" >> "$HERE/runner.log.txt"

# ① 单跑那 6 条（D15 是这趟新冒出来的，先前没单独看过）
for D in "D116 " "D123 " "D15 " "D124 " "D125 " "D162 "; do
  t0=$(date +%s)
  node tools/np-test.mjs --only="$D" >> "$LOG" 2>&1
  rc=$?
  t1=$(date +%s)
  LINE=$(grep -E "^N人测试：通过" "$LOG" | tail -1)
  echo "SINGLE [${D% }] rc=$rc 用 $((t1-t0))s ⇒ ${LINE:-（没读到计数行 ⇒ 这条按没跑成处理）}" >> "$LOG"
  echo "  single ${D% } rc=$rc $(date '+%T')" >> "$HERE/runner.log.txt"
done

# ② 全 16 部分并发一轮（jobs=4；带台账）
t0=$(date +%s)
EPIRUS_LOG_DEFAULT_OUT="$LED" node tools/gate-par.mjs --jobs=4 > "$HERE/fullmatrix.log.txt" 2>&1
rc=$?
t1=$(date +%s)
echo "MATRIX rc=$rc 用时 $(( (t1-t0)/60 )) 分钟（jobs=4，全 16 部分）" >> "$HERE/runner.log.txt"
grep -E "^✘ RED|^✔ GREEN|^通过|N人测试" "$HERE/fullmatrix.log.txt" | tail -22 >> "$HERE/runner.log.txt"

# ③ 台账收口：谁还写默认落点（判"声明制"有没有生效）
N=$(wc -l < "$LED")
echo "LEDGER 行数=$N（0 = 除基线声明者外没人再写默认落点）" >> "$HERE/runner.log.txt"
if [ "$N" != "0" ]; then cut -f2 "$LED" | sort | uniq -c >> "$HERE/runner.log.txt"; fi
echo "VERIFY_DONE $(date '+%F %T')" >> "$HERE/runner.log.txt"
