# 训练侧旋钮册（生成物，勿手改）

> 生成器就是本文件：`node training/knobs.mjs` 重生成；CI 每次都跑 `node training/knobs.mjs --check`（`.github/workflows/gates.yml`）。
> ⚠ `--check` 只核下面的**数据账**（全集/在用/暗键三个数）⇒ 本头注不在它的比对范围，别把手写说明加在册子上，加到这里。
> 真源：`training/server/knob-guard.mjs` 的 `readKeysOf()`（入口的源码 + 传递 import 闭包 + 显式声明的名单）解析现存入口的 env 读取。
> 注解：`training/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失。
> 历史台账（`REMOVED_TRAIN_KEYS` 等）在被删文件里，随 git 史可考。
> 2026-11-19 起本册大幅缩水：v7 线（train-3p/best/fast/server）已删除，其 EPIRUS_* 旋钮宇宙随之消失；
> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。
> 数据账：全集 186 ‖ 在用 19 ‖ 暗键 167

## 全量（按名排序）

| 旋钮 | 读它的入口 | 状态 |
|---|---|---|
| `EPIRUS_AGGR_GAMES` | promote-champion | 在用 |
| `EPIRUS_ALIAS_TSV` | — | 暗键（被提及无人读） |
| `EPIRUS_ALLOW_DARK` | promote-champion | 在用 |
| `EPIRUS_ALLOW_HEALTH_FAIL` | — | 暗键（被提及无人读） |
| `EPIRUS_ANCHOR` | — | 暗键（被提及无人读） |
| `EPIRUS_ANCHOR_TO` | — | 暗键（被提及无人读） |
| `EPIRUS_ARCH2` | — | 暗键（被提及无人读） |
| `EPIRUS_ARM` | — | 暗键（被提及无人读） |
| `EPIRUS_BAND_DIR` | — | 暗键（被提及无人读） |
| `EPIRUS_BATCH_MAX` | — | 暗键（被提及无人读） |
| `EPIRUS_BEAD_BOOM_W` | — | 暗键（被提及无人读） |
| `EPIRUS_BEAD_SEED` | — | 暗键（被提及无人读） |
| `EPIRUS_BEAD_SEED_KIND` | — | 暗键（被提及无人读） |
| `EPIRUS_BEAD_W` | — | 暗键（被提及无人读） |
| `EPIRUS_BIGCARD_W` | — | 暗键（被提及无人读） |
| `EPIRUS_BIGT_CHAIN_W` | — | 暗键（被提及无人读） |
| `EPIRUS_BIGT_PUSH` | — | 暗键（被提及无人读） |
| `EPIRUS_BLOCK_W` | — | 暗键（被提及无人读） |
| `EPIRUS_BREADTH_FLOOR` | — | 暗键（被提及无人读） |
| `EPIRUS_BREADTH_GAMES` | promote-champion | 在用 |
| `EPIRUS_BUNDLE_IN` | — | 暗键（被提及无人读） |
| `EPIRUS_BUNDLE_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_CARD_ABORT` | — | 暗键（被提及无人读） |
| `EPIRUS_CARD_ABORT_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_CARD_MIN` | — | 暗键（被提及无人读） |
| `EPIRUS_CHARGE_GAMES` | promote-champion | 在用 |
| `EPIRUS_CHARGE_MIN_EP` | — | 暗键（被提及无人读） |
| `EPIRUS_CHROME` | — | 暗键（被提及无人读） |
| `EPIRUS_CLEAR_W` | — | 暗键（被提及无人读） |
| `EPIRUS_CONV_OFFENSE` | — | 暗键（被提及无人读） |
| `EPIRUS_CONV_RATIO` | — | 暗键（被提及无人读） |
| `EPIRUS_COSTLY_W` | — | 暗键（被提及无人读） |
| `EPIRUS_COUNTER_OPPS` | — | 暗键（被提及无人读） |
| `EPIRUS_COURSE_BOT` | — | 暗键（被提及无人读） |
| `EPIRUS_COURSE_EVERY` | — | 暗键（被提及无人读） |
| `EPIRUS_COURSE_PACK` | — | 暗键（被提及无人读） |
| `EPIRUS_CURSE_PUSH` | — | 暗键（被提及无人读） |
| `EPIRUS_DEBUG_CDP` | — | 暗键（被提及无人读） |
| `EPIRUS_DEFQ_GAMES` | promote-champion | 在用 |
| `EPIRUS_DENSITY_GAMES` | promote-champion | 在用 |
| `EPIRUS_DIV_CATW` | — | 暗键（被提及无人读） |
| `EPIRUS_DIV_FORCE_GENS` | — | 暗键（被提及无人读） |
| `EPIRUS_DIV_K` | — | 暗键（被提及无人读） |
| `EPIRUS_DIV_ROLEW` | — | 暗键（被提及无人读） |
| `EPIRUS_DIV_W` | promote-champion | 在用 |
| `EPIRUS_DRAIN_PUSH` | — | 暗键（被提及无人读） |
| `EPIRUS_ECO_CAP` | — | 暗键（被提及无人读） |
| `EPIRUS_ECO_DIVW` | — | 暗键（被提及无人读） |
| `EPIRUS_ECO_TARGET` | — | 暗键（被提及无人读） |
| `EPIRUS_FEASIBILITY` | — | 暗键（被提及无人读） |
| `EPIRUS_FEASIBILITY_BLOCK` | — | 暗键（被提及无人读） |
| `EPIRUS_FEAS_GAMES` | promote-champion | 在用 |
| `EPIRUS_FEAT_MASK` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_CAL` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_CHAMP` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_CHAMP_EVERY` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_G_FLOOR` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_G_W` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_TAIL_Q` | — | 暗键（被提及无人读） |
| `EPIRUS_FIT_TAIL_W` | — | 暗键（被提及无人读） |
| `EPIRUS_GA_BAND` | — | 暗键（被提及无人读） |
| `EPIRUS_GA_GATE` | — | 暗键（被提及无人读） |
| `EPIRUS_GA_GATE_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_GUARD_GAMES` | promote-champion | 在用 |
| `EPIRUS_GUARD_SEEDS` | promote-champion | 在用 |
| `EPIRUS_HALL_DEDUP` | — | 暗键（被提及无人读） |
| `EPIRUS_HALL_TRACE` | — | 暗键（被提及无人读） |
| `EPIRUS_HALL_TRACE_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_HOARD_CAP_MULT` | — | 暗键（被提及无人读） |
| `EPIRUS_HOARD_LEFTOVER` | — | 暗键（被提及无人读） |
| `EPIRUS_HOLDOUT_SEG` | — | 暗键（被提及无人读） |
| `EPIRUS_HOLO2PROTO` | — | 暗键（被提及无人读） |
| `EPIRUS_HOTSTART` | — | 暗键（被提及无人读） |
| `EPIRUS_HPSEED` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_FRAC` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_GENS` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_ONLY` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_OVERRIDE` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_PLAN` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_SUBONLY` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_SUB_ONLY` | — | 暗键（被提及无人读） |
| `EPIRUS_IMIT_TEACHER` | — | 暗键（被提及无人读） |
| `EPIRUS_INIT_ACT_K` | — | 暗键（被提及无人读） |
| `EPIRUS_INIT_SCALE` | — | 暗键（被提及无人读） |
| `EPIRUS_INSTR` | — | 暗键（被提及无人读） |
| `EPIRUS_JSON` | promote-champion | 在用 |
| `EPIRUS_KILL_FIELD` | — | 暗键（被提及无人读） |
| `EPIRUS_KILL_REWARD` | — | 暗键（被提及无人读） |
| `EPIRUS_KR_TRANSFER` | — | 暗键（被提及无人读） |
| `EPIRUS_LASER_W` | — | 暗键（被提及无人读） |
| `EPIRUS_LOG_DEFAULT_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_MIX2_EVERY` | — | 暗键（被提及无人读） |
| `EPIRUS_MIX8` | — | 暗键（被提及无人读） |
| `EPIRUS_MIXHP_EVERY` | — | 暗键（被提及无人读） |
| `EPIRUS_MUT_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_NORM` | — | 暗键（被提及无人读） |
| `EPIRUS_NO_DEFQ` | promote-champion | 在用 |
| `EPIRUS_NO_GUARD` | promote-champion | 在用 |
| `EPIRUS_NO_PROXY` | promote-champion | 在用 |
| `EPIRUS_NO_SHAPE` | promote-champion | 在用 |
| `EPIRUS_OPP_N` | — | 暗键（被提及无人读） |
| `EPIRUS_PACK_OPP` | — | 暗键（被提及无人读） |
| `EPIRUS_PAIRED` | — | 暗键（被提及无人读） |
| `EPIRUS_PASSIVE_FIELD` | — | 暗键（被提及无人读） |
| `EPIRUS_POOL_OPPS` | — | 暗键（被提及无人读） |
| `EPIRUS_POOL_OPPS_TABLE` | — | 暗键（被提及无人读） |
| `EPIRUS_POOL_OPPS_TIER` | — | 暗键（被提及无人读） |
| `EPIRUS_PROXY_GAMES` | promote-champion | 在用 |
| `EPIRUS_PUBLISH` | — | 暗键（被提及无人读） |
| `EPIRUS_REGEN_GENS` | — | 暗键（被提及无人读） |
| `EPIRUS_REGEN_SLICE` | — | 暗键（被提及无人读） |
| `EPIRUS_REPO` | — | 暗键（被提及无人读） |
| `EPIRUS_RING_FORCE_EPS` | — | 暗键（被提及无人读） |
| `EPIRUS_RING_FORCE_UNTIL` | — | 暗键（被提及无人读） |
| `EPIRUS_RING_W` | — | 暗键（被提及无人读） |
| `EPIRUS_S4_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_S4_W` | — | 暗键（被提及无人读） |
| `EPIRUS_SEAT_GAMES` | promote-champion | 在用 |
| `EPIRUS_SEED` | — | 暗键（被提及无人读） |
| `EPIRUS_SEED0` | — | 暗键（被提及无人读） |
| `EPIRUS_SEEDPACK` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_BIGT` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_BIGT_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_BIGT_KEYS` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_BIGT_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_CARDS` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_CARDS_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_CLEAR` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_CLEAR_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_COUNTER` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_DEFQ` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_DEFQ_EPS` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_DEFQ_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_DEFQ_MINHANDS` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_DEFQ_MINSHARE` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_DEFQ_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_EVAL_SEEDS` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_GIFT_VETO` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_GIFT_VETO_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_LAND` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_LAND_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_LAND_TOL` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_POOL` | — | 暗键（被提及无人读） |
| `EPIRUS_SEL_TWO_STAGE` | — | 暗键（被提及无人读） |
| `EPIRUS_SEQ_KIND` | — | 暗键（被提及无人读） |
| `EPIRUS_SEQ_W` | — | 暗键（被提及无人读） |
| `EPIRUS_SHAPE_GAMES` | promote-champion | 在用 |
| `EPIRUS_SIGMA_DECAY` | — | 暗键（被提及无人读） |
| `EPIRUS_SIGMA_FLOOR` | — | 暗键（被提及无人读） |
| `EPIRUS_SIGMA_STALL` | — | 暗键（被提及无人读） |
| `EPIRUS_SNIPER_GAMES` | promote-champion | 在用 |
| `EPIRUS_STALL_ABORT` | — | 暗键（被提及无人读） |
| `EPIRUS_STOCK_BONUS` | — | 暗键（被提及无人读） |
| `EPIRUS_STYLE_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_STYLE_W` | — | 暗键（被提及无人读） |
| `EPIRUS_SUBSIDY_EP` | — | 暗键（被提及无人读） |
| `EPIRUS_SUBSIDY_H` | — | 暗键（被提及无人读） |
| `EPIRUS_SUBSIDY_MIN` | — | 暗键（被提及无人读） |
| `EPIRUS_SUB_BEAD` | — | 暗键（被提及无人读） |
| `EPIRUS_SUB_BEAD_KIND` | — | 暗键（被提及无人读） |
| `EPIRUS_SUPPORT_PRIOR` | — | 暗键（被提及无人读） |
| `EPIRUS_T3P_BASELINE` | — | 暗键（被提及无人读） |
| `EPIRUS_T3P_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_TB3P` | — | 暗键（被提及无人读） |
| `EPIRUS_TB3P_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_TB_OUT` | — | 暗键（被提及无人读） |
| `EPIRUS_TGT_W` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_EPS` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_EPS_K` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_EPS_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_MODE` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_SEAT_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_TRAIN_TEMP` | — | 暗键（被提及无人读） |
| `EPIRUS_TRIPLET` | — | 暗键（被提及无人读） |
| `EPIRUS_TRIPLET_LOG` | — | 暗键（被提及无人读） |
| `EPIRUS_VOID_IDEAL_W` | — | 暗键（被提及无人读） |
| `EPIRUS_VOID_W` | — | 暗键（被提及无人读） |
| `EPIRUS_WALL_FILTER` | — | 暗键（被提及无人读） |
| `EPIRUS_WALL_GAMES` | — | 暗键（被提及无人读） |
| `EPIRUS_WALL_MS` | — | 暗键（被提及无人读） |
| `EPIRUS_WIDTH_W` | — | 暗键（被提及无人读） |
| `EPIRUS_WORKERS` | — | 暗键（被提及无人读） |
| `EPIRUS_WR_TOL` | — | 暗键（被提及无人读） |
| `EPIRUS_XN2G` | — | 暗键（被提及无人读） |
| `EPIRUS_XN2REF` | — | 暗键（被提及无人读） |
| `EPIRUS_XN2W` | — | 暗键（被提及无人读） |

