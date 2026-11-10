export const K={sigma:5.670374e-8,T_SUN:5772,R_SUN:6.957e8,AU:1.495978707e11,WIEN:2.897771955e-3,kB:1.380649e-23,MH:1.6735e-27,G0:9.80665,R_STAR:8.31432,M_AIR:28.9644e-3,R0_US76:6356.766,MU0:4e-7*Math.PI,MP:1.6726e-27,R_E:6.371e6,B_EQ:3.12e-5};
export const L_SUN=4*Math.PI*K.R_SUN**2*K.sigma*K.T_SUN**4, C_SS=K.T_SUN*Math.sqrt(K.R_SUN/K.AU), C_EQ=C_SS/Math.sqrt(2);
export const PLANETS=[['Mercury',.387,.088,.142,'max ≈ 700 K (equator, noon), mean ≈ 340 K, night ≈ 100 K',700,340],['Venus',.723,.76,.689,'surface 737 K (greenhouse)',737,737],['Earth',1,.306,.434,'mean surface 288 K',288,288],['Moon',1,.11,.12,'equator noon ≈ 390 K, night ≈ 100 K',390,390],['Mars',1.524,.25,.170,'mean ≈ 210 K',210,210],['Jupiter',5.203,.503,.538,'emits 124 K (internal heat)',124,124],['Saturn',9.537,.342,.499,'emits 95 K (internal heat)',95,95],['Uranus',19.19,.300,.488,'emits 59 K',59,59],['Neptune',30.07,.290,.442,'emits 59 K (internal heat)',59,59]].map(([name,a,A,p,note,measuredSS,measuredEq])=>({name,a,A,p,note,measuredSS,measuredEq}));
export const flux=r=>L_SUN/(4*Math.PI*(r*K.AU)**2), Tss=(r,A)=>C_SS/Math.sqrt(r)*(1-A)**.25, Teq=(r,A)=>Tss(r,A)/Math.sqrt(2), localT=(theta,r,A)=>theta<Math.PI/2?Tss(r,A)*Math.max(0,Math.cos(theta))**.25:0, wienPeak=T=>K.WIEN/T;
export const ATM_BODIES=[['Earth',9.81,28.97,288,101325],['Mars',3.71,43.34,210,610],['Venus',8.87,43.45,737,9.2e6],['Titan',1.352,28,94,1.467e5],['Jupiter',24.79,2.22,165,1e5,'1-bar level'],['Saturn',10.44,2.07,134,1e5,'1-bar level']].map(([name,g,mu,T,P0,note])=>({name,g,mu,T,P0,note}));
export const scaleHeight=(T,mu,g)=>K.kB*T/(mu*K.MH*g), isothermalP=(z,P0,H)=>P0*Math.exp(-z/H);
export function parcel(z1,dz,P0,H,g){const F1=isothermalP(z1,P0,H),F2=isothermalP(z1+dz,P0,H),weight=F1-F2;return {F1,F2,weight,mass:weight/g}}
const bases=[0,11,20,32,47,51,71,84.852], lapses=[-6.5,0,1,2.8,0,-2.8,-2], temps=[288.15], pressures=[101325];
function nextP(p,t,delta,l){return l===0?p*Math.exp(-K.G0*K.M_AIR*delta*1000/(K.R_STAR*t)):p*(t/(t+l*delta))**(K.G0*K.M_AIR/(K.R_STAR*l/1000))}
for(let i=0;i<7;i++){let d=bases[i+1]-bases[i];pressures.push(nextP(pressures[i],temps[i],d,lapses[i]));temps.push(temps[i]+lapses[i]*d)}
function lower(z){let h=K.R0_US76*z/(K.R0_US76+z),i=6;while(i>0&&h<bases[i])i--;let d=h-bases[i];return {T:temps[i]+lapses[i]*d,P:nextP(pressures[i],temps[i],d,lapses[i])}}
export function us76T(z,Tinf=1000){if(z<=86)return lower(z).T;if(z<=91)return lower(86).T;if(z<=110)return 263.1905-76.3232*Math.sqrt(1-((z-91)/19.9429)**2);if(z<=120)return 240+12*(z-110);let xi=(z-120)*(K.R0_US76+120)/(K.R0_US76+z);return Tinf-(Tinf-360)*Math.exp(-.01875*xi)}
export const us76P=z=>z<=86?lower(z).P:NaN, localScaleHeight=(z,Tinf=1000)=>K.R_STAR*us76T(z,Tinf)/(K.M_AIR*K.G0*(K.R0_US76/(K.R0_US76+z))**2)/1000;
export const dipoleB=(r,lat)=>K.B_EQ*r**-3*Math.sqrt(1+3*Math.sin(lat)**2);
export function fieldLine(L,n){if(L<1)return [];let m=Math.acos(1/Math.sqrt(L));return Array.from({length:n},(_,i)=>{let lat=-m+2*m*i/(n-1),r=L*Math.cos(lat)**2;return {x:r*Math.cos(lat),z:r*Math.sin(lat)}})}
export const pdyn=(n,v)=>n*1e6*K.MP*(v*1000)**2, standoff=(n,v)=>(2*K.B_EQ**2/(K.MU0*pdyn(n,v)))**(1/6), magnetopause=(theta,r0,p)=>r0*(2/(1+Math.cos(theta)))**(.58*(1+.010*p)), magPressure=r=>(2*K.B_EQ*r**-3)**2/(2*K.MU0);

