# champion-map 一次性数据表索引（2026-10-21，DS 整理）

> 背景：10-21 夜清理 `champion-map/_*.tsv|txt`，删了 38 个零引用残留；下面 34 个都被 docs 或代码引用，**暂留**。
> 口径：`代码输入` = 被 `champion-map/*.mjs` / `docs/debug/*.mjs` 当数据源读，**不能删**；
> `文档证据` = 只被 CHANGELOG/docs 引用，读数多半已进正文，可逐条确认后删。

| # | 文件 | 内容 | 引用方 | 处置 |
|---|---|---|---|---|
| 1 | _e321-job1.tsv | §E318 ③ 的 15 臂考卷表（第一 job） | champion-map/attach-sc.mjs | 代码输入·留 |
| 2 | _e321-job2.tsv | 同上（第二 job） | champion-map/attach-sc.mjs | 代码输入·留 |
| 3 | _e318-all15.tsv | 15 臂考卷表 | evaln-noise.mjs / selkeys.mjs / METHODOLOGY | 代码输入·留 |
| 4 | _e328-descendants.tsv | 谱系扫描（arm/ts/files/wid/gens/fp） | chain-scan.mjs / ruler-measure.mjs / CHANGELOG | 代码输入·留 |
| 5 | _e328-extra.tsv | 额外血统行 | attach-kin.mjs / eps-full.mjs | 代码输入·留 |
| 6 | _e330-armparent.tsv | 臂父链（arm→parent） | audit-parent-evidence.mjs / lineage.mjs / CHANGELOG | 代码输入·留 |
| 7 | _kill.tsv | 杀意统计（攻击/可杀/取杀率） | docs/debug/kill-instinct.mjs | 代码输入·留 |
| 8 | _planfiring.tsv | 计划层触发统计 | docs/debug/plan-firing.mjs | 代码输入·留 |
| 9 | _pool-SOFTALL.tsv | 软带池扫描矩阵 | docs/debug/soup-softband.mjs | 代码输入·留 |
| 10 | _pool-V3.tsv | 池扫描 V3 | docs/debug/soup-softband.mjs | 代码输入·留 |
| 11 | _soup-extra2.tsv | 融合臂血统 | docs/debug/soup-softband.mjs | 代码输入·留 |
| 12 | _soup-members-SOFTALL.tsv | 软带池成员快照 | docs/debug/soup-softband.mjs | 代码输入·留 |
| 13 | _soup-tier2.tsv | 融合臂档级考卷 | docs/debug/soup-softband.mjs | 代码输入·留 |
| 14 | _sentinel-rows.tsv | 哨兵全量行（gate/line/桶） | docs/debug/sentinel-triage.mjs / GATE-SENTINEL-TRIAGE | 代码输入·留 |
| 15 | _breadth.tsv | 广度探针单枚表 | docs/debug/breadth-probe.mjs / CHANGELOG / 10-15 夜日志 | 代码输入+文档·留 |
| 16 | _ds-parent-recover.tsv | 父链恢复 585 行 | 10-05 handoff / OVERNIGHT | 文档证据·可确认后删 |
| 17 | _e315-byex.txt | v7bead25-93 / v7sub1-92 名单 | 10-05 handoff / SUMMARY | 文档证据·可确认后删 |
| 18 | _e315-bypg.txt | v7ringT-92 / v7ringT2-92 名单 | 同上 | 文档证据·可确认后删 |
| 19 | _e316-title.tsv | §E316 标题与考卷 | OVERNIGHT-2026-10-05 | 文档证据·可确认后删 |
| 20 | _e320-v7t1-31.txt | v7t1-31 两粒种子读数 | OVERNIGHT-2026-10-05 | 文档证据·可确认后删 |
| 21 | _e336-panel.tsv | §E336 面板（F/Hp/S/R） | 10-06 handoff / OVERNIGHT | 文档证据·可确认后删 |
| 22 | _e1-arms.tsv | E1 臂表 | champion-map/README.md | 文档证据·可确认后删 |
| 23 | _mixsweep-0.tsv | 掺席扫描（mode/cell/mean） | 10-12 汤日志 | 文档证据·可确认后删 |
| 24 | _pf-4arm-long.tsv | 计划层四臂长局 | CHANGELOG | 文档证据·可确认后删 |
| 25 | _pf-arms.tsv | 计划层臂表 | CHANGELOG / 10-15 handoff | 文档证据·可确认后删 |
| 26 | _pf-K2.tsv | K2 计划层读数 | champion-map/README.md | 文档证据·可确认后删 |
| 27 | _pm-v2-16.txt | 页面 16 局实测（v2） | 10-12 汤日志 | 文档证据·可确认后删 |
| 28 | _pm-v3-16.txt | 页面 16 局实测（v3） | 10-12 汤日志 | 文档证据·可确认后删 |
| 29 | _proto-chance.txt | proto/holo 机会统计 | 10-12 汤日志 | 文档证据·可确认后删 |
| 30 | _r1eps0.tsv | CARD-VALUE 臂 ε=0 表 | docs/research/CARD-VALUE-2026-10-13.md | 文档证据·可确认后删 |
| 31 | _r1eps2.tsv | CARD-VALUE 臂 ε=0.2 表 | 同上 | 文档证据·可确认后删 |
| 32 | _rct-multi.tsv | 卡价值 rct multi 行 | 同上 | 文档证据·可确认后删 |
| 33 | _sentinel-triage.txt | 哨兵交叉表 | docs/debug/sentinel-triage.mjs | 文档证据·可确认后删 |
| 34 | _usage-proto.tsv | usage-probe 单枚谱 | 10-12 汤日志 | 文档证据·可确认后删 |

## 结论

- **13 个代码输入**：`champion-map/*.mjs` 或 `docs/debug/*.mjs` 直接读，删了会断工具 ⇒ 长期保留（或以后把输入改成 `docs/artifacts/` 下的可重跑产物）。
- **21 个文档证据**：只被文字引用；每条读数是否已在 docs 正文里逐字收录需要人眼确认——确认一条删一条。
- 已被删的 38 个（零引用）与 `.log/.bak` 清单见本次清理 commit / 对话记录。

## 绿环（#47）状态

**已由 §E677 落地，不需要再做**：`champion-map/viewer.mjs:637` 的 `RSUBJ(d) { return RLONG() ? d.okl : d.oks; }`
⇒ 默认（3 血短程）绿环主语 = `okShort`（全腿短程，803/803），长程（5 血）= `okLong`（全腿长程，803/803）；
在册混合桌闸 `ok` 已从环与过线壳上退下（仍烘在 DATA 里给 promote 用）。悬停两把并排 + 翻脸标记也已实现。