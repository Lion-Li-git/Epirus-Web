# STATUS (2026-11-19 凌夜班 · zcode) — skill-report 合并尺落地 ‖ dup-cap ‖ 仓库批1清理 ‖ 训练波 R1/R2/MS

> 接力链：[PLAN-2026-11-18-late-coverage-dupcap-cleanup-zcode.md]（执行稿 v3，用户 00:5x 批准 + 三条修改：进图=观察层 / 入池=强度层 / champion-map 另开可视化页并重构观感；01:0x 追加「用普查看 T1/T2 覆盖并搞多技能包」）。
> 本班全部产物与判据可复算，命令在文末 §八。

## 0. 一句话现状

合并尺两级全链落地并 22 枚首测完毕（可视化页 `champion-map/skill-report.html` 上线）；池装配每包≤2 已实现并复验；scratch untrack −3954 tracked；训练波 R1 七臂 + R2 四臂 + MS 叠加四臂——**唯一稳定载体 = tank（A1-band3，镜像双桌形 30%+）**，其余卡的教学-退场-丢弃模式坐实，retention 需要事件奖励旋钮（下班的头号提案）。

## 一、skill-report 合并尺（批 1 · 全部落地）

| 件 | 内容 | 验证 |
|---|---|---|
| `tools/strength-lib.mjs` | A/B 核心从 `skill-report.mjs` 抽出（makeSel/runCondition/pairedDiff/needGamesPerPair/costOf 逐字搬运+参数化） | **parity：同种子 HTML/JSON 逐位一致**（scratch/parity/before|after，17522 字节全同） |
| `tools/skill-report.mjs` | 改薄调用共享核 | 上行 parity 即其验证 |
| `tools/pool-skill-report.mjs` | 两级合并尺：`--stage=1` 观察层（120 格普查，承 crossenv 机制、夹具钉现役 fixtures.tsv）‖ `--stage=2` 强度层（INSTR 配方自动化：按族分层格 + Δ_rich/Δ_nat 双经济 + 边界自适应续局 ≤24 局） | 22 枚全量首测通过（Stage1 每枚 ~16s，Stage2 每枚 ~8s） |
| `champion-map/build-skill-page.mjs` → `champion-map/skill-report.html` | 可视化页（烘焙式自包含、暗色卡片、色盲友好热力、判语沿用 skill-report 语义色；观察层=进图、强度层=入池后才出现） | 截图验收 0 JS 错误（scratch/gui-probe-out/skillpage-v3_*.png） |
| `pool-add.mjs` | `--retire=<id>`（摘表行+删 raw+留痕）；入池后自动 Stage1+Stage2（`--no-census` 跳过；失败不阻断但吼） | 冒烟：未知 id 响亮拒绝 |
| 数据 | `champion-map/data/skill-report/<id>.json` × 22（带 fixtureKey=fx-pool1119a / rulesFingerprint=4fcadaad / wid 戳）+ `fixtures.tsv` | — |

**未做（如实）**：`evidence-rot`/`--audit` 的新鲜度列（批 1e 后半）没接；firestorm 的强度配方格读「实验未生效」（它需要贴符前设，INSTR 的 `--combo=curseStorm` 自动化留给下一班）。

## 二、观察层覆盖账（22 枚 · 120 格 · ≥3 手/格判「该环境会用」）

与镜像卡谱（card-usage 60 局，本班早前跑的 20/30）对照：观察层把「偶发/环境特有」显形——armor 3 ‖ jinshield 3 ‖ miniT 3 ‖ firestorm 3 ‖ taunt 4 ‖ drain 4 ‖ tank 5 ‖ transfer 5 ‖ cannon 3 ‖ rod **1** ‖ mine 2 ‖ dualGun 2（枚数=在多少枚包里跨环境会）。镜像全零的五张在跨环境里其实有 3-4 枚「偶发载体」——与 11-16「自对局漏数」结论一致。**rod 近死（1/22）**。

