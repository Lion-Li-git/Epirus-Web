# PLAN · 2026-11-27 通宵班（千问执行版 v2）：审查修复 + 新指纹基线 + 双线训练 + 续班后备

> **计划定稿**：2026-11-27 23:49（UTC+8）。
> **执行窗口**：2026-11-27 23:50 → 2026-11-28 16:00；健康时延长到 18:00 做 stretch。
> **核心窗口**：23:50 → 次日 08:00；08:00 只做进度审议，不默认收工。
> **出发基线**：`main@2cef3d46`（v2.1.43，规则指纹 `442b4b68`，池 35 枚 `hard 17 / soft 18`）。
> **证据目录**：[`evidence-2026-11-27-overnight-qwen/`](evidence-2026-11-27-overnight-qwen/)。
> **授权边界**：本计划允许修复已确认缺陷、重测基线、开预注册训练臂和走完整入池链；不自动改规则设计，不物理删除文件，不推送未经验收的池变更。

---

## 一、本班目标与出发现状

### 1.1 本班必须完成的四件事

1. 修掉审查确认的 P0/P1 缺陷，重新冻结规则指纹与产品基线。
2. 在唯一夹具 `fx-pool1126d` 下重建 35 池 Stage 1、梯度可行底座和 2P/5P 难度阶梯。
3. 先验收现成 soft fallout 候选，再开最多两条训练线；每条线都必须有对照、精确 seed 和首件血统检查。
4. 08:00 根据预注册条件继续；只有全部主线和后备队列都无可执行工作时才收工。

### 1.2 已确认的出发事实

- v2.1.41 采用 B 方案：`AR-TK2` 回池，`PG-CN-S1200` 作为额外 soft 成员；池为 35 枚 `17/18`。
- v2.1.42 集中修了 11 项核心规则边界，指纹变为 `442b4b68`；v2.1.43 修了前端、池加载、AI 推理和训练服务。
- 当前 35 份 skill-report 中，33 份指纹为 `bfd49045`、2 份为 `03a9cc97`，没有一份属于 `442b4b68`。
- 当前 `pool-add --audit` 结构为 `bad=[]`，但该审计不检查规则指纹，也不统计 invited 成员的 `seatKill>0`。
- `spec 94/94`、核心/bundle 指纹、policy2/arch2 非零 argmax 的 greedy 一致性已通过；这些通过不覆盖下面的交叉缺陷。

### 1.3 审查阻断项：Phase 0 不修完，禁止进入训练或入池

| 级别 | 问题 | 必须修到的行为 |
|---|---|---|
| P0 | `train-server` 不拒绝跨站 Origin，`Origin:null` 放行，`/train` 允许 GET | 校验 Host/Origin；状态变更接口只收 POST；随机 token 为必需条件；外国 Origin 必须 403 |
| P0 | Windows `taskkill` 异步返回后立即清 `activeChild` | 等子进程 close/error 后再释放；保留 child 引用并兜底 `child.kill`；禁止两个训练进程同写 `latest.bak` |
| P1 | `validateTeacher` 拒绝合法的 `pack:<路径>` | 去掉 `pack:` 前缀后在仓内解析并验存在；仍拒绝越界和不存在路径 |
| P1 | 金刚盾主动判定不参与狙击干扰 | 金刚盾指向狙击手时，按 R13 使狙击无效；不要顺手扩整个 `ATK_EFFECT` |
| P1 | 金刚盾判定伤不触发地雷 | 非狙击攻击伤害实际落地后，按 R59 触发地雷；格挡/反弹/转移不触发 |
| P1 | 规则文档仍写过载炮“跳过金刚盾判定直接落伤” | 同步为“穿透格挡，金刚盾独立判定仍照常” |
| P1 | UI 读取不存在的 `baguaExtraNext` | 改为真实字段 `guardNext`，补下一回合徽章回归 |
| P1 | session 新多人包被本地旧包优先压住 | session 新包优先；本地持久化失败时仍应用新包并明确提示 |
| P2 | 整表校验只做单向成员检查 | 增加 ID 集合、数量、wid 和重复 ID 全等校验；截断/重复必须红 |
| P2 | pool-draw/evo 等修复缺对应回归 | 补 2P `bandW`、2.0 `beliefSearchPick`、`wrapBotN` 保留 bead 的定向断言 |

