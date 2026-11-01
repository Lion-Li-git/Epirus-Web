# HANDOFF → ZCode/GLM（千问 · 11-01 晚班）：从"镜像桌为什么塌成枪"走到"两道关口不同尺"

> 分支 `research/champion-2.0-repr-2026-10-28`，**已推 origin**（本地 HEAD = 远端，查法 `git rev-parse origin/<分支>` ↔ `git log -1 --format=%H`）。
> 我这一段的提交范围 `1b6865ad → 7f221c3f`（你下午那批是 `c734eeb8`/`a76b93aa`；⚠ 你我共用同一 git 身份 `Lion_Li`，**按消息前缀认作者，别按 author**）。
> 未并 main、未 promote、未碰 `js/bundled-champion-pool.js` 与 `champion-map/*`、未动引擎参数。账全文 `RESULTS-2026-11-01-DAY-qoder.md` §十八~§廿五 ‖ 判据 `PREREG-2026-11-01-ECON-LOCK-qoder.md` §〇~§十四（**每节都先于它的臂提交**，时刻与 `scratch/*.log` mtime 可对账）。

## 〇、一句话，以及它为什么影响你下午那批的读法

**你的 `GA2R-sword-s13/s41`"8/8 骰超冠军"和我这里"镜里塌成一维枪"同时成立，不矛盾。**
⇒ 强度与广度在考卷桌上不冲突；冲突的是**目标函数不为"等"付账**：镜里 `charge` 提供了 1083/1767/1166 次而**有而选 0**（`offer-trace`，ε=0）⇒ 没有珠 ⇒ 电磁炮**从未进菜单**（不是"学会了不用"）。
⇒ 引用你那三粒时请带上这一句：它们是**对照**（在册最强短程粒），不是"广度还没训出来"的证据——广度已经证到"能，但贪心不走"（见 §一）。

## 一、病因链（今天最结实的一块，可以直接接你的工作）

- **经济自锁**，三格：`蓄能`（不肯按）→ `珠`（进不了手）→ `炮/大雷`（进不了菜单）。三档教师各治一格、**锁会跳格**：`ration3`（经济前提门）把珠账从"囤死"改成"得了就花"（今晚同尺：`得 3 花 3 过期 0 ⇒ 0.0 颗/局、花珠率 100%`），**但得珠量太小、链建不起来** ‖ `ration4` 剂量拉大后格又跳回"只攒不用"（今晚 `得 2575 花 0 过期 2575 ⇒ 64.4 颗/局`；旧那句"得 1324 花 0"是**镜里自查**口径、另一批，别混引）‖ `ration5`（教它攥着等）读数在 §二十 四档教师账。**没有一档把三格同时按住**。
- **能力在权重里**（反事实供资源，§十九 在册原样）：`--grant=ep5` ⇒ 出手 **100% 大雷**、1st **93.1%**（基线 64.0）；`--grant=ep5+elec+boom` ⇒ **炮 71.3% ‖ 大雷 28.7%**、1st **99.8%**。⇒ 不是"学不会"，是"不给资源就不按"。
  今天再加一条**温度旁证**：`skill-mastery` 给 `GATE3-s13/s41` 打了 `✔ 会电磁炮`，而同一次打印的珠经济行是"得 0 花 0"——**不是打架，是两张桌温度不同**（arena2 `t=0.15` 采样 vs `chargeProfile`/门槛/镜 `ε=0` 贪心）。
- 因此这条**不是架构病**：代 3（`dims.keySplit`、珠种进键层）没让锁消失，也没让它加重。

## 二、把"广度"放进选择面，今天试了四次，全败——但败法各不相同且越来越靠近真因

| # | 做法 | 结果 | 原件 |
|---|---|---|---|
| 1 | CEM 当选面"同带内取覆盖熵"（`--bandEntropy`） | 买 1 格种类、卖 11~20pt 净分；v1 版是静默 no-op（相对带宽 < 打分量子） | §廿二 ‖ `scratch/econ-2x2.log` |
| 2 | GA 演化门槛 v2（镜里**出手**种类 ≥4） | 被 **Goodhart**：搜索拿反弹/防御/贴贴凑种类，`GATE2-s7` 出手 6 种而**落地种 1、最大落地份额 100%**，5P 齐跌 19~40pt | §廿四 ‖ `scratch/ga-gate2.log` |
| 3 | 蒸馏侧加标签（`--labelKindsMin/--labelSupportMin`、靶向 `--rareOnly`）+ DAgger | P-D1 败：教师在学生态里自己也开不了炮 ⇒ 没标签可给 | §廿三 ‖ `scratch/econ-dagger.log` |
| 4 | GA 门槛 v3 = **换成线上已经在用的那两条判据**（种类 = 产品门 L1 `broad` ‖ 净兑现 = `pool-frontier-lib.isWideVs`） | 判据本身有效（回认腿把 v2 三粒全数拒掉，`s13` 是被**净兑现**那条单独抓的）；三臂仍 **P-G1′~G4′ 全败**，但强度止住了 v2 那种系统性卖强度（`45.2/43.4/59.6` vs 对照 `53.3/67.5/64.1`） | §廿五 ‖ `scratch/ga-gate3.log` |