**配额（观察层口径）**：T1 = 环 **6/22 (27%) ✗** ‖ 大雷 19/22 ✓ ‖ 电磁炮 19/22 ✓；T2 = 激光眼 6/22 (27%) ✓边缘 ‖ **过载炮 3/22 (14%) ✗**。缺口与 11-13/14 旧账同构，但分母换成了跨环境口径。

## 三、dup-cap（批 2）

`js/pool-draw.js` `compose` 加 `enforceCap` 修复趟（两路抽法统一逐包 ≤2；bandW 路优先本带内重抽；同 salt 可复现；池太小产 `capNote` 且 ui.js 装配行 ⚠ 显示）。POOL-CONTRACT §0 ⑥ 改「已实现」。复验：4000 桌普通 8P 每包最大出现=**2**、破例 0、重复桌 67.7%（cap2 本就允许一对，符合裁定）。门禁 np/ui 60/60。

## 四、仓库批 1 清理（批 3）

- **先归位 6 件真依赖**（untrack 前必搬）：`scratch/ladder-anchor.json` → `docs/artifacts/`（ladder/profile2 的 --anchors 默认值与 2 处注释锚同步改）‖ `scratch/zcode-1113-deps/bp-{validity,table-truth}-1118.tsv` → `docs/artifacts/zcode-1113-deps/`（**它们本来就没被跟踪** = CI 早已拿不到，arena-eval 引用改新路径后顺带 `git add -f` 补登记）‖ exam-4n 三枚夹具（GD6a-TILT-3p.bak / G5J-50.js / G5C-100.js）→ `docs/artifacts/exam4-fixtures/`。
- `git rm -r --cached scratch/` + `.gitignore scratch/`（本地全保留）：**tracked 6189 → 2235（−3954）**。
- 连带修：D191④「未登记重复」红 3 条（搬进扫描域的夹具与既存 band 副本）→ `champion-map/pack-aliases.tsv` 补 3 行 role=exam4-fixture-move → **np/ui 60/60 恢复绿**。

## 五、训练波（批 4-7 · 全部短批 100 代×5 人×24 局×pop8，热启动+教师三件套）

**R1 七臂**（`EPIRUS_IMIT_TEACHER/ONLY/OVERRIDE=1/FRAC=0.4`，产物=docs/artifacts/night1119-<臂>-band1..6.bak，§E589 对 T3P_OUT 别名拒写 ⇒ exit 9 是**设计内**，band 产物都在）：

| 臂 | 教师/基座 | 镜像验收（30 局×双桌形） | 判定 |
|---|---|---|---|
| **A1 tank** | pickTankLine / R6C-KL | band3 **30.5% multi ‖ 30.8% long**（band6 33%）| ✅ **唯一成功载体**（wid efab8849384e9e62） |
| A2 jinshield | pickToolKit / R6C-KL | 0% | ✗ 教师退场即丢 |
| A3 taunt | pickToolKit / R6B-KL | 0% | ✗ |
| B1 firestorm | pickCurseStorm / TZT2D | ≤0.03%（教师归因只 1-2 手/代）| ✗ |
| B2 miniT | pickToolKit / RING-MINIT-CONT | ≤0.21% | ✗ |
| B3 rod | pickToolKit / R6C-KL | band2 0.42%‖0.25% 近线 | ✗（差临门一脚）|
| C1 purify | pickCurseStorm / TZT2D | **exit 8 空枪自守**（教师从不净化）| ✗ 负结果：purify 无教师坐实 |

**R2 四臂**（+`EPIRUS_SEL_CARDS=6` 用卡地板 + FRAC 0.6）：jinshield/firestorm/miniT **全部仍 0%**。教训钉死：**SEL_CARDS 地板数的是"用卡张数"不是"目标卡份额"**，GA 在教师退场后照丢。

