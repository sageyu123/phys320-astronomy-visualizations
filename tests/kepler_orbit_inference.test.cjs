const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../html/kepler_laws.html'), 'utf8');
const physics = html.slice(html.indexOf('function periodDays('), html.indexOf('function ellipseGeometry('));
const context = {};
vm.createContext(context);
vm.runInContext('const TAU=2*Math.PI,YEAR_DAYS=365.25,GM=TAU*TAU/(YEAR_DAYS*YEAR_DAYS);' + physics, context);
const model = require('../html/kepler_orbit_inference.js').create({
  earthAt: t => context.computeOrbit(1, 0.017, t), solveKepler: context.solveKepler
});
for (const planet of [{a:0.387,e:0.206}, {a:0.723,e:0.007}]) {
  planet.period = context.periodDays(planet.a);
  const events = model.observations(planet);
  assert.equal(events.length, 12);
  assert.equal(model.fit(events.slice(0,4),planet.period), null);
  for (const event of events) {
    for (const dt of [-0.01, 0.01]) {
      assert(event.elongation >= model.observe([planet.a,planet.e,0,0],planet.period,event.t+dt).elongation);
    }
  }
  for (const count of [5,6,8,12]) {
    // Withhold the generating positions and orbital elements from the fitter.
    const data = events.slice(0,count).map(({t,earth,angle}) => ({t,earth,angle}));
    const fit = model.fit(data,planet.period);
    assert(fit);
    assert(Math.abs(fit.a-planet.a)<1e-6);
    assert(Math.abs(fit.e-planet.e)<1e-6);
    fit.positions.forEach((p,i) => {
      const truth=events[i].planet;
      assert(Math.hypot(p.x-truth.x,p.y-truth.y)<1e-6);
      assert(Math.abs(p.ratio-Math.hypot(truth.x,truth.y)/Math.hypot(data[i].earth.x,data[i].earth.y))<1e-6);
    });
  }
}
console.log('Greatest-elongation dates, independent angular orbit fits, and distance ratios passed.');
const measureContext={window:{}};
vm.createContext(measureContext);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../html/kepler_measurements.js'),'utf8'),measureContext);
const measurements=measureContext.window.keplerMeasurements;
vm.runInContext(html.slice(html.indexOf('const HARMONIC_PLANETS ='),html.indexOf('const HALLEY =')),context);
const planets=vm.runInContext('HARMONIC_PLANETS',context);
measurements.configure({planets,computeOrbit:context.computeOrbit,periodDays:context.periodDays});
for(const epochDay of [0,100,300]){
  for(let marsNuDeg=0;marsNuDeg<360;marsNuDeg+=15){
    const result=measurements.outerState({epochDay,marsNuDeg});
    assert(result.intersection.ok);
    assert(Math.abs(result.rMeasured-result.rActual)<1e-10);
    const directions=[result.earth1,result.earth2].map((earth,i)=>{
      const angle=Math.atan2(-earth.y,-earth.x)+(i?result.epsilon2:result.epsilon1);
      return {x:Math.cos(angle),y:Math.sin(angle)};
    });
    const inferred=measurements.intersectRays(result.earth1,directions[0],result.earth2,directions[1]);
    assert(inferred.ok);
    assert(Math.hypot(inferred.point.x-result.mars.x,inferred.point.y-result.mars.y)<1e-9);
  }
  // Put Mars exactly on the Earth baseline: directions then fail to fix distance.
  const initial=measurements.outerState({epochDay,marsNuDeg:45});
  const p=initial.earth1,q=initial.earth2,dx=q.x-p.x,dy=q.y-p.y;
  const a=1.524,e=.093,b=a*Math.sqrt(1-e*e),x=p.x+a*e;
  const A=dx*dx/(a*a)+dy*dy/(b*b),B=2*(x*dx/(a*a)+p.y*dy/(b*b)),C=x*x/(a*a)+p.y*p.y/(b*b)-1;
  const t=(-B+Math.sqrt(B*B-4*A*C))/(2*A);
  const marsNuDeg=Math.atan2(p.y+t*dy,p.x+t*dx)*180/Math.PI;
  const parallel=measurements.outerState({epochDay,marsNuDeg});
  assert.equal(parallel.intersection.ok,false);
  assert(Number.isNaN(parallel.rMeasured));
}
console.log('Outer-planet triangulation and degenerate baselines passed.');