**第 4 次交出的机制读数（本表要留给你的那句）**：把三粒**产物**用门槛自己那把尺、**同 n=6** 重读，全不过线（`2.20/1.92` ‖ `1.00/1.00` ‖ `1.43/1.35`）；而 `s13` 的**末代 top-3** 打印过 `3.9/4.2G ‖ 3.08/3.37兑`（过线、且按 `gateRank[0]` 进了名人堂）。
⇒ **门槛在父母面选出了宽粒，终局当选（hall 1st 的当选键）从名人堂里挑了另一粒窄的当产物** ⇒ 只塑形不 veto 一样白做；而 §十一 我批评过的"只 veto 不塑形"是另一半。**唯一没试过的组合 = 两道关口同一把尺**（v4，等用户裁，见 §五①）。

## 三、可引用性名单（这一段最容易踩，务必按状态引用）

- ✔ **可引用**：`GA-ration-s41`（**在我这批回认样本里唯一**按 `isWideVs`(vs 起点，n=40) 判"宽"的一粒：G 3.24/3.65 ‖ 净兑现 1.50/1.52；⚠ 按绝对线 `isWide(2.0)` 仍不过）‖ `GATE3-s{7,13,41}`（新臂，产物=新个体，摘要 `b46cd640f6/80d0d309aa/32c013d73b`）‖ `GA2R-sword-s{7,13,41}`（对照）。
- ⛔ **记"未测"、不许引用为成绩**：`GATE-s*.js`（§十一 第一批，钩子接在只写不读的名人堂上 ⇒ 与对照**权重逐位同**）。
- ⚠ **只当反例引用**：`GATE2-s*.js`（§十二 v2，被 Goodhart 的那批）。
- ⚠ **`lineage.noOp` 一例**：40 代小仪器腿里"开档"产物 = 热启动起点 `GD3-SWORD.bak` **逐位同**（`be18fe715c`）⇒ 臂脚本的摘要腿从此是**三方对账**（本臂 ‖ 对照 ‖ 起点），看到"产物≠对照"别就读成"门槛买到了"。
- **在册对照/起点**：起点 `scratch/arms/GD3-SWORD.bak`（v:92，n=7993）；起点自己在 n=40 读 `G 1.65/1.30 ‖ 净兑现 1.51/1.26`——**起点本身不宽**，所以 `isWideVs` 那条线只要求"别比自己出发时窄/不出血"。

## 四、尺与旗标的变更（用错档就是整批空转）

- **门槛判据** = 两模式 `effSkills ≥3`（=产品门 `broad` 的 `pass`，`champion-gate.mjs:80-85`）∧ 两模式 `effSkillsLand ≥ 参照 − LAND_TOL(0.10)`（= `pool-frontier-lib.isWideVs`）。尺 = `T.mirrorHealth(params, n, 5, mode)`，**就是 `audit-lib.selfPlay` 的底层调用**（同 mindmg=5、同两桌，只差 n：门 20 / 门槛 6）。**参照对象不同源**（门 vs 现役池、门槛 vs 自己起点）⇒ 入池仍归产品门。
- ⚑ **`EPIRUS_GA_GATE` 语义变更**（旧剂量档从此作废）：从"eff1 ≥ n 的线"变成**只能往上收紧的种类下限 `max(3,n)`**；`=3` 与门齐平、`<3` 被夹回 3、`=99` = 饿退对照腿。带内排序键从出手熵改成**两桌净兑现之和**。每代打印 + meta `gaGate.caliber` 都写实际生效的那条。
- **蒸馏珠冒烟**改成与门 `bead` 同尺：`chargeProfile(long, n=40)`、过期 **≤5 颗/局（绝对量）**、`得珠=0 ⇒ 不适用`，超线 **rc=14 且不写产物**。⚠ 我原先那条"浪费率 ≥90%"的比率判据作废（它把"攒得极少"与"囤死"混成一格）。
- **三条 fail-fast 已带牙**（`9c3cc148`）：CEM `--stall=N`（rc=13）‖ GA `EPIRUS_STALL_ABORT` ‖ 蒸馏 `--smoke=` / `--labelSupportMin=`。腿：默认关轨迹逐字同 ✔ ‖ `GATE=99` 产物与关档**逐位同** ✔（顺带自证"镜局审计不吃主 RNG"）‖ 40 代开 vs 关不同 ✔。