### 1.4 明确不做

- 不重跑 `--group=engine` 整轮门禁；共享树不直接用 `gate-all --auto` 把别人的改动算进本班。
- 不做 2P 独立子池（D-34）或推理端路由（D-35）。
- 不动 `lv:sparring` 的 `scriptMix` 签名，不把 `long` 倒挂“修”掉。
- 不重跑 11-26 已淘汰的 W1/W2/W3/W4、T1–T3/T6/T7、R1–R3。
- 不把 `dualGun/mirror` 训练载体当本班主线；只允许状态窗诊断和方案记录。
- 不物理删除代码、权重或临时目录；清理一律先对账 `registry.tsv`，再整体挪到仓外隔离目录。

---

## 二、铁律、口径与预注册模板

### 2.1 过程护栏

- 并行子进程最多 2；`measure-point` 必须显式 `--jobs=2`，不能使用默认最高 10 并发。
- 新臂第一枚 `.bak` 落盘立即验 `v:92 / S1o / 16561` 和 `selftest3`。
- `selftest3` 红只禁止从该快照继续梯度训练，不单独否决冻结推理；但必须记录，不得隐瞒。
- 后台任务靠完成通知，不前台 sleep 轮询；不修改正在运行的脚本。
- 每个训练臂开跑前先写一行 `TRAINING-RUN-LOG`：seed、底座、全部非默认参数、输出路径、假设、止损。
- 每个候选的读数必须带 `rulesFingerprint`、`fixtureKey`、`champ=`、seed、局数和桌形。

### 2.2 三轴与池级分开

- A：脚本考卷；B：24 锚 Arena；C=(A+B)/2。三者必须同看。
- 单包强度不等于池级效果；候选必须做同抽签、同 seed、同位替换模拟。
- 2P 同时看 `rule/legacy`；5P 同时看 `multi/long`。
- 难度阶梯的正确方向是 **hard < regular < sparring**（替身夺冠率越低越强）。
- `arenaOverBand` 非零时，单次 Arena B 只能当读数，不能当池内排序键。

### 2.3 珠经济验收：禁止“少蓄少废”假改善

每个候选同时报：

- `elecGained / elecSpent / elecExpired` 的绝对值和 `/局`；
- `boomGained / boomSpent / boomExpired` 的绝对值和 `/局`；
- `spent/(spent+expired)` 与 `spent/gained`，并写明分母；
- 2/3/5/8P × multi/long 剖面；
- charge/railgun/cannon 的使用次数与有效格。

预注册达标必须同时满足：

1. 过期电珠 `/局` 相对底座下降 ≥40%；
2. 花珠绝对值不低于底座的 80%，不得靠停止蓄能刷闭环；
3. 分母 ≥20 时闭环 ≥45%；分母不足写 `readable=false`，不写 0%；
4. 立身技能有效格不归零，降幅 ≤30%；
5. Arena B 不劣于底座 2pt，2P rule/legacy 退化 ≤2pt；
6. promote 0 阻断、两 seed 人席 `seatKill=0`、池级阶梯不倒挂。

### 2.4 训练臂预注册模板

每臂只允许改动一个“处理包”；对照臂与处理臂除处理包外逐项相同：

- `UP`：完全相同；
- `SEED`：完全相同；
- `GAMES/BATCH/LR`：完全相同；
- `ARENA_SHAPES`：完全相同；
- `KL_W/KL_MODES`：完全相同；
- `OUT/TAG`：不同且显式；
- 处理包：例如 Stage C 三旋钮整体开关，不声称拆开了某个旋钮的独立贡献。

禁止 `--games=2400..3600`、`--klW=<视漂移>` 这类范围或占位符；`pg-train` 会把非法数字静默回退成 24000 或 0。

### 2.5 止损与换线

- 首件血统错或 `selftest3` 红：立即停该臂，不继续梯度。
- 第一枚完整候选无行为信号：停止该线，不扫 lr/KL/seed 剂量。
- 立身技能跌破阈值：可用更早快照，不允许盲目拉长到 4800 局。
- 两臂都无信号：换预备队，不用重复测量填时间。
- 任何池级台阶倒挂 ≥2σ：暂停入池，先归因，不把候选强度当修复证据。

