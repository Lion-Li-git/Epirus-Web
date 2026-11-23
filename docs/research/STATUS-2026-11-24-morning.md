# 交接 · 2026-11-24 早晨（Qoder 通宵班 · 22:30 → 时刻待补）

> 本文只写**事实、读数出处、待裁项**。机理与推导一律引 [STATUS-2026-11-24-night-qoder.md](STATUS-2026-11-24-night-qoder.md)（下称 STATUS）的节号，不复抄。
> 训练旋钮与环境键真源引 [TRAINING-KNOBS.md](../../training/TRAINING-KNOBS.md)；臂的逐条台账引 [TRAINING-RUN-LOG.md](../../TRAINING-RUN-LOG.md)。

## 0. 基线（会变的东西一律给命令，不给裸数字）

| 项 | 怎么现读 |
|---|---|
| 开工基线 | `bd52ab84`（v2.1.22 + 恢复件时间修复 + N5 规则换代） |
| 本班提交数 | `git log --since='2026-11-23 22:00' --oneline` |
| 收工 HEAD | `git rev-parse --short HEAD` |
| 规则指纹 | `node tools/rules-fingerprint.mjs`（本班应为 `11bb29db`，**本班没动 `js/core/**`**） |
| 池成员 | `champion-map/data/page/pool-members.tsv`（25 枚：hard 13 ‖ soft 12） |
| 门禁认证级别 | 本班**只跑过定向组**（`--group=meta` / `--group=probe` / `--group=ship`），整轮 `gate-all --np` 只在收口跑一次 ⇒ 引用任何"绿"都要带"不是整轮" |

## 一、用户五条指令逐条对账

| 指令 | 状态 | 证据 |
|---|---|---|
| ①「自动工具要做好」（不许拿"当前 0 违例"当证据） | **做了，且两条腿都在真件上红过** | 第四条腿（扫描时刻残留）在 4 枚 `v7ringB1-*` 真件上回写生效；第五条腿（表不许落后于件）当场点名同样 4 枚；夹具两相位 `exit 0/1` 现测过 ⇒ STATUS §4.3 ‖ §4.9 ‖ §4.14 |
| ②「不要单独训 2P 包，把 2P 加进普通包的训练，血量×人数矩阵都参与、剂量不同」 | **前提被推翻，实现未开**（不是没做，是量出来"按 2P 份额加剂量"这条路本身不成立） | STATUS §4.8：非单调（27%→42.1%、0%→25.2%、43%→50.3%）⇒ 排序跟着**每格样本数**走而不是跟着 2P 份额走；`--arenaShapes` 删格=抬每格剂量，这个混淆我写死了。**待裁：矩阵接入的形状菜单与每格局数怎么定** |
| ③「考古线尽管做，找出参数放在那里扫」 | **本班收 3 + 4 = 7 枚；剩余 147 枚是"无源"不是"没扫"** | 发 10 批 39 枚命中 3（`0b8f2598`）；把扫描源从 6 条扩到 214 条（206 个重放树）再收 4 枚（`0b972957`）⇒ 台账 `missing 151 → 147`；分诊器 `tools/replay-diagnose.mjs`（`c3f91660`）把"出了件但 wid 不等"变成"差哪一维" |
| ④「继续研究天火闭环，宁可不贴也不要不闭环」 | **闭环量到了、也买到了；但买入代价换了一台仪器才露出来** | 普查：抓手率 P50 1.5%（14 枚 legal≥10）‖ 6 枚机会恰为 0 ⇒ STATUS §4.11；臂：局闭环 10% → 89/92.9%（`f20`/`f35`）；**准入实测**：`f35` 被 `G5[long]` 挡（防席夺冠 49% > 25%），`f20` 过门（4%）但 `x2s` 输基座 ⇒ STATUS §4.12 |
| ⑤「更多风格跨环境的包（软带反而比硬带少一枚技能覆盖很奇怪）」 | **"少一枚"在带内并集这层不成立**：两带各守对方没有的卡；`rod` 洁净替代**本班已开两臂**（读数待臂落盘，不做 `pool-add`） | STATUS §4.2：`taunt`/`jinshield` 只在 hard，`rod`/`miniT` 只在 soft。RD-G1 两臂各只动一个变量对照在册 `nov21-rod-tzt2d-r10`（`rod@0.25→0.12` 的 `nov24-rdg1-rod12` ‖ `rareFrac=0.45→0.25` 的 `nov24-rdg1-rare25`；脚本 `scratch/run-rdg1-1124.sh`，其余逐字抄 r10：底座 `TZT2D`、`ring@0.10`、`steps=450`、`lr=0.002`、`pool=5000`、**不给 `--smoke`**——r10 的产物里没有这一维）。⚠ 计划叫我"先查 METHODOLOGY 的 rod/rareOnly 结论以免重证"：**查了，`docs/METHODOLOGY.md`（65KB）里 `rod`/`rareOnly`/`rareFrac`/`成对` 全是 0 命中** ⇒ 这条剂量账只住在 `TRAINING-RUN-LOG.md` 与 `FINDING-2026-11-14-ksmid-dose-phase-zcode.md`，**不在方法账上** |

