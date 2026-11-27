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
| 判断产物血统（30 秒） | 本页 §六 验尸脚本 | — |

## 一、训练核心机制（2.0 精确梯度 vs 旧 v7 变异进化）

早期的 v7 线采用「小 MLP + 种群 + 高斯变异 `mutatePolicy` + 交叉 `crossover` + 淘汰赛 / CEM」的无梯度黑盒神经演化；而当前唯一的 2.0 产线（`obs6 · S1o · v:92`）已经**彻底取消了群体、变异和交叉**，全线改用**单粒子解析反向传播 + Adam 梯度更新**：

| 维度 | 旧 v7 时期（已退役） | 当前 2.0 产线（在用） |
|---|---|---|
| **优化方式** | 群体无梯度进化：每代评估整个种群，每局约 26 手压成 1 个带噪声标量分，按排名做高斯变异与基因交叉 | **单粒子精确梯度（Adam）**：每一步对局或样本的每个决策节点都算解析梯度（`tapeForward` → `dLogPi`/`dLogKeyP` → `tapeBackward`） |
| **退场原因** | 网络扩到 `16561` 维后，整局标量适应度方差太大（同代相关仅约 `0.41`），盲目随机变异几乎退化成抽签 | 全网由线性层 + ReLU + RMSNorm/Attention + 两级 Softmax 构成，解析导数信噪比高出数量级 |
| **防漂与多样性靠什么** | 靠种群、精英保留、`sigma` 衰减与随机注入新个体 | 靠**多教师蒸馏 + DAgger** 注入技能，**批级 KL 锚**锁住键频不塌缩，**分段快照 `--segEvery`** + **探针回滚**选节点 |

### 1. 网络前向结构（`proto2/arch2.mjs` · `obs6`）

1. **席位集合与注意力（人数无关）**：己方全局/私有/3 回合记忆特征走 `selfEnc`；场上每名存活玩家走同一套 `seatEnc` → 2 头自注意力（`attnQ/K/V/O` + `RMSNorm` + `rff1/2` 残差前馈）→ 对我方做交叉注意力（`xattnQ/K/V`）并与对手 `oppMax` 池化拼接过 `ctx` 得到局面隐状态 `hctx`。
2. **候选动作编码与交互打分**：每个合法候选过 `actEnc`，与 `hctx` 及双目标席位编码 `(te1, te2)` 拼接过 `cand` + `policyHead`；再叠加 `skillHead`（技能全局偏置）与 `tBilin`（动作 × 目标双线性项；可选 `modeBias` 分桌形模式偏置）。
3. **两级 Softmax 输出**：先按决策键 `DK(cand)`（`keySplit=1` 时把 `蓄能#elec` 与 `蓄能#boom` 拆成独立决策键）取组内最大 logit 做技能层 softmax，再在键内做候选层 softmax。

### 2. 三条训练通路（均在单粒子上做，不做交叉变异）

1. **教师蒸馏 + DAgger（`proto2/supfit-gd.mjs`，`--mode=supfit|distill`）—— 注入新技能与纠正零覆盖键**
   - **采样**：在 `arena2` 桌面上收集 `(状态, 合法候选, 教师动作)`，支持 `--shapeBal=1` 按桌形均摊配额、`--arenaShapes=2:multi@2,...` 只改训练环逐格权重（评测菜单不增格）、`--winOnly=1|2` 仅采胜/败局语境、`--classPow/--classCap` 压低稀有类过拟合，以及 `closeCurseStorm` 标签闭环兜底。
   - **多教师轮替**：支持 `--teacher` 搭配 `--teacher2/3/4`（按比例、指定技能键或桌形切教师，可以是内置脚本专精如 `toolkit`/`cannon`/`detonate`，也可以是任意 `pack:<v7或2.0包>`）；`--shapeTeachers=2:standard=pack:<强包>;5:long=...` 可直接按 `(人数, 模式)` 派专科教师，防止单教师洗塌基础攻防。
   - **seed 契约**：显式 `--seed=N` 同时改变采集 LCG 与局 salt，sidecar 记 `collectionSeed/collectionSalt`；不传时仍走历史 `20261030/4242`，旧配方权重不变。
   - **DAgger（`--dagger=R`）**：第 0 轮只采教师自访轨迹；后续每轮改由**当前学生自己走出来的局面**请教师重标并入训练集再训，消除上线后走偏到陌生局面的协变量漂移。
   - **梯度更新**：对 `--objective=cand`（推荐）精确最大化 `log π(教师候选)`（`dLogPi` + `tapeBackward` + Adam，可选 `seatDrop` 与 `onlySeg`）。
2. **策略梯度 REINFORCE + 行为塑形 + 键频锚（`proto2/pg-train.mjs`，`--mode=pg`）—— 实战强度拔高**
   - **采样对手池（`--arenaPool`）**：用当前模型以 `--temp`（默认 `0.5`）在 `arena2` 打 `batch` 局；不传时默认为全脚本池 `buildPoolSeeded`。`--arenaPool=names:pack:...,aggro,...` 可摆真包与关键脚本；`human:rule` / `human:legacy` 复用 `tools/human-pool.mjs` 的人席原型，可把训练对手设为脚本替身，用于直接检验对脚本席的强度。
   - **回报与优势**：决策点累积回报 `G_t = 终局 scoreNet + 事后事件塑形`（常驻 `lamC`/`lamF`，以及可选 `lamExp` 废珠罚、`penDeadElec` 死电罚、`--shapeKey=key:w` 正/负塑形如孤儿贴符罚分），减去批均值 `mean` 或闭式岭回归 `ridge` 状态基线，按批内 `G` 标准差标准化得到优势 `A`。
   - **梯度 + KL 锚**：主梯度为 `A · dLogPi`；若开 `--klW > 0`，每步叠加对冻结起点键分布的交叉熵拉力（`dLogKeyP`，mode-covering），配合 `--klTilt/--klTiltMul` 拉抬弱键，并自动在 KL 目标里剔除负塑形键。
   - **防漂**：内置 `--segEvery` 定时落盘多节点快照（供后筛）与未见 seed 探针回滚闸（`--probe`）。
