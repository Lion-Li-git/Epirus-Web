#!/usr/bin/env bash
# A1b 复验驱动：修完 `pick='max'` 的比较基准（钳过 1 的权重 → 原始 ep）之后，
#   strict 那一档必须**仍然逐字复现 §E647 归档**——不然就是我改错了，或者旧形状本来就不可复现。
#   只跑 strict（18 格）：off 档与 weighted 档都不经这条分支（`SUPPORT_PRIOR >= 1` 且 `pick === 'max'` 才可达），
#   已实测改前/改后 3 格产品档逐字相同（00:47:10），所以 off 不需要重跑。
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../../.." && pwd)"     # 4 层
cd "$REPO" || { echo "⛔ 进不去 REPO=$REPO"; exit 9; }
OUT="$HERE/strength-E648b-strict.log.txt"; LOG="$HERE/strength-E648b.runner.log.txt"
: > "$OUT"; : > "$LOG"
echo "# §E648b A1b 复验：strict 档（--support=2 --supportpick=max --supportskip=1）× 3 起点 × 2 模式 × 3 seed × 200 局" >> "$OUT"
PACKS=("v7beadseed-82|docs/artifacts/v7beadseed-82.bak" "R-s123|docs/artifacts/e521-out/R-s123.js" "bundled-champion-3p|js/bundled-champion-3p.js")
n=0
for pm in "${PACKS[@]}"; do
  NAME="${pm%%|*}"; P="${pm#*|}"
  [ -f "$P" ] || { echo "⛔ 包不在盘上：$P" | tee -a "$LOG"; continue; }
  for MODE in multi long; do
    for SEED in 77000 77001 77002; do
      L=$(node tools/eval-5p.mjs 200 5 "$SEED" "$P" --mode="$MODE" --support=2 --supportpick=max --supportskip=1 2>>"$LOG" | grep '^\[冠军\] 1st=' || true)
      F=$(printf '%s' "$L" | sed -n 's/.*1st=\([0-9.]*\)%.*/\1/p')
      if printf '%s' "$F" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
        echo "ROW pack=$NAME seed=$SEED mode=$MODE gear=strict 1st=$F%" >> "$OUT"
      else
        echo "ROW pack=$NAME seed=$SEED mode=$MODE gear=strict PARSE_FAIL" >> "$OUT"; echo "  ⛔ 空读数 $NAME $MODE $SEED" | tee -a "$LOG"
      fi
      n=$((n+1))
    done
  done
done
if [ "$n" != "18" ]; then echo "⛔ 只跑了 $n 格（期望 18）⇒ 不算跑完" | tee -a "$LOG"; echo "STRENGTHB_INCOMPLETE $n $(date '+%F %T')" | tee -a "$LOG"; exit 1; fi
echo "STRENGTHB_DONE $n 格 $(date '+%F %T')" | tee -a "$LOG"
node "$HERE/verify-e647-repro.mjs" "$HERE/strength-E648.log.txt" "$HERE/strength-E648b-strict.log.txt" | tee -a "$LOG"
