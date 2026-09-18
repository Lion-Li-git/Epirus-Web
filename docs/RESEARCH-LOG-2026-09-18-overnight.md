# 通宵自主推进日志（2026-09-18 → 09-19 09:00 停工）

> **这份文件是防失忆用的唯一真相源。** 每完成一步就更新它。
> 如果上下文被压缩：**先重读本文件的 DONE / 不要重复 / NEXT 三节，再继续干活**，不要凭记忆重开实验。
> 约束（用户 2026-09-18 睡前授权）：可以长程训练与方向探索；**只提交并推送到 `qoder` 分支**；
> **绝不换包、绝不动 `js/bundled-champion-3p.js`、绝不 bump 版本号**（那是 ds 的发布动作）；
> 改动一律 env 开关且**默认关闭**；每步跑 `node tools/np-test.mjs`（期望 146/146）+
> `node tools/rules-fingerprint.mjs`（规则未动应仍为 `1391c094`）。

## 现场基线（09-18 23:40）
- `main` = `04e2e3f`（v1.5.115 代记）；`qoder` 已推 3 个 commit：`6848fa9` / `3527f20` / `0c916b3`
- 线上包 sha1 前 12 位 = **`268461f7c9f0`**（不许动）
- 工作区里 `results/*.txt` 是**用户自己的对局记录**，永远不要 `git add`（add 一律点名文件）

## DONE（已做完并**已提交/推送**，不要再做第二遍）
1. **第十三轮分析全部完成**，文档 `docs/OPTIMIZATION-ep-cliff.md`（已推 qoder）。三条实测结论：
   - 在位包 **看不到环**：9909 决策点、ep 直方 44/34/22/**0**/**0**%、峰 ep=**2**、环可负担 **0** 点；
   - arm A `v7ringA1-82` **富死**：ep≥4 占 68.5%、峰 ep 43/99、环可负担 71% 仍 0 次打环、终局余 ep 38.7/86.3；
   - **白送钱 >> 教它赚钱**：环×8 Δ+12.5pt CI[3.8,21.3] vs 加钱+18 Δ**+38.9pt** CI[24.6,53.3]、
     加钱+40 Δ+39.6pt（终局还攥着 38 点）⇒ 起作用的是"**瞬间付得起贵卡**"，不是平时有钱。
2. **根因两处已定位并实测**：`policy.js:202/:379` ep 编码在 **ep≥16 逐位冻结**（16/20/30/40 四档 p(ジ)=0.453、p(攻)=0.378 完全相同）；
   `evo.js` 经济 shaping 全是**封顶阶梯**（`economyStock` 挂 `maxEp` 且在 2C 夹住；`conv` 只数到 2 次 cost≥2）。
3. **5 个独立量具已入库**：`tools/probe-ring-afford.mjs`、`probe-ring-value.mjs`、`probe-cashout.mjs`、
   `probe-wealth-placebo.mjs`、`probe-ep-saturation.mjs`（REPO 路径走 `EPIRUS_REPO`，默认 `./`）。
4. **续跑量具的坑已修并写进文档**：`autoGameN` **不能从中间状态续跑**（重复一次 `startTurn`）⇒
   必须用 `probe-ring-value.mjs` 里的 `resumeN(state, chs, skipStart)`，忠实性自检 8/8 才可用。

## 不要重复做的事（都已经有结论了，重跑是浪费 GPU）
- ❌ **不要再跑"强迫打环/环奖励"臂** —— 本轮两条独立否定 + 之前四次失败同型（详见 `OPTIMIZATION-ep-cliff.md` §3/§5 L3）。
- ❌ 不要拿"环可负担率 76.8%"当读数 —— 那是 **ds 旧包/旧口径**；在位包实测是 **0%**。
- ❌ 不要报"每对 SE"当置信区间 —— 必须**按局 bootstrap**（30 快照只来自 6 局会造出假的 +15pt±2SE）。
- ❌ 不要用"打 ジ n 手"当安慰剂：那条线本来就在打 ジ ⇒ 与对照**逐字相同**，不是独立臂。
- ❌ 不要"修" `state.js:191` 与 `resolve.js:645` 两处 `ringStreak++` —— 查过是**误报**（分别管打环者本人与镜面复制者）。
- ❌ 不要重复跑 `probe-ep-saturation` / `probe-wealth-placebo` 的同一批读数来"再确认一遍"。

## NEXT（按顺序做，做完一件就划掉并把实测值写回 DONE）
- [x] **N1 做完**：L1 表征层验证 ⇒ `tools/probe-ep-encoding.mjs`。实测三条：
      M1 现状三种 ep 编码在 **ep≥16 的那 6 档（16/20/24/30/40/60）只产出 1 个不同值**（完全塌缩）；
      三个提案（log1p / √ / 两段线性+压缩）都是 **6/6 可区分**。M2 真实中局面上整条 213 维状态向量：
      arm A 192 输入 → 146 个不同向量（可区分度 76%）、线上包 → 109（57%）。
      M3 **精确改点定位**：状态侧只有下标 **[2, 18, 54]** 随自己席位 ep 变化（对手 ep 那几维要另改）。
      ⇒ 结论：换编码只解决"能不能表示"，"会不会用"仍需重训（换代代价 = FEAT_S 语义变 ⇒ 旧包不兼容）。
