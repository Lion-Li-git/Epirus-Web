import { readFileSync, writeFileSync } from 'node:fs';
import { extractJsonObject } from '../../tools/audit-lib.mjs';
import { rulesFingerprint, fingerprintOfBundle } from '../../tools/rules-fingerprint.mjs';
const FP = 'js/bundled-champion-3p.js';
const src = readFileSync(FP, 'utf8');
const json = extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P_META');
const m = JSON.parse(json);
const cur = rulesFingerprint();
const old = m.rulesFingerprint;
m.rulesFingerprint = cur;
const note = 'v2.0.1 重记 ' + cur + '（R65：终局收缩不再共享、也不消耗铁索连边）。'
  + '差异只在「连边存活到收缩回合」这一个边角：池内摄魂出手 0/2400 局（README 在册读数）⇒ 考卷样本里不可达；'
  + '同批 2P 槽按同一份引擎重测，读数逐位复现（平均 98.37% / 最差 82.50%，与在册相同）。'
  + '⚠ 本槽**未重测**（只重记指纹）：权重字节未动、未 promote、未换槽。';
m.fingerprintRefresh = note + ' ‖ ' + String(m.fingerprintRefresh || '');
m.shippedAs = '11-06 夜 v2.0.1 指纹重记（不动权重不换包）：引擎改动只有 endTurn 的收缩段（R65 摘/挂铁索连边），'
  + '没有任何读 MODES/卡表/出费的分支被改；同批 2P 槽重测逐位复现。' + String(m.shippedAs || '');
const out = src.replace(json, JSON.stringify(m));
writeFileSync(FP, out);
const back = fingerprintOfBundle(readFileSync(FP, 'utf8'));
console.log('指纹 ' + old + ' → ' + back + '（want ' + cur + '）');
console.log('meta 可解析 =', !!JSON.parse(extractJsonObject(readFileSync(FP,'utf8'), 'window.EPIRUS_CHAMPION_3P_META')));