/* obs5 随机种子包（KD 桥的 UP；布局=arch2.make 的 He-ish 定标） */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { writeFileSync } from 'node:fs';
const W = sandbox();
installArch2(W, { input: 'obs5', gen: 3, keySplit: 1, skills: W.EpirusRules.skills.length, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
const P = W.EpirusPolicy, T = W.EpirusTrainer;
const params = P.makePolicy(0.25);   /* ⚠ 签名只有 scale——第一版把 rng 当 scale 传，权重 NaN→JSON null→读回全零（11-10 事故） */
const packed = P.pack(params, W);
writeFileSync('scratch/obs4/KDO5-seed.bak', '/* Epirus 多人冠军（obs5 随机种子，KD 桥 UP） */\nwindow.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n');
console.log('参数 ' + params.length + ' ‖ dims=' + JSON.stringify(packed.dims));