---

## 三、阶段执行线

### Phase 0（23:50–00:50 · 60 min）— 审查修复与定向验收【硬前置】

#### 0A 训练服务安全与生命周期

- 加 Host/Origin 校验和随机 token；token 由服务启动时生成，UI 通过显式参数读取并只存 sessionStorage。
- `/train`、`/reset` 只接受 POST；GET 返回 405；无 token 或外国 Origin 返回 401/403。
- 保留 `file://` 的 `Origin:null` 使用能力，但必须带正确 token。
- 修复 `pack:<路径>` 教师解析。
- `killActive` 不清引用直到 close/error；Windows `taskkill` 结束后再允许新训练，非 Windows 用 `child.kill` 兜底。
- 新增安全自检：外国 Origin、`Origin:null` 无 token、GET `/train`、连续 `/reset`→`/train`、`pack:` 合法/越界路径。

#### 0B 金刚盾交叉规则

- 在狙击干扰路径显式识别“金刚盾声明目标为狙击手”。
- 在 `MINE_TRIGGER` 加入金刚盾；仍由 `deliverDamage` 的落地结果决定是否触发。
- 不直接扩 `ATK_EFFECT`；相抵和过载炮反制是否纳入金刚盾不在本班擅自扩大。
- 补两条交叉用例：
  - P0 狙击 P1，P1 金刚盾指向 P0，判定胜：狙击无效，P0 吃金刚盾 1 伤；
  - P1 带雷，P0 金刚盾命中 P1：P1 掉 1、雷炸 P0，且产生 mine 事件。
- 同步 `docs/RULES-2P.md` 的过载炮旧句。

#### 0C UI 与池加载

- `baguaExtraNext` 改 `guardNext`。
- session 新多人包优先于本地旧包；持久化失败仍应用并提示。
- 整表校验改为双向集合相等：数量、ID 集合、wid、重复 ID 全部一致。
- 补截断整表、重复 ID、错误 wid、session 包覆盖旧包、下一回合变速徽章回归。

#### 0D 定向验收与指纹冻结

```bash
set -o pipefail
EVID=docs/research/evidence-2026-11-27-overnight-qwen
mkdir -p "$EVID"
node --check training/server/train-server.mjs
node --check js/ui/ui.js
node --check js/pool-loader.js
node --check js/core/resolve.js
node tools/spec-run.mjs | tee "$EVID/phase0-spec.txt"
node tools/np-test.mjs --only=D126
node tools/np-test.mjs --only=N21
node tools/np-test.mjs --only=N22b
node tools/np-test.mjs --only=N22c
node tools/np-test.mjs --only=D23
node tools/np-test.mjs --only=D166
node tools/probe-pool-loader.mjs | tee "$EVID/phase0-pool-loader.txt"
node tools/audit-lib-selftest.mjs | tee "$EVID/phase0-audit-lib.txt"
node tools/smoke.mjs | tee "$EVID/phase0-smoke.txt"
node tools/battle-test.mjs | tee "$EVID/phase0-battle.txt"
node tools/rules-fingerprint.mjs | tee "$EVID/phase0-fingerprint.txt"
node training/knobs.mjs --check | tee "$EVID/phase0-knobs.txt"
```

**退出条件**：上述全绿、新指纹已记录、两个冠军 bundle 指纹同步、工作树可提交。00:50 未完成则整体顺延，禁止带旧指纹开训。

### Phase 1（00:50–02:20 · 90 min）— 新指纹全池基线重建

#### 1A Stage 1 全池普查

```bash
set -o pipefail
EVID=docs/research/evidence-2026-11-27-overnight-qwen
node tools/pool-skill-report.mjs --stage=1 --all-pool --jobs=2 | tee "$EVID/phase1-skill-stage1.txt"
node tools/pool-skill-report.mjs --bake | tee "$EVID/phase1-skill-bake.txt"
node "$EVID/shape-skill-profile.mjs"
```

- 35 份 JSON 必须同 `fixtureKey=fx-pool1126d`、同新指纹。
- `shape-skill-profile.mjs` 会写死旧证据目录；先在副本中把 `OUT` 改到本班目录，禁止覆盖 11-26 原件。
- 本阶段只重跑 Stage 1，不重跑全池 Stage 2 强度消融。

