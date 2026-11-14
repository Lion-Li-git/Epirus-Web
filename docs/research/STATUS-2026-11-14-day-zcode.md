# STATUS · 2026-11-14 白班（ZCode · 12:00~15:07，续夜6班）

> 夜6班的交接见 [STATUS-2026-11-14-night6-zcode.md](STATUS-2026-11-14-night6-zcode.md)（§七 = 本班上午的 gemini 批复核）。
> 本班主题：①gemini 批复核入库 ②中点实验（用户令"继续研究训练的问题"）③GD16m 进图（用户令）④obs5 判别分辨率考古（用户两问）。

## 一、gemini 白班修复批复核入库（a30f1098）

复核全绿后入库：①训练侧旋钮大删 246→193（白名单+读取代码同删零残留；RETAL_W 在 MSR 终判红后删不违铁律；
knobs --check + train-selftest 四腿 PASS）②池账三修（audit 空 verdict 盲区修 + WSEL9-200 移出页面池 16→15 +
**P0-2 seatKill 欠账清账**）③旧 1.8 包死链接账（registry path 清空 + archived-pack-meta.tsv + ARCHMETA/REGTS 兜底，
build 934 行对 gen4 锚 0 错配）④trends 页去陈旧。gate-all --auto 六道全绿。
细节见 night6 STATUS §七。gemini 未留 HANDOFF——已备注。

## 二、中点实验：**贴贴天火线首次全门通过**（3b92c0e8）

主账在 [FINDING-2026-11-14-ksmid-dose-phase-zcode.md](FINDING-2026-11-14-ksmid-dose-phase-zcode.md)（含 9 臂全表 + 三勘过程）。
摘要：

- **Batch1 dose×keySplit 矩阵（f/g/h 三臂）**：中点 = **keySplit 结构轴**（GD6a-TILT 本就是 keySplit:1 容器，
  KS=1 = 原生装载 / KS=0 = 把 charge#boom 合并回旧键层 ⇒ 键语义漂移 ⇒ argmax 塌回多数派）。dose 轴单独无中点
  （dose=8 两头不讨好）。GD16f（KS1+dose3）：环 86 段 ✓ bigT 67.5% ✓ 天火 322%/局 部署满负荷——魔咒全破。
- **Batch2 相位教师 v4→v6（i/j/k/l）+ dose 响应（m/n）**：GD16m（KS1+dose1+v6）**全线达标**：
  **天火 ✓ 160%/局 ∧ 引爆率 164.6%**（首次过 75% 门且进 >100% 区间）‖ 环 ✓318 段（父代原值 78 的 4 倍）‖
  bigT ✓277.5%/局 ‖ 电磁炮 ✓60%/局。学生从教师 1:1 原子对泛化出 引/贴=1.65（学会同批符多次引爆）。
- **钟摆合拢，中点三件套 = keySplit 原生装载 × 教师 stick→fs 原子对 × dose=1 支配度帽。**
- **用户两问抓出两处错，三勘定案真机理**：obs5 的历史是**类目级**（lastSkill 只进 4 类 one-hot；CURSE/FIRESTORM/
  CANNON/ROD/MINE/BIG_T/RAILGUN **全是 CAT.SPECIAL** 塌成同一位；「无精确键（断脚本指纹）」= 11-10 设计决定）。
  相位判别子在 obs5 不可观测 ⇒ fs/ring 同观测双标签 ⇒ 拟合 ll 爬坡（GD16k/l 起点=最优）。dose 响应划出悬崖：
  dose=1/2 健康、dose=3 崩（采样撞 (SPECIAL,ep) 同格双标签）。
- **普适规则入账：教师序列设计的复杂度上限 = 观测面的判别分辨率。**

## 三、GD16m 进图 + measure-point 现代化（3e64a51f）+ 父边实线（09019598）

- 用户令"GD16m 以及父节点系列先进图"：父代 GD6a-TILT / 祖 MSB8-charge **已在图**且吃过新尺重测；
  新行仅 GD16m 一枚——三现役尺 × 4 格 × 双桌形 **24 条读数全齐**（A coop v3 口径 + eps0 半边），
  fam=21 挂 GD6 蒸馏多线族，页检 99/0 + rebuild-map 98/0。
