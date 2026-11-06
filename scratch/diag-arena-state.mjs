/* 诊断：arena2 的「同一行连评两次读数会变」状态在哪儿 —— 每 arena 一份，还是模块级？
 * 做法：同一进程建两个 arena（各 11 桌形 × 40 局），v7 各评一次；再在同一个 arena 上连评两次。 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const W = sandbox();
W.EpirusTrainer.setBigTPush(12);
const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
const refParams = Float64Array.from(ref);
const show = (tag, r) => console.log(tag, 'raw', (100 * r.first).toFixed(1), 'net', r.score.toFixed(3), 'cleanNet', r.cleanScore.toFixed(3), 'nonji', r.maxCard && r.maxCard.nonji);

const A1 = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const A2 = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
show('A1#1', A1.evalParams(refParams, { phase: 'holdout', gamesPerShape: 40, temp: 0.15 }));
show('A1#2', A1.evalParams(refParams, { phase: 'holdout', gamesPerShape: 40, temp: 0.15 }));
show('A2#1', A2.evalParams(refParams, { phase: 'holdout', gamesPerShape: 40, temp: 0.15 }));
