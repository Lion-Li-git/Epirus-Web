# training/ —— 训练侧独立子仓（2026-11-11 起夜）

> 用户令：「把实际用于训练的东西搬过来，那边（浏览器）留用于调用的接线。」产品侧不跑训练门禁；
> 本目录自成一体：入口、服务、旋钮册、门禁指针都在这里。改训练侧的东西先读这一页。

## 结构

```
training/
├─ README.md                本页
├─ knobs.mjs                ★ 旋钮单一真源生成器（node training/knobs.mjs 重生成册；--check 供 CI）
├─ TRAINING-KNOBS.md        生成册：全集/在用/暗键/逐键注解（唯一配置真源，勿手改）
├─ train-3p.mjs             ★ 2.0 GA 训练入口（多人臂；obs5 产线主力，用法 --help）
├─ train-best.mjs           2 人多种子择优（v7 旧线）
├─ train-fast.mjs           2 人快速（v7 旧线）
├─ train-selftest.mjs       训练侧自检（回执往返 / 出厂默认清单 / econ 往返）
├─ start-train-server.cmd   双击启动训练服务（浏览器训练场 tab 连它）
├─ server/                  训练服务 + 旋钮单一来源（原 server/ 整体迁入，产品零 import）
│   ├─ train-server.mjs      SSE 训练服务：/train /champion /reset
│   ├─ paralleltrain.mjs     worker_threads 多核并行评估池（EPIRUS_WORKERS 控并行度）
│   ├─ train-worker.mjs      单 worker 评估入口
│   ├─ opp-pool.mjs / opp-champs.mjs   对手池 + 「名字→包」唯一入口（考卷 exam-4n 也吃它）
│   ├─ knob-guard.mjs        旋钮闸（读集解析 / 黑键侦测 / 传递 import 闭包）
│   └─ econ-env / fight-env / train-env   奖励旋钮三份单一来源表（D77 家族）
├─ proto2/                  2.0 研究栈
│   ├─ arch2.mjs             网络孪生（与 js/train/policy2.js 逐字同源——孪生账，不许合并）
│   ├─ pg-lib.mjs            重放/反传（tapeForward4/5 …）
│   ├─ supfit-full.mjs       蒸馏（支持 2.0 教师）
│   └─ selftest3.mjs 等      冒烟与量具
└─ recipes/                 命名配方（规划中：替代 121 份手抄 env 启动器；机制见 docs/research/PLAN-2026-11-10-night2-zcode.md §四）
```

## 与产品面的边界（谁在哪，为什么）

| 资产 | 位置 | 理由 |
|---|---|---|
| 训练入口 / 服务 / 蒸馏 / 旋钮册 | `training/` | 实际训练用；产品侧零依赖 |
| `js/core/*` 引擎 | `js/core/` | 产品 = 训练共用核；训练沙箱按文本装载同一份 |
| `js/train/policy.js / policy2.js` | `js/train/` | 包格式与前向——产品要读包出招，训练沙箱装载同一份（与 `training/proto2/arch2.mjs` 构成孪生账） |
| `js/train/bots.js` | `js/train/` | 脚本 AI：产品对战对手 + 训练对手，同一份 |
| `js/train/evo.js` | `js/train/` | **混合体**：产品面（pickChampion/belief/supportPrior/quickEval，浏览器 bundle 加载）+ 训练引擎核（fitness/进化/奖励 setter，Node 沙箱按文本装载）。物理拆分是已研究未执行的提案（见交接文档），原因是共享闭包太深 |
| `js/train/trainer.js` | `js/train/` | 冠军存取 + quickEval（产品接线） |
| 训练场 tab（ui.js WS 客户端） | `js/ui/ui.js` | 「调用的接线」：训练只能连 Node 服务跑（本 tab 不能独立开训练） |

## 门禁与 CI

- **产品门禁**（`.github/workflows/gates.yml`）每 push 跑全量 np + spec + 旋钮册 `--check`；训练侧的 np 部件（ship-feas/ship-promote 等 spawn `training/train-*.mjs` 的那批）目前仍随全量跑，**分家（paths 过滤 + 手动档）是下一批**。
- 旋钮册防腐烂：`node training/knobs.mjs --check`——改了 env 读取或 `SELF_ENV_KEYS` 注解必须重生成册并随改动提交。
- 训练侧自查入口：`node training/train-selftest.mjs`。

## 铁律

见根 `AGENTS.md`（旋钮注解同笔 / 加一删二 env≤40 / 禁错误吞咽 / 孪生账不合并 / 判定 A/B/C 三列同看 / 新尺新列族）。

## 训练流程速查（2.0 产线）

```bash
# 单臂（200 代 5P）
node training/train-3p.mjs 200 5 24 8
# 多种子轮换 + 2P 谱系晋升（每轮 C=(A+B)/2 重测，超 margin 才换代）
node scratch/night-adapt2/msbatch2.mjs --base=201 --rounds=1 --branches=3 --gens=200 --arm=MSB6
# 标准读数（A/B/C 三列同看的仪器）
node tools/exam4-triplet.mjs <包>              # A 轴（脚本桌，短+长）
node tools/exam-4n.mjs 100 77000 <包> --exam=B --dose=page   # B 轴（冠军桌，读数行带 champ= 戳）
```

旋钮怎么调：全部走 `EPIRUS_*` 环境变量，逐键含义查 `TRAINING-KNOBS.md`；新旋钮必须带注解登记（铁律 1）。