## 二、待裁清单（都要用户点名才动）

1. **闭环准入腿的形状**：判据用"机会 ≥N ∧ 抓手率 <X"还是"局闭环率 ≥X"？阈值 `N`/`X` 取几 ⇒ [PROPOSAL-2026-11-24-firestorm-closure-gate.md](PROPOSAL-2026-11-24-firestorm-closure-gate.md) §四 §六。
2. **存量 6 枚带伤 hard 包**：豁免 / 限期补剂量 / 立即降级 soft。
3. **`G5` 破防线的主语要不要扩到池内全员**：现测在册 hard 成员 `RG-CN` 防席夺冠 **42%**、线上包 26%，都在 ≤25 关档线外，而这道阻断门只判候选 ⇒ 扩主语会当场翻池装配（要走分支 + PR + CI）。
4. **机会恰为 0 的 6 枚**算不算病（分母为 0 ⇒ 现在只出"读不出"）。
5. **2P 接入普通包训练的形状菜单与每格局数**（②的未决前提）。
6. **`spread > 2×容差带` 断言**（上一班留到现在，未动）。
7. **池装配的 `pass` 不带指纹戳**：`pool-members.tsv` 里 25/25 全是 `pass`，而列里没有规则指纹、桌形或剂量 ⇒ 无法判断哪些 `pass` 在 `11bb29db` 之后已过期（本班现测 `RG-CN` 的 `G5[long]` = 42% 就是证据）。要不要补留痕 = 要不要接受一次全池贵复测，等裁 ⇒ STATUS §4.15。

## 三、本班**没有**做的事（免得下一班去找不存在的东西）

- 没有 `pool-add`、没有换包、没有动 `js/core/**`（指纹仍是 `11bb29db`）；没有 push、没打 tag。
- 没有跑整轮门禁认证（只在收口跑一次 `--np`，见 §五）。
- 没有实现"2P 进普通包训练"的任何装配代码（只出结论）。
- `scratch/skill-report-loop/`（带机会两列的那份全池报告）**没有**升为在册 `champion-map/data/skill-report/`，页面也没重烘这套报告 ⇒ 在册那套**不含机会两维**。要不要升是决定 1 的前置，等裁。
- RD-G1（洁净 rod 载体）**两臂已开但没量完**；`pool-add`、`--retire` 旧 rod 载体都没做——旧载体 `nov21-rod-tzt2d-r10` 是**全池 `rod` 的唯一在册载体**，新臂过线前摘它会直接把这一维覆盖清零。
- 生成器在这台机器上仍需 `--soup-thin-ok`（`SOUP-s9-82XD4a` 的父 `e234-out/D4a.js` 在盘但 wid 不符）⇒ 谱系图仍是薄图，**与本班无关的既存状态**，仍是 #62 那条没根治的账。

## 四、我造出来的两个新隐患（自己报，不等别人发现）

1. **臂级结论的种子方差没被控住**：`f20` 换一粒 seed 直接被产物级珠账自检拦下（过期 8.1 颗/局 > 5，**不落盘**），而它缺省那粒跑出 0.2。⇒ §4.8/§4.10/§4.12 里所有"臂级"读数都是 n=1 枚臂，**只能读成"这一枚臂的事实"**。收口前用 8 格网格（`frac × seed`）把这条钉成"过线格数 + 分布"，见 STATUS §4.13。
2. **我给下一班留了一个新量具而没有门**：`tools/firestorm-closure.mjs`（`b1b9d76e` 起，`ef1a7c82` 换判据）现在产 `champion-map/data/firestorm-closure-1124.tsv`，但**没有任何消费者读它**——`grep -rl firestorm-closure tools/ champion-map/ js/` 只命中生成器自己（`pool-add` 里也没有 `firestorm`/`closure`/`curseStats` 字样）⇒ 这份表可以是陈的、缺列的、手改的，门禁不会红。要不要给它配门 = 决定 1，别默认它"有读数=有保障"。