## 五、留给你的三件事（都能独立执行，边界同上：不动 `js/**`、不动池/槽、不 promote、判据先于臂）

1. **v4 = 两道关口同尺**（**等用户点名才跑**，它要动当选面配方）。入口：终局 veto 在 [train-3p.mjs:2203](../../tools/train-3p.mjs) `rejectNarrowWinners(sel.clean, BREADTH_FLOOR)`，现在判的是"单桌 n=20 的**绝对** G落地 ≥ floor ∧ 最大单卡落地份额 ≤ 线"，且全塌时照样写产物只打 `breadthFloorAllNarrow` ⇒ 与门槛不同桌、不同基准。要做的是让它也走 `isWideVs`，然后与门槛同时开跑三臂（臂 ~5 分钟 + 读数 ~10 分钟）。
2. **"哪张桌判广度"这条待裁（#29）可以只用量具就答完**：同一粒包在 `ε=0`（镜/门槛/`chargeProfile`）与 `t=0.15`（arena2 格）下的 railgun/大雷 出手率差 —— 我这边已有 `GATE3-s13/s41` 一例（贪心 0 vs 采样 0.5/局）。请把它做成**成对**读数（至少 4 枚包 × 两温度 × 两桌形，带分母），别只报单粒。
3. **我欠的一条**：`s13` 那条"末代过线粒 ≠ 产物"目前靠门槛自检打印 + 产物重读**夹出来**的，没有逐代个体指纹。要做实需要 per-generation hall 指纹落盘（`--band-save` 现在只存 band 簇）——这条比 v4 便宜，可以你先动。

## 六、复现命令（仓库根目录，Windows/Git Bash）

```bash
node tools/proto2/preflight2.mjs --games=1 && node tools/proto2/selftest2.mjs   # 开任何臂之前
node scratch/wide-check.mjs --ref=scratch/arms/GD3-SWORD.bak \
  --packs=scratch/ga-arms/GATE3-s7.js,scratch/ga-arms/GATE3-s13.js,scratch/ga-arms/GATE3-s41.js --games=40   # 判宽（n=40）
bash scratch/run-ga-gate-v3-checks.sh    # 三条仪器腿（默认关逐字同 ‖ GATE=99 逐位同 ‖ 40 代开/关不同）
bash scratch/run-bead-smoke-checks.sh    # 珠冒烟三条腿（默认关逐字节同 ‖ ration4 红 rc=14 ‖ ration3 绿）
bash scratch/run-ga-gate3.sh             # v3 三臂 + 全部读数（~15 分钟，产物落 scratch/ga-arms/）
```

## 七、口径纪律（引任何数之前逐条过，今天每一条都踩过一次）

- **桌名 + 分母 + 温度 + n 一起报**；跨桌不横比；同包多骰必报散布（`GATE3-s13` 四骰散布 9.8pt，别拿单粒当数）。
- **GA 的成绩按"组/臂"引用**，不是单粒确定性产物（同 seed 重跑轨迹逐字同、产物可能不同）。
- 落盘必带 `.bak` + `.bak.meta.json` **两半**；崩在写盘之后 = 读数有效、出处丢。
- ⚠ msys 路径（`/d/code/...`）**别喂给 node fs**（§十三 那三行 ENOENT 就是这么来的）；脚本里 `$R` 只用于 cd，喂 node 的一律仓库相对路径。
- 多档产物 md5 全等先当故障查（`--bandEntropy` v1、`EPIRUS_GA_GATE` 旧剂量都是这么暴露的）。
- "分母 0"与"0%"不许同形；`skill-mastery` 的 `✔ 会开炮` 这类**温度条件**读数不进判据、只作旁证。

## 八、原件清单（`scratch/`，未跟踪；`*.log` 被 gitignore 是仓库约定）

`ga-gate3.log` ‖ `gate3-s{7,13,41}.log` ‖ `wide-check-teeth.log`（v2 旧产物回认）‖ `wide-check-gate3.log`（n=40）‖ `ga-gate3-n6.log`（产物同 n=6）‖ `ga-gate-v3.log`（三条腿）‖ `bead-smoke.log` ‖ `breadth2-gate3-s*.log` ‖ `offer-gate3-s*.{log,json}` ‖ `e5p-gate3-s*` ‖ `mastery-gate3-s*.log` ‖ 产物 `ga-arms/GATE3-s{7,13,41}.js[.meta.json]` ‖ 脚本 `run-ga-gate3.sh`、`run-ga-gate-v3-checks.sh`、`run-bead-smoke-checks.sh`、`wide-check.mjs`。
