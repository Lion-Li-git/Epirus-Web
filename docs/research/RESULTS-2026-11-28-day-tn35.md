# RESULTS · 2026-11-28（日班）· `train-server` 控制台修复 ＆ `TN35-S` 清单外六臂探索收口

> 完成时间：2026-11-28 10:49（UTC+8）。
> 基线：`main@dad5659d`（`v2.1.46`，规则指纹 `c61298e6`，池 35 枚 `hard 17 / soft 18`）。
> 预登记：[`PREREG-2026-11-28-day-tn35.md`](PREREG-2026-11-28-day-tn35.md)。
> 池成员判定：**不改池（维持 35 枚 `17/18`）**；全部 H1–H3 六臂产物均严格按预注册硬门止损淘汰，未降低阈值或扫参追击，且零散产物全部留在 `scratch/`（未向 `docs/artifacts/` 或 `docs/research/` 写入大体积原始 JSON）。

## 1. 修复项落地

1. **[`training/server/train-server.mjs`](../../training/server/train-server.mjs) 控制台页面访问修复**：
   - 此前启动横幅打印 `http://127.0.0.1:8787/?token=<TOKEN>`，但 `GET /` 无条件返回 JSON，浏览器直接访问看到原始 JSON 而不是控制台页面。
   - 现新增白名单静态服务 `/app/`（仅放行 `index.html`、`css/**`、`js/**` 与排除 `champion-map/archive/**` 后的 `champion-map/**`，HTML 入口 `/app` `/app/` `/app/index.html` 仍强制校验 `token` 并自动填入 `#tr-token`）；
   - `GET /` 对浏览器导航（无 `X-Epirus-Token` 头且 `Accept` 含 `text/html`）`302` 跳往 `/app/?token=...`，而带 `X-Epirus-Token` 或 API 探活仍返回原有 `200 application/json`；`/status` 恒返回 JSON。
   - 启动横幅改为打印 `http://127.0.0.1:8787/app/?token=<TOKEN>`（并注明 `API 探活: /?token=<TOKEN>`）。
   - [`tools/train-server-selftest.mjs`](../../tools/train-server-selftest.mjs) 新增未带 token 访问 `/app/`（`401`）、`Accept: text/html` 访问 `/`（`302 -> /app/?token=...`）、`/app/?token=...`（`200 text/html`）、`/app/css/style.css`（`200`）与越权路径 `/app/docs/RULES-2P.md` / `/app/champion-map/archive/`（`404`）断言。
2. **[`docs/research/HANDOFF-2026-11-28-morning.md`](HANDOFF-2026-11-28-morning.md) 状态对齐**：
   - 将文件头交接时间戳与 §4 P3 债务表、§5 `NEXT` 对齐至 `07:48`（§6–§7 已完成的 `Pages archive` 排除、`training.yml` 路径补齐、`cdp-boot.mjs` 重试与全部 soft 快筛不再与 §5 `02:03` 初版互相覆盖）。

## 2. `TN35-S` 清单外实验汇总（目标：替换 `MX8-TN35-KL3` 清零 `seatKill=2` ＆ 压降 `90.23%` 废珠）

硬门：`selftest3` 六腿全绿 + `laserEye≥10, proto≥6, ring≥8, holo≥12, selfUnionN≥18` + `Stage 1 胜率≥40%` + `总废珠≤60%` + `花珠≥241`。

