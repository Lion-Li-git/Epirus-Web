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

## 三、全库重测（新轴 × 新引擎纪元）

- 驱动 `rerun-1114.mjs`（断点续跑）：Bpage（F5 page）→ Bexam（F5 exam，Δε 配对半边）→ Apage（coop），
  915 枚 × {multi,long} × 3 半批，seed/rounds=100/77000 与旧批一致。
- 新尺：`b-f5-page-1114` ‖ `b-f5-eps0-1114` ‖ `a-v2coop-page-1114`；ingest = `ingest-1114.mjs`（幂等，
  dry 验过）→ set-current ×3 → build-view（C 内算）→ rebuild-map。
- 〔批进度/读数待批完回填：三半批耗时 ‖ 失败数 ‖ 新旧尺差值分布 ‖ Δε 分布〕

## 四、池复检（P0-1，批完做）

- probe-pool 双带×双桌形（对照晨间 hard 7.76 vs soft 8.79）+ card-usage 15 枚——新引擎+新尺下重测；
  带位漂移只提案不擅动。

## 五、提交账（本班）

| commit | 内容 |
|---|---|
| `a83c9a47` | 收尾批（GD14/GD15 记账 + 铁律14 + README 重构） |
| `396d97af` | PLAN-night6 + 重测驱动初版 |
| `2a57c816` | A 轴配合剧本 + F5 夹具 + exam-4n --coop 集成 |
| `26167a78` | 训练方法 PROPOSAL + ingest 脚本 |
| 〔待〕 | 重测批 ingest + 池复检 + STATUS 定稿 |
