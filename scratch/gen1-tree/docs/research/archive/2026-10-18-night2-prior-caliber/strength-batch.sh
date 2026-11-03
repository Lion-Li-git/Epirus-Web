#!/usr/bin/env bash
# §E648 驱动 · 送盾先验三档强度配对（分支 `qoder-1018-night2`）
#   三档：off（关，配对基线）‖ strict（`--support=2 --supportpick=max --supportskip=1` = §E643/§E647 在册那个形状）
#        ‖ prod（`--support=2`，即 v1.7.105 起的产品默认 = weighted + skipP 0.6）
#   目的：① 用 strict 档**逐字复现**归档 `support-strength-E647*.txt` ⇒ 才允许说"B1 的差是档位造成的，不是我改了码"；
#         ② 量 prod 档 vs off 的真实强度差（§E647 那张表量的是已不可复现的形状）。
#   格子用显式"路径 → 名字"表，不靠 shell 变量复用（本仓被 `m.map(Number)` 那类写法咬过）。
#   单价：`eval-5p` 200 局 ≈ 19.3 秒（§E646 实测）⇒ 54 格串行 ≈ 17 分钟（与 Hp 批并发时墙钟会变长，**值不变**：每格同 seed 同参确定性）。
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../../.." && pwd)"
# ↑ 层数是 **4**：docs/research/archive/<这一层>/../../../../ = 仓库根。第一版我写的是 3 层 ⇒ REPO 落在 `docs/`，
#   三道 `[ -f ]` 全判"包不在盘上"、**0 格就跑完了**（本仓 ROOT 层数错是这个班第二次犯，写在原地防复发）。
cd "$REPO" || { echo "⛔ 进不去 REPO=$REPO"; exit 9; }
echo "[gear-check] REPO=$REPO ‖ 第一枚包在盘上？ $([ -f docs/artifacts/v7beadseed-82.bak ] && echo 是 || echo 否)"
OUT="$HERE/strength-E648.log.txt"
LOG="$HERE/strength-E648.runner.log.txt"
: > "$OUT"; : > "$LOG"

PACKS=(
  "v7beadseed-82|docs/artifacts/v7beadseed-82.bak"
  "R-s123|docs/artifacts/e521-out/R-s123.js"
  "bundled-champion-3p|js/bundled-champion-3p.js"
)
GEARS=("off|--support=0" "strict|--support=2 --supportpick=max --supportskip=1" "prod|--support=2")
SEEDS=(77000 77001 77002)
MODES=(multi long)

echo "# §E648 先验三档强度配对：3 枚起点 × 2 模式 × 3 seed × {off,strict,prod} × 200 局（配对同 seed 同座位）" >> "$OUT"
echo "# 分支 qoder-1018-night2 ‖ 起时刻 $(date '+%F %T')" >> "$OUT"

n=0
for pm in "${PACKS[@]}"; do
  NAME="${pm%%|*}"; PATHP="${pm#*|}"
  if [ ! -f "$PATHP" ]; then echo "⛔ 包不在盘上：$PATHP（跳过整枚，不拿别的包顶）" | tee -a "$LOG"; continue; fi
  for MODE in "${MODES[@]}"; do
    for SEED in "${SEEDS[@]}"; do
      for GG in "${GEARS[@]}"; do
        GEAR="${GG%%|*}"; FLAGS="${GG#*|}"
        LINE=$(node tools/eval-5p.mjs 200 5 "$SEED" "$PATHP" --mode="$MODE" $FLAGS 2>>"$LOG" | grep '^\[冠军\] 1st=' || true)
        if [ -z "$LINE" ]; then
          echo "ROW pack=$NAME seed=$SEED mode=$MODE gear=$GEAR PARSE_FAIL" >> "$OUT"
          echo "  ⛔ 空读数 pack=$NAME mode=$MODE seed=$SEED gear=$GEAR（不许当 0）" | tee -a "$LOG"
        else
          FIRST=$(printf '%s' "$LINE" | sed -n 's/.*1st=\([0-9.]*\)%.*/\1/p')
          if ! printf '%s' "$FIRST" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
            echo "ROW pack=$NAME seed=$SEED mode=$MODE gear=$GEAR PARSE_FAIL2 raw=$LINE" >> "$OUT"
            echo "  ⛔ 1st 解析不出：$LINE" | tee -a "$LOG"
          else
            echo "ROW pack=$NAME seed=$SEED mode=$MODE gear=$GEAR 1st=$FIRST%" >> "$OUT"
          fi
        fi
        n=$((n+1))
        if [ $((n % 9)) -eq 0 ]; then echo "  … $n/54 格 $(date '+%T')" | tee -a "$LOG"; fi
      done
    done
  done
done
if [ "$n" != "54" ]; then echo "⛔ 只跑了 $n 格（期望 54）⇒ 这不叫跑完，别看 tail 最后一行就当成功" | tee -a "$LOG"; echo "STRENGTH_INCOMPLETE $n 格 $(date '+%F %T')" | tee -a "$LOG"; exit 1; fi
echo "STRENGTH_DONE $n 格 $(date '+%F %T')" | tee -a "$LOG"
