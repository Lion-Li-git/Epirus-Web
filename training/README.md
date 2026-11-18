# training/ —— 训练侧独立子仓

> 改训练侧的东西**先读这一页**。产品侧不跑训练门禁；本目录自成一体。
> 2026-11-19 凌夜全面改写：此前本页把 `train-3p` 标成「2.0 产线主力」——**那是错的**（它默认是 v7 GA），
> 直接导致一整夜 19 臂掉进 v7 线（2026-11-18 事故，见 §二）。现在这页是权威地图，谁不确定就查这里。

## 〇、30 秒决策表：我要训练，用哪个入口？

| 你要做什么 | 用哪个 | 别用哪个 |
|---|---|---|
| **2.0 (obs6) 包的强化/塑形后训练**（现役主力） | `proto2/pg-train.mjs`（REINFORCE + `--shapeKey` 事件塑形 + `--klW/--klTilt` 键频锚 + `--segEvery` 多节点） | ❌ 不要用 train-3p 裸跑（会掉 v7 线） |
| **2.0 包的教师蒸馏 / DAgger / 多教师** | `proto2/supfit-gd.mjs`（`--teacher=toolkit|chain|v7mix|pack:<v7包路径>` + `--teacher2/3/4` 轮替键道；EQ-S4/TZ2C/DIV 系全出自它） | ❌ supfit-full / chain-supfit 已删（11-19，CEM 时代前身） |
| **GA + 教师三件套（2.0 形状）** | `train-3p.mjs` **必须带 `EPIRUS_ARCH2=S1o:input=obs6,gen=3,keySplit=1`**（obs6 祖先可直接热启动） | ❌ 缺 ARCH2 ⇒ exit 5（2026-11-19 起禁止默认训老网络，见 §二） |
| 2P v7 旧线（**冻结维护**，js/bundled-champion.js 的产线） | `train-best.mjs`（择优）／`train-fast.mjs`（快速） | 新实验不许开在 v7 线 |
| 页内「训练场」tab 的本机服务 | `start-train-server.cmd` → `server/train-server.mjs` | 它是 **v7 旧线**（2–5 人），产不出池里的 2.0 包——产品债，挂账在根 README「已知限制」 |
| 旋钮改了/加了 | `node training/knobs.mjs` 重生成册（**--check 供 CI**） | — |
| 训练侧自检 | `node training/train-selftest.mjs` | — |

> ⚠ 历史包袱提示：`train-3p.mjs` 不带 `ARCH2` 时会经 `P.embedLegacy` 把 obs6 祖先**投影成 v7 张量（5689）**
> ——meta.hotstartFrom 记着 2.0 父亲的 wid，张量却整个掉进旧线。2026-11-18 夜 19 臂全部栽在这里。
> 该投影路径现在被守卫拦住（exit 5），v7 线要跑必须显式 `EPIRUS_ALLOW_V7=1` 点名。

## 一、训练器清单（谁在产线上、谁冻结、谁已删）

### 产线（2.0 · obs6 · S1o 容器 v:92）

| 入口 | 机制 | 产物作证 |
|---|---|---|
| `proto2/pg-train.mjs` | REINFORCE + 行为塑形常驻（λc 充能链 / λf 电磁炮 / `--shapeKey=key:weight` 任意卡塑形）+ `--klW/--klTilt/--klTiltMul` 批级键频锚（mode-covering，不依赖键被采样）+ `--segEvery` 多节点快照防漂移 | 11-14 obs6-coldstart 系、DIV 系的 PG 腿 |
| `proto2/supfit-gd.mjs` | 教师蒸馏精确梯度版（Adam+反传）；教师 = `toolkit`（杂货铺本体：聚能环 3 珠链/避雷针/大雷三层选靶/贴贴渐进/过载炮 phase/断环）｜`chain`｜`v7mix`｜`pack:<v7包>`（**任意 v7 包当教师 = 跨线蒸馏**）｜`--teacher2/3/4` 键道轮替；`--objective=key|cand`（珠种/目标要 cand）；`--dagger` DAgger 轮 | EQ-S4 系（recipe：lr 4e-4/steps 180/groups 3300/objective=cand/dagger=1/classPow=0.35/shapeBal=1）、TZ2C 链 |
| `proto2/pg-lib.mjs` / `arena2.mjs` / `roster-lib.mjs` / `chain-lib.mjs` / `skill-mastery.mjs` | 上两台的共用库（tape 反传 / 对手表 / 桌形 / 链教师 / 预示式代理）——单一来源，不许抄第二份 | — |