**MS 叠加四臂**（用户 01:0x 令「搞多技能包」）：hotstart=A1-band3（tank 载体）+ `EPIRUS_IMIT_PLAN="pickTankLine:0.3:tank,pickToolKit:0.5:<X>"` 分段教学 + FRAC 0.8 + 地板，X ∈ {jinshield, miniT, taunt, rod}。结果见 §七（跑完回填）。

**结论与下班头号提案**：教学-退场-丢弃是机制性的——**retention 要事件奖励**（照 `REFLECT_W`/`BLOCK_W` 先例给"目标卡成功结算"付钱：`EPIRUS_JINSHIELD_W` / `EPIRUS_TAUNT_W` / `EPIRUS_MINIT_W` / `EPIRUS_ROD_W`），教师 imitation 只负责"先发生"。需要新旋钮 ⇒ 走旋钮册登记流程，等点名。

## 六、分带前置校准（批 8）

rule 替身（`--surrogate=rule`，800 局/档，池装配）：**multi：困难 16.6% < 普通 20.9% < 简单 22.1%（困难 vs 普通 −4.25±3.75pt = 2.2σ ✓）**；**long：17.5% < 23.1% < 24.9%（2.8σ ✓）**。排序两桌形全对——legacy 替身跑反阶梯的病根在替身不在产品（与 STATUS-2026-11-18-human-diversity 同向）。**简单 vs 普通 0.6σ/0.8σ 仍分不开**：脚本席施压把简单档垫硬，这不是量具问题，是装配设计题（v2.1.1 handoff §3 的标定件继续有效）。

## 七、MS 叠加臂结果（tank 载体基座 × 分段教学 × 地板，4 臂 + 复现 2 臂）

hotstart=A1-band3 + `IMIT_PLAN="pickTankLine:0.3:tank,pickToolKit:0.5:X"` + FRAC 0.8 + SEL_CARDS=6，X ∈ {jinshield, miniT, taunt, rod}（各 6 band，30 局×双桌形验收）：

| 臂 | tank 留存 | X 卡 | 判定 |
|---|---|---|---|
| MS1 +jinshield | 6/6 band 5~24% | 0% | ✗ |
| **MS2 +miniT** | 5/6 band 10~33% | **band2 multi 1.41% ✅ / long 0.03% ✗** | **✅ 半成功：全谱系第一枚镜像会出小雷的包**（multi 稳、long 未过；wid 见下） |
| MS3 +taunt | 4/6 | 0% | ✗ |
| MS4 +rod | 4/6 | 0% | ✗ |
| MS6 +laserEye（pickLaserBank） | 6/6 band 5~32% | 0% | ✗（专职教师也没能留下——再证 retention 靠奖励不靠教学）|
| MS5 +laserEye（pickLaserBead） | 2/6 | 0% | ✗（tank 都丢了 4/6）|

**总账：19 臂**（R1×7 + R2×4 + MS×4 + 复现×2 + laserEye×2），产出 **3 枚载体**：A1-band3（tank 双桌形 30%+，wid `efab8849384e9e62`）‖ MS2c-band1（tank+miniT 双桌形，wid `857b80775d5e2b80`）‖ MS2-band2（tank+miniT multi，wid `c8f5f357ffb31a10`）。

### ⚠ 更正（01:5x 用户抓到）：19 臂全部掉进 v7 线

