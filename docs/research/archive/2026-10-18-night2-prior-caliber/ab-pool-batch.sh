#!/usr/bin/env bash
# C1 · 给 DS 那条无 SE 的 A/B 补配对分辨率（真池桌：1 席被考 + 4 席按 tier 抽，逐批配对）
#   他印的是 3 枚 × Δ（−0.75 / +0.58 / +0.08，没带 SE、原始行没进仓）。这里把**整个池（hard 13 ‖ soft 16 = 29 枚）**都跑，
#   两臂只差 `--support=`（0 = 裸包 ‖ 2 = 产品档 weighted+skipP0.6），同 seedBase 同批数同盐步长 ⇒ 逐批配对成立。
#   单价实测（23:54:37）：1 枚 × 1 模式 × 10 批（被考+参照两臂 = 1200 场）= **6 秒** ⇒ 29 枚 × 2 模式 × 2 档 ≈ 23 分钟串行。
#   ⚑ 名单签名：subject 会被从对手席摘掉 ⇒ 每枚的签名互不相同 ⇒ **跨枚比"电平"不合法**；
#      但同一枚的 s0/s2 两臂签名相同 ⇒ 枚内配对合法 ⇒ 枚间只许比 Δ（这才是 n=29 那个分母的来源）。
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../../.." && pwd)"     # 4 层，见同班 strength-batch.sh 那条自曝
cd "$REPO" || { echo "⛔ 进不去 REPO=$REPO"; exit 9; }
TMP="$HERE/ab-tmp"; mkdir -p "$TMP"; rm -f "$TMP"/*.tsv 2>/dev/null
LOG="$HERE/ab-pool.runner.log.txt"; : > "$LOG"
BATCHES=${BATCHES:-20}; GAMES=${GAMES:-60}
echo "# C1 A/B（池桌 · 逐批配对）：batch=$BATCHES games=$GAMES ‖ 两臂只差 --support=0/2 ‖ 起 $(date '+%F %T')" >> "$LOG"

n=0
while IFS=$'\t' read -r ID WID PATHP TIER REST; do
  [ -z "$ID" ] && continue
  for MODE in multi long; do
    for SUP in 0 2; do
      OUT="docs/research/archive/2026-10-18-night2-prior-caliber/ab-tmp/${ID}__${MODE}__s${SUP}.tsv"
      if ! node tools/probe-pool.mjs --subject="$ID" --tier="$TIER" --batches="$BATCHES" --games="$GAMES" \
           --modes="$MODE" --support="$SUP" --out="$OUT" >> "$LOG" 2>&1; then
        echo "  ⛔ 失败 $ID $MODE support=$SUP（不补跑别的档来顶）" >> "$LOG"; continue
      fi
      [ -f "$OUT" ] || { echo "  ⛔ 没落盘 $ID $MODE support=$SUP" >> "$LOG"; continue; }
      n=$((n+1))
    done
  done
  echo "  … $ID 完成（累计 $n 格）$(date '+%T')" >> "$LOG"
done < <(tail -n +2 champion-map/pool-members.tsv)

echo "AB_CELLS_DONE $n 格（期望 $(( $(tail -n +2 champion-map/pool-members.tsv | grep -c .) * 4 )) ）$(date '+%F %T')" | tee -a "$LOG"
node "$HERE/analyze-ab-pool.mjs" | tee "$HERE/ab-pool.paired.txt"