export const niceCeil=km=>Math.ceil(km/(km<100?10:50))*(km<100?10:50);

const layersH=z=>K.R0_US76*z/(K.R0_US76+z);
const layersFloor=z=>216.65+(us76T(86)-216.65)*(z-11)/75;
const layersStrat=(z,ozone)=>z<11?216.65:layersFloor(z)+ozone*(us76T(z)-layersFloor(z));
export function layersTropopause({T0=288.15,ozone=1}={}){let lo=0,hi=25;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(T0-6.5*layersH(mid)<=layersStrat(mid,ozone))hi=mid;else lo=mid}return (lo+hi)/2}
export function layersT(z,{T0=288.15,ozone=1,Tinf=1000}={}){if(z>86)return us76T(z,Tinf);return z<layersTropopause({T0,ozone})?T0-6.5*layersH(z):layersStrat(z,ozone)}
export function layersStratopause(opts={}){if((opts.ozone??1)<.05)return null;let lo=layersTropopause(opts),hi=80;for(let i=0;i<45;i++){let a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(layersT(a,opts)<layersT(b,opts))lo=a;else hi=b}return (lo+hi)/2}
export function layersP(z,opts={}){if(z<0||z>86)return NaN;let n=Math.max(1,Math.ceil(z/.05)),dz=z/n,sum=0,zt=layersTropopause(opts),T0=opts.T0??288.15,ozone=opts.ozone??1,T=x=>x<zt?T0-6.5*layersH(x):layersStrat(x,ozone);for(let i=0;i<n;i++){let a=i*dz,b=(i+1)*dz;sum+=(layersH(b)-layersH(a))*(1/T(a)+1/T(b))/2}return 101325*Math.exp(-K.G0*K.M_AIR*1000/K.R_STAR*sum)}

