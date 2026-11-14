# STATUS · 2026-11-14 夜6班（ZCode · 23:0x→收工）

> 接夜5班（day 班 ds/gemini，其两批提交评述已当面交付；本班开班账见 `PLAN-2026-11-14-night6-zcode.md`）。

## 一、用户指令账（本班五令，全部落地）

1. **看 ds/gemini 今日工作** ✔（当面评述：午后批 D82/色带/3D 缓存 + 晚间批引擎换代 668081a2→120fca4d + 审计 TODO；
   欠账 = GD14/GD15 没记账、没交接文档）
2. **收尾 + 提交推送** ✔（`a83c9a47`：GD14/GD15 五臂 FINDING + AGENTS 铁律14 + README 按 14 重构 + 色带脚本入库）
3. **定今晚计划** ✔（PLAN-night6，`396d97af`）
4. **全库重测跟上新规则** ✔ 进行中（见 §三）
5. **A 轴配合脚本 + B 轴换轴** ✔（见 §二——首发批按「先调整好轴再跑重测，不然就是白跑」停掉重发）

## 二、轴定稿（用户 11-14 澄清后）

- **A 轴 = 原轮保留 + 配合剧本局追加**：`tools/exam-coop.mjs` 五本剧本（用户点名两典型：
  **藤甲+坦克天火集火**：贴藤甲→攒 2ジ 打坦克（火伤+1）→贴符/引爆天火；**给攒大招的角色套盾**：聚能环连开→
  bigT 落雷，holosupport 盾给 ep 最高的憋大招者）+ 集火围殴/挑衅坦克阵/反弹八卦墙。
  **只进 A 轴**（B 轴冠军配合太随机——用户澄清）；rotation 局逐字不动（与 a-1109 可配对）；
  n≥3 每格追加 40 局，n=2 无配合。
- 两个探针抓修的坑：① **确定性**——角色 chooser 必须 `asChooser` 包装（裸 bot 式返回值让引擎走带随机的回落，
  双跑 md5 不同）；② **经济序**——本引擎 ep 唯一收入=出 ji（epRegen 缺省 0），cost-0 的 guard 兜底会把角色
  锁死在 0 ジ（armor/holo/taunt 全不出手）。修后：armor×76/tank×15/curse×46+firestorm×6/holo×23/bigT×6 全对目标，
  armorfire 局均 35.7 回合、holocharger 16.0（组合在收人头）。
- **B 轴 = F5 风格互补五夹具**：MSB11-R2（蓄爆锚续账）‖ MSB14（枪炮反击）‖ WSEL9-200（广度）‖
  MSB15R-HITMIX（反墙 99.6 分位）‖ GD6a-TILT（蒸馏三线）——替换旧 F2 三 charge 一杂。
- **区分度**（rounds=8 四分层包）：coop 一致压低 h5 −6~−18pt、h8 −8~−11pt；强包排序被打乱
  （GD6a coop-on h8 26.4 反超 T8-s114 20.8）= 环境量出了不同的东西。
- 训练方法文书：`PROPOSAL-2026-11-14-training-methods-zcode.md`（①环境课程表 ②GA shaped reward ③键道细分降级，
  等点名）。

## 三、全库重测（新轴 × 新引擎纪元）✔ 落地（commit `161f923e`）

- 驱动 `rerun-1114.mjs`（断点续跑）：Bpage（F5 page）→ Bexam（F5 exam，Δε 配对半边）→ Apage（coop），
  915 枚 × {multi,long} × 3 半批 = 5490 跑**零失败**，16 路并发 4.49h（首发 6 路 ~13min 已按用户令停掉重发）。
- 换尺：rulers current 指针 → `b-f5-page-1114` ‖ `b-f5-eps0-1114` ‖ `a-v2coop-page-1114`（旧尺落 reference）；
  readings +21344 行全齐（915×4 档×2 桌形×3 尺）；batches.tsv 三行 batch_id 与 rulers 逐字对齐（主尺身份门）。
- 换尺流程的三个新坑（都修在 build-view/rebuild-map 里）：
  ① exam-view 漏写 n 计数列（值列有、计数列空 ⇒ 对照 7776 空/值错配）；
  ② 19 个无盘文件 registry 行（e1-teach-77003 等）= 新尺下诚实未测，对照守卫须豁免（锚里是 display 模板旧纪元残值）；
  ③ 对照锚换代：gen4-1114 新建（gen3-1105 留档），build-view 默认锚 + CLI 默认 + rebuild-map 硬编码三处单源化。
