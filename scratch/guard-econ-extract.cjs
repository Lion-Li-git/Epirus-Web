/* guard-econ-extract.mjs — 把 cf-arms-*.log 汇成"一手 0 费防御的账"表（qoder 11-02 午后）
 * ⚠ 键必须带剂量后缀：早前一版把 ` 剂量 1/1` 剥掉，四个剂量共用一个键 ⇒ 1/8 覆盖了 1/1，读数错了整列。 */
const fs = require('fs');
const packs = { 'DDA-150-ctrl-s13': '150代对照', 'DD-C-s13': '400代对照', 'bundled-champion-3p': '在售 v7', 'GD3-SWORD': '起点包' };
const cells = ['native(满血=3)', 'def@满血 剂量 1/1', 'def@HP-1 剂量 1/1', 'def@HP-1∧刚挨打', 'drain@≤1 剂量 1/1'];
const rows = {};
for (const f of fs.readdirSync('scratch').filter((x) => /^cf-arms-/.test(x))) {
  const key = f.replace('cf-arms-', '').replace('.log', '');
  for (const l of fs.readFileSync('scratch/' + f, 'utf8').split('\n')) {
    if (!l.includes(' | ')) continue;
    const c = l.split(' | ');
    if (c.length < 14) continue;
    (rows[key] = rows[key] || {})[c[0] + '|' + c[1].trim()] = c.map((x) => x.trim());
  }
}
const num = (s) => parseFloat(s);
const grab = (s, re) => { const m = s.match(re); return m ? m[1] : '—'; };
console.log('| 包 | 世界 | 档 | 夺1% | Δ夺1 | 回合 | 挡下/局 | 免伤/局 | 我造伤/局 | 累计挨打/局 | 其中无来源 | 终局活人 | 终局存活% |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const p of Object.keys(packs)) {
  const k = p + '-n3';
  for (const w of ['arms', 'armsaggro', 'strat', 'onlygun']) {
    const nat = (rows[k] || {})[w + '|native(满血=3)'];
    if (!nat) continue;
    const bWin = num(nat[2]);
    for (const cd of cells) {
      const x = (rows[k] || {})[w + '|' + cd];
      if (!x) continue;
      const win = num(x[2]);
      const name = cd === 'native(满血=3)' ? 'native' : cd.replace(' 剂量 1/1', '');
      console.log('| ' + packs[p] + ' | ' + w + ' | ' + name + ' | ' + x[2] + ' | ' +
        (cd.indexOf('native') === 0 ? '—' : (win - bWin >= 0 ? '+' : '') + (win - bWin).toFixed(1)) + ' | ' + x[3] + ' | ' +
        x[8] + ' | ' + x[9] + ' | ' + x[10] + ' | ' + grab(x[12], /^取([0-9.]+)/) + ' | ' +
        grab(x[12], /无来源 (\S+?)）/) + ' | ' + grab(x[12], /活([0-9.]+)/) + ' | ' + x[11] + ' |');
    }
  }
}