- **事实**：19 臂产物全部 `v:7 / 5689 张量`——SEEDPACK 祖先（R6C-KL/TZT2D）明明是 obs6（v:92/S1o/16561）。
- **根因**：我的臂没带 `EPIRUS_ARCH2` ⇒ train-3p 热启动走 `P.embedLegacy` 把 obs6 祖先**投影成 v7 张量**再训（meta.hotstartFrom 记着 2.0 父亲的 wid，张量整个掉线）。这是我漏读口径，不是工具静默故障。
- **执法**：train-3p 已加守卫——缺 ARCH2 且无 `EPIRUS_ALLOW_V7=1` ⇒ exit 5（用户裁定「禁止默认训老网络」落仓；`EPIRUS_ALLOW_V7` 已入旋钮册，全集 194）。
- **后果与回收**：三枚载体是 **v7 线包**，不能直接进 S1o 池；机制结论（教师→tank 成功 / retention 要奖励 / 载体×载体融合强化 / F4 融合双卡）与形状无关，仍成立。**2.0 线重跑**改用产线机器：`pg-train`（`--shapeKey` 事件塑形 + `--klW/--klTilt` 键频锚——retention 机制 native 存在）与 `supfit-gd`（`--teacher=pack:<v7载体>` 可把 v7 载体跨线蒸馏进 obs6）。融合工具 `tools/pack-fuse.mjs` 已就位（同盆地融合验证：F4 载体×载体双卡）。
- **训练侧理清（用户令）**：`training/README.md` 全面重写为权威地图（30 秒决策表/训练器清单/守卫说明/验尸脚本/流程速查）；已删 4 件死文件（obs2-from-v7 / grow-modebias-nmode / chain-supfit / supfit-full）；根 README 训练入口同步更正。归档候选清单（proto2 十月一次性探针 ~27 件）立在 README，下一批逐个对谱系后批量删。

MS2-band2 wid=`c8f5f357ffb31a10`。**复现臂 MS2b/MS2c**（同配方 seed 77031/77032）→ 结果回填于下：

**复现：3 跑 2 中**。MS2c（seed 77032）band1 = **tank 11.9% + miniT 4.12%（multi）‖ 10.4% + 5.55%（long）——双桌形双卡全过**（wid `857b80775d5e2b80`），band3 = miniT 1.85%/0.92%（tank 弱）；MS2（seed 77022）band2 = multi 双卡（wid `c8f5f357ffb31a10`）；MS2b（seed 77031）tank 5/6 band 留存但 miniT 全零 ✗。结论：配方**可行但 band 随机性大**（3 臂各 ≥1 枚 band 载体），稳定量产仍要走事件奖励旋钮。

**机制结论（三批臂共同钉死）**：imitation 只负责"行为先发生"，**GA 保留需要事件奖励**——`SEL_CARDS` 地板数广度不数目标卡、加长教师窗也留不住 jinshield/taunt/rod/firestorm；唯一例外的 miniT 是靠"反制价值真实存在"（对手矩阵里 ringspam 常在场）被 GA 自己留下来的。下班提案：`EPIRUS_JINSHIELD_W/TAUNT_W/MINIT_W/ROD_W/FIRESTORM_W` 事件奖励族（照 `REFLECT_W` 先例，纯训练侧计数、引擎零改动），教师窗照旧。

## 八、统一管线落地（02:3x–03:1x · 用户裁定「旧的全删了」的执行）

- **v7 线删除**：train-3p（248KB）/train-best/train-fast/train-selftest/start-train-server.cmd/server 七件（train-server/worker/paralleltrain/train-env/econ-env/fight-env）——tracked 一次性 −11 文件；产品训练场 tab（index.html+ui.js ~310 行）摘除，**导入冠军包控件回归对局区**（产品功能，非训练专属）。
- **门腿撤编**：D73/D124/D125/D121/D158/D116 整撤 + D228 摘⑥⑦⑧（纯函数腿保留）；**np 171→166 全绿**；`docs/GATE-SHIFTS.md` 记账。
- **旋钮账**：194 → **65**（在用 19 ‖ 暗键 46 列为下批删除候选）。KPI ≤40 接近达成。
- **权威地图**：`training/README.md` 全面重写（30 秒决策表 / 训练器清单 / 禁默认训老网条款 / 验尸脚本 / 流程速查）；根 README 训练入口同步。
- **2.0 载体臂（统一管线上重跑）**：`pg-train --klW=0.05 --klTilt=tank,miniT,jinshield,rod,firestorm,taunt --klTiltMul=3 --shapeKey=tank:0.2,miniT:0.15 --segEvery=1500 --games=6000`，双基座（R6C-KL ‖ EQ-S4-E9）× 2 臂 = U1/U2，结果回填 §九。

