# training/ —— 训练侧独立子仓

> 改训练侧的东西**先读这一页**。产品侧不跑训练门禁；本目录自成一体。
> v7 训练线已于 2026-11-19 **整体退役**（train-3p/train-best/train-fast/server 训练服务全删）——它的知识经
> `supfit-gd --teacher=pack:<v7包>` 跨线蒸馏平移进 2.0。现在全仓只有一条训练产线：**2.0（obs6 · S1o · v:92）**。

## 〇、30 秒决策表：我要训练，用哪个入口？

| 你要做什么 | 用哪个 | 别用哪个 |
|---|---|---|
| **统一 2.0 训练总入口**（一键分发下述各路 / 自检） | `node training/train.mjs --mode=pg\|supfit\|fuse\|selftest` | 直接传 env 旋钮给 2.0 产线（改走 `--flag`） |
| **2.0 (obs6) 包的强化/塑形后训练**（现役主力） | `proto2/pg-train.mjs`（REINFORCE + `--shapeKey` 事件塑形 + `--klW/--klTilt` 键频锚 + `--segEvery` 多节点） | ❌ klTilt 抬不起**零覆盖键**（放大起点分布，3×0=0）——零覆盖键走蒸馏 |
| **2.0 包的教师蒸馏 / DAgger / 多教师** | `proto2/supfit-gd.mjs`（`--teacher=toolkit\|chain\|v7mix\|pack:<任意包>` + `--teacher2/3/4` 键道轮替 + `--winOnly` 胜局语境；EQ-S4/TZ2C/DIV/night2 系全出自它） | ❌ 从融合/插值产物出发时教师必须 ⊇ 两父系键道（METHODOLOGY §148.6） |
| 浏览器页面本地 SSE 训练服务 | `node training/server/train-server.mjs`（或双击 `training/start-train-server.cmd`） | — |
| 融合两枚同形状包 | `tools/pack-fuse.mjs`（--a --b --t --out；产物只当教师/候选） | ❌ 融合产物不能当自由巩固起点（单教师巩固 = 洗掉融合） |
| 旋钮改了/加了 | `node training/knobs.mjs` 重生成册（**--check 供 CI**） | — |
| 判断产物血统（30 秒） | 本页 §五 验尸脚本 | — |

## 一、训练器清单

### 产线（2.0 · obs6 · S1o 容器 v:92）

| 入口 | 机制 | 产物作证 |
|---|---|---|
| `proto2/pg-train.mjs` | REINFORCE + 行为塑形常驻（λc 充能链 / λf 电磁炮 / `--shapeKey=key:weight` 任意卡塑形）+ `--klW/--klTilt/--klTiltMul` 批级键频锚（mode-covering，不依赖键被采样）+ `--segEvery` 多节点快照防漂移 | 11-14 obs6-coldstart 系、DIV 系的 PG 腿 |
| `proto2/supfit-gd.mjs` | 教师蒸馏精确梯度版（Adam+反传）；教师 = `toolkit`（杂货铺本体：聚能环 3 珠链/避雷针/大雷三层选靶/贴贴渐进/过载炮 phase/断环）｜`chain`｜`v7mix`｜`pack:<任意 2.0/v7 包>`（**v7 包当教师 = 跨线蒸馏，v7 退役后知识平移的唯一通道**）｜内部键道教师全表见 `buildTeacherPick`：`cannon`（过载炮专职，toolkit 的 cannon phase 只 2/6600 ⇒ 专职教师才是正解）/`transfer`/`antiReflect`/`breakAll`/`ration6(t)`/`oracleDef`｜`--teacher2/3/4` 键道轮替（双教师轮替治蒸馏窄化：S3 五阻断 → S6 一阻断）；`--objective=key\|cand`（珠种/目标要 cand）；`--dagger` DAgger 轮；`--winOnly=1|2` 胜局/败局语境蒸馏（**语境集中器：两向都锐化**——镜像对照已否方向性假说，机制与规矩见 METHODOLOGY §149） | EQ-S4 系（recipe：lr 4e-4/steps 180/groups 3300/objective=cand/dagger=1/classPow=0.35/shapeBal=1）、TZ2C 链、night2-S 系 |
| `proto2/pg-lib.mjs` / `arena2.mjs` / `roster-lib.mjs` / `chain-lib.mjs` / `skill-mastery.mjs` | 上两台的共用库（tape 反传 / 对手表 / 桌形 / 链教师 / 预示式代理）——单一来源，不许抄第二份 | — |
| `tools/pack-fuse.mjs` | 同形状包权重线性融合（产物 META 记 fusedFrom/ratio）；**只当教师/候选**，当起点要双父系教师（§148.6） | fuse-S3S1 系 |

