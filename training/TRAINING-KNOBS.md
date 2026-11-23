# 训练侧旋钮册（生成物，勿手改）

> 生成器就是本文件：`node training/knobs.mjs` 重生成；CI 每次都跑 `node training/knobs.mjs --check`（`.github/workflows/gates.yml:125`）。
> ⚠ `--check` 比的是**整篇字节**（不是只比数据账三个数——旧头注这么写，是错的：`cur !== content` 才 exit 1）。
> 判"在用/暗键"的口径（2026-11-24 换）：**按读法扫维护面**（`tools/ training/ js/ champion-map/` 里 `process.env.X` / `env['X']` 两形），
> 名单模块与注释不参与判定；`env[变量]` 这种**动态读法**看不见具体键，落进"仅动态提及"档，**不是删除候选**。
> 为什么换口径：旧口径拿手维护的入口名单判，实测两头都错过——`training/train-3p.mjs` 整族键（`EPIRUS_ANCHOR`/`BREADTH_FLOOR`/`GA_GATE`…）与 `tools/np-parallel.mjs` 读的 `EPIRUS_BATCH_MAX` 都被判成暗键，照表删就删坏现役代码。
> 运行时那套（`training/server/knob-guard.mjs` 的 `readKeysOf()` / `detectDarkKnobs()`，按**单个入口**的 import 闭包判）没变，也不该变：那是"这个入口认不认这个键"，本册答的是"全仓还有没有人读"。
> 注解：`training/train-3p.mjs` 的 `SELF_ENV_KEYS` 行尾注释——注解住在读取处旁边，删旋钮时自然消失。
> 历史台账（`REMOVED_TRAIN_KEYS` 等）在被删文件里，随 git 史可考。
> 2026-11-19 起 v7 产线（train-best/fast/server 那批）退役、其旋钮宇宙大幅缩水；⚠ 但那句"train-3p 已删除"**不成立**：
> `training/train-3p.mjs` 仍在仓（`tools/command-checkup.mjs:22,68` 拿它当 env 读者入口跑 `detectDarkKnobs`），死掉的是 `tools/train-3p.mjs` 那条旧路径（`tools/gate-all.mjs:89` 记着）。
> 2.0 产线（pg-train / supfit-gd）是 **--flag** 接口（见 training/README.md §〇），不走 env 旋钮。
> 数据账：全集 186 ‖ 在用（有读法）109 ‖ 仅动态提及 51 ‖ 暗键 26

## 全量（按名排序）

