# 2026-10-21 早班归档 · 把杂货铺放上训练桌 ‖ `HOLO2PROTO=drop` 在现行口径下还抬不抬得动自盾族

分支 `research/prior-style-2026-10-20-qoder` ‖ 工作树 `D:/wt-qoder-1020` ‖ 正文见 `docs/research/logs/2026-10-18-beadseed82-qoder.md` 的 **§E676**。
用户 07:0x 给的两条假设：**①「训练对应的脚本场并不会用连招 ⇒ 把杂货铺丢到训练里面」**、
**②「把被扭转的送盾改为扭转成原型制御，能否让冠军学会用」**。

## 目录里有什么

| 文件 | 是什么 | 复跑命令 |
|---|---|---|
| `opp-spectrum.mjs` | 前提尺：训练桌那 9 只 picker 与 `pickToolKit` 各自的**出手谱 + 决策时握珠**（5 席镜像桌） | `node opp-spectrum.mjs --games=200 [--mode=long]` |
| `e676-batch.sh` | 20 臂驱动（base / tk / drop × 4 起点 × 2 seed，4 路并发） | `bash e676-batch.sh`（**默认写 `*.rerun`**，覆盖原件要 `OVERWRITE=1`） |
| `e676-analyze.mjs` | 配对分析：起点按产物 META 的 `hotstartFrom` 认、格按 `recipe.arm/h2p/toolkitOpps` 认；**先报地板再报 Δ** | `node e676-analyze.mjs` |
| `raw/opp-spec-{multi,long}.txt` | 前提尺原样输出（800 场里 RAILGUN = 0 那张表） | — |
| `raw/usage-{multi,long}.tsv` | `tools/usage-probe.mjs --games=60 --eps=0` 的 27 枚谱（自盾族与兑现族都在列） | 见 README 末"重取读数" |
| `raw/e676-analyze.out` | 配对分析原样输出（地板 + 逐起点 Δ + 符号判/合地板判两栏） | — |
| `raw/status.tsv` ‖ `raw/driver.log.txt` | 每臂退出码与时刻（发车 07:21:46 ‖ 收摊 07:28:42，`date` 实抄） | — |
| `arms/*.log.txt` | 20 份臂日志原件（含 `[toolkit-ops]`/`决策期档已下达` 那两行与 §E589 去重点名行） | — |

## 四条口径，引这里的数必须一起带上

1. **前提尺是镜像桌**（一局 5 席同一只 picker），不是训练里那张"9 脚本 + 2 池成员"的真混桌 ⇒ 它只回答"哪一维有没有出现、多少剂量"，**不回答强度**；
   第二臂（`train9tk`）换了桌的分布 ⇒ 跨臂的差**不是**因果读。
2. **读数尺 = `usage-probe`，ε=0（贪心）、5 席全是被测包自己** ⇒ 量的是"这个策略想用什么"，不是"页面上偶然是什么"；
   出厂/评测口径不受本班任何旋钮影响（`EPIRUS_HOLO2PROTO` 与 `EPIRUS_TOOLKIT_OPPS` 都只在训练进程内生效，D229 那条线没动）。
3. **base 格借的是 §E675 在册的 p2 产物** —— 只有当本班 base 臂的日志点名"同一粒权重已在 `e675-out/…-p2.js`"（`EXIT=9`）时这才是同一枚包；
   那两行在 `arms/e676-beadseed-base-s88010.log.txt` 与 `arms/e676-teach-base-s88010.log.txt` 里，**别照文件名抄**（§E650 那条教训）。
4. **判词两栏都要看**：`符号判` 是 §E675 预注册那条（≥3 起点同号且 0 反号）；`合地板判` 再要求 Δ 越过"同档跨 seed 的漂移中位"。
   只引 `符号判` 会把漂移范围内的晃动读成方向 —— 本班 `drop` 的 proto/shift 正是这一形（符号 0 正 3 负，但 Δ −0.20 低于地板 0.78）。

## 已知限制（发臂前就写好的，别事后补成"本来就知道"）

- 4 枚起点封顶 ⇒ 判词最多到"方向性"，够不到"稳定"；seed 只 2 粒，加 seed 不加分辨率（要加的是**簇**）。
- `tk` 格除了"多了杂货铺"还**稀释了其余每只的桌内份额**（池成员开火计数 19640+18936 → 14694+15075 是同臂日志里的实测）⇒ 它不是干净的单变量。
- `drop` 档**没有拦截计数**（`policy.js` 的 `remapHolo` 不报"这一手被改写/禁掉了几次"）⇒ "有没有东西可拧"只能从产物的 holo 列反推，属**候选机理·未直接测**。

## 重取读数（干净克隆里可跑；产物本体在 gitignore 的 `docs/artifacts/`，不在仓里）

```
node tools/usage-probe.mjs --paths=<逗号分隔的产物路径> --games=60 --out="$PWD/docs/research/archive/2026-10-21-toolkit-drop/raw/usage-multi.tsv"
```
⚑ `--out=` **必须给绝对路径**：本工具按 `champion-map/` 解析相对路径（本班实测 ENOENT 撞过一次，报的是崩溃不是空表）。
⚑ 归档件的 **mtime 是复制时刻，不是产出时刻** —— 时刻只存在于文中与 `raw/status.tsv`、`raw/driver.log.txt` 里。
