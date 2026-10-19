#!/usr/bin/env bash
# §E650 预注册臂（`docs/research/PREREG-2026-10-19-gift-veto-qoder.md`，判据写死在先，不许看完数据再改线）
#   起点 = `v7beadseed-82`（现役 hard，裸包送盾 17.3/20 局 ‖ 14.8/100 局 ⇒ 两个长度都超线）
#   两档 = veto 关（现状逐字）‖ veto 开（`EPIRUS_SEL_GIFT_VETO=1`，线 = `HOLO_GIFT_MAX` 单源）
#   3 粒 seed × 120 代 ⇒ 6 臂。单价实测 120 代 ≈ 81 秒（00:59:52 那次 40 代是 81 秒 ⇒ 120 代按比例 ≈ 3.5 分钟；与 Hp 批并发会更久，**值不受影响**）
#   ⚑ 每臂都会往 `champion-map/pack-aliases.tsv` 追加别名行 ⇒ 跑完由驱动自己还原（测试臂不该污染在册登记），还原与否写进日志。
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../../.." && pwd)"     # 4 层（这一层数错过两次，写在原地）
cd "$REPO" || { echo "⛔ 进不去 REPO=$REPO"; exit 9; }
# ⚑ 起点/臂名可换（PREREG §三.4 要第二个起点才能升格）：`PFX` 同时是臂名前缀与 band 目录前缀，
#   换起点**必须同时换 PFX**，否则两批写同一个日志/同一个目录/同一个 `arms/<臂>.winner.js`（=本班那个"两个写者"病的静态版本）。
PFX="${PFX:-gv}"; TAG="${TAG:-}"
SEEDPACK="${SEEDPACK:-docs/artifacts/v7beadseed-82.bak}"
# ⚑ `VSET` = 要跑哪几档（默认两档都跑）。PREREG §七 那一问只要"训练器自己把当选位推到多少送盾"⇒ 只跑关档，省一半时间。
VSET="${VSET:-0 1}"
LOG="$HERE/gift-veto-arms${TAG}.log.txt"; : > "$LOG"
# ⚑ 单实例锁（本班真实事故的产物：11:2x 我一边跑这个脚本一边改它 ⇒ 旧驱动仍在跑旧逻辑，与新驱动往同一个日志里交错写，
#    日志里同时出现 rc=0/rc=127 与乱序臂名 ⇒ 那批数据整个作废）。改脚本之前必须按 PID 确认老进程已经收干净。
LOCK="$HERE/.gift-veto-arms.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "⛔ 已有一个实例在跑（pid $(cat "$LOCK")）⇒ 拒绝第二个：两个写者往同一个日志追加，事后分不出谁是谁" | tee -a "$LOG"; exit 1
fi
echo $$ > "$LOCK"; trap 'rm -f "$LOCK"' EXIT
[ -f "$SEEDPACK" ] || { echo "⛔ 起点不在盘上：$SEEDPACK" | tee -a "$LOG"; exit 8; }
EXP=$(( 3 * $(echo "$VSET" | wc -w) ))   # ⚑ 期望臂数从 VSET 算出来，**不写死 6**——写死的守卫会在只跑一档的批上骗人
echo "# §E650 臂批：start=$SEEDPACK pfx=$PFX VSET='$VSET' 120代 × 3 seed × {veto=$VSET} ‖ 期望 $EXP 臂 ‖ 起 $(date '+%F %T')" >> "$LOG"
n=0
for SEED in 77000 77001 77002; do
  for V in $VSET; do
    ARM="${PFX}${V}-${SEED}"
    # shellcheck disable=SC2086
    ( export EPIRUS_SEED="$SEED" EPIRUS_ARM="$ARM" EPIRUS_BAND_DIR="docs/artifacts/$PFX-$ARM" \
             EPIRUS_T3P_OUT="docs/artifacts/$PFX-$ARM/out.js" \
             EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$SEEDPACK"
      # §E654 补：原先所有臂共用默认落点 `docs/artifacts/train-3p-out.js` ⇒ ① 下一臂覆写上一臂（"哪臂是谁"只能靠时序），
      #   ② 那次 rc=9 里躺着的是**上一臂**的冠军（01:32 实测把 gv0-77000 登成 gv1-77000），③ 它还写脏了 D123 的基线。
      #   现在每臂有自己的 out.js；根上也加了"没声明不许写默认落点"的闸（train-3p 的 exit 10）。
      # ⚑ 第一版这里写的是 `$ENV_EXTRA node …`（把 `EPIRUS_SEL_GIFT_VETO=1` 存在变量里当前缀赋值）
      #   ⇒ bash 把"VAR=1"当成**命令名**去找，rc=127 立刻失败，日志却长得像"跑完了没印东西"。前缀赋值必须是字面词。
      if [ "$V" = "1" ]; then export EPIRUS_SEL_GIFT_VETO=1; fi
      exec node tools/train-3p.mjs 120 5 8 12 ) > "$HERE/gift-veto-$ARM.log.txt" 2>&1
    rc=$?
    # 每臂跑完**立刻**把当选产物收走：`train-3p-out.js` 是所有臂共用的落点名，下一臂会覆写它 ⇒ 不趁现在收就永远分不清哪臂是谁
    # ⚑ 但**只有 rc=0 才收**：§E589 守卫判"这粒权重已在盘上"时不写产物（退出码 9），那一刻 `train-3p-out.js` 里躺着的是**上一臂**的冠军
    #   ⇒ 照抄就会把上一臂登记成本臂（01:32 实测：gv1-77000.winner.js 的 META arm=gv0-77000，读数 39.24 其实是关档那格的）。
    #   rc=9 那格的权威产物 = 臂日志里 `[band-save] …（当选）` 那一粒，就地落成 `arms/<臂>.winner.js`（这样分析器拿到的拷贝永远自证 META arm 相符）。
    if [ "$rc" = "0" ] && [ -f "docs/artifacts/$PFX-$ARM/out.js" ]; then
      mkdir -p "$HERE/arms"; cp -f "docs/artifacts/$PFX-$ARM/out.js" "$HERE/arms/$ARM.winner.js"
    else
      SEL=$(sed -n "s/^\[band-save\] \(${ARM}-band[0-9]*\)\.bak.*（当选）.*/\1/p" "$HERE/gift-veto-$ARM.log.txt" | head -1)
      if [ -n "$SEL" ] && [ -f "docs/artifacts/$PFX-$ARM/$SEL.bak" ]; then
        mkdir -p "$HERE/arms"; cp -f "docs/artifacts/$PFX-$ARM/$SEL.bak" "$HERE/arms/$ARM.winner.js"
        echo "  ⚑ $ARM rc=$rc ⇒ 没写产物（守卫判已在盘上），权威产物取自（当选）$SEL.bak ⇒ 已落成 arms/$ARM.winner.js" >> "$LOG"
      else
        echo "  ⛔ $ARM rc=$rc 且（当选）那粒找不到（SEL='${SEL:-空}'）⇒ 这一格按读不出处理，别拿别的臂顶" >> "$LOG"
      fi
    fi
    LINE=$(grep -E "^\[送盾闸\]" "$HERE/gift-veto-$ARM.log.txt" | tail -1)
    PROD=$(grep -oE "已写入 [^ ]+\.js|已在 \`?docs/artifacts/[^ \`]+" "$HERE/gift-veto-$ARM.log.txt" | tail -1)
    echo "ARM $ARM rc=$rc ‖ ${LINE:-（veto 关档不印，这是预期的）} ‖ 产物: ${PROD:-没报}" >> "$LOG"
    n=$((n+1))
  done
