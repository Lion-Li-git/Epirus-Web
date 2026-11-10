#!/usr/bin/env node
/* 一次性补丁：主 README 跟上训练侧子仓（11-11 用户令"重构完去主 readme 的目录里也改一下"）。 */
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'README.md';
let s = readFileSync(f, 'utf8');
function rep(from, to, quiet) {
  const n = s.split(from).length - 1;
  if (!n) { if (!quiet) console.error('⛔ 没命中: ' + from.slice(0, 60)); return false; }
  s = s.split(from).join(to);
  console.log(n + ' × ' + from.slice(0, 58));
  return true;
}

/* 简单路径替换 */
rep('`docs/` `tools/` `server/` 不发布', '`docs/` `tools/` `training/` 不发布');
rep('双击 `tools/start-train-server.cmd` 启动训练服务', '双击 `training/start-train-server.cmd` 启动训练服务');
rep('多人侧 `server/opp-pool.mjs` 的 `OPP_SPECS`', '多人侧 `training/server/opp-pool.mjs` 的 `OPP_SPECS`');
rep('node tools/train-selftest.mjs                # 训练侧三条凭据', 'node training/train-selftest.mjs             # 训练侧三条凭据');
rep('node tools/train-fast.mjs 500', 'node training/train-fast.mjs 500');
rep('node tools/train-best.mjs 4 600', 'node training/train-best.mjs 4 600');
rep('node tools/train-3p.mjs 60 5 24 24', 'node training/train-3p.mjs 60 5 24 24');
rep('node tools/train-3p.mjs 200 5 24 8', 'node training/train-3p.mjs 200 5 24 8');
rep('训练侧 `tools/proto2/arch2.mjs` 同源；`tools/proto2/browser-parity.mjs`', '训练侧 `training/proto2/arch2.mjs` 同源；`training/proto2/browser-parity.mjs`');

/* 目录结构：server/ 块 → training/ 块 */
const SRV = `├─ server/                       可选训练服务（Node，内置 http / worker_threads / vm）
│   ├─ train-server.mjs            SSE 实时进度：/train /champion /reset
│   ├─ paralleltrain.mjs           worker_threads 多核并行评估池
│   ├─ train-worker.mjs            单 worker 评估入口
│   └─ opp-pool.mjs / opp-champs.mjs   对手池 + 「名字→包」唯一入口
`;
const TRN = `├─ training/                     ★ 训练侧独立子仓（2026-11-11 起：入口/服务/旋钮册都住这里；产品侧零依赖，详见 training/README.md）
│   ├─ knobs.mjs                   ★ 旋钮单一真源生成器（--check 供 CI 防腐烂；册 = TRAINING-KNOBS.md 唯一配置真源）
│   ├─ train-3p.mjs                ★ 2.0 GA 训练入口（多人臂，obs5 产线主力）‖ train-best/fast = 2 人 v7 旧线 ‖ train-selftest.mjs = 训练侧自检
│   ├─ start-train-server.cmd      双击启动训练服务（训练场 tab 连它）
│   ├─ server/                     训练服务 + 旋钮单一来源（原 server/ 整体迁入）
│   │   ├─ train-server.mjs          SSE 实时进度：/train /champion /reset
│   │   ├─ paralleltrain.mjs         worker_threads 多核并行评估池（EPIRUS_WORKERS）
│   │   ├─ train-worker.mjs          单 worker 评估入口
│   │   ├─ opp-pool.mjs / opp-champs.mjs   对手池 + 「名字→包」唯一入口（考卷也吃它）
│   │   └─ knob-guard.mjs / econ-env / fight-env / train-env   旋钮闸 + 奖励旋钮三份单一来源表
│   ├─ proto2/                     2.0 研究栈（arch2=网络孪生 / pg-lib=重放反传 / supfit-full=蒸馏 / selftest3）
│   └─ recipes/                    命名配方（规划中：替代手抄 env 启动器）
`;
rep(SRV, TRN);

/* tools/ 清单里抽掉训练入口三行 + selftest + cmd */
rep(`│   ├─ train-3p.mjs / train-best.mjs / train-fast.mjs   训练入口（多人 / 2 人多种子择优 / 快速）
`, '');
rep(`│   ├─ train-selftest.mjs          训练侧自检（回执往返 / 出厂默认清单 / econ 往返）
`, '');
rep(`│   └─ start-train-server.cmd      双击启动训练服务
`, '│   └─ eval-5p.mjs 已在上面；训练侧入口全部在 training/（见上）\n');

/* js/train/evo.js 行补混合体说明 */
rep('│   ├─ evo.js                  对抗进化 + 冠军出牌口径（policyChooserN / pickChampion）',
    '│   ├─ evo.js                  对抗进化 + 冠军出牌口径（policyChooserN / pickChampion）‖ 混合体：产品 AI 面（浏览器 bundle）+ 训练引擎核（Node 沙箱按文本装载同一份）');

/* 主尺段补 11-11 重测注 */
rep('- **B 轴**：冠军桌混合夹具 `KDG-B + FOCUS + Q-s47`（2.0 主力两枚 + 反墙锚），衡量“对会还手的冠军”；',
    '- **B 轴**：冠军桌混合夹具 `KDG-B + FOCUS + Q-s47`（2.0 主力两枚 + 反墙锚），衡量“对会还手的冠军”。⚠ 11-11 代表重测（`scratch/zcode-1111-bretest/`）：夹具新旧是双向扭曲——obs5 冠军链在冠军桌真实负（MSB2-R1 −0.271/−0.089），A 轴选拔 ≠ 冠军桌强度；夹具滚动与 champ 戳入表的调整见交接文档。');

writeFileSync(f, s);
console.log('README 更新完成');