## 暗键（删除候选：源码有字面量、现役入口不读）

- `EPIRUS_ALIAS_TSV`
- `EPIRUS_ALLOW_HEALTH_FAIL`
- `EPIRUS_ANCHOR`
- `EPIRUS_ANCHOR_TO`
- `EPIRUS_ARCH2`
- `EPIRUS_ARM`
- `EPIRUS_BAND_DIR`
- `EPIRUS_BATCH_MAX`
- `EPIRUS_BEAD_BOOM_W`
- `EPIRUS_BEAD_SEED`
- `EPIRUS_BEAD_SEED_KIND`
- `EPIRUS_BEAD_W`
- `EPIRUS_BIGCARD_W`
- `EPIRUS_BIGT_CHAIN_W`
- `EPIRUS_BIGT_PUSH`
- `EPIRUS_BLOCK_W`
- `EPIRUS_BREADTH_FLOOR`
- `EPIRUS_BUNDLE_IN`
- `EPIRUS_BUNDLE_OUT`
- `EPIRUS_CARD_ABORT`
- `EPIRUS_CARD_ABORT_GAMES`
- `EPIRUS_CARD_MIN`
- `EPIRUS_CHARGE_MIN_EP`
- `EPIRUS_CHROME`
- `EPIRUS_CLEAR_W`
- `EPIRUS_CONV_OFFENSE`
- `EPIRUS_CONV_RATIO`
- `EPIRUS_COSTLY_W`
- `EPIRUS_COUNTER_OPPS`
- `EPIRUS_COURSE_BOT`
- `EPIRUS_COURSE_EVERY`
- `EPIRUS_COURSE_PACK`
- `EPIRUS_CURSE_PUSH`
- `EPIRUS_DEBUG_CDP`
- `EPIRUS_DIV_CATW`
- `EPIRUS_DIV_FORCE_GENS`
- `EPIRUS_DIV_K`
- `EPIRUS_DIV_ROLEW`
- `EPIRUS_DRAIN_PUSH`
- `EPIRUS_ECO_CAP`
- `EPIRUS_ECO_DIVW`
- `EPIRUS_ECO_TARGET`
- `EPIRUS_FEASIBILITY`
- `EPIRUS_FEASIBILITY_BLOCK`
- `EPIRUS_FEAT_MASK`
- `EPIRUS_FIT_CAL`
- `EPIRUS_FIT_CHAMP`
- `EPIRUS_FIT_CHAMP_EVERY`
- `EPIRUS_FIT_G_FLOOR`
- `EPIRUS_FIT_G_W`
- `EPIRUS_FIT_TAIL_Q`
- `EPIRUS_FIT_TAIL_W`
- `EPIRUS_GA_BAND`
- `EPIRUS_GA_GATE`
- `EPIRUS_GA_GATE_GAMES`
- `EPIRUS_HALL_DEDUP`
- `EPIRUS_HALL_TRACE`
- `EPIRUS_HALL_TRACE_OUT`
- `EPIRUS_HOARD_CAP_MULT`
- `EPIRUS_HOARD_LEFTOVER`
- `EPIRUS_HOLDOUT_SEG`
- `EPIRUS_HOLO2PROTO`
- `EPIRUS_HOTSTART`
- `EPIRUS_HPSEED`
- `EPIRUS_IMIT_FRAC`
- `EPIRUS_IMIT_GENS`
- `EPIRUS_IMIT_ONLY`
- `EPIRUS_IMIT_OVERRIDE`
- `EPIRUS_IMIT_PLAN`
- `EPIRUS_IMIT_SUBONLY`
- `EPIRUS_IMIT_SUB_ONLY`
- `EPIRUS_IMIT_TEACHER`
- `EPIRUS_INIT_ACT_K`
- `EPIRUS_INIT_SCALE`
- `EPIRUS_INSTR`
- `EPIRUS_KILL_FIELD`
- `EPIRUS_KILL_REWARD`
- `EPIRUS_KR_TRANSFER`
- `EPIRUS_LASER_W`
- `EPIRUS_LOG_DEFAULT_OUT`
- `EPIRUS_MIX2_EVERY`
- `EPIRUS_MIX8`
- `EPIRUS_MIXHP_EVERY`
- `EPIRUS_MUT_MODE`
- `EPIRUS_NORM`
- `EPIRUS_OPP_N`
- `EPIRUS_PACK_OPP`
- `EPIRUS_PAIRED`
- `EPIRUS_PASSIVE_FIELD`
- `EPIRUS_POOL_OPPS`
- `EPIRUS_POOL_OPPS_TABLE`
- `EPIRUS_POOL_OPPS_TIER`
- `EPIRUS_PUBLISH`
- `EPIRUS_REGEN_GENS`
- `EPIRUS_REGEN_SLICE`
- `EPIRUS_REPO`
- `EPIRUS_RING_FORCE_EPS`
- `EPIRUS_RING_FORCE_UNTIL`
- `EPIRUS_RING_W`
- `EPIRUS_S4_GAMES`
- `EPIRUS_S4_W`
- `EPIRUS_SEED`
- `EPIRUS_SEED0`
- `EPIRUS_SEEDPACK`
- `EPIRUS_SEL_BIGT`
- `EPIRUS_SEL_BIGT_GAMES`
- `EPIRUS_SEL_BIGT_KEYS`
- `EPIRUS_SEL_BIGT_MODE`
- `EPIRUS_SEL_CARDS`
- `EPIRUS_SEL_CARDS_GAMES`
- `EPIRUS_SEL_CLEAR`
- `EPIRUS_SEL_CLEAR_GAMES`
- `EPIRUS_SEL_COUNTER`
- `EPIRUS_SEL_DEFQ`
- `EPIRUS_SEL_DEFQ_EPS`
- `EPIRUS_SEL_DEFQ_GAMES`
- `EPIRUS_SEL_DEFQ_MINHANDS`
- `EPIRUS_SEL_DEFQ_MINSHARE`
- `EPIRUS_SEL_DEFQ_MODE`
- `EPIRUS_SEL_EVAL_SEEDS`
- `EPIRUS_SEL_GIFT_VETO`
- `EPIRUS_SEL_GIFT_VETO_GAMES`
- `EPIRUS_SEL_LAND`
- `EPIRUS_SEL_LAND_GAMES`
- `EPIRUS_SEL_LAND_TOL`
- `EPIRUS_SEL_POOL`
- `EPIRUS_SEL_TWO_STAGE`
- `EPIRUS_SEQ_KIND`
- `EPIRUS_SEQ_W`
- `EPIRUS_SIGMA_DECAY`
- `EPIRUS_SIGMA_FLOOR`
- `EPIRUS_SIGMA_STALL`
- `EPIRUS_STALL_ABORT`
- `EPIRUS_STOCK_BONUS`
- `EPIRUS_STYLE_GAMES`
- `EPIRUS_STYLE_W`
- `EPIRUS_SUBSIDY_EP`
- `EPIRUS_SUBSIDY_H`
- `EPIRUS_SUBSIDY_MIN`
- `EPIRUS_SUB_BEAD`
- `EPIRUS_SUB_BEAD_KIND`
- `EPIRUS_SUPPORT_PRIOR`
- `EPIRUS_T3P_BASELINE`
- `EPIRUS_T3P_OUT`
- `EPIRUS_TB3P`
- `EPIRUS_TB3P_GAMES`
- `EPIRUS_TB_OUT`
- `EPIRUS_TGT_W`
- `EPIRUS_TRAIN_EPS`
- `EPIRUS_TRAIN_EPS_K`
- `EPIRUS_TRAIN_EPS_MODE`
- `EPIRUS_TRAIN_MODE`
- `EPIRUS_TRAIN_SEAT_GAMES`
- `EPIRUS_TRAIN_TEMP`
- `EPIRUS_TRIPLET`
- `EPIRUS_TRIPLET_LOG`
- `EPIRUS_VOID_IDEAL_W`
- `EPIRUS_VOID_W`
- `EPIRUS_WALL_FILTER`
- `EPIRUS_WALL_GAMES`
- `EPIRUS_WALL_MS`
- `EPIRUS_WIDTH_W`
- `EPIRUS_WORKERS`
- `EPIRUS_WR_TOL`
- `EPIRUS_XN2G`
- `EPIRUS_XN2REF`
- `EPIRUS_XN2W`

