#!/usr/bin/env node
/* 一次性补丁：SELF_ENV_KEYS 追加 68 条补登记（11-11 夜）。CRLF 保持。 */
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'tools/train-3p.mjs';
let s = readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const anchor = "  'EPIRUS_BEAD_WASTE_W'" + NL + "];";
if (!s.includes(anchor)) { console.error('⛔ 锚点没找到'); process.exit(1); }
const blk = [
  "  /* ===== 11-11 夜（ZCode）：补登记 sweep —— 在用未登记 68 条清零（清单 = 生成器 docs/TRAINING-KNOBS.md「在用未登记」节，",
  "   * 剔除 ECON/FIGHT/TRAIN 三份单一来源表已管的 37 条）。注解一律同行 //（收割按行取）；详注在读取点旁边。 ===== */",
  "  'EPIRUS_ALLOW_DARK',   // 闸放行旗（=1 放行「本入口读不到的键」）；用臂必须自己补回逐键回执证据（见上 ⚑ 块）",
  "  'EPIRUS_ALLOW_HEALTH_FAIL',   // 2P 服务：体检未过仍落盘（实验臂旗，默认关）",
  "  'EPIRUS_T3P_OUT', 'EPIRUS_T3P_BASELINE',   // 产物改道 / 基线持有者声明（写默认落点要显式认领，三选一纪律见 :2363）",
  "  'EPIRUS_TB_OUT', 'EPIRUS_TB3P', 'EPIRUS_TB3P_GAMES',   // train-best：产物改道 / 候选跑 3P 五道体检（默认 0=关）/ 其量具局数（缺省跟随 feasPlan）",
  "  'EPIRUS_LOG_DEFAULT_OUT',   // 没改道的臂另追加一行到该文件（点名默认落点用，§E654）",
  "  'EPIRUS_BUNDLE_IN', 'EPIRUS_BUNDLE_OUT',   // 2P 服务：热启动源 / 产物落点（隔离模式；线上包只由 promote 写）",
  "  'EPIRUS_IMIT_TEACHER', 'EPIRUS_IMIT_PLAN', 'EPIRUS_IMIT_FRAC', 'EPIRUS_IMIT_GENS',   // 示范族：教师名 / 分段计划名 / 退火窗口（占总代数比例）/ 绝对代数（服务端由 FRAC 折算）",
  "  'EPIRUS_IMIT_ONLY', 'EPIRUS_IMIT_OVERRIDE', 'EPIRUS_IMIT_SUBONLY', 'EPIRUS_IMIT_SUB_ONLY',   // 示范族：只示范单键 / 真示范覆盖 / 只示范子集（本入口拼写）/（服务端拼写）——两拼写并存是历史账",
  "  'EPIRUS_LASER_W', 'EPIRUS_TGT_W',   // 奖励权重：激光眼命中 / 威胁靶向（下达后回执不一致 ⇒ exit 7）",
  "  'EPIRUS_CURSE_PUSH', 'EPIRUS_SUPPORT_PRIOR',   // 部署档把手：贴贴高 ep 软注入 / 送盾先验 0|1|2（本入口 CLI 默认 2）",
  "  'EPIRUS_COURSE_PACK', 'EPIRUS_FIT_CHAMP', 'EPIRUS_FIT_CHAMP_EVERY',   // 11-10 DS：课程席放真实包 / fitness 掺冠军桌（包路径）/ 冠军席每 k 局一席（默认 4）",
  "  'EPIRUS_PACK_OPP',   // 2.0 臂：一枚包上训练桌当对手席（默认关；v7 模式拒收）",
  "  'EPIRUS_SIGMA_FLOOR', 'EPIRUS_SIGMA_DECAY', 'EPIRUS_SIGMA_STALL',   // GA σ 调度：下限（0.06）/ 衰减（0.995）/ 停滞回抬档（K 代没进步 ×1.25，默认 0=关）",
  "  'EPIRUS_TRAIN_EPS', 'EPIRUS_TRAIN_EPS_K', 'EPIRUS_TRAIN_EPS_MODE', 'EPIRUS_TRAIN_TEMP',   // 训练执行口径（E28）：ε / εK / 模式 / 温度——缺省=产品口径，显式给=显式实验",
  "  'EPIRUS_WR_TOL',   // 2P 服务：冠军换代的胜率容差（默认 0.03）",
  "  'EPIRUS_SEL_TWO_STAGE', 'EPIRUS_SEL_G45', 'EPIRUS_SEL_G4LONG',   // 选拔档：两段式（默认开，=0 关）/ G4/G5 最坏格否决（默认关）/ G4long 逐格否决（默认关）",
  "  'EPIRUS_FEAS_GAMES', 'EPIRUS_AGGR_GAMES', 'EPIRUS_SEAT_GAMES', 'EPIRUS_DENSITY_GAMES', 'EPIRUS_CHARGE_GAMES',   // 体检量具局数族（audit-lib.feasPlan 单一来源；默认=在册 FEAS_N_DEFAULTS）",
  "  'EPIRUS_FEASIBILITY', 'EPIRUS_FEASIBILITY_BLOCK',   // 2P 服务：落盘前可行性体检（=0 关）/ 体检不过阻断落盘（默认关）",
  "  'EPIRUS_OPP_N',   // 2P 服务：对手池名单覆盖（逗号名表，缺省 9 席；配对 A/B 用）",
  "  'EPIRUS_REGEN_GENS', 'EPIRUS_REGEN_SLICE',   // 补贴族：补贴总代数 / 补贴率下达（本入口）",
  "  'EPIRUS_RING_FORCE_EPS', 'EPIRUS_RING_FORCE_UNTIL',   // 聚能环强探档：ε / 截止代（默认 0=关）",
  "  'EPIRUS_S4_GAMES',   // 2P 服务：shapeScorer 量具局数（默认 8）",
  "  'EPIRUS_SEED0',   // 2P 服务：worker 播种根（服务端派生后下发）",
  "  'EPIRUS_TRAIN_SEAT_GAMES',   // 2P 服务：座位轮换局数（>0 才开 setSeatGames）",
  "  'EPIRUS_STYLE_TABLE', 'EPIRUS_STYLE_FRAC', 'EPIRUS_STYLE_W', 'EPIRUS_STYLE_GAMES',   // 风格课程：指定风格桌 / 风格席混入比例 / 风格奖励权重（服务端，默认 0.5）/ 其量具局数（默认 2）",
  "  'EPIRUS_SUBSIDY_H', 'EPIRUS_SUBSIDY_EP', 'EPIRUS_SUBSIDY_MIN',   // 2P 服务：补贴局形状（每 h 局 / 从 ep 起 / 低于 min 不补）",
  "  'EPIRUS_WALL_MS',   // 2P 服务：墙钟收敛（ms，=0 纯按代数；动它破坏同参可复现，慎重）",
  "  'EPIRUS_WORKERS',   // 2P 服务并行度：worker 数（缺省 cpus-1，上限 16）",
  "  'EPIRUS_CHARGE_MIN_EP',   // 蓄能门槛（worker 下达，缺省 2 = v1.5.82 裁定）",
  "  'EPIRUS_FEAT_MASK',   // worker：特征掩码（policy.setFeatMask，训练侧砍维用）",
  "  'EPIRUS_NORM',   // 2.0 臂：输入标准化 {mean[],std[]} JSON 路径（读不出/形状不对 ⇒ exit 7）",
  "  'EPIRUS_TRIPLET', 'EPIRUS_TRIPLET_LOG',   // 落盘后 triplet 读数（spawn exam4-triplet，JSON 上 stdout）/ 台账追加路径（设了才写）",
  "  'EPIRUS_ALIAS_TSV',   // 包别名表路径（pack-resolve 链读；门体 _ctx 有自己的缺省）",
  "  'EPIRUS_INIT_ACT_K'   // 2.0 起点初始化的动作头振幅（arch2 缺省 1）",
].join(NL);
s = s.replace(anchor, "  'EPIRUS_BEAD_WASTE_W'," + NL + blk + NL + "];");
writeFileSync(F, s);
console.log('补登记 68 条已插入');
