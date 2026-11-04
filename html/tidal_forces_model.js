export const K = {G:6.674e-11,M_SUN:1.989e30,M_EARTH:5.972e24,M_MOON:7.346e22,R_EARTH:6.371e6,R_MOON:1.737e6,D_MOON:3.844e8,D_SUN:1.496e11,SIDEREAL_DAY:86164.1,SOLAR_DAY:86400,SYNODIC_MONTH:29.53*86400,YEAR:365.25*86400,F_ROCHE:2.456,F_RIGID:Math.cbrt(2),PDOT_PER_CENTURY:2.3e-3,SATURN:{Rp:6e7,rhoP:690,ringInner:8e7,ringOuter:1.36e8,ringMass:1e16,name:'Saturn'},RHO_ICE:1200};
K.I_EARTH=0.3307*K.M_EARTH*K.R_EARTH**2;
export const tidalBracketExact=x=>(1+x)**-2-(1-x)**-2;
export const tidalBracketApprox=x=>-4*x;
export const deltaForcePerMass=(M,R,d)=>K.G*M/d**2*tidalBracketExact(R/d);
export const deltaForcePerMassApprox=(M,R,d)=>-4*K.G*M*R/d**3;
export const tidalAccelAcross=(M,R,d)=>2*K.G*M*R/d**3;
export function samplePoints(){const a=[];for(let x=-1;x<=1;x+=.5)for(let y=-1;y<=1;y+=.5)if(x*x+y*y<=1)a.push([x,y]);return a;}
export function forceField(points,D){return points.map(p=>{const x=D-p[0],y=p[1]===0?0:-p[1],r=Math.hypot(x,y),abs=[x/r**3,y/r**3];return {p,abs,res:[abs[0]-1/D**2,abs[1]]};});}
export const tidalAccelLinear=(p,D)=>[2*p[0]/D**3,p[1]===0?0:-p[1]/D**3];
export const sunMoonRatio=(Ms=K.M_SUN,Mm=K.M_MOON,ds=K.D_SUN,dm=K.D_MOON)=>(Ms/Mm)*(dm/ds)**3;
export const equilibriumTideHeight=(M,d,Mb=K.M_EARTH,R=K.R_EARTH)=>(M/Mb)*(R/d)**3*R;
const P2=c=>(3*c*c-1)/2;
export const tideHeightAt=(phi,thetaM,thetaS,Hm,Hs)=>Hm*P2(Math.cos(phi-thetaM))+Hs*P2(Math.cos(phi-thetaS));
export const tideEnvelope=(thetaM,thetaS,Hm,Hs)=>({mean:(Hm+Hs)/4,amp:.75*Math.sqrt(Hm*Hm+Hs*Hs+2*Hm*Hs*Math.cos(2*(thetaM-thetaS)))});
export const tideFrame=(tHours,thetaM0,obsLon0)=>({phi:obsLon0+2*Math.PI*tHours/24,thetaM:thetaM0+2*Math.PI*tHours/(29.53*24),thetaS:0});
export const lunarHighTideInterval=()=>.5/(1/24-1/(29.53*24));
export function phaseName(thetaM){return ['new Moon','waxing crescent','first quarter','waxing gibbous','full Moon','waning gibbous','third quarter','waning crescent'][Math.floor(((thetaM%(2*Math.PI)+2*Math.PI)%(2*Math.PI)+Math.PI/8)/(Math.PI/4))%8];}
export function bulgeForces(D,delta,eps=0){const c=Math.cos(delta)*(1+eps),s=Math.sin(delta)*(1+eps);function point(x,y){const dx=D-x,dy=-y,r=Math.hypot(dx,dy),f=[dx/r**3,dy/r**3],p=[x,y];return {p,f,ft:(x*f[1]-y*f[0])/Math.hypot(x,y)};}const near=point(c,s),far=point(-c,-s);return {near,far,torque:(1+eps)*(near.ft+far.ft)};}
export const bulgeTorqueFirstOrder=(D,delta)=>-3*Math.sin(2*delta)/D**3;
export const stretchRatioEarthOnMoon=()=>K.M_EARTH*K.R_MOON/(K.M_MOON*K.R_EARTH);
export const Mt=K.M_EARTH+K.M_MOON, mu=K.M_EARTH*K.M_MOON/Mt, omega0=2*Math.PI/K.SIDEREAL_DAY, a0=K.D_MOON;
export const Lspin=omega=>K.I_EARTH*omega, Lorb=a=>mu*Math.sqrt(K.G*Mt*a), Ltot=Lspin(omega0)+Lorb(a0), n=a=>Math.sqrt(K.G*Mt/a**3), vorb=a=>Math.sqrt(K.G*Mt/a), omegaOfA=a=>(Ltot-Lorb(a))/K.I_EARTH;
export const LspinMoon=a=>0.3929*K.M_MOON*K.R_MOON**2*n(a);
export const dPdt=K.PDOT_PER_CENTURY/(100*K.YEAR), dOmegaDt0=-omega0*dPdt/K.SIDEREAL_DAY, torque0=K.I_EARTH*dOmegaDt0, dadt0=-torque0/(.5*mu*Math.sqrt(K.G*Mt/a0));
export const dadt=a=>dadt0*(a0/a)**5.5, aOfT=t=>(a0**6.5+6.5*dadt0*a0**5.5*t)**(2/13), tOfA=a=>(a**6.5-a0**6.5)/(6.5*dadt0*a0**5.5);
export function lockState(){let lo=a0,hi=10*a0;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(omegaOfA(mid)>n(mid))lo=mid;else hi=mid;}const a=(lo+hi)/2;return {a,P:2*Math.PI/n(a),t:tOfA(a)};}
export function evolve(tSeconds){const lock=lockState(),t=Math.max(-1e9*K.YEAR,Math.min(lock.t,tSeconds)),a=t===lock.t?lock.a:aOfT(t),omega=omegaOfA(a),motion=n(a),spin=Lspin(omega),orb=Lorb(a);return {t,a,omega,n:motion,day:2*Math.PI/omega,month:2*Math.PI/motion,v:vorb(a),Lspin:spin,Lorb:orb,Ltot,fracSpin:spin/Ltot,fracOrb:orb/Ltot,locked:a>=lock.a-1};}
export const primaryMass=(rhoP,Rp)=>4/3*Math.PI*rhoP*Rp**3, satelliteMass=(rhoM,Rm)=>4/3*Math.PI*rhoM*Rm**3, selfGravity=(rhoM,Rm)=>K.G*satelliteMass(rhoM,Rm)/Rm**2, tidalAtSatellite=(rhoP,Rp,Rm,r)=>2*K.G*primaryMass(rhoP,Rp)*Rm/r**3, rocheRadius=(rhoP,rhoM,Rp,f=K.F_ROCHE)=>f*Math.cbrt(rhoP/rhoM)*Rp, radiusFromMass=(mass,rho)=>Math.cbrt(3*mass/(4*Math.PI*rho));
export const disruptionState=(r,rRoche,rRigid)=>r>1.25*rRoche?'intact':r>rRoche?'stretched':'disrupted', elongation=(r,rRoche)=>Math.max(0,Math.min(1,(rRoche/r)**3));
