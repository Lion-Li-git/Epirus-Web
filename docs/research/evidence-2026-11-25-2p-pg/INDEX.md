# 证据索引 · 2026-11-25 2P PG 与残局诊断

对应结果：[`RESULTS-2026-11-25-2p-pg.md`](../../RESULTS-2026-11-25-2p-pg.md)；预注册：[`PREREG.md`](PREREG.md)。

## 目录

- `pool-ladder/`：当前 28 池、`n=2 standard`、rule/legacy、8 seed、每档 1000 局的原始文本与配对汇总。
- `train/`：两粒 2P-only PG 的完整 stdout 与运行 manifest。
- `packs/`：两粒 PG 的最终包、sidecar 和 500/1000/1500 局快照。
- `selftest3/`：最终包与 1000 局快照的梯度预检原文。
- `2p/`：底座、最终包、1000 局快照在 rule/legacy × 77000/90210 上的原始 JSON 与汇总。
- `endgame/count-spectrum.txt`：三枚代表包的全场与 alive=2 夺冠率。
- `endgame/switch/`：三枚包在 2P/5P/8P、脚本/真实对手下的中段与残局行为 JSON。
- `eval-manifest.tsv`：selftest3 与 2P 验收的时间、退出码、SHA-256。
- `sha256-manifest.tsv`：本目录除自身与索引外所有文件的 SHA-256。

## 关键判语

- 2P 池级阶梯：rule 轻度倒挂，legacy 方向正确但普通↔简单仍弱。
- PG：所有快照的两把 2P 替身均变差；s28 最终 selftest3 红，s29 最终严重退化。主尺失败后按预注册未跑 5P 护栏。
- 残局：三枚代表包均未量到 alive=2 后夺冠率低于全场；FS-G2 的真实对手 8P 残局分母为 0，属于盲区。
- 未改产品代码、规则、池或难度表；未做产品路由；未跑本地整轮门禁。