// Magnetosphere quantities use n in cm^-3, v in km/s, B in nT and distances in Earth radii.
export const standoffR0=(n,v,bz)=>10.25*((n/5)*(v/400)**2)**(-1/6)*(10.22+1.29*Math.tanh(.184*(bz+8.14)))/11.39;
export const shueAlpha=(n,v,bz)=>(.58-.007*bz)*(1+.024*Math.log(1e9*pdyn(n,v)));
export const bowShockR0=(n,v,bz)=>{const m=v/Math.hypot(109/Math.sqrt(n),60),m2=m*m;return standoffR0(n,v,bz)*(1+1.1*((2/3)*m2+2)/((8/3)*(m2-1)))};
export const newellD=(v,bz,by=3)=>v**(4/3)*Math.hypot(by,bz)**(2/3)*Math.sin(Math.atan2(Math.abs(by),bz)/2)**(8/3);
export const kpFromD=(n,v,D)=>Math.max(0,Math.min(9,.05+2.244e-4*D+2.844e-6*Math.sqrt(n)*v*v));
export const ovalEdges=kp=>({midnight:67.8-2.07*kp,noon:70.1-1.25*kp});
export const polarCap=D=>{const Dhat=Math.min(1,D/50000),flux=.3+.7*Dhat,theta=Math.asin(Math.sqrt(flux/7.9))*180/Math.PI;return {Dhat,flux,noon:93.5-theta,midnight:86.5-theta}};
export const obrienQ=(v,bz)=>{const vb=.001*v*Math.max(0,-bz);return vb>.49?-4.4*(vb-.49):0};
export const obrienTau=(v,bz)=>2.4*Math.exp(9.74/(4.69+.001*v*Math.max(0,-bz)));
export const dstSteady=(n,v,bz)=>obrienQ(v,bz)*obrienTau(v,bz)+7.26*Math.sqrt(1e9*pdyn(n,v))-11;
export function dstSeries(n,v,bz){const dt=.05,points=[],quiet=7.26*Math.sqrt(1e9*pdyn(5,400))-11;let star=0;for(let i=0;i<=1080;i++){const t=Math.round((-6+i*dt)*100)/100,active=t>=0&&t<12,pressure=active?1e9*pdyn(n,v):1e9*pdyn(5,400),dst=star+7.26*Math.sqrt(pressure)-11;points.push({t,dst,star});const Q=active?obrienQ(v,bz):0,tau=obrienTau(active?v:400,active?bz:2);star=Q*tau+(star-Q*tau)*Math.exp(-dt/tau)}const minimum=points.reduce((a,b)=>b.dst<a.dst?b:a);return {points,minimum,quiet}}
// Frozen-in advection, with angular lookup tables and RK2 in the sheath.
// The precompute is incremental: Begin builds the lookup tables, Advance marches the line a few steps (the page calls it
// with a time budget each frame so no frame blocks), and magnetoPrecompute runs it to completion in one go.
export function magnetoPrecomputeBegin({n=5,v=400,bz=2}={}){const r0=standoffR0(n,v,bz),alpha=shueAlpha(n,v,bz),rb=bowShockR0(n,v,bz),N=4096,step=Math.PI/N,mp=new Float64Array(N+1),bs=new Float64Array(N+1);for(let i=0;i<=N;i++){const a=i*step;mp[i]=r0*(2/(1+Math.cos(Math.min(a,2.7))))**alpha;bs[i]=rb*(2/(1+Math.cos(Math.min(a,2.3))))**.8}const x=new Float64Array(361),z=new Float64Array(361);for(let i=0;i<361;i++){x[i]=-25;z[i]=22*Math.sinh(2*(-1+2*i/360))/Math.sinh(2)}return {r0,N,step,mp,bs,x,z,k:0,snapshots:[],tA:-1,TC:1,dt:.1,done:false}}
export function magnetoPrecomputeAdvance(job,maxSteps=1e9){const {N,step,mp,bs,x,z,r0}=job,lookup=(table,a,b)=>table[Math.min(N,Math.round(Math.atan2(Math.abs(b),-a)/step))];for(let s=0;s<maxSteps&&!job.done;s++){const k=job.k;if(k%2===0)job.snapshots.push(Array.from(x,(xx,i)=>[xx,z[i]]));for(let i=0;i<361;i++){let a=x[i],b=z[i],r=Math.hypot(a,b),vx=1,vz=0;if(r<lookup(bs,a,b)){const q=r*r;vx+=r0*a/q;vz=r0*b/q;const mx=a+vx*.025,mz=b+vz*.025,mr=Math.hypot(mx,mz);if(mr<lookup(bs,mx,mz)){const mq=mr*mr;vx=1+r0*mx/mq;vz=r0*mz/mq}else{vx=1;vz=0}}a+=vx*.05;b+=vz*.05;r=Math.hypot(a,b);const m=lookup(mp,a,b)+.15;if(r<m){a*=m/r;b*=m/r}x[i]=a;z[i]=b}const t=(k+1)*.05;if(job.tA<0&&x[180]>=-r0-.5){job.tA=t;job.TC=t*.25/.30}job.k=k+1;if(job.tA>0&&t>job.tA+job.TC+.3||job.k>=4000)job.done=true}return job}
export function magnetoPrecompute(params={}){const job=magnetoPrecomputeBegin(params);magnetoPrecomputeAdvance(job);return {snapshots:job.snapshots,tA:job.tA,TC:job.TC,dt:.1}}