#### 1B 梯度可行底座普查

- 逐枚调用 `node training/proto2/selftest3.mjs <包路径>`，输出到 `phase1-selftest3-pool.txt`。
- 旧架构/legacy 包单独标 `unsupported`，不得把投影成功误写成 2.0 绿色。
- 重点更新：`DR-R3E`、`JN-DR`、`nov21-taunt-dsp0b`、`HL-G1`、`PG-DR`、`T65-RINGBEAD`、`TF-DR`、`OBS6E9`、`FS-DR`、`RD-PG`。

#### 1C 受影响包同 seed 规则回归

- 建仓外只读对照工作树：`git worktree add --detach D:/code/Epirus-Web-fp-before 2cef3d46`。
- 对照树跑旧指纹，当前树跑 Phase 0 后的新指纹；同包、同 seed、同剂量。
- 至少覆盖：`JN-DR`、`HL-G1`、`FS-DR`、`FS2-LE26`、`TK-FS4`、`RD-PG`、`MN-PG`、`PG-CN`、`nov21-taunt-dsp0b`、`OBS6E9`、`DR-R3E`。
- 单枚 Arena B 用 `node tools/arena-eval.mjs --pack=<包> --id=<id> --dose=page --seed=82200 --jobs=2`，stdout 落证据文件。
- 胜率变化 >2pt 或局长变化 >2 回合的包必须逐项归因；不得用“规则变了”一句带过。

#### 1D 2P/5P 难度阶梯矩阵

```bash
set -o pipefail
EVID=docs/research/evidence-2026-11-27-overnight-qwen
for s in 95001 95002 95003 95004 95005 95006 95007 95008; do
  node tools/probe-diff-ladder.mjs --pool=1 --n=2 --mode=standard --games=1000 --seed="$s" --surrogate=rule \
    > "$EVID/phase1-2p-rule-$s.txt"
  node tools/probe-diff-ladder.mjs --pool=1 --n=2 --mode=standard --games=1000 --seed="$s" --surrogate=legacy \
    > "$EVID/phase1-2p-legacy-$s.txt"
done
for s in 95001 95002 95003 95004; do
  node tools/probe-diff-ladder.mjs --pool=1 --n=5 --mode=multi --games=400 --seed="$s" --surrogate=legacy \
    > "$EVID/phase1-5p-multi-$s.txt"
  node tools/probe-diff-ladder.mjs --pool=1 --n=5 --mode=long --games=400 --seed="$s" --surrogate=legacy \
    > "$EVID/phase1-5p-long-$s.txt"
done
```

**退出条件**：四桌形均有均值、逐 seed 和 CI；2P 必须是 hard < regular < sparring；5P long 若普通/简单倒挂，先定位 `pool-draw` 或成员构成，不直接开训。

### Phase 2（02:20–03:50 · 90 min）— 现成 soft fallout 候选完整筛选

候选顺序：

1. `scratch/arms/nov27-long-pgdr-l1b.seg1200.bak`；
2. `scratch/arms/nov27-long-pgdr-l1b.seg600.bak`；
3. `scratch/arms/nov27-long-pgdr-l1b.seg2400.bak`；
4. `scratch/arms/nov27-pg-rod-s1.seg1800.bak`。

每枚按顺序完成：

```bash
set -o pipefail
EVID=docs/research/evidence-2026-11-27-overnight-qwen
ID=<候选ID>
CAND=<候选路径>
node training/proto2/selftest3.mjs "$CAND" | tee "$EVID/$ID-selftest3.txt"
node tools/pool-skill-report.mjs --stage=1 --candidate="$CAND" --jobs=1 --out="$EVID/skill-$ID" \
  | tee "$EVID/$ID-stage1.txt"
node tools/promote-champion.mjs "$CAND" --dry --support=2 \
  | tee "$EVID/$ID-promote-dry.txt"
node champion-map/pipeline/measure-point.mjs --pack="$CAND" --id="$ID" --ver=2.0 --bake --jobs=2 \
  | tee "$EVID/$ID-measure.txt"
node tools/probe-human-seat.mjs --packs="js/bundled-champion-3p.js,$CAND" --games=200 --modes=multi,long --seed=90210 \
  > "$EVID/$ID-seat-90210.tsv"
node tools/probe-human-seat.mjs --packs="js/bundled-champion-3p.js,$CAND" --games=200 --modes=multi,long --seed=90211 \
  > "$EVID/$ID-seat-90211.tsv"
```