| 旋钮 | 读它的文件（前 3） | 署名入口 | 状态 |
|---|---|---|---|
| `EPIRUS_AGGR_GAMES` | — | promote-champion train-3p | 仅动态提及（不删） |
| `EPIRUS_ALIAS_TSV` | `tools/gates/_ctx.mjs` `champion-map/pack-guard.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_ALLOW_DARK` | — | promote-champion train-3p train | 仅动态提及（不删） |
| `EPIRUS_ALLOW_HEALTH_FAIL` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_ANCHOR` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_ANCHOR_TO` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_ARCH2` | `tools/probe-cem-arm.mjs` `training/train-3p.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_ARM` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_BAND_DIR` | `training/train-3p.mjs` `champion-map/opphuman-arms.mjs` | train-3p train | 在用（读法 2 处） |
| `EPIRUS_BATCH_MAX` | `tools/np-parallel.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_BEAD_BOOM_W` | — | — | 暗键（无读法） |
| `EPIRUS_BEAD_SEED` | — | — | 暗键（无读法） |
| `EPIRUS_BEAD_SEED_KIND` | — | — | 暗键（无读法） |
| `EPIRUS_BEAD_W` | — | — | 仅动态提及（不删） |
| `EPIRUS_BIGCARD_W` | — | — | 暗键（无读法） |
| `EPIRUS_BIGT_CHAIN_W` | — | — | 暗键（无读法） |
| `EPIRUS_BIGT_PUSH` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_BLOCK_W` | — | — | 仅动态提及（不删） |
| `EPIRUS_BREADTH_FLOOR` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_BREADTH_GAMES` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_BUNDLE_IN` | `tools/ring2-run.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_BUNDLE_OUT` | `tools/ring2-run.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_CARD_ABORT` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_CARD_ABORT_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_CARD_MIN` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_CHARGE_GAMES` | `tools/champ-audit.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_CHARGE_MIN_EP` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_CHROME` | `tools/cdp-boot.mjs` `tools/page-chrome.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_CLEAR_W` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_CONV_OFFENSE` | — | — | 暗键（无读法） |
| `EPIRUS_CONV_RATIO` | — | — | 仅动态提及（不删） |
| `EPIRUS_COSTLY_W` | — | — | 暗键（无读法） |
| `EPIRUS_COUNTER_OPPS` | `training/train-3p.mjs` `champion-map/opphuman-arms.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_COURSE_BOT` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_COURSE_EVERY` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_COURSE_PACK` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_CURSE_PUSH` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_DEBUG_CDP` | `tools/page-chrome.mjs` | — | 在用（读法 1 处） |
| `EPIRUS_DEFQ_GAMES` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_DENSITY_GAMES` | — | promote-champion train-3p | 仅动态提及（不删） |
| `EPIRUS_DIV_CATW` | — | — | 暗键（无读法） |
| `EPIRUS_DIV_FORCE_GENS` | — | — | 仅动态提及（不删） |
| `EPIRUS_DIV_K` | — | — | 暗键（无读法） |
| `EPIRUS_DIV_ROLEW` | — | — | 暗键（无读法） |
| `EPIRUS_DIV_W` | — | promote-champion train-3p | 暗键（无读法） |
| `EPIRUS_DRAIN_PUSH` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_ECO_CAP` | — | — | 暗键（无读法） |
| `EPIRUS_ECO_DIVW` | — | — | 暗键（无读法） |
| `EPIRUS_ECO_TARGET` | — | — | 暗键（无读法） |
| `EPIRUS_FEASIBILITY` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_FEASIBILITY_BLOCK` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_FEAS_GAMES` | — | promote-champion train-3p | 仅动态提及（不删） |
| `EPIRUS_FEAT_MASK` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_FIT_CAL` | — | — | 暗键（无读法） |
| `EPIRUS_FIT_CHAMP` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_FIT_CHAMP_EVERY` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_FIT_G_FLOOR` | — | — | 暗键（无读法） |
| `EPIRUS_FIT_G_W` | — | — | 暗键（无读法） |
| `EPIRUS_FIT_TAIL_Q` | — | — | 暗键（无读法） |
| `EPIRUS_FIT_TAIL_W` | — | — | 仅动态提及（不删） |
| `EPIRUS_GA_BAND` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_GA_GATE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_GA_GATE_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_GUARD_GAMES` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_GUARD_SEEDS` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_HALL_DEDUP` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_HALL_TRACE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_HALL_TRACE_OUT` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_HOARD_CAP_MULT` | — | — | 暗键（无读法） |
| `EPIRUS_HOARD_LEFTOVER` | — | — | 仅动态提及（不删） |
| `EPIRUS_HOLDOUT_SEG` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_HOLO2PROTO` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_HOTSTART` | `training/train-3p.mjs` `champion-map/audit-parent-evidence.mjs` `champion-map/lineage.mjs` +1 | train-3p | 在用（读法 4 处） |
| `EPIRUS_HPSEED` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_IMIT_FRAC` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_IMIT_GENS` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_IMIT_ONLY` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_IMIT_OVERRIDE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_IMIT_PLAN` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_IMIT_SUBONLY` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_IMIT_SUB_ONLY` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_IMIT_TEACHER` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_INIT_ACT_K` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_INIT_SCALE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_INSTR` | — | — | 暗键（无读法） |
| `EPIRUS_JSON` | — | promote-champion train-3p | 仅动态提及（不删） |
| `EPIRUS_KILL_FIELD` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_KILL_REWARD` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_KR_TRANSFER` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_LASER_W` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_LOG_DEFAULT_OUT` | `tools/gates/_ctx.mjs` `training/train-3p.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_MIX2_EVERY` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_MIX8` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_MIXHP_EVERY` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_MUT_MODE` | `tools/probe-cem-arm.mjs` `training/train-3p.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_NORM` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_NO_DEFQ` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_NO_GUARD` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_NO_PROXY` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_NO_SHAPE` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_OPP_N` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_PACK_OPP` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_PAIRED` | `tools/probe-cem-arm.mjs` `training/train-3p.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_PASSIVE_FIELD` | — | — | 仅动态提及（不删） |
| `EPIRUS_POOL_OPPS` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_POOL_OPPS_TABLE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_POOL_OPPS_TIER` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_PROXY_GAMES` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_PUBLISH` | `training/train-3p.mjs` `champion-map/opphuman-arms.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_REGEN_GENS` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_REGEN_SLICE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_REPO` | `tools/probe-g4-anatomy.mjs` `tools/probe-ring-ablate.mjs` | — | 在用（读法 2 处） |
| `EPIRUS_RING_FORCE_EPS` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_RING_FORCE_UNTIL` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_RING_W` | — | — | 仅动态提及（不删） |
| `EPIRUS_S4_GAMES` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_S4_W` | — | — | 暗键（无读法） |
| `EPIRUS_SEAT_GAMES` | — | promote-champion train-3p | 仅动态提及（不删） |
| `EPIRUS_SEED` | `tools/diag.mjs` `tools/promote-champion2p.mjs` `training/train-3p.mjs` | train-3p | 在用（读法 3 处） |
| `EPIRUS_SEED0` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_SEEDPACK` | `tools/dedupe-artifacts.mjs` `training/train-3p.mjs` `training/train.mjs` +3 | train-3p train | 在用（读法 6 处） |
| `EPIRUS_SEL_BIGT` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_BIGT_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_BIGT_KEYS` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_BIGT_MODE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_CARDS` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_CARDS_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_CLEAR` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_CLEAR_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_COUNTER` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_DEFQ` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_DEFQ_EPS` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_DEFQ_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_DEFQ_MINHANDS` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_DEFQ_MINSHARE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_DEFQ_MODE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_EVAL_SEEDS` | `tools/gates/_ctx.mjs` `training/train-3p.mjs` | train-3p | 在用（读法 2 处） |
| `EPIRUS_SEL_GIFT_VETO` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_GIFT_VETO_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_LAND` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_LAND_GAMES` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_LAND_TOL` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_POOL` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEL_TWO_STAGE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEQ_KIND` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SEQ_W` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SHAPE_GAMES` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_SIGMA_DECAY` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SIGMA_FLOOR` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SIGMA_STALL` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SNIPER_GAMES` | `tools/promote-champion.mjs` | promote-champion train-3p | 在用（读法 1 处） |
| `EPIRUS_STALL_ABORT` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_STOCK_BONUS` | — | — | 暗键（无读法） |
| `EPIRUS_STYLE_GAMES` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_STYLE_W` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_SUBSIDY_EP` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_SUBSIDY_H` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_SUBSIDY_MIN` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_SUB_BEAD` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_SUB_BEAD_KIND` | — | — | 仅动态提及（不删） |
| `EPIRUS_SUPPORT_PRIOR` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_T3P_BASELINE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_T3P_OUT` | `training/train-3p.mjs` | train-3p train | 在用（读法 1 处） |
| `EPIRUS_TB3P` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_TB3P_GAMES` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_TB_OUT` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_TGT_W` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_TRAIN_EPS` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_TRAIN_EPS_K` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_TRAIN_EPS_MODE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_TRAIN_MODE` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_TRAIN_SEAT_GAMES` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_TRAIN_TEMP` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_TRIPLET` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_TRIPLET_LOG` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_VOID_IDEAL_W` | — | — | 暗键（无读法） |
| `EPIRUS_VOID_W` | — | — | 暗键（无读法） |
| `EPIRUS_WALL_FILTER` | — | — | 暗键（无读法） |
| `EPIRUS_WALL_GAMES` | — | — | 暗键（无读法） |
| `EPIRUS_WALL_MS` | `training/server/wall-cap.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_WIDTH_W` | — | — | 仅动态提及（不删） |
| `EPIRUS_WORKERS` | — | train-3p | 仅动态提及（不删） |
| `EPIRUS_WR_TOL` | `tools/gates/meta-repo.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_XN2G` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_XN2REF` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |
| `EPIRUS_XN2W` | `training/train-3p.mjs` | train-3p | 在用（读法 1 处） |

## 仅动态提及（**不是删除候选**：读法长成 `env[变量]`，扫不出具体键）

- `EPIRUS_AGGR_GAMES`
- `EPIRUS_ALLOW_DARK`
- `EPIRUS_ALLOW_HEALTH_FAIL`
- `EPIRUS_BEAD_W`
- `EPIRUS_BIGT_PUSH`
- `EPIRUS_BLOCK_W`
- `EPIRUS_CHARGE_MIN_EP`
- `EPIRUS_CONV_RATIO`
- `EPIRUS_CURSE_PUSH`
- `EPIRUS_DENSITY_GAMES`
- `EPIRUS_DIV_FORCE_GENS`
- `EPIRUS_DRAIN_PUSH`
- `EPIRUS_FEASIBILITY`
- `EPIRUS_FEASIBILITY_BLOCK`
- `EPIRUS_FEAS_GAMES`
- `EPIRUS_FEAT_MASK`
- `EPIRUS_FIT_TAIL_W`
- `EPIRUS_HOARD_LEFTOVER`
- `EPIRUS_HPSEED`
- `EPIRUS_IMIT_GENS`
- `EPIRUS_IMIT_PLAN`
- `EPIRUS_IMIT_SUBONLY`
- `EPIRUS_IMIT_SUB_ONLY`
- `EPIRUS_IMIT_TEACHER`
- `EPIRUS_INIT_ACT_K`
- `EPIRUS_JSON`
- `EPIRUS_KILL_FIELD`
- `EPIRUS_MIX2_EVERY`
- `EPIRUS_MIX8`
- `EPIRUS_OPP_N`
- `EPIRUS_PASSIVE_FIELD`
- `EPIRUS_REGEN_GENS`
- `EPIRUS_RING_FORCE_EPS`
- `EPIRUS_RING_FORCE_UNTIL`
- `EPIRUS_RING_W`
- `EPIRUS_S4_GAMES`
- `EPIRUS_SEAT_GAMES`
- `EPIRUS_SEED0`
- `EPIRUS_STYLE_GAMES`
- `EPIRUS_STYLE_W`
- `EPIRUS_SUBSIDY_EP`
- `EPIRUS_SUBSIDY_H`
- `EPIRUS_SUBSIDY_MIN`
- `EPIRUS_SUB_BEAD_KIND`
- `EPIRUS_TB3P`
- `EPIRUS_TB3P_GAMES`
- `EPIRUS_TB_OUT`
- `EPIRUS_TGT_W`
- `EPIRUS_TRAIN_SEAT_GAMES`
- `EPIRUS_WIDTH_W`
- `EPIRUS_WORKERS`

## 暗键（删除候选：维护面里没有任何 `env.X` / `env['X']` 读法）

- `EPIRUS_BEAD_BOOM_W`
- `EPIRUS_BEAD_SEED`
- `EPIRUS_BEAD_SEED_KIND`
- `EPIRUS_BIGCARD_W`
- `EPIRUS_BIGT_CHAIN_W`
- `EPIRUS_CONV_OFFENSE`
- `EPIRUS_COSTLY_W`
- `EPIRUS_DIV_CATW`
- `EPIRUS_DIV_K`
- `EPIRUS_DIV_ROLEW`
- `EPIRUS_DIV_W`
- `EPIRUS_ECO_CAP`
- `EPIRUS_ECO_DIVW`
- `EPIRUS_ECO_TARGET`
- `EPIRUS_FIT_CAL`
- `EPIRUS_FIT_G_FLOOR`
- `EPIRUS_FIT_G_W`
- `EPIRUS_FIT_TAIL_Q`
- `EPIRUS_HOARD_CAP_MULT`
- `EPIRUS_INSTR`
- `EPIRUS_S4_W`
- `EPIRUS_STOCK_BONUS`
- `EPIRUS_VOID_IDEAL_W`
- `EPIRUS_VOID_W`
- `EPIRUS_WALL_FILTER`
- `EPIRUS_WALL_GAMES`

