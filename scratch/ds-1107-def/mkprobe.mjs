
import { readFileSync, writeFileSync } from 'node:fs';
let s = readFileSync('champion-map/index.html', 'utf8');
const probe = '<' + 'script>setTimeout(function(){try{var L=DATA.filter(function(d){return d.lin;}).map(function(d){return d.id+\":\"+d.lin+\":\"+(d.pt||\"-\")});document.title=\"LIN[\"+L.length+\"]\"+L.join(\"|\");}catch(e){document.title=\"ERR \"+e.message;}},800);<' + '/script>';
s = s.replace('</body>', probe + '</body>');
writeFileSync('scratch/ds-1107-def/probe.html', s);
console.log('written');
