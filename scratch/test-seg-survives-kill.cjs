/* 用户 11-03 提的那件事的验收尺：训练中途被停，**已经打过的深度快照必须还在盘上**。
 * 病（DS 的 CBG 三臂实测）：段快照只攒在内存、等 band-save 那段统一落盘 ⇒ 停在名人堂验证 = 全丢。
 * 这个夹具跑一小臂，看到 `=== 名人堂验证` 就把子进程杀掉，然后数 band 目录里剩下什么。
 * 期望：seg*.bak ≥ 快照数（当场落盘）‖ 而产物 .js 不存在（证明"确实没跑到写盘"，不是它跑完了）。 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { readdirSync, existsSync, mkdirSync, readFileSync } = fs;

const REPO = 'D:/code/Epirus-Web';
const DIR = process.env.TEMP + '/epi-segkill';
try { readdirSync(DIR).forEach((f) => { try { fs.unlinkSync(DIR + '/' + f); } catch (e) {} }); } catch (e) { mkdirSync(DIR, { recursive: true }); }
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const SEG_EVERY = 3;
const child = spawn(process.execPath, ['tools/train-3p.mjs', '12', '5', '2', '4'], {
  cwd: REPO,
  env: Object.assign({}, process.env, {
    EPIRUS_ARM: 'SEGKILL', EPIRUS_SEED: '13', EPIRUS_HOLDOUT_SEG: String(SEG_EVERY),
    EPIRUS_SEL_EVAL_SEEDS: '1', EPIRUS_SEL_TWO_STAGE: '0',
    EPIRUS_BAND_DIR: DIR, EPIRUS_T3P_OUT: DIR + '/SEGKILL.js',
  }),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let buf = '', killed = false, t0 = Date.now();
const timer = setTimeout(() => { console.log('⛔ 180s 没看到名人堂验证 ⇒ 本夹具没跑成（不是"通过"）'); try { child.kill('SIGKILL'); } catch (e) {} process.exit(4); }, 180000);

child.stdout.on('data', (d) => {
  const s = String(d); buf += s;
  const snaps = (buf.match(/\[holdout-seg\] \d+ 代快照/g) || []).length;
  if (/代快照/.test(s)) {
    const m = /(\d+) 代快照/.exec(s);
    console.log('  · 快照 ' + m[1] + ' 代（+' + ((Date.now() - t0) / 1000).toFixed(0) + 's）');
  }
  if (!killed && /名人堂验证/.test(s)) {
    killed = true;
    console.log('→ 看到「名人堂验证」⇒ 立刻杀进程（模拟 11-03 那次中止）');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) { console.log('kill 失败：' + e.message); } }, 300);
  }
});
child.stderr.on('data', (d) => { buf += String(d); });
child.on('exit', (code) => {
  clearTimeout(timer);
  const files = existsSync(DIR) ? readdirSync(DIR) : [];
  const segs = files.filter((f) => /-seg\d+\.bak$/.test(f)).sort();
  const snaps = (buf.match(/\[holdout-seg\] \d+ 代快照/g) || []).length;
  console.log('\n退出码=' + code + ' ‖ 内存里打了 ' + snaps + ' 个快照');
  console.log('目录内容：' + (files.length ? files.join(' ‖ ') : '（空）'));
  let bytesOk = 0, metaOk = 0;
  for (const f of segs) {
    const t = readFileSync(DIR + '/' + f, 'utf8');
    if (/window\.EPIRUS_CHAMPION_3P_META = \{/.test(t) && /"seg":\s*true/.test(t) && /"gen":\s*\d+/.test(t) && /"fit":/.test(t)) metaOk++;
    if (/EPIRUS_CHAMPION_3P = \{/.test(t) && t.length > 50000) bytesOk++;
  }
  console.log('两半都在的段（meta + 权重体）：' + metaOk + '/' + segs.length + ' ‖ 权重大小合格：' + bytesOk + '/' + segs.length);
  const packWritten = files.some((f) => f === 'SEGKILL.js');
  console.log('产物 .js 写过？' + (packWritten ? '**是**（那这次没测到"中途被停"，判读作废）' : '否（符合预期：确实停在写盘之前）'));
  const pass = killed && snaps > 0 && segs.length === snaps && metaOk === segs.length && !packWritten;
  console.log(pass ? '✅ 中断留得住节点：' + segs.length + ' 个深度快照全在盘上' : '⛔ 判否：见上面各行（要么没杀成、要么段数对不上）');
  process.exit(pass ? 0 : 1);
});