## 五、复现与验收入口（照抄即可）

| 目的 | 命令 |
|---|---|
| 恢复台账五条腿自检 | `node tools/land-recovered.mjs --check`（**别接管道**，`$?` 会被 `tail` 吞） |
| 重放树扫源（只报告 / 真落盘） | `bash scratch/run-anchor-scan-1124.sh` ‖ 加 `--do` |
| 闭环普查（含机会两列） | `node tools/firestorm-closure.mjs --all-pool`；单枚候选加 `--candidate=<路径>` |
| 臂的准入实测 | `node tools/promote-champion.mjs --dry --support=2 --candidate=scratch/arms/<臂>.bak` |
| 破防机制读数（N=300/格） | `node tools/gate-drafts.mjs <包1.bak> <包2.bak>`（`GATE4_GAMES` 可改局数） |
| 剂量×seed 网格 | `bash scratch/run-dose-grid-1124.sh`（台账 `scratch/dose-grid-1124.out`） |
| 收口整轮 | `node tools/gate-all.mjs --np` |

## 六、正在跑的长测量（写这条是为了让下一班别当"没跑成"）

| 作业 | 产物 | 起点 | 说明 |
|---|---|---|---|
| 池 25 枚 `G4`+`G5` 全员普查 | `scratch/g5-pool-1124.log` | 01:16 | 每枚 ~2–4 分钟；先印完全部 `G4` 再进 `G5`，所以中途 `grep G5` 为 0 属正常 |
| 剂量×seed 网格 4 臂（**已收**） | `scratch/arms/nov24-fsclose-{020,035}-2026{1102,1103}.bak{,.meta.json}` ‖ 闭环读数表 `node scratch/dose-grid-table.mjs` | 01:19–01:36（台账 mtime） | 四臂都 `TRAIN_EXIT=0` ⇒ **0.20 那档总共 4 粒 seed 里 3 粒落了产物、1 粒被珠账自检拒绝**；结论在 STATUS §4.16 |
| RD-G1 洁净 rod 两臂 | `scratch/arms/nov24-rdg1-{rod12,rare25}.bak` ‖ 台账 `scratch/rdg1-1124.out` | 01:40 起（第一臂 01:46 落盘） | 单臂 ~40 分钟（`steps=450`、`pool=5000`，比闭环臂贵一个量级）；**判活看 CPU 增量，别看日志 mtime**（`步` 行之间本来就几分钟不动） |
| 臂的 `G5` 复现读数（**排队中**） | 待池普查跑完再单实例跑 `gate-drafts`（⛔ 别同时起第二个同型测量实例） | — | 幸存的 5 枚闭环臂 × `G5[long]`，用来判 §4.12 那个 4%↔49% 会不会随 seed 翻 |

## 七、本班收口时的认证级别（照实写，不写成"全绿"）

- **定向**：`--group=meta`（01:28）与 `--group=probe`（01:42）各 4 道全绿（`spec 81/81 ‖ smoke ‖ battle ‖ map`），**两轮工具自己就明写"不许当认证引用"**；日志 `scratch/gate-meta-after-ringb1.log` ‖ `scratch/gate-probe-after-psrfix.log`。
- **整轮** `node tools/gate-all.mjs --np`：按计划在收口跑一次；**跑没跑、结果如何以那笔提交与日志为准**，别引用我这句当证据。
- **数据面**：`land-recovered --check` exit 0（五条腿零违例）‖ `map-audit` 只剩 2 条已知缺口（147 枚缺件 + 128 枚 quarantine 恢复件权重等价）‖ 页内自检 100 PASS / 0 FAIL。
- **规则面**：`node tools/rules-fingerprint.mjs` 仍是 `11bb29db`（本班没动 `js/core/**`）。
- **交付面**：没有 push、没有 tag、没有 `pool-add`、没有换包；本班所有提交都在本地。