- A/B/C、promote、人席、覆盖代价全部落盘后才做池级模拟。
- 池级模拟在仓外副本工作树改 `pool-members.tsv`，不碰活表；同抽签、同 seed、同位替换。
- 只有 2P rule/legacy 与 5P multi/long 全通过才进入 Phase 5 入池；否则留候选，不自动入池。

### Phase 3（03:50–06:30 · 160 min）— A 线：hard 高废珠清理（对照 + 处理）

#### A0：同底座无 Stage C 对照

```bash
node training/train.mjs --mode=pg \
  --up=docs/artifacts/DR-R3E.bak \
  --games=2400 --batch=48 --lr=0.0003 --seed=20261128 \
  --lamC=0 --lamF=0 --lamExp=0 --penDeadElec=0 --beadSpendW=0 \
  --klW=0.35 --klModes=standard \
  --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long \
  --segEvery=600 --out=scratch/arms/nov28-dr-r3e-a0.bak --tag=nov28-dr-r3e-a0
```

#### A1：Stage C 处理

```bash
node training/train.mjs --mode=pg \
  --up=docs/artifacts/DR-R3E.bak \
  --games=2400 --batch=48 --lr=0.0003 --seed=20261128 \
  --lamC=0 --lamF=0 --lamExp=1.10 --penDeadElec=0.70 --beadSpendW=0.50 \
  --klW=0.35 --klModes=standard \
  --arenaShapes=2:standard@2,3:multi,5:multi,5:long@2,8:multi,8:long \
  --segEvery=600 --out=scratch/arms/nov28-dr-r3e-a1.bak --tag=nov28-dr-r3e-a1
```

- A0/A1 同时最多两路；首枚 seg600 落盘立即验血统和 `selftest3`。
- 第一枚完整候选按 §2.3 验收；不达标则停 A 线，不扫 lr/KL。
- A1 有信号后，A2 才允许换第二起点 `JN-DR`（仅 Phase 1 为绿）或 `FS-DR`（仅 Phase 1 为绿）；第二起点用于检验是否只对 DR 血缘有效。
- `nov21-taunt-dsp0b` 留作 A3 后备；不得重跑 PG-DR+taunt 教师，只允许自身底座 Stage C，且 KL 保住 taunt ≥8 格。

### Phase 4（06:30–08:00 · 90 min）— B 线：新规则窗口诊断与镜像对照

- 先诊断，不先开训：
  - 金刚盾主动判定的可负担窗口、声明目标分布、胜率与触发后的收益；
  - 全息在大雷/激光眼下的生存贡献；
  - 天火转移与原型制控交叉后的真实兑现。
- 从 `evidence-2026-11-26-value-coverage/` 复制诊断脚本到本班目录并改 `OUT`；禁止覆盖旧证据。
- 只有发现“可负担、高收益、但现役包明确不用”的窗口，才开一组轻剂量处理 vs 同 seed 无修改对照。
- 若 15 分钟诊断没有明确窗口，B 线只落诊断结论，剩余时间转 Phase 6 或后备队。

### Phase 5（08:00–09:30 · 90 min）— 08:00 进度审议与首轮入池

08:00 不自动收工，按下列条件裁决：

- Phase 0/1 未完成：继续修基线，禁止训练和入池。
- 有候选通过单包但未做池级模拟：继续模拟，不提前入池。
- 至少一枚候选通过完整链：执行一次入池，优先替换 `seatKill>0` 且角色可替代者；不允许一夜连换多枚。
- 全部主线无信号：转 Phase 6/9 后备队，不重复测量。

入池标准链：

