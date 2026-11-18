# 训练侧旋钮册（生成物，勿手改）

> 2026-11-19 起本册大幅缩水：v7 线（train-3p/best/fast/server）已删除，其 EPIRUS_* 旋钮宇宙随之消失；
> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。
> 真源：server/knob-guard.mjs 解析现存入口的 env 读取。历史台账（REMOVED_TRAIN_KEYS 等）在被删文件里，随 git 史可考。
> 数据账：全集 65 ‖ 在用 19 ‖ 暗键 46

## 全量（按名排序）

| 旋钮 | 读它的入口 | 状态 |
|---|---|---|
| `EPIRUS_AGGR_GAMES` | promote-champion | 在用 |
| `EPIRUS_ALIAS_TSV` | — | 暗键（被提及无人读） |
| `EPIRUS_ALLOW_DARK` | promote-champion | 在用 |
| `EPIRUS_ALLOW_V7` | — | 暗键（被提及无人读） |
| `EPIRUS_ARCH2` | — | 暗键（被提及无人读） |
| `EPIRUS_ARM` | — | 暗键（被提及无人读） |
| `EPIRUS_BAND_DIR` | — | 暗键（被提及无人读） |
| `EPIRUS_BATCH_MAX` | — | 暗键（被提及无人读） |
| `EPIRUS_BREADTH_GAMES` | promote-champion | 在用 |
| `EPIRUS_BUNDLE_IN` | — | 暗键（被提及无人读） |
| `EPIRUS_BUNDLE_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_CHARGE_GAMES` | promote-champion | 在用 |
| `EPIRUS_CHROME` | — | 暗键（被提及无人读） |
| `EPIRUS_COUNTER_OPPS` | — | 暗键（被提及无人读） |
| `EPIRUS_COURSE_BOT` | — | 暗键（被提及无人读） |
| `EPIRUS_COURSE_EVERY` | — | 暗键（被提及无人读） |
| `EPIRUS_DEBUG_CDP` | — | 暗键（被提及无人读） |
| `EPIRUS_DEFQ_GAMES` | promote-champion | 在用 |
| `EPIRUS_DENSITY_GAMES` | promote-champion | 在用 |
| `EPIRUS_DIV_W` | promote-champion | 在用 |
| `EPIRUS_FEAS_GAMES` | promote-champion | 在用 |
| `EPIRUS_GUARD_GAMES` | promote-champion | 在用 |
| `EPIRUS_GUARD_SEEDS` | promote-champion | 在用 |
| `EPIRUS_HOLDOUT_SEG` | — | 暗键（被提及无人读） |
| `EPIRUS_HOTSTART` | — | 暗键（被提及无人读） |
| `EPIRUS_INIT_ACT_K` | — | 暗键（被提及无人读） |
| `EPIRUS_INSTR` | — | 暗键（被提及无人读） |
| `EPIRUS_JSON` | promote-champion | 在用 |
| `EPIRUS_KILL_FIELD` | — | 暗键（被提及无人读） |
| `EPIRUS_KILL_REWARD` | — | 暗键（被提及无人读） |
| `EPIRUS_LOG_DEFAULT_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_MIX2_EVERY` | — | 暗键（被提及无人读） |
| `EPIRUS_MIX8` | — | 暗键（被提及无人读） |
| `EPIRUS_MIXHP_EVERY` | — | 暗键（被提及无人读） |
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
| `EPIRUS_SELF_TEACHER` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_COUNTER` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_EVAL_SEEDS` | — | 暗键（被提及无人读） |
| `EPIRUS_SHAPE_GAMES` | promote-champion | 在用 |
| `EPIRUS_SNIPER_GAMES` | promote-champion | 在用 |
| `EPIRUS_SUPPORT_PRIOR` | — | 暗键（被提及无人读） |
| `EPIRUS_T3P_BASELINE` | — | 暗键（被提及无人读） |
| `EPIRUS_T3P_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_TEACHER_GATE` | — | 暗键（被提及无人读） |
| `EPIRUS_TEACHER_GATE_HP` | — | 暗键（被提及无人读） |
| `EPIRUS_TEACHER_GATE_T` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_TRIPLET` | — | 暗键（被提及无人读） |
| `EPIRUS_WALL_MS` | — | 暗键（被提及无人读） |
| `EPIRUS_WORKERS` | — | 暗键（被提及无人读） |
| `EPIRUS_WR_TOL` | — | 暗键（被提及无人读） |
| `EPIRUS_XN2G` | — | 暗键（被提及无人读） |
| `EPIRUS_XN2REF` | — | 暗键（被提及无人读） |
| `EPIRUS_XN2W` | — | 暗键（被提及无人读） |

## 暗键（删除候选：源码有字面量、现役入口不读）

- `EPIRUS_ALIAS_TSV`
- `EPIRUS_ALLOW_V7`
- `EPIRUS_ARCH2`
- `EPIRUS_ARM`
- `EPIRUS_BAND_DIR`
- `EPIRUS_BATCH_MAX`
- `EPIRUS_BUNDLE_IN`
- `EPIRUS_BUNDLE_OUT`
- `EPIRUS_CHROME`
- `EPIRUS_COUNTER_OPPS`
- `EPIRUS_COURSE_BOT`
- `EPIRUS_COURSE_EVERY`
- `EPIRUS_DEBUG_CDP`
- `EPIRUS_HOLDOUT_SEG`
- `EPIRUS_HOTSTART`
- `EPIRUS_INIT_ACT_K`
- `EPIRUS_INSTR`
- `EPIRUS_KILL_FIELD`
- `EPIRUS_KILL_REWARD`
- `EPIRUS_LOG_DEFAULT_OUT`
- `EPIRUS_MIX2_EVERY`
- `EPIRUS_MIX8`
- `EPIRUS_MIXHP_EVERY`
- `EPIRUS_MUT_MODE`
- `EPIRUS_PAIRED`
- `EPIRUS_PASSIVE_FIELD`
- `EPIRUS_REPO`
- `EPIRUS_SEED`
- `EPIRUS_SEEDPACK`
- `EPIRUS_SELF_TEACHER`
- `EPIRUS_SEL_COUNTER`
- `EPIRUS_SEL_EVAL_SEEDS`
- `EPIRUS_SUPPORT_PRIOR`
- `EPIRUS_T3P_BASELINE`
- `EPIRUS_T3P_OUT`
- `EPIRUS_TEACHER_GATE`
- `EPIRUS_TEACHER_GATE_HP`
- `EPIRUS_TEACHER_GATE_T`
- `EPIRUS_TRAIN_MODE`
- `EPIRUS_TRIPLET`
- `EPIRUS_WALL_MS`
- `EPIRUS_WORKERS`
- `EPIRUS_WR_TOL`
- `EPIRUS_XN2G`
- `EPIRUS_XN2REF`
- `EPIRUS_XN2W`