3. **同形状权重线性融合（`tools/pack-fuse.mjs`，`--mode=fuse`）**
   - 对同盆地/同维度的两枚包按 `t·A + (1−t)·B` 对 `.a` 数组线性混合；通常只作为再蒸馏起点或教师，不代替梯度训练。

## 二、训练器清单

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

### 当前训练入口

- 日常训练：`pg-train` / `supfit-gd`，唯一合法产物形状为 `v:92 / S1o`。
- 历史逐位复刻：`training/train-3p.mjs` 仅由 `training/train.mjs --mode=v7 --era=<commit>` 委托调用。
- 页面「🧪 训练场」：`pg` / `supfit` 双模式，带 SSE 进度与多人槽回写。

### 已隔离的一次性探针

2026-11-24 将 22 个零代码引用的一次性研究探针整体移到仓外隔离目录 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-24\training\proto2\zero-ref-probes\`，原相对路径与 SHA 清单保存在该目录的 `manifest.tsv`。历史研究读数仍引用原命令；需要恢复时按清单原路放回。

## 三、纪律：禁止训老网络（2026-11-19 用户裁定）

- **唯一合法产物形状 = `v:92 / S1o`**。判断一件产物在不在 2.0 线：`packed.v ≥ 92` 且 `arch==='S1o'`（验尸脚本见 §六）。
- 执法点：pg-train/supfit-gd 天然只认 v:92（`readPack2`+`assertObsArch`）；v7 训练线（唯一能产 v:7 的入口）已整体删除 ⇒ **训练侧已无 v7 生产者**。
- v7 时代的**知识**不删：`--teacher=pack:<v7包>` 跨线蒸馏把它平移进 2.0（A1/MS2c 载体 → S3/S4/S6 即此路）。

## 四、与产品面的边界（谁在哪，为什么）

| 资产 | 位置 | 理由 |
|---|---|---|
| 训练入口 / 蒸馏 / 旋钮册 | `training/` | 实际训练用；产品侧零依赖 |
| `js/core/*` 引擎 | `js/core/` | 产品 = 训练共用核；训练沙箱按文本装载同一份 |
| `js/train/policy.js / policy2.js` | `js/train/` | 包格式与前向——产品要读包出招，训练沙箱装载同一份（policy2 与 `training/proto2/arch2.mjs` 构成孪生账，不许合并） |
| `js/train/bots.js` | `js/train/` | 脚本 AI：产品对战对手 + 训练对手，同一份 |
| `js/train/evo.js` | `js/train/` | **混合体**：产品面（pickChampion 等，浏览器 bundle 加载）+ 训练引擎核（fitness/奖励 setter，Node 沙箱按文本装载）。物理拆分是已研究未执行的提案（共享闭包太深） |
| `js/train/trainer.js` | `js/train/` | 冠军存取 + quickEval + 训练 CSV 导出（产品接线；供对局区及 2.0「🧪 训练场」tab 调用） |
| `training/train.mjs` + `server/train-server.mjs` | `training/` | 2.0 统一 CLI 总入口与本地 SSE 训练服务（支持页面「🧪 训练场」在线启动 `pg` / `supfit`） |

## 五、门禁与 CI

- 产品 CI 跑 np 矩阵、spec 与浏览器三档；训练侧旋钮册和训练栈自检走独立 `.github/workflows/training.yml`，只在训练面变更时触发。
- 旋钮册防腐烂：改了 env 读取 ⇒ `node training/knobs.mjs` 重生成册并随改动提交（**生成器就是 knobs.mjs 本身**）。改旗标/旋钮先看 AGENTS 铁律（同笔注解、加一删二、≤40）。
- 梯度训练启动门：`pg-train` / `supfit-gd` 对实际装载的上游参数自动执行 `selftest3`；红则不开训。冻结推理包的产品验收不消费这门。数值梯度使用 `ε=1e-5` 避开 `ulp(logπ)/ε` 舍入假红；键级导数跳过最大值并列的不可导点，其余格仍逐位对账。
- 训练侧手动自查：`node training/train.mjs --selftest`（涵盖 `selftest2` + `selftest3` + `browser-parity`）。

## 六、常用验尸（30 秒判断产物血统）

```bash
# 一件 .bak 是哪条线？
node -e "const vm=require('vm'),fs=require('fs');const sb={window:{}};sb.globalThis=sb;sb.console=console;vm.createContext(sb);for(const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js'])vm.runInContext(fs.readFileSync(f,'utf8'),sb);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),sb);const g=sb.window.EPIRUS_CHAMPION_3P||sb.window.EPIRUS_CHAMPION;console.log('v='+g.v,'arch='+(g.arch||'(v7壳)'),'params='+g.a.length);" -- <包路径>
# v≥92 + S1o = 2.0 线（唯一合法训练产物）
```

## 七、训练流程速查（2.0 产线）

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
