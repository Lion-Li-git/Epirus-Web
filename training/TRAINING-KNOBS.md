# 训练侧旋钮册（生成物，勿手改）

> 2026-11-19 起本册大幅缩水：v7 线（train-3p/best/fast/server）已删除，其 EPIRUS_* 旋钮宇宙随之消失；
> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。
> 真源：server/knob-guard.mjs 解析现存入口的 env 读取。历史台账（REMOVED_TRAIN_KEYS 等）在被删文件里，随 git 史可考。
> 数据账：全集 40 ‖ 在用 19 ‖ 暗键 21

## 全量（按名排序）

| 旋钮 | 读它的入口 | 状态 |
|---|---|---|
| `EPIRUS_AGGR_GAMES` | promote-champion | 在用 |
| `EPIRUS_ALIAS_TSV` | — | 暗键（被提及无人读） |
| `EPIRUS_ALLOW_DARK` | promote-champion | 在用 |
| `EPIRUS_ARCH2` | — | 暗键（被提及无人读） |
| `EPIRUS_BATCH_MAX` | — | 暗键（被提及无人读） |
| `EPIRUS_BREADTH_GAMES` | promote-champion | 在用 |
| `EPIRUS_BUNDLE_IN` | — | 暗键（被提及无人读） |
| `EPIRUS_BUNDLE_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_CHARGE_GAMES` | promote-champion | 在用 |
| `EPIRUS_CHROME` | — | 暗键（被提及无人读） |
| `EPIRUS_DEBUG_CDP` | — | 暗键（被提及无人读） |
| `EPIRUS_DEFQ_GAMES` | promote-champion | 在用 |
| `EPIRUS_DENSITY_GAMES` | promote-champion | 在用 |
| `EPIRUS_DIV_W` | promote-champion | 在用 |
| `EPIRUS_FEAS_GAMES` | promote-champion | 在用 |
| `EPIRUS_GUARD_GAMES` | promote-champion | 在用 |
| `EPIRUS_GUARD_SEEDS` | promote-champion | 在用 |
| `EPIRUS_HOTSTART` | — | 暗键（被提及无人读） |
| `EPIRUS_INSTR` | — | 暗键（被提及无人读） |
| `EPIRUS_JSON` | promote-champion | 在用 |
| `EPIRUS_LOG_DEFAULT_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_MUT_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_NO_DEFQ` | promote-champion | 在用 |
| `EPIRUS_NO_GUARD` | promote-champion | 在用 |
| `EPIRUS_NO_PROXY` | promote-champion | 在用 |
| `EPIRUS_NO_SHAPE` | promote-champion | 在用 |
| `EPIRUS_PAIRED` | — | 暗键（被提及无人读） |
| `EPIRUS_PASSIVE_FIELD` | — | 暗键（被提及无人读） |
| `EPIRUS_PROXY_GAMES` | promote-champion | 在用 |
| `EPIRUS_REPO` | — | 暗键（被提及无人读） |
| `EPIRUS_SEAT_GAMES` | promote-champion | 在用 |
| `EPIRUS_SEED` | — | 暗键（被提及无人读） |
| `EPIRUS_SEEDPACK` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_EVAL_SEEDS` | — | 暗键（被提及无人读） |
| `EPIRUS_SHAPE_GAMES` | promote-champion | 在用 |
| `EPIRUS_SNIPER_GAMES` | promote-champion | 在用 |
| `EPIRUS_T3P_BASELINE` | — | 暗键（被提及无人读） |
| `EPIRUS_WALL_MS` | — | 暗键（被提及无人读） |
| `EPIRUS_WORKERS` | — | 暗键（被提及无人读） |
| `EPIRUS_WR_TOL` | — | 暗键（被提及无人读） |

## 暗键（删除候选：源码有字面量、现役入口不读）

- `EPIRUS_ALIAS_TSV`
- `EPIRUS_ARCH2`
- `EPIRUS_BATCH_MAX`
- `EPIRUS_BUNDLE_IN`
- `EPIRUS_BUNDLE_OUT`
- `EPIRUS_CHROME`
- `EPIRUS_DEBUG_CDP`
- `EPIRUS_HOTSTART`
- `EPIRUS_INSTR`
- `EPIRUS_LOG_DEFAULT_OUT`
- `EPIRUS_MUT_MODE`
- `EPIRUS_PAIRED`
- `EPIRUS_PASSIVE_FIELD`
- `EPIRUS_REPO`
- `EPIRUS_SEED`
- `EPIRUS_SEEDPACK`
- `EPIRUS_SEL_EVAL_SEEDS`
- `EPIRUS_T3P_BASELINE`
- `EPIRUS_WALL_MS`
- `EPIRUS_WORKERS`
- `EPIRUS_WR_TOL`