### GA 入口（train-3p：v7 默认线已被守卫锁死）

| 入口 | 说明 |
|---|---|
| `train-3p.mjs` | 多人 GA（名次适应度+座位轮换+多对手池）。**2026-11-19 起缺 `EPIRUS_ARCH2` ⇒ exit 5**；带 ARCH2 时张量/变异/交叉/打包全部切 2.0（§E821，`arch2.mjs` 覆盖实现）。`EPIRUS_ALLOW_V7=1` = 显式 v7 例外臂（账上必须写明） |
| `train-best.mjs` / `train-fast.mjs` | 2P v7 择优/快速（`js/bundled-champion.js` 的产线）——**冻结维护**：修 bug 可以，新实验不许 |

### 冻结线（v7 · 产品还挂着，只维护）

| 入口 | 说明 |
|---|---|
| `server/train-server.mjs`（+ worker/paralleltrain/wall-cap/shape-scorer/train-env） | 页内训练场的 SSE 服务：v7 · 2–5 人。**产不出池里的 2.0 包**——迁 2.0 或页面显式标注，二选一，挂账 |
| `server/opp-pool.mjs` / `opp-champs.mjs` / `knob-guard.mjs` / `econ-env` / `fight-env` | 对手池 + 名字→包唯一入口 + 旋钮闸 + 奖励旋钮表——产线与考卷共用，**活** |

### 本班已删（2026-11-19，破坏性替换授权内）

`proto2/obs2-from-v7.mjs`（obs2 面废弃）‖ `proto2/grow-modebias-nmode.mjs`（11-16 一次性：modeBias 加行，已应用到全部现役包）‖ `proto2/chain-supfit.mjs`（CEM 版蒸馏，被 supfit-gd 精确梯度版取代）‖ `proto2/supfit-full.mjs`（全段蒸馏前身，supfit-gd 覆盖）。

### 归档候选清单（下一批批量处理，本班不动）

`proto2/` 里 10 月 PREREG 波的一次性研究探针（battery/matrix2/rankfit/rank-signal/rank-inter/breadth2/capacity/behav-shift/composite-score/def-drain-trace/def-gate/dimgate/fit2/fitness-noise/head-health/longrange-offer/margin-n/mixprobe/obs2.mjs/offer-trace/pool-check/preflight2/project-blocks/ref-baseline/chain-price/chain-clone/convert-obs3c 等）——零 import 但属 CLI 仪器，**删除前要逐个对谱系**（docs/research 在册读数可能引用）。删法照 11-14 白班批先例（a30f1098：白名单+读取代码同删零残留）。

## 二、纪律：禁止默认训老网络（2026-11-19 用户裁定）

- **默认 = 2.0 线**。任何训练产物落成 `v:7` 容器（5689 张量）而不带 `EPIRUS_ALLOW_V7=1` 点名 ⇒ 违规。
- train-3p 的守卫（缺 ARCH2 ⇒ exit 5）是这一条在 GA 入口的执法点；pg-train/supfit-gd 天然只认 v:92（`readPack2`+`assertObsArch`），无需守卫。
- 判断一件产物在不在 2.0 线：`packed.v ≥ 92` 且 `arch==='S1o'`。快速验尸脚本见 §五。

## 三、与产品面的边界（谁在哪，为什么）

| 资产 | 位置 | 理由 |
|---|---|---|
| 训练入口 / 服务 / 蒸馏 / 旋钮册 | `training/` | 实际训练用；产品侧零依赖 |
| `js/core/*` 引擎 | `js/core/` | 产品 = 训练共用核；训练沙箱按文本装载同一份 |
| `js/train/policy.js / policy2.js` | `js/train/` | 包格式与前向——产品要读包出招，训练沙箱装载同一份（policy2 与 `training/proto2/arch2.mjs` 构成孪生账，不许合并） |
| `js/train/bots.js` | `js/train/` | 脚本 AI：产品对战对手 + 训练对手，同一份 |
| `js/train/evo.js` | `js/train/` | **混合体**：产品面（pickChampion 等，浏览器 bundle 加载）+ 训练引擎核（fitness/奖励 setter，Node 沙箱按文本装载）。物理拆分是已研究未执行的提案（共享闭包太深） |
| `js/train/trainer.js` | `js/train/` | 冠军存取 + quickEval（产品接线） |
| 训练场 tab（WS 客户端） | `js/ui/ui.js` | 「调用的接线」：训练只能连 Node 服务跑 |

