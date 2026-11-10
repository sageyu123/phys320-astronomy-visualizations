const {test}=require('node:test'), assert=require('node:assert/strict');
let m; test('load model',async()=>{m=await import('data:text/javascript;base64,'+require('node:fs').readFileSync(require('node:path').join(__dirname,'../html/planet_atmospheres_model.js')).toString('base64'))});
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b} ± ${t}`);
test('solar flux and coefficients',()=>{near(m.C_SS,393.6,.2);near(m.C_EQ,278.3,.2);near(m.flux(1),1361,2)});
test('planet temperatures',()=>{for(const [name,a,b] of [['Mercury',618.3,437.2],['Venus',324,229.1],['Earth',359.3,254],['Mars',296.7,209.8],['Jupiter',144.9,102.5],['Neptune',65.9,46.6]]){const p=m.PLANETS.find(x=>x.name===name);near(m.Tss(p.a,p.A),a,.5);near(m.Teq(p.a,p.A),b,.5)}near(m.Tss(.307,.088),694,1)});
test('Wien peaks',()=>{near(m.wienPeak(5772)*1e9,502,1);near(m.wienPeak(290)*1e6,9.99,.02)});
test('scale heights and parcel balance',()=>{for(const [name,v] of [['Earth',8.36],['Mars',10.77],['Venus',15.78],['Titan',20.49],['Jupiter',24.74],['Saturn',51.16]]){let b=m.ATM_BODIES.find(x=>x.name===name);near(m.scaleHeight(b.T,b.mu,b.g)/1000,v,.05)}for(const z of [0,1000,20000])for(const dz of [100,10000]){let p=m.parcel(z,dz,101325,8360,9.81);near(p.F1-p.F2-p.weight,0,1e-9*p.F1)}});
test('US76 temperatures and pressure',()=>{const z=h=>m.K.R0_US76*h/(m.K.R0_US76-h);near(m.us76T(0),288.15,1e-9);near(m.us76T(z(11)),216.65,.001);for(const [h,p,t] of [[11,22632,1],[20,5474.9,.5],[32,868.02,.1],[47,110.91,.02],[71,3.9564,.001]])near(m.us76P(z(h)),p,t);near(m.us76P(86),.3734,.001);near(m.us76T(86),186.95,.1);near(m.us76T(110),240,.1);near(m.us76T(120),360,.001);near(m.us76T(500),999.2,.3);for(const x of [86,91,110,120])near(m.us76T(x+1e-6),m.us76T(x-1e-6),.2)});
test('magnetosphere',()=>{for(const [n,v,r] of [[5,400,10.25],[30,800,6.03],[1,300,14.75]]){near(m.standoff(n,v),r,.05);near(m.magPressure(m.standoff(n,v))/m.pdyn(n,v),1,1e-9)}near(m.pdyn(5,400),1.338e-9,.005e-9);near(m.dipoleB(1,0),3.12e-5,1e-15);near(m.dipoleB(1,Math.PI/2),6.24e-5,1e-15);near(m.dipoleB(10,0),3.12e-8,1e-18)});

test('nice altitude ceilings',()=>{for(const [v,w] of [[41.8,50],[53.8,60],[78.9,80],[102.5,150],[123.7,150],[255.8,300],[99,100],[100,100]])assert.equal(m.niceCeil(v),w)});
test('layers default temperatures reproduce US76',()=>{for(const z of [0,11,11.005,11.01,11.015,20,32,47,51,71,86,110,120])near(m.layersT(z),m.us76T(z),1e-6)});
test('layers tropopause follows surface temperature',()=>{const h=z=>m.K.R0_US76*z/(m.K.R0_US76+z);for(const T0 of [250,288.15,300])near(h(m.layersTropopause({T0})),(T0-216.65)/6.5,.02)});
test('layers ozone profile and stratopause',()=>{assert.equal(m.layersStratopause({ozone:0}),null);for(let z=1;z<=86;z++)assert.ok(m.layersT(z,{ozone:0})<=m.layersT(z-1,{ozone:0})+1e-8);let floor=216.65+(m.us76T(86)-216.65)*(49-11)/75;near(m.layersT(49,{ozone:1.5})-floor,1.5*(m.us76T(49)-floor),1e-9)});
test('layers pressure follows standard atmosphere',()=>{for(const z of [11,20,32,47,71,86])near(m.layersP(z)/m.us76P(z),1,.002);assert.ok(Number.isNaN(m.layersP(87)))});
test('solar activity affects only above 120 km',()=>{for(const z of [0,5,30,86,110,120])near(m.layersT(z,{Tinf:700}),m.layersT(z,{Tinf:1400}),1e-9);assert.ok(m.layersT(400,{Tinf:1400})>m.layersT(400,{Tinf:700}))});

