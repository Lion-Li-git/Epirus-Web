#!/usr/bin/env bash
# 夜班 B 段：c11 带闸重掷 → N4 ε 长程扫 → N5 老包普查 → B4 终验
# 断点续跑：docs/artifacts/.b1..done 标记
set -u
cd "$(git rev-parse --show-toplevel)"
ART=docs/artifacts
M() { touch "$ART/.$1.done"; echo "[mark] $1 $(date +%H:%M)"; }
S() { grep -q "ALL-B-DONE" /tmp/b-report.log 2>/dev/null; }

# ---- B1：seed 11 带 vetoDegenerate 重掷（看继承者是谁） ----
if [ ! -f "$ART/.b1.done" ]; then
  node -e "const fs=require('fs');const s=fs.readFileSync('docs/artifacts/v7tgt-44.bak','utf8');const m=/window\\.EPIRUS_CHAMPION_3P\\s*=\\s*(\\{[\\s\\S]*\\});/.exec(s);fs.writeFileSync('js/bundled-champion.js','window.EPIRUS_CHAMPION = '+m[1]+';\n');"
  EPIRUS_ARM=v7xfer44c11b EPIRUS_SEED=11 node tools/train-best.mjs 3 500 > /tmp/b1-c11b.log 2>&1
  rc=$?
  [ $rc -eq 0 ] && cp js/bundled-champion.js "$ART/v7xfer44c11b-2p.bak"
  git checkout -- js/bundled-champion.js index.html 2>/dev/null
  grep -E "退化闸|选中" /tmp/b1-c11b.log | tail -4
  M b1
fi

# ---- B2：N4 ε 长程口径扫描（现役 3P 包；只报告） ----
if [ ! -f "$ART/.b2.done" ]; then
  node tools/behavior-profile.mjs --champion=js/bundled-champion-3p.js --field=self --gamemode=long \
    --eps=0,0.1,0.15,0.2,0.25 --epsmode=soft --games=20 > /tmp/b2-eps-long.log 2>&1
  node tools/behavior-profile.mjs --champion=js/bundled-champion-3p.js \
    --eps=0.1,0.15,0.2 --epsmode=soft --games=40 --mirror=40 > /tmp/b2-eps-mixed.log 2>&1
  echo "[b2] $(date +%H:%M)"; tail -20 /tmp/b2-eps-long.log >> /tmp/b-report.log; M b2
fi

# ---- B3：N5 老包 × 2P 移植普查 ----
if [ ! -f "$ART/.b3.done" ]; then
  node docs/debug/night-probe-2p-transfer.mjs \
    docs/artifacts/v7seat24-31.bak docs/artifacts/v7seat24b-31.bak \
    docs/artifacts/v7bead25-31.bak docs/artifacts/v7bead3-31.bak docs/artifacts/v7bead3-82.bak docs/artifacts/v7bead3-93.bak \
    docs/artifacts/v7t2-31.bak docs/artifacts/v7t2-82.bak \
    docs/artifacts/v7tgt-44.bak docs/artifacts/v7tgt2-31.bak docs/artifacts/v7tgt2-52.bak docs/artifacts/v7tgt3-31.bak \
    docs/artifacts/v7tgt4-62.bak docs/artifacts/v7tgt4-63.bak docs/artifacts/v7tgt4-64.bak docs/artifacts/v7tgt4-66.bak \
    docs/artifacts/v7tgt5-31.bak docs/artifacts/v7tgt5-62.bak docs/artifacts/v7tgt5-64.bak \
    docs/artifacts/v7new6-31.bak docs/artifacts/v7f5b-31.bak docs/artifacts/v7press3-31.bak docs/artifacts/v7u1-82.bak \
    > /tmp/b3-survey.log 2>&1
  M b3
fi

# ---- B4：D82 注入新产物 + 终验（np-test / spec×5 / smoke / battle） ----
node -e "
const fs=require('fs');
const names=fs.readdirSync('docs/artifacts').filter(f=>/^v7xfer44/.test(f)&&f.endsWith('.bak')).map(f=>f.replace(/\.bak$/,''));
let cl=fs.readFileSync('CHANGELOG.md','utf8');
const i=cl.indexOf('- 夜班修（spec 定值化）');
if(i>=0 && cl.indexOf('B1 重掷')<0){
  fs.writeFileSync('CHANGELOG.md', cl.slice(0,i)+'- B1 重掷/B2-B3 夜产物点名：'+names.join('、')+'。\n'+cl.slice(i));
  console.log('注入完成',names.length);
}"
node tools/np-test.mjs > /tmp/b4-nptest.log 2>&1; echo "b4-np exit=$? $(grep 通过 /tmp/b4-nptest.log | tail -1)"
for i in 1 2 3 4 5; do node tools/spec-run.mjs | tail -1; done
node tools/smoke.mjs > /tmp/b4-smoke.log 2>&1; echo "b4-smoke exit=$?"
node tools/battle-test.mjs > /tmp/b4-battle.log 2>&1; echo "b4-battle exit=$?"
echo "ALL-B-DONE $(date +%H:%M)" >> /tmp/b-report.log
echo "ALL-B-DONE"
