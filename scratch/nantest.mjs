console.log('!NaN =', !NaN);
const f = new Float64Array(1); f[0] = NaN;
console.log('!f[0] =', !f[0], '‖ Boolean(NaN) =', Boolean(NaN));
