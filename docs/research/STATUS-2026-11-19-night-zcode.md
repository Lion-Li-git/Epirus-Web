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

MS2-band2 wid=`c8f5f357ffb31a10`。**复现臂 MS2b/MS2c**（同配方 seed 77031/77032）→ 结果回填于下：

**复现：3 跑 2 中**。MS2c（seed 77032）band1 = **tank 11.9% + miniT 4.12%（multi）‖ 10.4% + 5.55%（long）——双桌形双卡全过**（wid `857b80775d5e2b80`），band3 = miniT 1.85%/0.92%（tank 弱）；MS2（seed 77022）band2 = multi 双卡（wid `c8f5f357ffb31a10`）；MS2b（seed 77031）tank 5/6 band 留存但 miniT 全零 ✗。结论：配方**可行但 band 随机性大**（3 臂各 ≥1 枚 band 载体），稳定量产仍要走事件奖励旋钮。

**机制结论（三批臂共同钉死）**：imitation 只负责"行为先发生"，**GA 保留需要事件奖励**——`SEL_CARDS` 地板数广度不数目标卡、加长教师窗也留不住 jinshield/taunt/rod/firestorm；唯一例外的 miniT 是靠"反制价值真实存在"（对手矩阵里 ringspam 常在场）被 GA 自己留下来的。下班提案：`EPIRUS_JINSHIELD_W/TAUNT_W/MINIT_W/ROD_W/FIRESTORM_W` 事件奖励族（照 `REFLECT_W` 先例，纯训练侧计数、引擎零改动），教师窗照旧。

## 八、复算命令

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
```