```bash
set -o pipefail
EVID=docs/research/evidence-2026-11-27-overnight-qwen
ID=<候选ID>
CAND=docs/artifacts/<候选文件>.bak
TARGET=<被替成员ID>
TIER=soft
git add -f "$CAND"
node tools/promote-champion.mjs "$CAND" --dry --support=2 \
  | tee "$EVID/$ID-promote-final.txt"
node champion-map/pipeline/measure-point.mjs --pack="$CAND" --id="$ID" --ver=2.0 --bake --jobs=2 \
  | tee "$EVID/$ID-measure-final.txt"
node tools/pool-add.mjs --retire="$TARGET"
node tools/pool-add.mjs --id="$ID" --pack="$CAND" --tier="$TIER" \
  --run-promote --seat="$EVID/$ID-seat-90210.tsv,$EVID/$ID-seat-90211.tsv" --arena=6 \
  | tee "$EVID/$ID-pool-add.txt"
```

- `pool-add` 按 id 排序会改变抽签顺序：入池前保存整张表顺序，入池后恢复原顺序并把 `ID` 放到 `TARGET` 原行号，不能只移动候选一行。
- 若 `TARGET` 是 soft 头 1，替换会改变真包夹具：必须升代 `fixtures.tsv` 的 `fixtureKey` 与 `real-opponents`，旧/新读数不混表。
- 两 seed 人席证据追加到 canonical `pool-seat-90210/90211.tsv` 时只追加候选行，保留既有基准和成员行。
- 入池后必须重跑：

```bash
node tools/pool-skill-report.mjs --stage=1 --pack="$ID" --jobs=1
node tools/pool-skill-report.mjs --stage=2 --pack="$ID" --jobs=1
node tools/pool-skill-report.mjs --bake
node tools/build-pool-bundle.mjs --split --ver=p1128a
node champion-map/rebuild-map.mjs
node tools/probe-diff-ladder.mjs --pool=1 --n=2 --mode=standard --games=1000 --seed=77000 --surrogate=rule
node tools/probe-diff-ladder.mjs --pool=1 --n=2 --mode=standard --games=1000 --seed=77000 --surrogate=legacy
node tools/probe-diff-ladder.mjs --pool=1 --n=5 --mode=multi --games=400 --seed=77000 --surrogate=legacy
node tools/probe-diff-ladder.mjs --pool=1 --n=5 --mode=long --games=400 --seed=77000 --surrogate=legacy
node tools/pool-add.mjs --audit
```

- 产品 `seed=77000` 必须与入池前的同位替换模拟一致；不一致先查槽位，不查权重。
- `bad=[]` 之外单独统计 invited 的 `seatKill>0`，不得把审计忽略项说成清零。

### Phase 6（09:30–12:00 · 150 min）— C 线：soft 5P long 防软化

候选靶点按新指纹读数重排，不沿用旧 Arena B 排序：

1. `MSB11-R1S130778313`；
2. `RINGB11` / `SOFT-RING-C3G25`；
3. `MX6-GD-TF20` / `MX8-TN35-KL3` / `MX8-R6B-KL` / `RING-MINIT-CONT`。

规则：

- 先算每项技能的池内深度和角色，不只看 30 技并集；唯一载体不得归零，armor/tank/rod/taunt 等角色必须有人接。
- 候选优先来自 Phase 2 现成快照和 Phase 3 淘汰但 5P 强健的中间快照。
- 每次只模拟一个替换；2P/5P 全矩阵通过才入池。
- 目标是降低 soft 废珠和 seatKill，不是单纯增加 soft 数量。

### Phase 7（12:00–14:00 · 120 min）— 第二起点与复现

- 对 Phase 3 有信号的处理包，用第二绿色起点按同配方复现。
- 两个起点都同向才写机制结论；只有一个起点时只写“在该底座成立”。
- 对进入池的候选补 2P 八 seed 与 5P 四 seed 的最终阶梯，不只依赖 08:00 的单 seed 复核。
- 若第二起点反号，保留两列，不挑有利起点汇报。

### Phase 8（14:00–16:00 · 120 min）— 完整验收、页面与交接

- 对本班所有入池成员逐枚补完 promote、measure、人席、Stage 1/2、同位替换和产品阶梯。
- 重烘 bundle、manifest、skill-report、演化图和 README/CHANGELOG 当前现状。
- 定向门：

