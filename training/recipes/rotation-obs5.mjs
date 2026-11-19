/* 命名配方：2.0 (obs6) 统一训练管线标准配方
 *
 * 原 obs5 / train-3p 的 EPIRUS_* env 配方已随 2026-11-19 v7 训练线退役；
 * 本文件改为导出 2.0 统一管线（pg-train / supfit-gd）的 CLI 旗标标准配方。
 */
export const RECIPES = {
  pg_shape: {
    mode: 'pg',
    up: 'docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak',
    games: 6000,
    batch: 48,
    lr: 3e-4,
    segEvery: 1500,
    klW: 0.05,
    klTilt: 'tank,miniT,jinshield,taunt,rod,firestorm',
    klTiltMul: 3,
    shapeKey: 'tank:0.25,miniT:0.15',
  },
  supfit_dual: {
    mode: 'supfit',
    upstream: 'docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak',
    teacher: 'toolkit',
    teacher2: '',
    teacher2frac: 0.5,
    objective: 'cand',
    dagger: 1,
    lr: 4e-4,
    steps: 180,
    groups: 3300,
    shapeBal: 1,
    classPow: 0.35,
  },
};

