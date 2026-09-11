/* Dated angular observations and orbit inference. Period is an input, never
   used to infer a distance through Kepler's third law. The page supplies its
   existing Kepler solver and known Earth orbit. */
const KeplerOrbitInference = {
  create({ earthAt, solveKepler }) {
    const tau = 2*Math.PI;
    const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
    function position(params, period, t) {
      const [a,h,k,longitude] = params;
      const e = Math.hypot(h,k), omega = Math.atan2(k,h);
      const E = solveKepler(tau*t/period + longitude - omega,e);
      const x = a*(Math.cos(E)-e), y = a*Math.sqrt(1-e*e)*Math.sin(E);
      return {x:x*Math.cos(omega)-y*Math.sin(omega),y:x*Math.sin(omega)+y*Math.cos(omega)};
    }
    function observe(params,period,t) {
      const earth=earthAt(t), planet=position(params,period,t);
      const angle=Math.atan2(planet.y-earth.y,planet.x-earth.x);
      const elongation=Math.abs(wrap(angle-Math.atan2(-earth.y,-earth.x)));
      return {t,earth:{x:earth.x,y:earth.y},planet,angle,elongation};
    }
    function observations(planet,count=12) {
      const params=[planet.a,planet.e,0,0], period=planet.period;
      const events=[];
      // Daily bracketing followed by golden-section refinement of each maximum.
      let previous=observe(params,period,0), current=observe(params,period,1);
      for(let day=2;day<12000 && events.length<count;day++) {
        const next=observe(params,period,day);
        if(current.elongation>previous.elongation && current.elongation>next.elongation) {
          let lo=day-2,hi=day,ratio=(Math.sqrt(5)-1)/2;
          let c=hi-ratio*(hi-lo),d=lo+ratio*(hi-lo);
          for(let j=0;j<48;j++) {
            if(observe(params,period,c).elongation>observe(params,period,d).elongation){hi=d;d=c;c=hi-ratio*(hi-lo);}
            else {lo=c;c=d;d=lo+ratio*(hi-lo);}
          }
          events.push(observe(params,period,(lo+hi)/2));
        }
        previous=current;current=next;
      }
      return events;
    }
    function residuals(params,period,events) {
      return events.map(o=>{
        const p=position(params,period,o.t);
        return wrap(Math.atan2(p.y-o.earth.y,p.x-o.earth.x)-o.angle);
      });
    }
    function solve(matrix,vector) {
      const a=matrix.map((r,i)=>r.concat(vector[i]));
      for(let i=0;i<4;i++) {
        let p=i;for(let j=i+1;j<4;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;
        if(Math.abs(a[p][i])<1e-15)return null;
        [a[p],a[i]]=[a[i],a[p]];
        const divisor=a[i][i];for(let k=i;k<5;k++)a[i][k]/=divisor;
        for(let j=0;j<4;j++)if(j!==i){const factor=a[j][i];for(let k=i;k<5;k++)a[j][k]-=factor*a[i][k];}
      }
      return a.map(r=>r[4]);
    }
    function fit(events,period) {
      if(events.length<5)return null;
      let best=null;
      // Fit a, the two eccentricity-vector components, and initial mean
      // longitude. Only measured directions, dates, Earth positions and P enter.
      for(const a0 of [0.35,0.7])for(const phase0 of [0,Math.PI/2,Math.PI,3*Math.PI/2]) {
        let params=[a0,0.05,0.02,phase0],lambda=0.001;
        let r=residuals(params,period,events),cost=r.reduce((s,v)=>s+v*v,0);
        for(let iteration=0;iteration<100;iteration++) {
          const jac=events.map(()=>[]);
          for(let k=0;k<4;k++) {
            const plus=params.slice(),minus=params.slice(),step=1e-5;
            plus[k]+=step;minus[k]-=step;
            const rp=residuals(plus,period,events),rm=residuals(minus,period,events);
            for(let j=0;j<events.length;j++)jac[j][k]=wrap(rp[j]-rm[j])/(2*step);
          }
          const normal=Array.from({length:4},()=>Array(4).fill(0)),rhs=Array(4).fill(0);
          for(let j=0;j<events.length;j++)for(let k=0;k<4;k++) {
            rhs[k]-=jac[j][k]*r[j];for(let l=0;l<4;l++)normal[k][l]+=jac[j][k]*jac[j][l];
          }
          for(let k=0;k<4;k++)normal[k][k]+=lambda;
          const delta=solve(normal,rhs);if(!delta)break;
          const trial=params.map((v,k)=>v+delta[k]);
          const e=Math.hypot(trial[1],trial[2]);
          if(trial[0]<=0.1 || trial[0]*(1+e)>=0.98 || e>=0.65){lambda*=10;continue;}
          const nr=residuals(trial,period,events),nc=nr.reduce((s,v)=>s+v*v,0);
          if(nc<cost){params=trial;r=nr;cost=nc;lambda=Math.max(1e-10,lambda/3);}
          else lambda*=10;
          if(cost<1e-20 || lambda>1e12)break;
        }
        if(!best || cost<best.cost)best={params,cost};
      }
      if(!best || best.cost/events.length>1e-10)return null;
      const [a,h,k,phase]=best.params;
      return {a,e:Math.hypot(h,k),omega:Math.atan2(k,h),phase,params:best.params,
        rms:Math.sqrt(best.cost/events.length),
        positions:events.map(o=>{
          const p=position(best.params,period,o.t);
          return {...p,t:o.t,r:Math.hypot(p.x,p.y),ratio:Math.hypot(p.x,p.y)/Math.hypot(o.earth.x,o.earth.y)};
        })};
    }
    return {position,observe,observations,fit};
  }
};
if(typeof module!=='undefined')module.exports=KeplerOrbitInference;