- **父子读数**（图上可见）：C5 短 0.057 / 长 0.092（父 0.149/0.192）——子代全线低于父代 = **多样性换考分**；
  长程格差距最小；rounds 12.7 vs 24.85、dmg 24.6 vs 17.4、distinctKeys 6 vs 4。
- **measure-point 三处陈旧修复**（进图令暴露）：尺 id 硬编码 a-v2-page-1109/b-f2-page-1111 已冻结
  （add-point 拒写）→ 从 rulers.tsv 现役行取；exam-4n-full→exam-4n 100/77000 口径对齐 + A 带 --coop=v3 +
  补 eps0 半边；rounds 12→100。以后新点进图一条命令全口径。
- **父边实线**（用户问"为啥是虚线"）：seedpack(路径推断,虚线) → seedpack-wid(实线)——手工核验
  widOf(GD6a-TILT.bak)=440ca578ed5384d0=图上节点 wid。页面父边置信编码：实线=身份实证、虚线=路径推断。
- **根子同笔修**：supfit-gd 产物补内嵌 EPIRUS_CHAMPION_3P_META（11-05 契约，hotstartFrom 记 **wid** 不记路径，
  算不出退回路径并点名）——以后进图自动连实线边。冒烟验证过。

## 四、obs5 判别分辨率考古（用户末问，设计级发现未落定）

用户问"为什么 obs5 的 lastSkill 被压缩，我设计时不是所有信息可知吗"——考古结论：

1. **用户原则在案**（obs4 提案标题「正交维度信息全覆盖」）；obs3b 时代接近全可知（对手精确键 30 维 + K=4 键 bag）。
2. **例外条款是 11-09/10 训练侧加的**：考卷对手 = 固定 28 脚本 ⇒ 对手精确键史 = **脚本指纹**（网络背 counter
   刷考卷不学行为）；obs4 选了特征层硬切（比 DS 时代的 KEYDROP dropout 更硬）。**理由只覆盖对手侧**。
3. **实现越过条款**：共享 seatEnc 把 **self 侧**历史也压成类目（48 维序列块"类+果，无自身键 bag"）——
   这步不是理由要求的，今天相位教师的拟合失败就是它的代价。

**修复三路已呈报待裁**：①**obs5b 新面**（推荐：self 侧恢复精确 lastSkill（先只 1 步，指纹耦合最小）+ 对手侧维持
风格不变量；新 dof ⇒ 孪生双写、obs5 存量不受影响）②维持 obs5（教师在分辨率内设计，连续引爆段永久学不到）
③obs5 原地加回（指纹通道重开 + 存量全作废，不建议）。**等用户点头后才出 obs5b 设计稿。**

## 五、提交账（本班）

| commit | 内容 |
|---|---|
| `a30f1098` | gemini 白班修复批（复核入库，详见 night6 STATUS §七） |
| `3b92c0e8` | 中点合拢：GD16m 天火线首次全门（9 臂 + 三勘 + dose 悬崖 + supfit --detDose/rationdet2 v6） |
| `3e64a51f` | GD16m 进图（24 读数 + measure-point 现代化三修） |
| `09019598` | 父边升实线 + supfit-gd META 契约（hotstartFrom=wid） |

## 六、留给下一班 / 待用户裁

1. **obs5b 设计稿**（①路）——等用户点头后动工；这是今天最大的设计级发现的自洽收口。
2. **cannon 线 KS=1 副作用专查**：KS=1 三臂炮线部署全 0（GD16c KS=0 是 360%）——疑 cannon 键与
   curse/ring 键道竞争在 KS=1 分组下换了形状。
3. **GD16m 进池评估**：历史首个天火线全过包，走 10-21 裁定 A 的 invited/block 语义（等点名）。
4. **WSEL9-200 裁决**（昨日悬）：邀回或 promote 补体检，二选一待用户裁。
5. 连续引爆段（R62 连发 2ジ 玩法）学不到——obs5 判别子缺失的直接后果，与 1) 联动（obs5b 落地后重跑窗口≥2 相位）。
