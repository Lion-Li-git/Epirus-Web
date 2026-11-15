# STATUS · 2026-11-16 凌晨（ZCode · 承 11-15 白班/晚班，整夜班 23:15–01:5x）

> 接力链：[PLAN-2026-11-15-night2-crossmode-longhorizon-zcode.md]（23:15 前哨批）→
> 用户令"排满到九点+四项全批"⇒ [PLAN-2026-11-16-overnight-zcode.md]（本夜执行稿，执行列已回填）。

## 一、四把新尺/工具（用户点名的研究标准全部落地）

1. **跨环境技能普查尺** `scratch/probes/probe-crossenv-skill.mjs`（批 1）：对手矩阵（10 脚本+5 真包）
   × 4 人数 × 2 模式 = 120 格/包；产出并集数/每技能环境覆盖率/桶钉换招 JS/自对局失真列。
   参照集 9 包（`crossenv-census-1116.json`）：**GD16m 换招 0.0083 垫底自证**；**自对局漏数 1-3 技能
   坐实**（V3a/V3b/P4 各有环境独有技能）；覆盖矩阵分层"稳定会"vs"偶发"（GD16m 的
   bigT/railgun/ring=70/52/79 格是最稳链手）；tank 在 E9 有 14 格稀疏使用（旧普查 ≥2% 阈值效应暴露）。
2. **前线真实强度尺** `probe-frontline-strength.mjs`（批 2）：对手=现役 8 强。**现役产品冠军
   bundled-champion-3p 对前线垫底 0.2479**——全部候选压它；链专家被旧夹具系统性低估
   （V3a 0.323 vs 考卷 0.206）。
3. **mem-probe-e6 `--paired`**（批 6，Qoder 修尺建议落地）：对手中心配对读数（每对手跨包基线偏差），
   旧 R/H/Gap 语义逐字不动。样张：heavyfire 基线 0.0 / deepsaver 100.0 的常数偏置被剥除；
   E9 |dev| 11.5 最均匀。**是否取代单点 Gap 进验收条款仍留用户**。
4. **全库双轴 exam-4n 重测**（批 2c，v2.0.9 规则，951 枚）：`exam4n-rerun-1116-{multi,long}.tsv`
   （942 枚×2 轴，jobs=8 共 20 分钟）。坑入账：**驱动 extra 必须仓库相对路径**（绝对路径过不了
   join(ROOT,rel) 存在性检查）。工具 `gen-exam4n-extra-1116.mjs`。

## 二、尺的循环性发现（图尺换代的真正约束）

全库短轴 Top 15 **全是 MSB/G5/v7 代**（G5J-50 0.4515 登顶），obs6 线靠后（E9 #178/P4 #297/P9 #609）——
exam-4n 的 champ 夹具是 MSB 血，MSB 包在自家夹具接近训练最优；前线尺反向偏袒 obs6 系。
⇒ **图尺换代不能单边换，混合夹具才是答案**（`--champ=MSB15R-HITMIX,GD6a-TILT,Q-s47,OBS6E9,
OBS6P4-S4000` 全在册）——混合版全库重测已在跑（`exam4n-mixedfix-1116-{multi,long}.tsv`），
晨班拿它对比三把尺后定 headline。

## 三、批 3：V3 谱系六点进图 + 四粒进池 hard 带

- 绘图谱系链 `E9→shaped1→V2→V2S0→V3a/V3b→B2`（registry 957，fam23）；
  **时间倒挂守卫咬住 V2S0→V2 假父边**（快照血统派生自 shaped1 非 V2 终粒）→ 改判父=shaped1，
  rebuild-map 100 PASS。门禁 5 道全绿（00:44）。
- **promote 体检（--dry 全集）**：**血统级统一阻断 = G5 防席夺冠**（对只防御龟不能清场，
  long 关档 29-73%）——与 E5c 血 G4[multi] 同型的家族性质：
  shaped1 G5[long]34% ｜ B2 G5[long]34% ｜ V3a G5[long]29%+G5[multi]35%（地板五道全过）｜
  V3b G4[long]63.3%+G5 61%/40% ｜ V3S2 G4[long]64.3%+G5 73%/40%。
- **进池 4 枚 hard 带**（+4=22，bundle 重烘 + pool-sync 逐枚一致 + 门禁绿）：
  shaped1/B2/V3a/V3b 全 invited=1 + block（如实记阻断明细）。**V3S2 缓入**（META 无标准出处字段，
  父边无证据不断言——等晚班补融合谱系）。
- **G5 清门首臂判负**：V3a + 龟系桌 PG（wall/protowall/tankline…）⇒ G5 反而恶化（29/35→43/47）——
  对龟训练学会一起龟。**血统级"破龟不能"需要演示/塑形机制（oracleDef 反龟示范或打龟伤害塑形），
  不是对手桌**——下一班主修方向。

## 四、批 4：B2 判定 + 长程合一七连否收卷

B2（V3a 基座 + 形门教师团 bundled@2P 0.70/v7blk1@5:long 0.35/GD16m 键道 0.15 + rareOnly 真密度键）：
环 100 标签供给成功，官方尺短 0.2078/**5P 长格 0.3006 全库最佳**，**H 82.3% 全库新高**（Gap −12.9），
但链部署 0（环 100 标签 → ε=0 零转化）。验收 2/3。
**七连否**：soup/端到端对齐/PG 探索/PG 从链起/教师标签量/移植/端到端形门蒸馏——
训练侧单包长程合一关闭；长程正路 = **案①路由（V3a/V3b 长链席）**。B2 本体 = 最强全能席候选。

## 五、批 5：案② adapter 可行性判词（只读 spike）

policy2 结构定位：skill 打分 = skillHead·hctx 点积，hctx 共享编码 ⇒ **每模式加性偏置**
（state.modeKey 可达）= 最小侵入形态，规避 V3H3 的 hctx 基旋转激活死。预估改动面半天
（arch2 布局段/policy2 两条打分路径/checkPack/指纹各一档，缺省全零=老包逐字不变）。
验证设计已写进 PROPOSAL 案②；训练臂留下一班（布局改动不宜深夜动）。

## 六、留给晨班

1. **混合夹具三尺对照**（跑完即得）：exam4n-rerun（旧夹具）/ exam4n-mixedfix（混合）/ 前线尺
   ——定图面 headline 口径（用户已授权换尺）；
2. **V3S2 融合谱系**：等晚班补 META 出处后绘+进池（五道地板全过，只欠出身）；
3. **G5 破龟机制臂**：oracleDef 反龟示范 或 打龟伤害塑形（--shapeKey 系）——今晚对手桌路线已证负；
4. **案①路由施工**：池四粒已就位（invited=1），路由表 (n,mode)→池成员的装配面施工单在
   PROPOSAL 案①；
5. 批 5 modeBias 训练臂（半天，按 PROPOSAL 验证设计）。

## 七、提交账（本夜）

| commit | 内容 |
|---|---|
| `155dd18b` | 前哨批 PLAN（23:15 三批） |
| `e8f5a5c7` | 整夜 PLAN（七批，用户四令全落） |
| `96694495`…`97968389` | 前哨批终账（E8cR/T12R/T12H/LH9-12/T2-1R 五律） |
| `b073f7e7` | 批 1/2/6 工具 + 普查/前线读数 + --paired |
| `ebd6a6dc` | 批 3 四粒进池 + bundle 重烘 |
| `178e9fa7` | 批 2c 全库双轴表 + 批 3a 六点绘图 |
| 本笔 | STATUS 终笔 + PROPOSAL 案②判词 + 混合夹具表（跑完补） |
