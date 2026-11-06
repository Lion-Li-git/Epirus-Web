# 交接：11-03 夜收尾 → GLM（DS）

> 用户 23:02 令：停跑、收尾、剩余交 GLM。当前**无任何训练任务在跑**；停掉的三臂（`EFFG-s13/s41/s7`）无产物。

## 一、今天落地的能力（代码，全部已提交、未推）
| 提交 | 内容 |
|---|---|
| `a6993046` | 评估修复：新增 `EPIRUS_OPP_SWEEP`（每代覆盖全部对手，默认关逐位不变）+ 24 局/配对/轮齐三臂对照 |
| `e618aefe` | 宽起点 + 干净评估：种数 10/10/11 保住，但 arena2 全弱、G4 100% 被单脚本打穿 |
| `d3f36c3f` | 蒸馏 v7 宽教师 A 案：修 `packPick` 透传 legal、教师 temp 0.15→0.05、采样改 5P+shapeBal |
| `f28ef519` | obs3c 验证：`reflect/guard` 留出 0%→17%/50%（特征可分），但 GA 50/150 代仍壁盆 |
| `943ae9d4` | **宽度判据改为"有效技能数"**（非ジ成功出手份额 ≥0.5% 的键数），`maxLandShare` 降为记录 |
| （本笔） | `EPIRUS_EFFSKILL_MIN` 量具接线修复（原来只在 BREADTH_FLOOR/SEL_LAND/SEL_KEEP 开时才跑 mirrorHealth） |

## 二、已验证的读数（可直接引用）
1. **评估噪声**：同权重隔代重测的 `挡` 差中位 0.167（8 局）vs 种群逐代移动 0.116 ⇒ 比值 **1.44**；改 24 局+配对+轮齐后 **0.41~0.64**，且旧配方 3 粒里 1 粒塌成 bigT 单极（arena2 0、种数 1）而新配方三粒全 ≥0.25、种数 4~6；
2. **宽度**：`WIDTH_W` 0.05/0.15 无效（种数 2~5、均值 0.319→0.139）；0.5 档不抬种数（5/5/5，低于起点 6）但**压住塌尾**；
3. **宽起点 + 干净评估**：从 11 种 `CB-s13` 续 50 代，FIX 保 10/10/11 种、OLD 掉 9/10/5；但 arena2 全弱、G4 被只枪/只狙 **100%** 打穿、G5 防席 50~97%；
4. **obs3c**：蒸馏层 `guard` 0→50%、`reflect` 0→17%、产物 7 种；GA 50 代不稳（7/6/1 种），150 代防御被洗掉且 arena2 −0.06/−0.13；
5. **有效技能数**（新判据，20 局 multi 镜）：`L5-D4a` 6 ‖ `CB-s13` 6（旧判据 91% bigT 会误判塌缩）‖ `VDIST7-OC3` 8 ‖ `OC3GATE-s41` 10 ‖ `WIDEFIX-s7` 6。

## 三、关键旋钮（全部默认关，逐字可逆）
- `EPIRUS_PAIRED=1`：同代同批局（配对评估）；
- `EPIRUS_OPP_SWEEP=1`：座位 `(g*4+k+gen*4)%L`，每代覆盖全部对手（旧公式每代 11/17）；
- `EPIRUS_POPSTAT=1 [POPSTAT_K] [POPSTAT_OUT]`：逐代种群统计 JSONL（默认写 `scratch/popstat/<ARM>.jsonl`）；噪声比用 `scratch/noise-ratio.mjs` 算；
- `EPIRUS_EFFSKILL_MIN=<k>` + `EPIRUS_EFFSKILL_SHARE=<0.005>`：有效技能数下限（**宽度判据**）；
- `EPIRUS_BREADTH_FLOOR`/`EPIRUS_BREADTH_FATAL`：旧"落地份额"判据（**已被用户否掉，别再用**）；`BREADTH_FATAL=1` 仍是"全不合格 ⇒ exit 7 不落盘"的开关，EFFSKILL_MIN 共用它；
- `EPIRUS_HOLDOUT_SEG=25`：每 25 代当场落段（SIGKILL 也留得住，qoder 验过）。

## 四、坑（都踩过，写下来防复发）
1. **闸默认关**：`BREADTH_FLOOR`/`EFFSKILL_MIN` 默认 0 ⇒ 今天的批必须先确认横幅/读回，否则 1 种卡的包会一路写到底（已加 fatal）；
2. **量具接线**：`mirrorHealth` 那段只在 `BREADTH_FLOOR||SEL_LAND||SEL_KEEP` 开时跑 ⇒ 只开 EFFSKILL_MIN 会读到 0（本笔已修，加进条件）；
3. `maxLandShare` **不是**宽度判据（用户 11-03 裁定：大雷主输出 + 防御攒资源 + 小技能收尾不算窄）；
4. `train-3p` 参数序是 `[代][人数][每代局数][种群]`（我按 `50 5 8 24` 发错过）；
5. `gate-drafts` 吃**位置参数**（`node tools/gate-drafts.mjs <pack>`），不是 `--pack=`；
6. obs3c 进不了产品（`js/train/policy2.js:260` 只认 obs3|obs3b）；`scratch/convert-obs3c.mjs` 是 obs3b→obs3c 的转换器；
7. `supfit-gd` 的 `pack:` 教师：温度 0.15 下防御族≈0；采样默认 11 桌形会把配额填在 3P 上 ⇒ 要用 `--arenaShapes=5:long,5:multi --shapeBal=1`。

## 五、停在哪、下一步建议（给 GLM）
- 停在三臂 `EFFG-*`（150 代、24 局、`EFFSKILL_MIN=6` fatal、起点 `L5-D4a`）刚重发就被停 ⇒ **无产物**；重跑即可（约 20 分钟/臂，3 并发）；
- 建议顺序：① 重跑 EFFG 三臂，看"闸内能不能造出 ≥8 有效技能且 arena2 ≥0.25"；② 若不行，做一次"有效技能数 vs 强度"的 2×2（起点 × 闸），确认闸本身不制造壁盆；③ obs3c 只有在 ① 出包后才值得谈 policy2 支持；
- 不建议再投：`WIDTH_W` 任何档、落地份额判据、obs3c 加大数据量（1600 组/2000 步已证明过冲）。
