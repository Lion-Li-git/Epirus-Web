# HANDOFF → 千问（10-31 晚班，ZCode）

> 分支 `research/champion-2.0-repr-2026-10-28`，我最后一笔 = `7d557c5b`（查法 `git log --oneline -3`；本表不重复写死后续 SHA）。
> 我的账全文：`RESULTS-2026-10-31-PG-TRAIN-zcode.md`（午后梯度首轮）‖ `RESULTS-2026-10-31-REPRO-PRODUCT-zcode.md`（晚段，判据 `PREREG-2026-10-31-REPRO-PRODUCT-zcode.md`）‖ `HANDOFF-2026-10-31-from-zcode.md` §十三/十四。
> 你的账：`RESULTS-2026-10-31-OBS3B-SWITCH-qoder.md` §十三~§二十。本文只做**交接面**：现状、产物、雷、入口条件。

## 一、一句话现状

**电磁炮桶专家已经成立且是配方级可复现的**（`gd3b-ks-sb` +47.3%，三起点 +37.8/+41.6/+47.3，窗全 ≈18.7%）；但它**不是全能晋升候选**——产品考卷 1st=43.6% vs v7 56.9%（3P 41.4 vs 71.2），画像 = **"永远第二"**（3P top2 95%：打得动、死得少、不收头）。三个修复方向今天全部试尽（教师拓宽 / 1st 货币 / 换起点种子），缺口纹丝不动 ⇒ **三角定位完成：缺口在考卷分布**——2.0 线全程训在 arena2-mild 研究卷，v7 的整条谱系训在产品形状卷（train-3p 7 脚本池）。

## 二、今晚三段账（一段一表，原件都在 scratch/*.log）

| 段 | 判 | 关键读数 |
|---|---|---|
| **P-R1 复现**（keySplit+shapeBal+key 配方换起点） | ✅ 过线 | OB3CH **+37.8%** ‖ OB3RB2-s23 **+41.6%** ‖ OB3S-C2 **+47.3%**（`cp-gd3repro.log`） |
| **P-P1/P-P3/P-P4 产品卷** | ❌ | gd3b 5P **43.6** vs v7 **56.9**；3P **41.4** vs **71.2**；v7mix 教师 41.4（出手种类 3→9 也没用，一致率 65.5% 接不住 v7）；缺口集中"含深经济对手 Δ−19.2pt"（v7 同拆分 −1.7） |
| **P-P5 1st 货币 CEM**（gd3b 起 ×2 种子 ×24k） | ❌（a 败 b 败） | 产品 5P **30.0 / 41.0**；出手种类仍 3；**正面读数：1st 货币下链完全常驻**（炮 3.77/3.57 vs 起点 3.81，研究卷 +41.4/+42.0） |

**给你划的边界**：你 §十六"装真→胜负训练保链涨分"我全部复认（P-P5 再添一票：连换货币链都不掉）；但**"保住链"与"产品卷能赢"是两件事**——研究卷上 +41~+47% 的包到产品卷是 30~44%。你的 §四"考场对齐"教训在训练侧的版本就是今晚的终点结论：**测量卷 ≠ 训练卷这件事，我们在 2.0 线上从第一天起就混着用了**。

## 三、产物清单（全部 gen-3/v:92，均在 `scratch/arms/`，meta 齐全）

| 包 | 是什么 | 状态 |
|---|---|---|
| `gd3b-ks-sb.bak` | **电磁炮桶专家**（你 §二十 的产物）：研究卷 +47.3%、炮 3.81/局、窗 18.3% | **桶级验收待跑**（pool-check 按 PREREG §三池表过一遍即可正式入池，与晋升无关） |
| `gd3repro-OB3CH.bak` / `gd3repro-OB3RB2s23.bak` | P-R1 复现产物（+37.8/+41.6） | 桶种子备胎 |
| `gd3v7mix-OB3S.bak` | v7mix 教师（链覆写+v7 价值 argmax）：研究卷 +13.8%、炮 0.89、留出 65.5% | 教师风格路线的存档读数 |
| `FIRST1-s7/s13.bak` | 1st 货币 CEM 产物 | 判败保留（链常驻证据） |
| `voided-pgnan-round1/`（26 枚） | 废轮（含我午后 NaN 事故 25 枚 + P-P5 错食性 1 枚） | 只留读数 |

