/* NiceMigrationModelFactory(): self-contained, usable as a Blob worker source.
 * create({diskMass=35,innerEdge=15.5,seed=1,tEnd=60}) returns step(ms),
 * planets(t), snapshot(t), counters(t), ledger(t), stories(), lifeStory(id), chunk(), and recordBytes().
 * Times are Myr, distances AU, angular momenta Earth orbital momenta.
 * step advances whole 0.01 Myr batches; snapshots/counters are at 0.1 Myr.
 * In a worker, call factory().installWorker(), then post {type:'start',params}.
 * Progress messages transfer history, data, stage, ejector and counters arrays.
 * history has nine Float64 values/batch (a[4], planet dL[4], body dL); data has three
 * Float32 values/body (a,e,omega); counters have 25 Float64 values/sample:
 * inward[5], outward[5], ejected[4], oort, impacts, sent, returned,
 * sentOort, sentOut, everIn, inJ, inOther, inTransit, bodyDL.
 */
function NiceMigrationModelFactory(){
 const GM=4*Math.PI*Math.PI, ME=3.003e-6, N=1500, starts=[5.45,8.18,11.5,14.2], masses=[9.546e-4,2.858e-4,4.366e-5,5.151e-5], root=Math.sqrt(GM);
 function create(params={}){
  const diskMass=params.diskMass??35, edge=params.innerEdge??15.5, end=params.tEnd??60, mb=diskMass/N, maxBatch=Math.round(end*100), maxSnap=Math.floor(maxBatch/10)+1;
  let seed=(params.seed??1)>>>0, batch=0, totalMs=0,maxMs=0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rand())))*Math.cos(2*Math.PI*rand());
  function poisson(x){if(x<=0)return 0;if(x>30)return Math.max(0,Math.round(x+Math.sqrt(x)*normal()));let lim=Math.exp(-x),k=0,p=1;do{k++;p*=rand()}while(p>lim);return k-1}
  const pa=starts.slice(), pl=starts.map((a,i)=>masses[i]/ME*Math.sqrt(a)), initialL=pl.slice(), bodies=[], history=new Float64Array((maxBatch+1)*9), snapshots=new Float32Array(maxSnap*N*3), stages=new Uint8Array(maxSnap*N), ejectors=new Int8Array(maxSnap*N), counts=[], steps=Array.from({length:400},()=>[]), inward=new Uint32Array(5),outward=new Uint32Array(5), ejected=new Uint32Array(4);
  let oort=0,impacts=0, bodyChange=0; const initBody=[];
  for(let i=0;i<4;i++)rand();
  for(let i=0;i<N;i++){let a=edge*Math.pow(34/edge,rand()),e=Math.min(.95,.02*Math.sqrt(-2*Math.log(Math.max(1e-12,rand())))*Math.sqrt(2/Math.PI));rand();let omega=rand()*2*Math.PI,h=Math.sqrt(a*(1-e*e)); bodies.push({a,q:a*(1-e),h,omega,owner:4,status:0,ejector:-1,sent:false,sentBatch:-1,returned:false,everIn:false});initBody.push(h)}
  function transfer(i,dh){bodyChange+=mb*dh;pl[i]-=mb*dh;pa[i]=(pl[i]*ME/masses[i])**2}
  function save(){let ho=batch*9;for(let i=0;i<4;i++){history[ho+i]=pa[i];history[ho+4+i]=pl[i]-initialL[i]}history[ho+8]=bodyChange}
  function snapshot(){let s=batch/10, off=s*N*3, so=s*N, sent=0,returned=0,sentOort=0,sentOut=0,everIn=0,inJ=0,inOther=0,inTransit=0,bodyDL=0;
   for(let i=0;i<N;i++){let b=bodies[i],stage=b.status|| (b.owner===4?0:b.a>pa[3]?1:2);snapshots[off+3*i]=b.a;snapshots[off+3*i+1]=Math.max(0,1-b.q/b.a);snapshots[off+3*i+2]=b.omega;stages[so+i]=stage;ejectors[so+i]=b.ejector;bodyDL+=mb*(b.h-initBody[i]);if(b.sent){sent++;if(b.returned)returned++;if(b.status===4)sentOort++;if(!b.status&&b.a>pa[3])sentOut++}if(b.everIn){everIn++;if(b.status===3){if(b.ejector===0)inJ++;else inOther++}else if(!b.status)inTransit++}}
   counts.push({inward:Array.from(inward),outward:Array.from(outward),ejected:Array.from(ejected),oort,impacts,sent,returned,sentOort,sentOut,everIn,inJ,inOther,inTransit,bodyDL});
  }
  function saveStory(id,i,oldA,newA,dl,n){if(id>=400)return;let arr=steps[id],side=newA>pa[i]?1:-1,last=arr[arr.length-1];if(last&&last.planet===i&&last.side===side&&!last.end){last.t=batch/100;last.after=newA;last.dL+=dl;last.kicks+=n}else arr.push({t:batch/100,planet:i,kicks:n,before:oldA,after:newA,dL:dl,side})}
  function kick(b,id,i){let ap=pa[i],rh=ap*Math.cbrt(masses[i]/3),v2=GM*(2/ap-1/b.a),h=b.h*root,vt=h/ap,vr=Math.sqrt(Math.max(0,v2-vt*vt))*(rand()<.5?-1:1),vp=Math.sqrt(GM/ap),rx=vr,ty=vt-vp,vinf=Math.hypot(rx,ty);if(!(vinf>0))return;
   let bk=(.05+3.45*rand())*rh,delta=2*Math.atan(GM*masses[i]/(bk*vinf*vinf))*(rand()<.5?-1:1),co=Math.cos(delta),si=Math.sin(delta),vx=rx*co-ty*si,vy=rx*si+ty*co+vp,E=(vx*vx+vy*vy)/2-GM/ap,oldA=b.a,oldH=b.h; b.h=ap*vy/root;transfer(i,b.h-oldH);
   if(b.owner!==i){let from=b.owner; if(from>i){for(let k=from;k>i;k--)inward[4-k]++}else {for(let k=from;k<i;k++)outward[3-k]++}b.owner=i}
   if(i===3&&b.sent&&batch>b.sentBatch)b.returned=true;
   if(E>=0){b.status=3;b.ejector=i;ejected[i]++;if(i===0)inward[4]++;return}
   b.a=-GM/(2*E);let ecc=Math.sqrt(Math.max(0,1-b.h*b.h/b.a));b.q=b.a*(1-ecc);if(i===3&&b.a>ap&&!b.sent){b.sent=true;b.sentBatch=batch;}if(b.a<pa[3])b.everIn=true;
  }
  function one(){let start=performance.now();batch++;
   for(let id=0;id<N;id++){let b=bodies[id];if(b.status)continue;let P=Math.pow(Math.max(b.a,.1),1.5),orbits=10000/P,hit=false;
    for(let i=0;i<4;i++){let ap=pa[i];if(!(b.q<ap&&ap<2*b.a-b.q))continue;let v2=GM*(2/ap-1/b.a),vt=b.h*root/ap,vr=Math.sqrt(Math.max(0,v2-vt*vt)),vp=Math.sqrt(GM/ap),rel=Math.hypot(vr,vt-vp),F=Math.min(2,rel/Math.max(vr,1e-12)),rh=ap*Math.cbrt(masses[i]/3),rate=Math.min(.5,2*(7*rh)/(2*Math.PI*ap)*F),num=poisson(orbits*rate);let before=b.a, beforeL=pl[i], actual=0;for(let k=0;k<num&&!b.status;k++){kick(b,id,i);hit=true;actual++}if(actual&&id<400){saveStory(id,i,before,b.status===3?Infinity:b.a,pl[i]-beforeL,actual);if(b.status===3)steps[id][steps[id].length-1].end='ejected'}if(b.status)break}
    if(b.status)continue;
    if(!hit){let outer=-1;for(let i=0;i<4;i++)if(pa[i]<b.q)outer=i;if(outer>=0){let wp=3.5*pa[outer]*Math.cbrt(masses[outer]/3),rate=.004*Math.exp(-(b.q-pa[outer])/wp);if(rand()<1-Math.exp(-orbits*rate)){let e=Math.min(.999,1-b.q/b.a+.02*rand()),old=b.h;b.q=b.a*(1-e);b.h=Math.sign(b.h||1)*Math.sqrt(b.a*(1-e*e));transfer(outer,b.h-old)}}}
    if(b.a>10000&&rand()<1-Math.pow(.9,orbits)){b.status=4;oort++;if(id<400&&steps[id].length)steps[id][steps[id].length-1].end='oort';continue}
    if(b.q<1.7&&rand()<1-Math.pow(1-2e-5,orbits)){b.status=5;impacts++;if(id<400&&steps[id].length)steps[id][steps[id].length-1].end='impact'}
   }
   save();if(batch%10===0)snapshot();let ms=performance.now()-start;totalMs+=ms;maxMs=Math.max(maxMs,ms);
  }
  save();snapshot();
  function index(t){return Math.max(0,Math.min(batch,Math.round(t*100)))}
  return {step(ms=6){let until=performance.now()+ms;do{if(batch>=maxBatch)break;one()}while(performance.now()<until);return batch/100},get frontier(){return batch/100},planets(t){let j=index(t)*9;return Array.from(history.slice(j,j+4))},ledger(t){let j=index(t)*9,p=Array.from(history.slice(j+4,j+8)),b=history[j+8];return {planets:p,bodies:b,sum:p.reduce((a,b)=>a+b,0)+b}},snapshot(t){let s=Math.min(counts.length-1,Math.floor(index(t)/10)),o=s*N;return {data:snapshots.subarray(o*3,(o+N)*3),stage:stages.subarray(o,o+N),ejector:ejectors.subarray(o,o+N)}},counters(t){return counts[Math.min(counts.length-1,Math.floor(index(t)/10))]},stories(){return steps.map((s,id)=>({id,steps:s})).filter(x=>{let a=x.steps, outward=a.findIndex(z=>z.planet===3&&z.side===1),ret=a.findIndex((z,i)=>i>outward&&z.planet===3),u=a.findIndex((z,i)=>i>ret&&z.planet===2),sat=a.findIndex((z,i)=>i>u&&z.planet===1),j=a.findIndex((z,i)=>i>sat&&z.planet===0&&z.end==='ejected'&&z.t<40);return outward>=0&&ret>outward&&u>ret&&sat>u&&j>sat}).sort((a,b)=>Math.abs(a.steps.length-8)-Math.abs(b.steps.length-8)).slice(0,5)},chunk(firstBatch,firstSnap){let lastSnap=counts.length, h=history.slice(firstBatch*9,(batch+1)*9),d=snapshots.slice(firstSnap*N*3,lastSnap*N*3),st=stages.slice(firstSnap*N,lastSnap*N),ej=ejectors.slice(firstSnap*N,lastSnap*N),c=new Float64Array((lastSnap-firstSnap)*25);for(let n=firstSnap;n<lastSnap;n++){let x=counts[n];c.set([...x.inward,...x.outward,...x.ejected,x.oort,x.impacts,x.sent,x.returned,x.sentOort,x.sentOut,x.everIn,x.inJ,x.inOther,x.inTransit,x.bodyDL],(n-firstSnap)*25)}return {firstBatch,firstSnap,frontier:batch/100,history:h,data:d,stage:st,ejector:ej,counters:c}},lifeStory(id){if(!Number.isInteger(id)||id<0||id>=400)return null;let b=bodies[id];return {id,steps:steps[id],end:b.status===3?{kind:"ejected",planet:b.ejector}:b.status===4?{kind:"oort"}:b.status===5?{kind:"impact"}:{kind:"survives"}}},recordBytes(){return history.byteLength+snapshots.byteLength+stages.byteLength+ejectors.byteLength+counts.length*25*8},timing(){return {mean:totalMs/batch,max:maxMs}}};
 }
 function installWorker(){let sim, nextBatch=0,nextSnap=0, chunkCount=0;self.onmessage=e=>{if(e.data.type!=='start')return;sim=create(e.data.params||{});nextBatch=nextSnap=chunkCount=0;function run(){sim.step(30);let chunk=sim.chunk(nextBatch,nextSnap);nextBatch=Math.round(chunk.frontier*100)+1;nextSnap=Math.floor(chunk.frontier*10)+1;chunk.type='progress';if(++chunkCount%20===0)chunk.stories=sim.stories();self.postMessage(chunk,[chunk.history.buffer,chunk.data.buffer,chunk.stage.buffer,chunk.ejector.buffer,chunk.counters.buffer]);if(sim.frontier<(e.data.params?.tEnd??60))setTimeout(run,0);else self.postMessage({type:'done',frontier:sim.frontier,stories:sim.stories()})}run()};}
 return {create,installWorker};
}
const NiceMigrationModel=NiceMigrationModelFactory();
if(typeof module!=='undefined'&&module.exports)module.exports=NiceMigrationModel;
if(typeof window!=='undefined'){window.NiceMigrationModel=NiceMigrationModel;window.NiceMigrationModelFactory=NiceMigrationModelFactory}