- 页面重烘 **99 PASS ‖ 0 FAIL**；ship-pool 1/1（D234 ⑩c 裸跑 build-view 随默认锚切 gen4 后绿）。
- **首读数（全量配对 n=915）**：
  - Δ(F5−F2) X̄₄ page：短 med +0.0013（居中）‖ 长 med **−0.0370**（F5 长桌更狠）；p10~p90 ±0.07；
    **秩相关 0.951** = 阶梯保形、风格敏感（个体摆幅 ±0.07~0.2）。
  - Δε 新纪元：短 med −0.011（正/负 251/664）‖ 长 med −0.014（196/719）——**反号率 21~27%**（旧纪元 11%）
    = F5 下「开探索更强」的包多一倍以上；现役 T8-s114 Δε −0.0175/−0.0113（旧 −0.066 第 3 百分位 ⇒ 温和化）。
  - 个包：GD6a B短 +0.052→+0.109（新夹具偏爱蒸馏系）‖ **WSEL9-200 +0.121→+0.005 塌了**
    （广度可能是 charge 系广度，被 MSB14/HITMIX 反制——装配校准「风格洞」的夹具层镜像）‖
    MSB15R-HITMIX +0.182→−0.025（自己进了夹具队 + 天敌同席）。

## 四、池复检（P0-1）✔ 完成（新引擎 + 新池真源，带位只提案不擅动）

- **装配强度（probe-pool，games=60 seeds=90210,90211 双桌形，人类替身夺冠率，越低越强）**：
  **hard 综合 6.86%（晨 7.76）‖ soft 综合 13.39%（晨 8.79）** —— hard/soft 差距从 1.0pt 拉到 **6.5pt**。
  - hard 全格 0.85~15.85%（最疼 = 反弹系三格 15.85/10.85；只枪/农民/只防御 ≤3.3）——**换引擎后 hard 更扛**
  - soft 的「可被打爆」面变宽：**只枪压制 34.15/50.00**、只防御 15.00/21.65（晨：33/16.7）——soft 带被简单
    脚本打穿的幅度更大。**两种读法**：当「风格洞」= soft 覆盖缺口在扩大；当「难度语义」= 两带分离度变好
    （soft 该被打通、hard 该扛住——现状正是这两句）。⇒ **提案：带位不动**；真正欠的仍是训练侧
    （并集 14/30 卡不变 ‖ 用卡 ≥9 与三件全开仍只有 KD-G2/WSEL9 两枚 ‖ 16 张缺卡）。
- **卡谱（card-usage 16 枚镜像）**：union 14/30 持平；GD6a-TILT 5 卡防御 0%（单风格特化，符合设计）；soft 里
  STR-B/DEF-s16/EFFG 系防御 0%（进攻画像）——与 11-13 晨结论同构。

## 五、提交账（本班）

| commit | 内容 |
|---|---|
| `a83c9a47` | 收尾批（GD14/GD15 记账 + 铁律14 + README 重构） |
| `396d97af` | PLAN-night6 + 重测驱动初版 |
| `2a57c816` | A 轴配合剧本 + F5 夹具 + exam-4n --coop 集成 |
| `26167a78` | 训练方法 PROPOSAL + ingest 脚本 |
| `a0073373` | 挑衅坦克 v2（用户两轮修正：3~4ジ挑衅 + 按 ep 分级防御/转移奉还） |
| `161f923e` | 全库重测换尺落地（三新尺 + readings 全齐 + gen4 锚 + build-view 三修 + 页 99/0） |
| `5d7447c3` | 池复检读数（hard 6.86/soft 13.39，带位不动提案）+ STATUS 定稿 |
| `b1483dd2` | RETAL_W 落地 + 暗键删二证据（无可删项）+ 普查回填 |
| `6837a3ee` | 四技能首战（supfit 三脚本教师 + teacher3/4 + mastery 天火线）+ GD16 钟摆 |
| `914b95f7` | MSR 12 线终判回填（C+0.061 纯交换，还手 12.9% ≈ 基线——奖励没买到标的） |
| `60303d9a` | 炮计价勘正 + cannonPick v2（2-1-0 节拍）+ mastery 转移线 v1 |
| `18ff3ed4` | φ3 选靶二勘（必打 3ジ+ 攒钱手）+ cannonPick v3（炮标签 5→23） |
| `fb54af8d` | 转移率口径二勘（分母 = 使用次数：0.5×点数/次数，回本线 100% = 2.0 点/次） |
| 〔本笔〕 | **gemini 白班修复批**（经复核入库，详见 §七）+ 本节提交账补全 |

