# HANDOFF：11-02 晨班（ZCode 夜班 → 千问；写于 ~01:4x，Phase 4 臂在跑）

## 一、今夜四件定案（全文 `RESULTS-2026-11-02-NIGHT3-zcode.md`，快照 `LIVE-LINES.md` 追记 7）

1. **B 路线零改动收口**：obs3b 面天生集合制（`obs3Scene` 对 alive 全量发席，8P=自己+7 对手全进池；
   NMAX=10 本按 2–10 人设计；policy2.js 镜像同构）。**js/ 未动、指纹未翻**。
   ⚠ **LIVE-LINES 追记 6 的"观测面 5 席硬上限"被本夜证伪**（那是 v7 面的事实，探针量错路径错推广）——
   引用 8P 观测面结论一律以追记 7 为准。
2. **干预全关协议（用户裁定，长期生效）**：gen-3 训练一律 `EPIRUS_BIGT_PUSH=0 EPIRUS_DRAIN_PUSH=0
   EPIRUS_CURSE_PUSH=0 EPIRUS_SUPPORT_PRIOR=0`（train-3p 部署档四键，逐键回执）；考试/报告一律
   `--shipbigt=0 --shipdrain=0`（skill-report 已加旗标+装载补 policy2.js）。**bigT 历史读数全部要标注口径**
   （BIGT_PUSH=12 硬兑现默认开污染三条路；干净口径 GATE4b-s13 bigT=2.98% vs 曾读 39/40）。
3. **基线重测（干净口径，48 局/包 seed 77000）**：GA2R-s13/s41 64.0/64.0 ‖ GA-ration-s41 58.3 ‖ GATE4b-s13 48.6 ‖
   v7 champ 57.6。**8P 首测**：GA-ration-s41 56.9（最强）‖ GA2R-s13 52.9 ‖ GATE4b 系 40.9/44.0。
4. **M-3 负结果**：ration6 教师 16 键标签全谱 + 学生自访全线走通（73.4%），但三发 Adam 蒸馏产物
   在镜像冒烟逐字节同塌（全员蓄能/决胜 0%）——"蒸馏到镜像分布"墙第 4 例（M-2 同族）。
   冒烟闸两次正确拒发，无产物落盘。

## 二、交接给晨班的题（按优先级）

1. **M-3（第一题，03:1x 已翻案）**：四发蒸馏"镜像塌缩"**不是蒸馏病**——全镜像桌蒸馏的学生自访留出 99.5%，
   忠实复刻教师；教师在穷镜像里本来就"只攒不打"（canAffordLater 门把枪/剑/投资块全锁死 ⇒ 零攻击输出）。
   **修法 = 教师加穷桌攻击地板**（枪 2/局不挂经济门，ration2 原样式；剑照旧挂门）然后混桌重蒸——
   "自锁 vs 僵局"的平衡点，改动一行，建议过目后直接做。仪器全在库：`--teacher=ration6` +
   `--arenaShapes=…:rN`（穷富混桌）+ 冒烟闸（exit 12/14；注意它会把"节俭"误判"空转"，判读时看自访留出）。
2. **Phase 4 终局臂读数（02:4x 已完成，`scratch/night3/phase4-review.log` / RESULTS §五）**：
   五臂宽门槛 **5/5 ✔**；本夜最佳 = **GD3ALL-G5-8p-s41**（5P 54.8 ‖ 3P 65.2 ‖ 8P 45.1，但 0 桶线）；
   s13 = 宽+3 线但 31.9；s7/s41 复刻"宽-强不相容"。**在册双强未易主**（GA2R 5P 64.0 / GA-ration-s41 8P 56.9）。
   **坦克/狙击自发涌现证实**（8p-s41 干净 report：狙 8.1%+坦 5.7%）⇒ 兜底条款不触发；**双枪 8P 不自动解开**（0.000）。
3. **双枪 8P 观察**（用户点题）：8P 臂产物跑一份 `skill-report`（8P 表）看双枪是否自发解开；
   坦克/狙击零使用兜底条款：若干净 skill report 仍全零 ⇒ 训练桌补短程对局重蒸（不特训）。

## 三、用户裁定待办（不催，列出）
- 晋升材料：GA2R-s13/s41（64.0/64.0 干净四骰 + 8P 52.9/49.7）、GA-ration-s41（58.3/56.9）——等用户点名。
- 考试/货币改动（收缩 45、经济对手席）、Stage C、§十一五项——白天班既定待办。

## 四、仪器净增（全部默认关/默认 0，带回归腿）
- `EPIRUS_CURSE_PUSH`/`EPIRUS_SUPPORT_PRIOR`（train-3p 部署档，+原有两键=四键回执制）。
- skill-report：`--shipbigt`/`--shipdrain` + policy2 装载（v:92 容器可测）。
- supfit-gd：`--teacher=ration6` ‖ `--regen`/逐形 `:rN`（arena2 经济补贴，进指纹）‖ 炮配额进 DOSE6。
- 8P 训练桌：`node tools/train-3p.mjs 400 8 8 8`（argv[2..5]）；8P 考卷 = `eval-5p.mjs 10 8 81000 <包> --shipbigt=0 --shipdrain=0`。
- 探针：`scratch/probe-obs3b-seats.mjs`（真路径观测集合）/`scratch/probe-smoke-ident.cjs`（M-3 定位用）。

## 五、警告
- **不要不带干预全关旗标跑 gen-3 训练/考试**——那会静默回到"带大雷兑现档"的旧世界，读数不可比。
- LIVE-LINES 追记 6 的 8P 盲区结论已废弃（追记 7 修正）。
- scratch/ 不入库：`scratch/night3/` 下的基线/审读文件只在本机，交接以 RESULTS/本文件数字为准。
