const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=import('data:text/javascript;base64,'+require('node:fs').readFileSync(require('node:path').join(__dirname,'../html/atmospheric_escape_model.js')).toString('base64')); 
test('weighted Boltzmann fit recovers equilibrium temperature', async()=>{const m=await M;const g=m.createGas({N:20000,A:32,T:300,init:'maxwell',seed:12});const f=m.boltzmannFit(g);assert.ok(f.points.length>=8);assert.ok(Math.abs(f.temperature/300-1)<.15)});
