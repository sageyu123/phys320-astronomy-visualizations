const assert=require('node:assert/strict');
const model=require('../html/nice_migration_model.js');
const start=performance.now(), sim=model.create({seed:1});
while(sim.frontier<60)sim.step(1000);
const elapsed=(performance.now()-start)/1000;
console.log('Myr      Jupiter     Saturn     Uranus    Neptune');
for(const t of [1,5,10,30,60])console.log(String(t).padEnd(8)+sim.planets(t).map(a=>a.toFixed(4).padStart(11)).join(''));
let l=sim.ledger(60), c=sim.counters(60), timing=sim.timing();
console.log('Ledger:',l);console.log('Neptune returns:',c.sent,c.returned,c.sentOort,c.sentOut);console.log('Inward fates:',c.everIn,c.inJ,c.inOther,c.inTransit);console.log('Batch ms mean/max:',timing.mean,timing.max,'record bytes:',sim.recordBytes(),'stories:',sim.stories().length,'run seconds:',elapsed);
assert.ok(sim.planets(30)[3]>=24);assert.ok(sim.planets(60)[0]-5.45<=-.15);assert.ok(sim.planets(60)[1]>8.18&&sim.planets(60)[2]>11.5);assert.ok(Math.abs(l.sum/l.planets[0])<1e-9);assert.ok(sim.recordBytes()<20e6);assert.ok(sim.stories().length);assert.ok(elapsed<15);
const again=model.create({seed:1});while(again.frontier<60)again.step(1000);assert.deepEqual(again.planets(60),sim.planets(60));assert.deepEqual(again.counters(60),sim.counters(60));assert.deepEqual(again.snapshot(60).stage,sim.snapshot(60).stage);
const chunk=sim.chunk(0,0);assert.equal(chunk.history.length,6001*9);assert.equal(chunk.data.length,601*1500*3);assert.equal(chunk.counters.length,601*25);assert.equal(sim.lifeStory(400),null);assert.ok(sim.lifeStory(0).end.kind);
console.log('Full-run determinism and transferable record shapes: passed');
const vm=require('node:vm'), fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../html/nice_migration_model.js'),'utf8');
const factorySource=source.slice(source.indexOf('function NiceMigrationModelFactory()'),source.indexOf('\nconst NiceMigrationModel='));
let messages=[], transfers=[];const fakeSelf={postMessage(message,buffers){messages.push(message);transfers.push(buffers)}};
vm.runInNewContext(factorySource+';NiceMigrationModelFactory().installWorker()', {self:fakeSelf,performance,setTimeout:fn=>fn()});
fakeSelf.onmessage({data:{type:'start',params:{tEnd:.1}}});
assert.equal(messages.at(-1).type,'done');assert.equal(messages[0].type,'progress');assert.equal(transfers[0].length,6);assert.equal(messages.at(-2).frontier,.1);
console.log('Blob factory worker protocol: passed');

for(let n=0;n<=600;n++){const sn=sim.snapshot(n/10);assert.ok(sn.direction instanceof Uint8Array);assert.equal(sn.direction.length,1500);for(const d of sn.direction)assert.ok(d<=2)}
assert.deepEqual(again.snapshot(60).direction,sim.snapshot(60).direction);assert.equal(chunk.direction.length,601*1500);
let dirChecked=0,dirMerged=0;for(let sid=0;sid<400;sid++){const story=sim.lifeStory(sid);for(let n=1;n<=600;n++){const steps=story.steps.filter(z=>z.t>(n-1)/10+1e-9&&z.t<=n/10+1e-9);if(!steps.length)continue;const z=steps.at(-1),same=steps.filter(y=>Math.abs(y.t-z.t)<1e-9);if(same.length>1)dirMerged++;const bb=z.batchBefore,net=!Number.isFinite(z.after)?1:z.after>bb?1:z.after<bb?2:0;if(!net)continue;const sn=sim.snapshot(n/10),d=sn.direction[story.id];if(Number.isFinite(z.after)&&Math.abs(sn.data[3*story.id]-z.after)>1e-4*z.after)continue;assert.equal(d,net,`direction story ${story.id} at ${n/10}`);dirChecked++}}
assert.ok(dirChecked>50);console.log('direction steps checked (net over most recent batch):',dirChecked,'of which several steps in one batch:',dirMerged);
console.log('Snapshot kick directions: passed');