done
# 测试臂追加的别名行还原掉（在册登记文件不该被实验污染），但**先把被还原的内容留在证据里**
if ! git diff --quiet champion-map/pack-aliases.tsv; then
  git diff champion-map/pack-aliases.tsv > "$HERE/gift-veto${TAG}-aliases-side.diff.txt"
  echo "⚑ pack-aliases.tsv 被本批追加 $(git diff --numstat champion-map/pack-aliases.tsv | awk '{print $1}') 行 ⇒ 已留在 gift-veto${TAG}-aliases-side.diff.txt 后还原" >> "$LOG"
  git checkout -- champion-map/pack-aliases.tsv
fi
# 产物**不删**：后面还要用它们量"裸包送盾（20 与 100 局）"和强度。
# 当选那粒由每臂日志的落盘行指认（不猜 band 号），所以整批 band 文件都收进来。
mkdir -p "$HERE/arms"
for d in docs/artifacts/$PFX-$PFX*/; do
  [ -d "$d" ] || continue
  for f in "$d"*-band*.bak; do [ -f "$f" ] && cp -f "$f" "$HERE/arms/$(basename "$d")--$(basename "$f")"; done
  grep -E "已写入|已在 \`?docs/artifacts" "$HERE/gift-veto-$(basename "$d" | sed "s/^$PFX-//").log.txt" | tail -2 | sed "s|^|  落盘($d): |" >> "$LOG"
done
echo "  arms/ 收了 $(ls "$HERE/arms" 2>/dev/null | wc -l) 份 band 产物" >> "$LOG"
# ⚑ 收尾必须把本批的 band 目录**移出共享产物池**（01:44 实测到的自相矛盾）：
#   上面那步还原了 `pack-aliases.tsv` ⇒ 池里这些 band 立刻变成"未登记的重复" ⇒ 门 D191④ 红（unregistered 0→19）。
#   证据已经收在 `arms/`（分析器优先读它），池里留着只会让下一班以为"重复是我的码造的"。
for d in docs/artifacts/$PFX-$PFX*/; do
  [ -d "$d" ] || continue
  mkdir -p /c/Users/14765/AppData/Local/Temp/epirus-scratch-2026-10-19
  mv "$d" /c/Users/14765/AppData/Local/Temp/epirus-scratch-2026-10-19/ && echo "  移出产物池：$d → Temp/epirus-scratch-2026-10-19/" >> "$LOG"
done
if [ "$n" != "$EXP" ]; then echo "GVARMS_INCOMPLETE $n 臂 ≠ 期望 $EXP（VSET='$VSET'）$(date '+%F %T')" >> "$LOG"; grep -c "^ARM " "$LOG" | sed 's/^/落账臂数: /'; exit 1; fi
echo "GVARMS_DONE $n 臂（期望 $EXP）$(date '+%F %T')" >> "$LOG"
grep -c "^ARM " "$LOG" | sed 's/^/落账臂数: /'
