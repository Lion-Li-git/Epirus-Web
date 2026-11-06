console.log('typeof NaN =', typeof NaN, '‖ isNaN =', Number.isNaN(NaN), '‖ NaN===NaN =', NaN === NaN);
console.log('NaN ? "t" : "f" =', NaN ? 't' : 'f');
console.log('0/0 =', 0/0, '‖ Math.sqrt(-1) =', Math.sqrt(-1));
console.log('v8 =', process.versions.v8, '‖ node =', process.version);
const x = NaN; let c = 0; if (x) c = 1; console.log('if(NaN) 走了吗 c =', c);
