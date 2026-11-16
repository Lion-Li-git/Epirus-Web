#!/bin/bash
# run-promote-family-1117.sh —— 15 枚 promote --dry --json 落 staging blob（jobs=5 并行）
cd /d/code/Epirus-Web || exit 1
PACKS=(
  "EQ-S4-GD6ATEACH|docs/artifacts/obs6-coldstart/EQ-S4-GD6ATEACH.bak"
  "OBS6-SHAPEDIST|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST.bak"
  "OBS6-SHAPEDIST-V2|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V2.bak"
  "OBS6-SHAPEDIST-V2S0|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V2.snap0.bak"
  "OBS6-SHAPEDIST-V3a|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3a.bak"
  "OBS6-SHAPEDIST-V3b|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3b.bak"
  "OBS6-SHAPEDIST-V3S2|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3S2.bak"
  "OBS6-SHAPEDIST-V3H3|docs/artifacts/obs6-coldstart/OBS6-SHAPEDIST-V3H3.bak"
  "OBS6B2|docs/artifacts/obs6-coldstart/OBS6B2.bak"
  "OBS6-UNIFIED-U1|docs/artifacts/obs6-coldstart/OBS6-UNIFIED-U1.bak"
  "OBS6-UNIFIED-U2S0|docs/artifacts/obs6-coldstart/OBS6-UNIFIED-U2.snap0.bak"
  "OBS6-UNIFIED-U4S0|docs/artifacts/obs6-coldstart/OBS6-UNIFIED-U4.snap0.bak"
  "OBS6-UNIFIED-U4|docs/artifacts/obs6-coldstart/OBS6-UNIFIED-U4.bak"
  "OBS6-UNIFIED-US1|docs/artifacts/obs6-coldstart/OBS6-UNIFIED-US1.bak"
  "OBS6-UNIFIED-US5|docs/artifacts/obs6-coldstart/OBS6-UNIFIED-US5.bak"
)
run_one() {
  IFS='|' read -r ID P <<< "$1"
  OUT="champion-map/staging/${ID}-audit.json"
  if [ -s "$OUT" ]; then echo "↷ 已有 $ID"; return; fi
  RES=$(node tools/promote-champion.mjs "$P" --dry --games=10 --exam-games=20 --json 2>&1)
  LINE=$(printf '%s\n' "$RES" | grep "^EPIRUS_JSON " | tail -1)
  if [ -n "$LINE" ]; then
    printf '%s\n' "${LINE#EPIRUS_JSON }" > "$OUT"
    echo "✅ $ID"
  else
    echo "⛔ $ID 无 EPIRUS_JSON：$(printf '%s\n' "$RES" | tail -2 | head -c 200)"
  fi
}
export -f run_one 2>/dev/null
i=0
for p in "${PACKS[@]}"; do
  run_one "$p" &
  i=$((i+1))
  if (( i % 5 == 0 )); then wait; fi
done
wait
echo "=== 全部完成 ==="
ls champion-map/staging/*-audit.json | wc -l