## 四、门禁与 CI

- 产品门禁每 push 跑全量 np + spec + 旋钮册 `--check`；训练侧 np 部件的**分家（paths 过滤 + 手动档）是下一批**（11-13 用户裁定：训练的门禁只随训练开）。
- 旋钮册防腐烂：改了 env 读取或 `SELF_ENV_KEYS` 注解 ⇒ `node training/knobs.mjs` 重生成册并随改动提交（**重生成器就是 knobs.mjs 本身**——旧文档里写的 `tools/knobs-registry.mjs` 路径已不存在，11-19 修正）。
- 训练侧自查：`node training/train-selftest.mjs` ‖ 2.0 冒烟：`proto2/selftest2.mjs` / `selftest3.mjs` ‖ 浏览器逐位对齐：`proto2/browser-parity.mjs`。

## 五、常用验尸（30 秒判断产物血统）

```bash
# 一件 .bak 是哪条线？
node -e "const vm=require('vm'),fs=require('fs');const sb={window:{}};sb.globalThis=sb;sb.console=console;vm.createContext(sb);for(const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js'])vm.runInContext(fs.readFileSync(f,'utf8'),sb);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),sb);const g=sb.window.EPIRUS_CHAMPION_3P||sb.window.EPIRUS_CHAMPION;console.log('v='+g.v,'arch='+(g.arch||'(v7壳)'),'params='+g.a.length);" -- <包路径>
# v≥92 + S1o = 2.0 线；v=7 + 5689 = v7 线（违规产物，除非 EPIRUS_ALLOW_V7=1 点名）
```

## 六、训练流程速查（2.0 产线）

```bash
# ① 行为塑形后训练（多技能包的主力路）：键频锚抬稀缺卡 + 事件塑形锁目标卡 + 多节点防漂
node training/proto2/pg-train.mjs --up=docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak \
  --games=6000 --batch=48 --lr=3e-4 --segEvery=1500 \
  --klW=0.05 --klTilt=tank,miniT,jinshield,taunt,rod,firestorm --klTiltMul=3 \
  --shapeKey=tank:0.25,miniT:0.15 --out=scratch/arms/<臂>.bak --tag=<臂>

# ② 教师蒸馏 / DAgger（跨线蒸馏：v7 包也能当教师）
node training/proto2/supfit-gd.mjs --upstream=docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak \
  --teacher=toolkit --objective=cand --dagger=1 --lr=0.0004 --steps=180 --groups=3300 \
  --shapeBal=1 --classPow=0.35 --out=scratch/arms/<臂>.bak --tag=<臂>

# ③ GA + 教师三件套（2.0 形状，必须 ARCH2）
EPIRUS_ARCH2=S1o:input=obs6,gen=3,keySplit=1 EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=<obs6包> \
  EPIRUS_IMIT_TEACHER=pickToolKit EPIRUS_IMIT_ONLY=<卡> EPIRUS_IMIT_OVERRIDE=1 EPIRUS_IMIT_FRAC=0.5 \
  node training/train-3p.mjs 100 5 24 8

# ④ 标准读数（A/B/C 三列同看）
node tools/exam4-triplet.mjs <包>                                          # A 轴
node tools/exam-4n.mjs 100 77000 <包> --exam=B --dose=page                 # B 轴（champ= 戳必带）
node tools/pool-skill-report.mjs --stage=1 --pack=<在池id>                  # 跨环境覆盖（观察层）
```

旋钮怎么调：全部走 `EPIRUS_*`（pg-train/supfit-gd 用 `--flag`），逐键含义查 `TRAINING-KNOBS.md`；新旋钮必须带注解登记（铁律 1）。v7 线只在 train-best/fast/server 与 `EPIRUS_ALLOW_V7=1` 例外臂里存在。