- [ ] **N1′（新发现，待做）**：`probe-leftover.mjs` 的判据读数显示**在位包不是"不会攒"，是"攒不到就花光"**：
      线上包 multi 兑现率 **94%**、余 ep/人 **0.9**、峰 ep 2；arm A multi 兑现率 **23%**、余 ep/人 **23.2**。
      ⇒ 两包的病**方向相反**，所以"余款惩罚"对线上包是**空操作**（没余款可罚），只对 arm A 型有效。
      待验：给在位包那一侧的处方是"低 ep 时的攒"，但 STOCK_BONUS 上限只有 0.05、而 tempo 损失在胜率尺度上是
      1.0 量级 ⇒ **推断：这个不对称才是环学不出来的真正阻力**（需要一次"提高 STOCK_BONUS 会不会买到环"的臂来证）。
- [ ] **N1″（原 N1）** L1 的**表征验证**：不改训练，只在 `probe-ep-saturation.mjs` 里加一个
      `EPIRUS_EP_FEAT_CAP=<新上限/编码>` 的**影子前向**（同一份参数、只换 ep 编码），看 16/20/30/40 四档
      是否不再逐位相同。⚠ 旧包参数是在旧编码下学出来的 ⇒ 换编码必然错乱，所以这里只看**输入是否可区分**，
      不看胜率；判据：p(ジ) 在 ep 阶梯上**不再逐位相同**即成立。
- [ ] **N2** 实现 L2′：`evo.js` 里
      ① `rec` 加 `leftEp`（终局余款）与 `epGained/epSpent`；② `economyStock` 自变量 `maxEp`→`leftEp`（开关 `EPIRUS_HOARD_ON_LEFTOVER=1`）；
      ③ `conv` 改比率 `已花/已获得`（开关 `EPIRUS_CONV_RATIO=1`）；④ `HOARD` 饱和点 `2C`→可配 `EPIRUS_HOARD_CAP_MULT`（默认 2，臂上试 4）。
      全部默认关闭 ⇒ np-test 146/146、指纹 `1391c094` 不变；np-test 里给新纯函数补一条 D 断言（门槛语义单测，学 D15 的路子）。
- [ ] **N3** 跑臂：对照臂（开关全关，复现今天的行为作为**回归基准**）+ ② 单开 + ②③④ 全开。seed 31-33 起步。
- [ ] **N4** 判据（三条都要，缺一即否）：产物**终局余 ep 显著低于在位包**（现值：multi 38.7 / long 86.3）·
      **A 卷分数不掉** · **出手/回合上升**。另用 `probe-convert` / `skill-report` / `champ-audit` 交叉。
- [ ] **N5** 写 `docs/AUDIT-RESPONSE-2026-09-19-overnight.md`（给 ds 的交接：改了什么、实测、否定什么、他接手要注意什么），推送。

## DOING
- **N3 三臂正在跑**（`tools/l2-arms.mjs`，后台，约 35~40 分钟）：
  `v7l2c` 对照（开关全关）→ `v7l2h`（只开 `EPIRUS_HOARD_LEFTOVER=1`）→ `v7l2f`（+`CONV_RATIO=1`+`HOARD_CAP_MULT=4`）。
  共同配置 = 池 E+gunspam(17) · `CLEAR_W=0.05` · `TRAIN_SEAT_GAMES=24` · **无 imit 教师**
  （上一轮 arm A 开了 `IMIT_OVERRIDE=0.5` 会覆盖 50% 早期决策 ⇒ 会把 shaping 效应糊在教师示范里，测不干净）。
  进度看 `docs/artifacts/l2-arms-status.log`；每臂另有 `ring2-status-<tag>.log` / `ring2-server-<tag>.log`。
- ⚠ 已知现象（不是 bug）：对照臂 seed 81 被**健康门槛**拦下（`G 有效技能数 1.43 < 3`、以及一例 `回合 41.4 > 40`）
  ⇒ 无 imit 教师时这配置更容易长窄。若某臂 6 个 seed 全被拦，就改用 `EPIRUS_ALLOW_HEALTH_FAIL=1` 重跑**并显式记账**。
- **接线凭据**：worker 只在 `hasEconOverride` 为真时打 `[econ] worker 生效值` ⇒ 到 `v7l2h`/`v7l2f` 的
  server 日志里应有 **16 行**（这就是"开关真到了 worker"的判据，对照臂没有是正常的）。