```bash
node tools/spec-run.mjs
node tools/np-test.mjs --part=ship-pool
node tools/np-test.mjs --part=meta-repo
node tools/np-test.mjs --only=D16
node tools/np-test.mjs --only=D168
node tools/smoke.mjs
node tools/battle-test.mjs
node champion-map/rebuild-map.mjs
```

- 写 `RESULTS-2026-11-28-overnight-qwen.md` 和 `HANDOFF-2026-11-28-morning.md`。
- 16:00 做第二次收工审议；仍有合格后备臂则延长，不为了到点而停。

### Phase 9（16:00–18:00 · 120 min，stretch）— 后备队列

按顺序取，不并行超过 2：

1. transfer 状态窗诊断：声明数、可负担窗口、真实 `to` 兑现、2/3/5/8P 剖面；只诊断，不继续堆 transfer。
2. dualGun/mirror 载体诊断：可达性、目标分配、AI 选择率、规则交互；只出方案，不自动开训。
3. soft 角色覆盖审计：armor/tank/rod/taunt/railgun 的深度与唯一载体。
4. P3 工程债务清单：
   - Pages 构建排除 `champion-map/archive/`，先量站点体积再改；
   - training workflow 补 `js/train/policy2.js` 触发路径；
   - `training/knobs.mjs` 185 键的清理前置对账，不在本班物理删代码。
5. 权重考古与旧指纹读数标注：只标过期，不把旧数混进新表。

---

## 四、时间盒总览

| 时段（UTC+8） | 核心目标 | 硬退出/续班条件 |
|---|---|---|
| 23:50–00:50 | Phase 0：审查修复、定向验收、新指纹冻结 | 未全绿禁止进入 Phase 1 |
| 00:50–02:20 | Phase 1：35 池 Stage 1、selftest3、规则回归、阶梯矩阵 | 四桌形基线落盘后才开候选 |
| 02:20–03:50 | Phase 2：现成 fallout 候选完整筛选 | 单包全通过才做池级模拟 |
| 03:50–06:30 | Phase 3：A0/A1 对照与处理，按信号开 A2 | 首件红停臂；无信号换线 |
| 06:30–08:00 | Phase 4：新规则窗口诊断，最多一组镜像对照 | 无窗口不硬开训 |
| 08:00–09:30 | Phase 5：08:00 审议 + 首轮入池 | 不默认收工；按预注册条件续班 |
| 09:30–12:00 | Phase 6：soft 5P long 角色覆盖与替换 | 每次只换一枚 |
| 12:00–14:00 | Phase 7：第二起点复现与最终阶梯 | 反号保留，不挑起点 |
| 14:00–16:00 | Phase 8：完整验收、重烘、RESULTS/HANDOFF | 16:00 再审议，不自动停 |
| 16:00–18:00 | Phase 9：transfer/dualGun/覆盖/P3 后备 | 全部无可执行工作才收工 |

---

## 五、常用命令速查

```bash
# 0. 结构与旋钮
node tools/rules-fingerprint.mjs
node training/knobs.mjs --check

# 1. 当前指纹 Stage 1（不是 --all）
node tools/pool-skill-report.mjs --stage=1 --all-pool --jobs=2
node tools/pool-skill-report.mjs --bake

# 2. 单包血统（位置参数）
node training/proto2/selftest3.mjs docs/artifacts/<pack>.bak

# 3. 晋升（位置参数；--dry 不写 promote.tsv）
node tools/promote-champion.mjs docs/artifacts/<pack>.bak --dry --support=2

# 4. 测绘（正确目录；必须 --id；显式限并发）
node champion-map/pipeline/measure-point.mjs \
  --pack=docs/artifacts/<pack>.bak --id=<ID> --ver=2.0 --bake --jobs=2

# 5. 人席两 seed（先落证据，不覆盖 canonical 全表）
node tools/probe-human-seat.mjs \
  --packs=js/bundled-champion-3p.js,docs/artifacts/<pack>.bak \
  --games=200 --modes=multi,long --seed=90210
node tools/probe-human-seat.mjs \
  --packs=js/bundled-champion-3p.js,docs/artifacts/<pack>.bak \
  --games=200 --modes=multi,long --seed=90211

# 6. 入池（产物先 git add -f；--run-promote 才会写 promote 日志并同步表）
node tools/pool-add.mjs --id=<ID> --pack=docs/artifacts/<pack>.bak --tier=soft \
  --run-promote --seat=<90210.tsv>,<90211.tsv> --arena=6

# 7. 重烘与审计
node tools/build-pool-bundle.mjs --split --ver=p1128a
node champion-map/rebuild-map.mjs
node tools/pool-add.mjs --audit
```