## 九、pg-train 多技能臂结果（回填槽）

**supfit-gd 蒸馏臂结果（30 局×双桌形镜像验收，≥0.5% 线）**：

| 臂 | 配方 | 双桌形读数 | 判定 |
|---|---|---|---|
| S1 | R6C-KL + toolkit 教师 | **armor 2.2% multi**（首个稳定藤甲载体）‖ **jinshield 0.5%** 过线 ‖ curse 2.4% | ✅ 两张死卡获得 2.0 线载体 |
| S2 | EQ-S4-E9 + toolkit | jinshield 0.1%/0.6% ‖ curse 2.6% ‖ snap0(long) curse 10.0% | ⚠ snap 节点可用 |
| **S3** | R6C-KL + **教师=v7 tank 载体（pack: 跨线蒸馏）** | **tank 19.7% multi ‖ 16.5% long** + armor 1.1% | ✅ **2.0 线 tank 载体达成** |
| **S4** | R6C-KL + **教师=v7 tank+miniT 载体** | final: tank 7.5% + **miniT 5.0%** multi ‖ **miniT 10.9%** + curse 7.8% long ‖ snap0: 四张稀缺卡同包 | ✅ **多技能包成立**（tank+miniT+curse） |
| U1/U2 | pg-train klTilt+shapeKey | 全零 | ✗ 负结果：klTilt 放大起点分布，零覆盖键 3×0=0（机制在 klW 注释） |

**S6/S7/S8/S9（双教师轮替与巩固波）**：

| 臂 | 配方 | 读数 | promote --dry |
|---|---|---|---|
| **S6** | pack:tank 载体 + toolkit 轮替 0.5 | tank 14.9/6.0 ‖ **armor 3.2/2.0-3.0** ‖ curse 2.2 ‖ 用卡 9-12 | **仅剩 1 阻断**：G5[long] 26% vs 25%（贴线）——广度/反弹墙/G5multi 全清 |
| S7 | pack:MS2c + toolkit 0.5 | miniT 0.9/0.7 ‖ tank 1.5 | 未跑（S6 优先）|
| S8 | S6 + toolkit 巩固一轮 | G5[long] 清了 ‖ F 还手率 17%<20%（跷跷板）| 1 阻断（换位置了）|
| S9 | frac 0.35 偏 tank | G5[long] 42% 更差 | 1 阻断 |

**promote-loop 结论**：双教师轮替解决了蒸馏窄化（S3 五阻断 → S6 一阻断贴线）；G5[long] 破龟是最后一座山（在册同类：池内 G5[long] 越线包 28-33% 的老病）。下一班的口子 = 更长步数 / teacher2frac 扫描 / snap 节点配合 promote 循环（每轮 4 分钟，标准仪器全在）。

**统一管线战果**：v7 线的 GA 发现（tank / tank+miniT 载体）经 `supfit-gd --teacher=pack:<v7包>` **跨线蒸馏**成 2.0 线产物——v7 线退役但它的**知识**通过教师机制平移。加上 S1 的 armor/jinshield，死卡（tank/jinshield/armor/miniT）在 2.0 线全部有载体；**大雷 +17.3pt**（EQ-S4-E9 强度尺读出"没学会的强招"）列 S5（chain 教师，跑批中）。
**pg-train klTilt 路线 = 负结果（8 节点全零）**，机制原因（`pg-train` klW 注释在册）：`--klTiltMul` 放大的是**起点策略分布**——起点从未用过的键 3×0=0；`--shapeKey` 又依赖键被采样（逐决策塑形挂不上未采样键，klW 注释原话）。**零覆盖键的正解 = supfit-gd 教师蒸馏**（标签来自教师、不依赖学生采样；toolkit 教师标签里正好有金刚盾 11/藤甲 11/贴贴 14/无极变速 7）。已换 `--teacher=toolkit --objective=cand --dagger=1` 蒸馏臂（S1/S2 双基座）。