## 六、留给下一班的口子

1. **训练方法三线等点名**（PROPOSAL-2026-11-14-training-methods）：①环境课程表（配合剧本当训练对手）
   ②GA shaped reward 买还手/兑现（直接对准 GD6a 唯一阻断线）③键道细分降级——建议顺序 ②→①→③。
2. **B 轴 F5 的观察账**：旧 baxis-F2/F3k2 冻结留档；F5 从今晚起是现役尺，攒样本 ≥100 再议下代夹具。
3. ~~审计 TODO（ds/gemini 班留的）P0-2：pool-members seatKill 欠账~~ **已由 gemini 白班批清账**（15 行全真值，seat 审计新纪元重烘，见 §七②）。
4. Δε 新纪元反号率 21~27% 值得一次专读（哪些包在新规则下开探索受益——镜面/地雷改动的受惠者画像）。
5. **WSEL9-200 裁决待用户**：gemini 按「无邀请+无判定」契约把它移出页面池（§七②）；它是 ≥9 卡宽包两枚之一
   （另一枚 KD-G2），页面卡谱损失一枚宽包。两条回补路：promote-champion 补体检记判定，或用户点名 invited。
   B 轴 F5 fixture 不受影响（rulers.tsv 未动、scratch/ds-1109/WSEL9-200.js 在盘）。

## 七、gemini 白班修复批（11-14 12:36~12:44，ZCode 复核后入库）

> gemini 未留 HANDOFF/STATUS（铁律 11 缺口）——本节是复核方的交接备注。

1. **训练侧旋钮大删 246→193（−53 根）**：删旧实验残留三族——奖励侧（AGGRO_OPPS/FOCUS_W/DEF_ADAPT_W/
   DEF_IDLE_W/DRAIN_HEAL_W/GUARD_HIT_W/REFLECT_W/BEAD_WASTE_W/BREADTH_FATAL/EFFSKILL_×2/FITGW/RETAL_W 等）、
   对手桌族（OPP_HUMAN×4/ECON_OPPS/RING_OPPS/PASSIVE_OPPS/OPP_SWEEP/OPP_BLOCK/FAMILY_FIELD/TOOLKIT_OPPS 等）、
   观测侧（POPSTAT×3/HALL_SEED/HALL_TRACE_PROBE/WIDE_FINAL/SEL_KEEP×9/SEL_GRID×3 等；SEL_DEF/SEL_BIGT 族保留）。
   白名单+读取代码同删（train-3p −1306 行，grep 零残留）。RETAL_W 在 MSR 终判红（914b95f7）之后删，
   不违「在跑对照两侧不删」；evo.js 引擎侧机制留档休眠（默认 0 逐字不变）。
   **KPI ≤40 仍欠（现 193），下一批候选 = econ/env 族**。
2. **池账三修**：①pool-add audit 盲区（promoteVerdict 空 ≠ 免检，空按 untested 计）②**WSEL9-200 移出页面池
   16→15（hard 7→6）**——invited=0/verdict 空/seatKill -1 的「三无」成员，`--audit` 修后全绿
   （untestedAuto 0/bad []）；裁决口子见 §六.5 ③**P0-2 seatKill 欠账清账**：16 行全 -1 → 全真值
   （seat 审计新纪元重跑，pool-seat-9021x 双表重烘）。
3. **旧 1.8 包死链接账**：champion-map/packs/ 目录 609626e9 已删，registry 里 18 枚 1.8 包 path 一直是死链 →
   path 清空 + 元数据（wid/ts/gens/seed/meta_json）落 data/archived-pack-meta.tsv（不靠旧路径重扫），
   lineage.mjs/viewer.mjs 加 ARCHMETA/REGTS 兜底；build-view 重烘 934 行对 gen4 锚 **0 错配**、19 无盘行豁免。
4. **trends 页去陈旧**：A/B 标签改从 rulers.tsv 现役尺读（不再写死 F2），删「V111 应仍在 B 轴底部」过期注。
5. **复核路径**：node --check ✓ ‖ knobs --check 绿（193/183/未登记 0/暗键 9）✓ ‖ train-selftest ①②③a③b
   PASS ✓ ‖ pool-add --audit 全绿 ✓ ‖ build report 934 锚对齐 ✓ ‖ gate-all --auto 六道全绿
   （np/probe 89/89 + engine-fuzz 13/13 + spec 68/68 + smoke/battle/map OK）。
