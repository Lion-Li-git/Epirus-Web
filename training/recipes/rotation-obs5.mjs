/* 命名配方：rotation-obs5 —— obs5 轮换产线的基线配方（11-11 夜自 msbatch2 内联迁出，逐字同值）
 *
 * 消费者：scratch/night-adapt2/msbatch2.mjs（--recipe=rotation-obs5，缺省即本配方）。
 * 形状：桌形混合（MIX2/MIX8/MIXHP）+ 收割席 + 课程席（每代 1 席 pickFarmer，可被 MSB_COURSE_PACK 覆盖成真实包）
 *   + 反制对手桌 + triplet 台账 + 臂级中途节点（HOLDOUT_SEG=50，MSB_SEG 可覆盖）。
 * MSB_* 运行时覆盖（COURSE_PACK/FIT_CHAMP/FIT_EVERY/SEG）留在驱动器里——它们是"这次跑什么"不是"配方是什么"。
 *
 * ⚠ 改这份 = 改所有 --recipe=rotation-obs5 的臂的配方 ⇒ 改完必须重开 base（种子流语义变了就不是同一条实验线）。
 */
export const RECIPE_ENV = {
  EPIRUS_ARCH2: 'S1ob:input=obs5,gen=3,keySplit=1,seatH=24,actH=24,hid=32,hid2=24',
  EPIRUS_MUT_MODE: 'seg',
  EPIRUS_TRAIN_MODE: 'long',
  EPIRUS_KILL_REWARD: '2', EPIRUS_KILL_FIELD: '1',
  EPIRUS_MIX8: '4', EPIRUS_MIX2_EVERY: '4', EPIRUS_MIXHP_EVERY: '2',
  EPIRUS_COURSE_EVERY: '1', EPIRUS_COURSE_BOT: 'pickFarmer',
  EPIRUS_COUNTER_OPPS: 'gunFocus,gunSpam,guardSpam,targeter',
  EPIRUS_SEL_COUNTER: '1',
  EPIRUS_TRIPLET: '1',
  EPIRUS_HOLDOUT_SEG: '50',
};