---

## 六、DONE / DOING / NEXT（交班起点）

### DONE

- v2.1.41–43 已提交推送；当前池 35 枚 `17/18`，结构审计 `bad=[]`。
- Phase 0 已提前完成：训练服务认证/生命周期 `6b47442a`、金刚盾交叉规则 `f4b8e1bd`、UI/整表校验 `5307ebe0`，均已推送。
- 新规则指纹冻结为 `c61298e6`；`spec 96/96`、训练服务自检、池加载自检、`ui-contract 8/8`、`meta-repo 13/13`、`ship-pool 1/1`、`D16`/`D168`、训练栈 37 条、真实 Chrome `SMOKE OK`/`BATTLE OK` 全绿。
- Phase 1 已完成：35/35 Stage 1 对齐新指纹；底座 28 绿/4 红/3 legacy；2P rule/legacy 八 seed 与 5P multi/long 四 seed 全部保序；受影响包 Arena 回归首 seed 三处变化在第二 seed 全部归零。
- Phase 1 结果见 [`RESULTS-2026-11-28-phase1-baseline.md`](RESULTS-2026-11-28-phase1-baseline.md)。
- Phase 2 已完成：`L1B-S600` 完整链通过并原位替换 `RING-MINIT-CONT`，v2.1.45 池维持 35 枚 `17/18`；全矩阵与产品 `seed=77000` 四桌形全部保序。
- Phase 2 结果见 [`RESULTS-2026-11-28-phase2-fallout.md`](RESULTS-2026-11-28-phase2-fallout.md)。
- Phase 3 A 线已完成并淘汰：A1 全部快照花珠绝对量仅 A0 的 13.1–19.7%，属于“少蓄少废”假改善；不开第二起点。结果见 [`RESULTS-2026-11-28-dr-r3e-stage-c.md`](RESULTS-2026-11-28-dr-r3e-stage-c.md)。
- Phase 4 已完成：金刚盾/全息高可负担窗口的强制使用对照全部负收益，B 线不开训。结果见 [`RESULTS-2026-11-28-phase4-rule-window.md`](RESULTS-2026-11-28-phase4-rule-window.md)。
- Phase 6 已完成：`L1B-S1200` 原位替换 `RINGB11`，v2.1.46 池维持 35 枚 `17/18`；全矩阵与产品 `seed=77000` 四桌形全部保序，覆盖只增不减。
- Phase 6 结果见 [`RESULTS-2026-11-28-phase6-soft-screen.md`](RESULTS-2026-11-28-phase6-soft-screen.md)。
- transfer 状态窗诊断完成：`TF-DR` 长程兑现 0–12.5%，`AR-TK2` 条件兑现更高；不开 transfer 训练。结果见 [`RESULTS-2026-11-28-transfer-window.md`](RESULTS-2026-11-28-transfer-window.md)。
- dualGun/mirror 诊断完成：全池仅 1 次有效双枪、0 次镜面；不开载体训练。结果见 [`RESULTS-2026-11-28-dualgun-mirror.md`](RESULTS-2026-11-28-dualgun-mirror.md)。
- 最终交接见 [`HANDOFF-2026-11-28-morning.md`](HANDOFF-2026-11-28-morning.md)。
- 计划命令已按真实 CLI 重写；明确 `hard < regular < sparring`、候选同位替换、人席两 seed、产物跟踪和槽位恢复。
- 计划工作量扩为核心 8 小时 + 续班 8 小时 + 2 小时 stretch；08:00 与 16:00 只审议，不默认收工。

### DOING

- 无训练进程、无入池操作、无后台测量在跑。

### NEXT

- 02:03 起收口：等待 `aef11ee9` CI 回执；本班不再主动改池或开新训练臂。
- A/B 线均已收口，不再扫 lr/KL/seed；下一班若要继续训练，先提出清单外的新假设。
