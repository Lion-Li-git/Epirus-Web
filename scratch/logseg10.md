# 第十段（10-29 03:2x）· #143 换路：**不搬 rollout，改成让仪器把"可复现的夹具"落盘**

## 醒来先读这一屏（交接位）

第九段那条"要搬就整族搬"的结论**没有作废**，但搬这件事被三行代码否掉了：
状态本来就是整只可 JSON 序列化的、`legal` 从状态算得出、obs3 编码器是可 import 的独立模块。
⇒ 于是 #143 的形状从"抽 lib"换成"**instrument 落夹具+标签，下游读 JSONL**"——这正是本仓七台下游仪器一直在用的形状。
rollout 的算术仍然只有一份，而且**一份都不用搬**。

## 三条代码级事实（都是我自己去核的，不是推的）

1. `js/core/state.js:241` ⇒ `cloneState = JSON.parse(JSON.stringify(s)); c.rng = s.rng`
   —— 状态除 `rng` 那只闭包外**整只可序列化**，而 rankfit 早就会给克隆体重挂一条自己的定标流。
2. `js/core/play.js:9` 的 `legalActions(state, pid)` 挂在 `EpirusPlay` 上 ⇒ `T.econBase(st, pid, legal)`（`js/train/evo.js:501`）
   要的 `legal` **从状态本身算得出**，不需要保留母局的调用栈。
3. `obs3Encode` = `import { encode } from './proto2/obs3.mjs'`（`tools/probe-myopia-regret.mjs:35`）⇒ 复算校验用的是**同一份编码器**。

## 为什么"抽 lib"是错的路（记下来，免得下次又想去搬）

本仓对"rollout 只能有一份"的既有解法**不是公共库，是落盘**：
`probe-distill-learnability` ‖ `probe-label-resolution` ‖ `probe-settle-capture` ‖ `probe-value-head-ceiling` ‖ `proto2/rank-signal` ‖ `proto2/audit-dims` ‖ `proto2/obs2-from-v7`
**七台**下游全部读 `probe-myopia-regret --dump*/` 的 JSONL，注释里写的理由逐字相同（"rollout 的算术只能有一份，所以不另写采集器"）。
反过来说：搬 lib 要动的是一台**被 D214 门 spawn 的仪器**的控制流（`tools/gates/probe-instruments.mjs:1399/1404` 各跑一次真进程），
风险换不到任何好处 ⇒ 撤。

## 设计（新旗标 `--dumpfx=<path>`，默认关 ⇒ 一行不写 ⇒ 既有读数逐字不变）

一行 = 一个**采样决策**（不是候选）：

| 字段 | 装什么 | 为什么 |
| --- | --- | --- |
| `st` | 整只状态（`rng` 置 `null`） | 下游能原地重建，不必复现母局走法 |
| `pid` | 焦点席 | 现在恒为 `FOCUS=1`，写出来免得以后变了读不出 |
| `pool[]` | `key/target/target2/bead` + `net` + `win` + `hpTop` + `rounds` + **逐流 `winS`** | 身份够匹配、标签够算 CE，逐流留着算教师自己的分半一致率 |
| `cfg/seed/arm/env/g/n/round/pk/keep/rep/freshrng` | 口径列 | "记下用哪台尺与哪种启动"那条规矩 |

下游（`rankfit --fromdump=<path>`）：重建状态 ⇒ 挂定标 rng ⇒ `legalActions` ⇒ `candidatesFor(..., {lockTarget:false})` ⇒ 按 `(key,target,target2,bead)` **匹配**回 dump 里那一只候选。

**⚑ 牙口（这条臂值不值得信，全看它）：每只匹配上的候选，用同一个 `obs3.mjs` 编码器把 `x` 复算一遍，与 dump 里的 `x` 逐元素比（容差 1e-4，就是落盘时的取整精度）；任何一只复算不上或对不上 ⇒ 硬失败退出。**
复算 == 原值 才叫"夹具复现成功"——否则我量的是两个世界的标签（"覆盖式接入要自证真被调用"同族）。

## 口径条款（先写下来，别到时候互相引错）

- **① 名单仍是 v7 的 top-`KEEP`** ⇒ 天花板是"短名单内排对"，不是"全候选里排对"。放宽用现成旗标 `--keep=`，代价按候选数**线性**涨 rollout。
- **② 标签里的 `win` 是"A0 延续 + `rep` 条流"下的期望赢率** ⇒ 换 `--arm=` 就换口径，两批**不许互引**。
- **③ 桌形/种子/环境由 dump 自己带**（`cfg`/`seed`/`env` 列）⇒ rankfit 不许再自己挑一遍。

## 预登记的停止线与判语

1. 冒烟：`--games=2 --rep=2 --keep=6 --dumpfx=…`，**≤5 分钟**且复算门全绿才算仪器成立；分母（决策数/候选数）落文件。
2. 一批真 dump（决策数 ≥ 冒烟的 10 倍，写清分母）⇒ **两臂**（S1 与 S1o 各一，同一份 dump、同一剂量）。
3. 判语**只看一个数**：`profile2 --temp=0.001` 的 **Δ夺1(2.0 − 随机起点)**（SE≈1.0）。
   \> +2pt ⇒ "稠密且与强度同向的货币"这条路成立，再谈结构；
   < −2pt 且 `e:98` 那一行崩 ⇒ 换**目标**（序列级），不换结构。
4. 不做的事：不搬 rollout、不动 `--dumpobs3` 的字段、不碰 D214 钉的那几处文本。