## 十一、S6 入池（07:0x · 用户裁定「s6入池吧」的执行）

- **入池**：`pool-add --id=night2-S6 --tier=soft --run-promote --invite` ⇒ **池 23 枚**（8 hard ‖ 15 soft）。wid `d12c18baca6c1eab`，包正身 `docs/artifacts/night2-S6.bak`（scratch 正本同在）。
- **体检**：promote --dry --support=2 严格档仅剩 G5[long] 26%——池层按 **用户 10-12 裁定（上线档 ≤40%）自动豁免 ⇒ pass**；人席没量过（批表无此枚，seatKill=-1 如实）。
- **点名**：note 记「用户 11-19 07:0x 裁定入池」。
- **前线读数**：24 锚联盟 page 剂量 6 粒 ⇒ **B=−104.8pt（极差 36.6）**——蒸馏产物没经过长 GA 强度进化，对现役锚差距巨大，soft 带是诚实位置（补强度列下班项）。
- **普查**：入池自动跑 Stage1+Stage2 ⇒ `champion-map/data/skill-report/night2-S6.json`（并集 **19/30**，自对局 18，换招JS 0.0605；Stage2 强度 25 技·消融 10）——比 22 枚池成员的旧读数偏高，蒸馏载体的行为多样性是真的。
- **bundle**：`js/bundled-champion-pool.js` 已重烘（7043 KB，含 night2-S6）。
- **图节点未补（如实）**：`pool-sync` 报「night2-S6 不在图节点里」——coords.tsv 行是仪器链产物（exam-4n-full+attach），不手搓半空行。**下班项**：night2-S6 ‖ night1119-A1-tank-band3 ‖ MS2c-band1 三枚走 exam-4n-full --extra + attach 管线补图。

## 十二、发散臂（用户 07:0x 令「研究更发散的方法」——不许重证蒸馏成立，找方法论外的新机制）

**X1 胜局语境蒸馏**（`supfit-gd --winOnly=1`，本班新手术）：标签一律先入局内缓冲 `pend`，局终只把 **@me 席获胜**那几局落盘（平局也丢）。机制假设：DAgger 标签内容由教师定（零覆盖键照旧有解），但**学习语境的分布**由对手环境定——只留胜局语境 ⇒ 学生向「获胜状态下的教师动作」靠拢，败着语境（追不平、龟死局）不进梯度。与蒸馏成立正交：不改标签内容，只改语境。手术四件：pend/nOut 配额语义（winOnly=0 默认路径逐位不变）‖ flushPend 局终裁决 ‖ GCAP ×4 兜底（胜率 25-50% 经验带）‖ LABEL.winGamesKept/winGamesDrop 如实记账。冒烟：32 胜局留 480 组 ‖ 37 败/平丢 681 组，1.5s 绿。

**X2 融合热启动**（`pack-fuse S3×S1 t=0.5` → toolkit 巩固）：同盆地载体×载体融合（tank 系 × armor/jinshield 系）做**训练起点**而不是终点——F4 当年验证的是「融合产物本身双卡」，这次验证「融合后再蒸馏能否一次巩固出双卡宽载体」。

臂结果（30 局 × 双桌形镜像普查）：