| 假说 | 臂名（`scratch/arms/`） | 配方关键差 | `selftest3` | 胜率 | 并集 | `laserEye` | `proto` | `holo` | `ring` | `firestorm` | `elec` (花/废) | `boom` (花/废) | 总废珠 | 结论 |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|
| H1 | `TN35-L1B.snap0`（终点腿 C 红） | `L1B-S1200` 底 + `FS2(charge,laserEye,firestorm)` + `MX8(proto,holo,jinshield)`，`winOnly=0` | snap0 绿 / 终点红 | 40.33% | 18 | **0** | 45 | 37 | 4 | 0 | 15 / 1877 | 0 / 0 | **98.3%** | **淘汰**：`charge` 跨亲污染 + `round 1` 饱和 |
| H1 | `TN35-WIN` | 同上，**`winOnly=1`** | **snap0 & 终点全绿** | **48.00%** | 17 | **0** | 49 | 42 | 0 | 0 | 75 / 1806 | 0 / 0 | **95.2%** | **淘汰**：证 `winOnly=1` 稳梯度且提胜率 `+7.67pt`，仍因 `charge` 键道零 `laserEye` |
| H2 | `TN35-FS2` | 主从反转：`FS2-LE26` 底，副教师禁 `charge`，`winOnly=0` 终点 | 全绿 | 41.08% | 20 | **0** | 19 | 28 | 4 | 33 | 13 / 767 | 18 / 0 | **95.9%** | **淘汰**：`DAgger round 1` 漂掉 `laserEye/boom` |
| H2 | `TN35-FS2.snap0` | 同上 `round 0` 快照（无 `round 1` 漂移） | 全绿 | 38.67% | 19 | 7 | 15 | 29 | 0 | 30 | 38 / 936 | 109 / 0 | **86.3%** | 进 H3 PG（`boom 109/109`，唯差胜率与电珠） |
| H2 | `TN35-FS2W` | 同 H2，**`winOnly=1`** 终点 | snap0 红 / 终点绿 | 38.17% | 20 | 4 | 2 | 9 | 8 | 29 | 32 / 989 | 89 / 1 | **87.9%** | **淘汰**：再证 `winOnly=1` 护终点但缩窄 `proto/holo` |
| H3 | `TN35-PG`（`seg2400`） | `TN35-FS2.snap0` → Stage C 岭基线 PG（`baseline=ridge`, `klTilt`, `2400g`） | seg600 & 终点全绿 | 35.92% | 14 | 5 | 10 | 47 | 0 | 20 | 19 / 190 | 55 / 0 | **71.7%** | **淘汰**：废珠 `86.3%→71.7%` 仍超 `60%` 且胜率/覆盖掉线 |
| H3 | `FSDR-PH` | `FS-DR`（`53.9%` 废）+ `MX8(proto,holo,jinshield)` `--dagger=0` 单轮嫁接 | 全绿 | 41.08% | 14 | 1 | 5 | 21 | 0 | 33 | 10 / 221 | 17 / 0 | **87.7%** | **淘汰**：无 `charge`/无 DAgger 仍把 `FS-DR` 拉回电珠闲置 |

## 3. 机制结论与下一步建议

1. **`MX8-TN35-KL3` 暂不强行以单枚替换**：无论直接 PG（`63.35%`，夜班）还是 `L1B-S1200` 跨亲（`H1`）、`FS2-LE26` 反置（`H2`）、`TN35-FS2.snap0` 两阶段岭基线 PG（`H3`）、`FS-DR` 无漂移嫁接（`H3`），`holo/proto`（`1 ep`）与 `charge#boom → laserEye` + `railgun` 在单一 `16561` 维 MLP 上形成互抢 `ep` 与电珠闲置的结构性拮抗；若要替换 `MX8-TN35-KL3` 的 `seatKill=2`，建议后续改走**双卡分担**（如分别由低 `seatKill=0` 的 `laserEye` 载体与 `proto/holo` 载体承担，不强制塞入同一枚 `soft` 包）或重构角色池分拆判据。
2. **方法论确认（`§149` `--winOnly=1`）**：在多技能蒸馏里，`--winOnly=1` 两轮均守住终点 `selftest3` 全绿并抬高主线胜率（`40.33%→48.00%`），同时显著收窄次级稀有技覆盖（`proto 19→2, holo 28→9`），只宜用于单主线强化，不宜用于多技能拼盘。
3. **待用户裁定（`AGENTS.md §10` 不可逆项）**：
   - `training/knobs.mjs --check` 当前为 `185 / 在用 144 / 仅动态 41 / 暗键 0`，KPI 降回 `≤40` 需对 `v7`（`training/train-3p.mjs` 等 `100+` 条 `EPIRUS_*` 键）做**总体退役决断并整体迁至仓外隔离区 + 文档同笔清零**，不可用修扫描器假降。
   - 若认可不再将 `MX8-TN35-KL3` 的四项稀缺技能强捆于单枚包，可由用户拍板启用“分担载体替换”清理最后这枚 `seatKill=2`。