### 本地服务与共用仪器（`server/`）

| 文件 | 消费方 / 用途 |
|---|---|
| `server/train-server.mjs` + `start-train-server.cmd` | 2.0 (obs6) 本地 HTTP/SSE 训练服务，供页面「🧪 训练场」tab 调度 `train.mjs --mode=pg\|supfit` |
| `server/opp-pool.mjs` | 对手池单一来源（tools/exam-4n、eval-5p、analyze-regime-scan…） |
| `server/opp-champs.mjs` | 名字→包唯一入口（probe-diff-ladder、style-exam、gates） |
| `server/knob-guard.mjs` | 暗键检测（knobs.mjs、gates、table-census） |
| `server/shape-scorer.mjs` / `server/wall-cap.mjs` | 打分/墙帽（js/train/evo.js、np-parallel、gates） |

### 已退役删除（2026-11-19，v7 线整体退役；页面训练场与本地服务已重写接入 2.0）

已删除旧 v7 训练器（`train-3p.mjs`、`train-best.mjs`、`train-fast.mjs`、`train-selftest.mjs`）、旧 v7 `server/*`（`train-worker` / `paralleltrain` / `train-env` / `econ-env` / `fight-env`）、`proto2/{obs2-from-v7,grow-modebias-nmode,chain-supfit,supfit-full}.mjs` 与 `tools/probe-econ-reset-audit.mjs`。原导入控件及 2.0「🧪 训练场」tab（`pg` / `supfit` 双模式 + SSE 进度与本机多人槽回写）现已在 `index.html` 与 `js/ui/ui.js` 就位。

### 归档候选清单（下一批批量处理，本班不动）

`proto2/` 里 10 月 PREREG 波的一次性研究探针（battery/matrix2/rankfit/rank-signal/rank-inter/breadth2/capacity/behav-shift/composite-score/def-drain-trace/def-gate/dimgate/fit2/fitness-noise/head-health/longrange-offer/margin-n/mixprobe/obs2.mjs/offer-trace/pool-check/preflight2/project-blocks/ref-baseline/chain-price/chain-clone/convert-obs3c 等）——零 import 但属 CLI 仪器，**删除前要逐个对谱系**（docs/research 在册读数可能引用）。删法照 11-14 白班批先例（a30f1098：白名单+读取代码同删零残留）。

## 二、纪律：禁止训老网络（2026-11-19 用户裁定）

- **唯一合法产物形状 = `v:92 / S1o`**。判断一件产物在不在 2.0 线：`packed.v ≥ 92` 且 `arch==='S1o'`（验尸脚本见 §五）。
- 执法点：pg-train/supfit-gd 天然只认 v:92（`readPack2`+`assertObsArch`）；v7 训练线（唯一能产 v:7 的入口）已整体删除 ⇒ **训练侧已无 v7 生产者**。
- v7 时代的**知识**不删：`--teacher=pack:<v7包>` 跨线蒸馏把它平移进 2.0（A1/MS2c 载体 → S3/S4/S6 即此路）。

## 三、与产品面的边界（谁在哪，为什么）