| 臂 | 配方 | 镜像读数 | 判定 |
|---|---|---|---|
| **X1** | S6 配方 + winOnly=1，120 步 | **tank 23/26**（对照 14.9/6.0）‖ armor 3% 保住 ‖ curse 0 ‖ 用卡 7/5 | ✅ **新方法：锐化旋钮**——胜局语境让主胜招 tank ×4.3，广度同步收窄。**METHODOLOGY §149 已立**（「约束在状态分布」在采集保留端的第二根杆；含三条规矩：预注册按锐化写 / nOut 保默认逐位不变 / 开臂前先读方法论） |
| X2 | fuse-S3S1-t50 热启动 + toolkit 单教师 120 步 | 用卡 11 但 **tank/armor 全归零**（charge 13+railgun 13 主导） | ⚠ **§148.6 前半的再证实**（插值/融合产物不能当自由起点——本班内第二次重证已知结论，用户点名；新账只有下面 X2b 的后半） |
| **X2b** | 同融合起点 + **双父系教师**（pack:S3 主 + toolkit 副 0.35） | tank multi **14%** / armor long **12%** / 用卡 9，双卡保住 | ✅ **§148.6 追加后半**：融合产物当起点的唯一活法 = 教师键道 ⊇ 两父系键道；单教师巩固 = 洗掉融合 |

**班内自省（用户 07:5x 两次点名）**：X1/X2 开臂前没先读 `docs/METHODOLOGY.md` 相关节——X2 就是 §148.6 在 pack-fuse 语境的重复。此后流程钉死：**开臂前 grep 方法论相邻节 + PROPOSAL/FINDING，臂计划里写明「这是不是已有结论」**（已入 §149 规矩 3 + 记忆）。

## 十三、复算命令（更新）

```bash
# 合并尺（两级）
node tools/pool-skill-report.mjs --stage=1 --all-pool --jobs=8
node tools/pool-skill-report.mjs --stage=2 --all-pool --jobs=8
node champion-map/build-skill-page.mjs      # 烘 champion-map/skill-report.html
# dup-cap 复验
node scratch/mix-freq-1118.mjs
# 强度尺 parity
node tools/skill-report.mjs 2 1 scratch/parity/after.html --json=scratch/parity/after.json
# rule 替身阶梯
node tools/probe-diff-ladder.mjs --pool=1 --games=800 --n=5 --mode=multi --surrogate=rule
# 训练臂验收（目标卡镜像稳定性）
node tools/card-usage.mjs --packs=docs/artifacts/night1119-A1-tank-band3.bak --games=30 --mode=multi
# X1 胜局语境蒸馏（METHODOLOGY §149）
node training/proto2/supfit-gd.mjs --upstream=docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak --obs=obs6 \
  --teacher=pack:docs/artifacts/night1119-A1-tank-band3.bak --teacher2=toolkit --teacher2frac=0.5 \
  --rolloutMode=game --shapeBal=1 --classPow=0.35 --objective=cand --dagger=1 \
  --groups=3300 --steps=120 --winOnly=1 --out=scratch/arms/night2-X1-winonly.bak --tag=night2-X1-winonly
# X2/X2b 融合热启动（§148.6 后半）
node tools/pack-fuse.mjs --a=scratch/arms/night2-S3.bak --b=scratch/arms/night2-S1.bak --t=0.5 --out=scratch/arms/fuse-S3S1-t50.bak
node training/proto2/supfit-gd.mjs --upstream=scratch/arms/fuse-S3S1-t50.bak --obs=obs6 \
  --teacher=pack:scratch/arms/night2-S3.bak --teacher2=toolkit --teacher2frac=0.35 \
  --rolloutMode=game --shapeBal=1 --classPow=0.35 --objective=cand --dagger=1 \
  --groups=3300 --steps=120 --out=scratch/arms/night2-X2b-fuse.bak --tag=night2-X2b-fuse-dualT
# S6 入池链
node tools/pool-add.mjs --id=night2-S6 --pack=docs/artifacts/night2-S6.bak --tier=soft --run-promote --invite
node champion-map/pipeline/measure-point.mjs --pack=docs/artifacts/night2-S6.bak --id=night2-S6 --ver=2.0 --parent=MX8-R6C-KL --bake
```