## 四、工具变化（都在今晚的提交里，回归腿齐全）

1. **`eval-5p` 补载 `js/train/policy2.js`**——第五装载点漏网：代 2/3 包此前在产品考卷**响亮拒读**（`no-policy2-module`），未静默。你 Stage B 清理装载表时名单里没有它。
2. **`supfit-gd --teacher=chain|v7mix`**（默认 chain 逐字不变；回归腿 `probe-v7mix-regr.bak` ≡ `gd3b-ks-sb.bak` md5）。meta 记 teacher/keySplit。
   ⚑ 已知小毛病：`like()` 测试集似然在"测试集出现训练集没有的稀有键"时被 NaN 毒成 −99（只坏打印，v7mix 的 holo 键触发过）——谁动 supfit-gd 顺手修。
3. **`probe-cem-arm` 加响亮闸**：点 `--arenaCur/--arenaStrat/…` 族旗标却不给 `--arena2=1` ⇒ 当场 exit 2。⚠ 这是我今晚 P-P5 首遍当场栽的坑（静默掉进 scoreMemberN，meta `arena:null`/`currency:"scoreMemberN.fit"` 是事后报警）——**发臂看一眼 meta 的 arena 字段**。
4. **`selftest3` 包参数改必填**（默认曾指 OB3CH-s7，代 2 退役后裸跑必撞代闸）。本机现成代 3 包 = `scratch/arms/gd3b-ks-sb.bak`。
5. 现役尺状态：`selftest2` 36 腿 ✅ ‖ `selftest3` 6 腿（在 gd3b-ks-sb 上）✅ ‖ `browser-parity` P1–P6 ✅（你 §二十 清单，我未动）。

## 五、下一手（等用户点头，本文只备料）

**适应段搬考卷**——把 CEM/蒸馏的适应段搬到产品形状考卷上。备好的接线点：
- `arena2.mjs createArena2(o)` 已支持 `o.shapes` 覆盖；roster 侧现在吃的是固定池（`pool=cc652985/20` + `only:*` 单技能行）。产品 7 脚本（random/defend/antidef/wall/farmer/heavyfire/deepsaver）的包装器在 `server/opp-pool.mjs OPP_SPECS` + `tools/bot-chooser-lib.mjs makeAsChooser`（eval-5p 同款）——大概率走 `fixedByKey` 那条路加 7 行 fixed 即可。
- `probe-cem-arm` 需要一个 `--arenaPool=product`（或 `--arenaShapes=5:multi,...`）旗标把这两样传进 createArena2。
- 配方形态（我的建议）：**双段**——mild 上装真（蒸馏 20 秒，行为配方不变）→ 产品形状卷上 24k 适应（货币用 first）。单段直接产品卷也可以，但桶行为会不会被产品卷拆掉是未知数（今天唯一没试的组合）。
- 判据先立再跑（预登记补一段即可）；v7 同批基线在我手里：**5P 56.9 / 3P 71.2**（seed 77000，`e5p-v7.log`/`e5p3-v7.log`），配对同 seed 直接可比。

## 六、与你 Stage C 的交错（建议顺序）

1. 先裁决/跑适应段搬考卷（上面的第五节）——**D16 指纹重录放在它之后**（考卷搬了指纹本来要重录，别做两遍）。
2. 承重消融新面重跑（你 Stage C 第三件）不受影响，随时可做。
3. 电磁炮桶的 pool-check 验收（第三节表格里那行）半小时级，可穿插。
4. miniT/大雷/激光眼桶：**配方已备好但建议等考卷搬迁落定再开**——否则又要在旧考卷上造一批"研究卷富、产品卷穷"的桶专家。

## 七、口径纪律（今晚新增的两条）

1. **跨卷读数不许横比**：mild 冻结桌的净分与 eval-5p 的 1st 是两张卷（今晚 13~30pt 的翻转就是这么来的）；引用任何一条都带上卷名。
2. **arena 族旗标必须配 `--arena2=1`**（第四节第 3 条，已有响亮闸兜底，但 meta 的 `arena` 字段值得扫一眼）。

—— ZCode，10-31 晚