| 资产 | 位置 | 理由 |
|---|---|---|
| 训练入口 / 蒸馏 / 旋钮册 | `training/` | 实际训练用；产品侧零依赖 |
| `js/core/*` 引擎 | `js/core/` | 产品 = 训练共用核；训练沙箱按文本装载同一份 |
| `js/train/policy.js / policy2.js` | `js/train/` | 包格式与前向——产品要读包出招，训练沙箱装载同一份（policy2 与 `training/proto2/arch2.mjs` 构成孪生账，不许合并） |
| `js/train/bots.js` | `js/train/` | 脚本 AI：产品对战对手 + 训练对手，同一份 |
| `js/train/evo.js` | `js/train/` | **混合体**：产品面（pickChampion 等，浏览器 bundle 加载）+ 训练引擎核（fitness/奖励 setter，Node 沙箱按文本装载）。物理拆分是已研究未执行的提案（共享闭包太深） |
| `js/train/trainer.js` | `js/train/` | 冠军存取 + quickEval + 训练 CSV 导出（产品接线；供对局区及 2.0「🧪 训练场」tab 调用） |
| `training/train.mjs` + `server/train-server.mjs` | `training/` | 2.0 统一 CLI 总入口与本地 SSE 训练服务（支持页面「🧪 训练场」在线启动 `pg` / `supfit`） |

## 四、门禁与 CI

- 产品门禁每 push 跑全量 np + spec + 旋钮册 `--check`；训练侧 np 部件的**分家（paths 过滤 + 手动档）是下一批**（11-13 用户裁定：训练的门禁只随训练开）。
- 旋钮册防腐烂：改了 env 读取 ⇒ `node training/knobs.mjs` 重生成册并随改动提交（**重生成器就是 knobs.mjs 本身**）。改旗标/旋钮先看 AGENTS 铁律（同笔注解、加一删二、≤40；当前全集 40 / 在用 19 / 暗键 21）。
- 训练侧自查：统一执行 `node training/train.mjs --selftest`（涵盖 `selftest2` + `selftest3` + `browser-parity`）。

## 五、常用验尸（30 秒判断产物血统）

```bash
# 一件 .bak 是哪条线？
node -e "const vm=require('vm'),fs=require('fs');const sb={window:{}};sb.globalThis=sb;sb.console=console;vm.createContext(sb);for(const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js'])vm.runInContext(fs.readFileSync(f,'utf8'),sb);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),sb);const g=sb.window.EPIRUS_CHAMPION_3P||sb.window.EPIRUS_CHAMPION;console.log('v='+g.v,'arch='+(g.arch||'(v7壳)'),'params='+g.a.length);" -- <包路径>
# v≥92 + S1o = 2.0 线（唯一合法训练产物）
```

## 六、训练流程速查（2.0 产线）

```bash
# ① 行为塑形后训练（多技能包的主力路）：键频锚抬稀缺卡 + 事件塑形锁目标卡 + 多节点防漂
node training/train.mjs --mode=pg --up=docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak \
  --games=6000 --batch=48 --lr=3e-4 --segEvery=1500 \
  --klW=0.05 --klTilt=tank,miniT,jinshield,taunt,rod,firestorm --klTiltMul=3 \
  --shapeKey=tank:0.25,miniT:0.15 --out=scratch/arms/<臂>.bak --tag=<臂>

# ② 教师蒸馏 / DAgger（跨线蒸馏：v7 包也能当教师；零覆盖键的正解）
node training/train.mjs --mode=supfit --upstream=docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak \
  --teacher=toolkit --objective=cand --dagger=1 --lr=0.0004 --steps=180 --groups=3300 \
  --shapeBal=1 --classPow=0.35 --out=scratch/arms/<臂>.bak --tag=<臂>
#   窄化时换双教师轮替：--teacher=pack:<载体> --teacher2=toolkit --teacher2frac=0.5
#   要锐化不要广度时：--winOnly=1（METHODOLOGY §149）

# ③ 标准读数（A/B/C 三列同看）
node tools/exam4-triplet.mjs <包>                                          # A 轴
node tools/exam-4n.mjs 100 77000 <包> --exam=B --dose=page                 # B 轴（champ= 戳必带）
node tools/pool-skill-report.mjs --stage=1 --pack=<在池id>                  # 跨环境覆盖（观察层）
node tools/card-usage.mjs --packs=<包> --games=30 --mode=multi             # 目标卡镜像稳定性（long 分列）
```

旋钮怎么调：全部走 `EPIRUS_*`（pg-train/supfit-gd 用 `--flag`），逐键含义查 `TRAINING-KNOBS.md`；新旋钮必须带注解登记（铁律 1）。
