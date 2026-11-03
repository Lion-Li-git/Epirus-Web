# eval-dd.ps1 — DD 六臂的考试（5P/8P + 防御/摄魂 + 白防 + 综合加权）
cd 'D:\code\Epirus-Web'
foreach ($p in @('W-s13','W-s41','W-s7','C-s13','C-s41','C-s7')) {
  node tools/eval-5p.mjs 12 5 77000 scratch/ga-arms/DD-$p.js --shipbigt=0 --shipdrain=0 *> scratch/dd-eval-$p-5p.log
  '5p ' + $p + ' rc=' + $LASTEXITCODE
  node tools/eval-5p.mjs 10 8 81000 scratch/ga-arms/DD-$p.js --shipbigt=0 --shipdrain=0 *> scratch/dd-eval-$p-8p.log
  '8p ' + $p + ' rc=' + $LASTEXITCODE
  node tools/proto2/def-drain-trace.mjs --pack=scratch/ga-arms/DD-$p.js --table=strat --games=20 *> scratch/dd-trace-$p.log
  node scratch/def-quality-gen3.mjs --pack=scratch/ga-arms/DD-$p.js --games=20 *> scratch/dd-quality-$p.log
  node tools/proto2/arena2.mjs --pack=scratch/ga-arms/DD-$p.js --strat=mild --gamesPerShape=40 --temps=0.05,0.1,0.15 --json=scratch/comp-DD-$p.json *> scratch/comp-DD-$p.log
  'eval ' + $p + ' done'
}
'all done'