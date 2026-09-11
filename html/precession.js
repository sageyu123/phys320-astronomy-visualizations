import { drawTorqueTimeline } from "./precession_torque_plot.js?v=lunar-51";
import {
  TAU, PRECESSION_YEARS, LUNAR_ORBIT_DAYS,
  add, cross, dot, length, normalize, scale, stateAt
} from "./precession_model.js?v=lunar-51";

const COLORS = {
  canvas: "#0d1015", deep: "#10161d", panel: "#171d24", raised: "#202832",
  border: "#33404d", borderStrong: "#5d6e80", text: "#e7edf3", muted: "#8b98a8",
  cyan: "#56c7d9", amber: "#ffcc66", magenta: "#d17bff", purple: "#b28cff",
  green: "#6bd69b", white: "#f5f7fa"
};
const FONT = '"SF Pro Text", "Helvetica Neue", Arial, sans-serif';

function hexAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
}

function makeStars() {
  const out = [];
  const count = 34;
  for (let i = 0; i < count; i++) {
    const z = -0.82 + ((i * 37) % 100) / 100 * 1.64;
    const a = (i * 2.3999632297) % TAU;
    const r = Math.sqrt(Math.max(0, 1 - z*z));
    out.push({ p:[r*Math.cos(a)*1.72, r*Math.sin(a)*1.72, z*1.72], size: i%7===0 ? 2 : 1.2 });
  }
  return out;
}
const STAR_FIELD = makeStars();

function project(v, w, h, camera) {
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
  const x1 = cy*v[0] - sy*v[1];
  const y1 = sy*v[0] + cy*v[1];
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  // Positive ecliptic north projects upward at the default camera pitch.
  const y2 = cp*v[2] - sp*y1;
  const z2 = sp*v[2] + cp*y1;
  const s = camera.zoom * Math.min(w, h) * 0.28;
  return { x:w*0.5 + x1*s, y:h*0.52 - y2*s, depth:z2 };
}

function line3(ctx, points, w, h, camera, color, width=1, dash=[]) {
  if (!points.length) return;
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((v, i) => { const p=project(v,w,h,camera); if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
  ctx.stroke(); ctx.restore();
}

function arrow3(ctx, from, to, w, h, camera, color, width=2, label="") {
  const a=project(from,w,h,camera), b=project(to,w,h,camera);
  const dx=b.x-a.x, dy=b.y-a.y, m=Math.hypot(dx,dy)||1;
  const ux=dx/m, uy=dy/m, nx=-uy, ny=ux, head=Math.max(7,Math.min(13,m*0.16));
  ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=width;
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x-ux*head+nx*head*.45,b.y-uy*head+ny*head*.45);
  ctx.lineTo(b.x-ux*head-nx*head*.45,b.y-uy*head-ny*head*.45); ctx.closePath(); ctx.fill();
  if(label){ ctx.font=`600 11px ${FONT}`; ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText(label,b.x+nx*7,b.y+ny*7); }
  ctx.restore();
}

function point3(ctx, v, w, h, camera, color, radius=4) {
  const p=project(v,w,h,camera); ctx.save(); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,TAU); ctx.fill(); ctx.restore();
}

function label3(ctx, text, v, w, h, camera, color, dx=7, dy=-7) {
  const p=project(v,w,h,camera); ctx.save(); ctx.font=`600 11px ${FONT}`; ctx.fillStyle=color; ctx.textAlign="left"; ctx.textBaseline="middle";
  let x=p.x+dx;
  if(x+ctx.measureText(text).width>w-8){ctx.textAlign="right";x=Math.min(w-8,p.x-8);}
  ctx.fillText(text,Math.max(8,x),Math.max(12,Math.min(h-34,p.y+dy))); ctx.restore();
}

function circle3(normal, radius, samples=96) {
  const n=normalize(normal);
  let e1=cross([0,0,1],n); if(length(e1)<1e-6) e1=[1,0,0]; e1=normalize(e1);
  const e2=normalize(cross(n,e1)); const pts=[];
  for(let i=0;i<=samples;i++){ const a=TAU*i/samples; pts.push(add(scale(e1,radius*Math.cos(a)),scale(e2,radius*Math.sin(a)))); }
  return pts;
}

function parallel3(normal, offset, radius, samples=96) {
  const n=normalize(normal);
  let e1=cross([0,0,1],n); if(length(e1)<1e-6)e1=[1,0,0]; e1=normalize(e1);
  const e2=normalize(cross(n,e1)); const rr=radius*Math.sqrt(Math.max(0,1-offset*offset)); const pts=[];
  for(let i=0;i<=samples;i++){ const a=TAU*i/samples; pts.push(add(scale(n,offset*radius),add(scale(e1,rr*Math.cos(a)),scale(e2,rr*Math.sin(a))))); }
  return pts;
}

function drawBackground(ctx,w,h) {
  const grad=ctx.createRadialGradient(w*.52,h*.42,0,w*.52,h*.42,Math.max(w,h)*.72);
  grad.addColorStop(0, COLORS.deep); grad.addColorStop(1, COLORS.canvas);
  ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
}

function drawStars(ctx,w,h,camera) {
  STAR_FIELD.forEach(st => {
    const p=project(st.p,w,h,camera); ctx.fillStyle=hexAlpha(COLORS.muted,0.35+(p.depth+1.7)/7);
    ctx.beginPath(); ctx.arc(p.x,p.y,st.size,0,TAU); ctx.fill();
  });
}

function drawCone(ctx,w,h,camera,state,opts) {
  drawStars(ctx,w,h,camera);
  line3(ctx,circle3([0,0,1],1.62),w,h,camera,hexAlpha(COLORS.amber,.45),1,[5,4]);
  const ring=[]; const ringR=Math.sin(state.axis[2] ? Math.acos(state.axis[2]) : 0)*1.34; const ringZ=Math.cos(Math.acos(state.axis[2]))*1.34;
  // The model's fixed obliquity keeps this ring at 23.44 degrees.
  for(let i=0;i<=96;i++){ const a=TAU*i/96; ring.push([ringR*Math.cos(a),ringR*Math.sin(a),ringZ]); }
  if(opts.showCone){
  ctx.save(); ctx.fillStyle=hexAlpha(COLORS.cyan,.035);
  for(let i=0;i<96;i+=4){ const a=project([0,0,0],w,h,camera), b=project(ring[i],w,h,camera), c=project(ring[i+4],w,h,camera); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  line3(ctx,ring,w,h,camera,hexAlpha(COLORS.cyan,.52),1,[4,4]);
  for(let i=0;i<96;i+=8) line3(ctx,[[0,0,0],ring[i]],w,h,camera,hexAlpha(COLORS.cyan,.18),1);
  }
  drawEarth(ctx,w,h,camera,state.axis,state.spinPhase,false);
  const axisTip=scale(state.axis,1.34);
  arrow3(ctx,[0,0,0],scale([0,0,1],1.62),w,h,camera,COLORS.amber,2,w<560?"":"ecliptic pole");
  arrow3(ctx,[0,0,0],axisTip,w,h,camera,COLORS.cyan,2.5,w<560?"":"celestial pole / L");
  line3(ctx,[[0,0,0],axisTip],w,h,camera,hexAlpha(COLORS.cyan,.3),1,[3,3]);
  if(w<560) drawMobilePoleLabels(ctx,w,h,camera,state,1.62,1.34);
  else { ctx.save(); ctx.font=`600 11px ${FONT}`; ctx.fillStyle=COLORS.amber; ctx.fillText("fixed ecliptic frame",18,64); ctx.fillStyle=COLORS.cyan; ctx.fillText("moving axis traces a 23.44° cone",18,81); ctx.restore(); }
  if(opts.showCone){
    const tangent=scale(state.precessionTangent,1.0);
    arrow3(ctx,axisTip,add(axisTip,scale(tangent,.4)),w,h,camera,COLORS.magenta,2,"dL/dt");
  }
  if(w>=560){ ctx.save(); ctx.font=`10px ${FONT}`; ctx.fillStyle=COLORS.muted; ctx.textAlign="right"; ctx.textBaseline="bottom"; ctx.fillText("daily spin illustrative · no historical pole date implied",w-16,h-14); ctx.restore(); }
}

function ellipsoidLines(axis) {
  const basis = (()=>{ let e1=cross([0,0,1],axis); if(length(e1)<1e-6)e1=[1,0,0]; e1=normalize(e1); return {e1,e2:normalize(cross(axis,e1))}; })();
  const out=[]; const a=1.08, c=.76;
  for(let j=0;j<5;j++){
    const lat=-Math.PI/2+j*Math.PI/4, rr=a*Math.cos(lat), zz=c*Math.sin(lat), pts=[];
    for(let i=0;i<=72;i++){ const q=TAU*i/72; pts.push(add(add(scale(basis.e1,rr*Math.cos(q)),scale(basis.e2,rr*Math.sin(q))),scale(axis,zz))); }
    out.push(pts);
  }
  for(let j=0;j<6;j++){
    const q=TAU*j/6, pts=[];
    for(let i=0;i<=72;i++){ const lat=-Math.PI/2+Math.PI*i/72; pts.push(add(add(scale(basis.e1,a*Math.cos(lat)*Math.cos(q)),scale(basis.e2,a*Math.cos(lat)*Math.sin(q))),scale(axis,c*Math.sin(lat)))); }
    out.push(pts);
  }
  return out;
}

const CONTINENT_PATCHES = [
  [[70,-165],[60,-145],[57,-132],[49,-125],[40,-124],[30,-115],[23,-110],[16,-96],[9,-82],[19,-87],[22,-97],[29,-96],[30,-82],[25,-80],[35,-76],[45,-64],[52,-56],[59,-65],[55,-82],[68,-95],[72,-125]],
  [[12,-72],[8,-60],[4,-51],[-6,-35],[-16,-39],[-24,-46],[-35,-54],[-54,-68],[-46,-75],[-25,-70],[-5,-81],[4,-78]],
  [[36,-6],[35,10],[32,22],[31,32],[15,42],[12,51],[2,43],[-12,40],[-26,33],[-35,20],[-28,16],[-14,12],[4,9],[5,-8],[15,-17],[28,-13]],
  [[36,-9],[44,-9],[48,-5],[51,4],[58,6],[71,25],[60,32],[56,28],[50,35],[42,29],[37,23],[45,14],[42,9]],
  [[70,35],[75,85],[70,130],[64,177],[52,155],[48,135],[36,129],[23,120],[10,108],[5,101],[21,98],[7,78],[25,67],[12,44],[31,35],[42,45],[52,40]],
  [[-11,132],[-12,142],[-20,148],[-28,153],[-38,146],[-39,135],[-32,115],[-22,114],[-15,124]]
];

function earthBasis(axis,spinPhase) {
  let e1=cross([0,0,1],axis); if(length(e1)<1e-6)e1=[1,0,0]; e1=normalize(e1);
  const e2=normalize(cross(axis,e1));
  return { m1:normalize(add(scale(e1,Math.cos(spinPhase)),scale(e2,Math.sin(spinPhase)))), m2:normalize(cross(axis,normalize(add(scale(e1,Math.cos(spinPhase)),scale(e2,Math.sin(spinPhase)))))) };
}

function earthSurfacePoint(axis,basis,latDeg,lonDeg,radius=.76) {
  const lat=latDeg*Math.PI/180, lon=lonDeg*Math.PI/180, cl=Math.cos(lat);
  return add(scale(axis,radius*Math.sin(lat)),add(scale(basis.m1,radius*cl*Math.cos(lon)),scale(basis.m2,radius*cl*Math.sin(lon))));
}

function drawVisibleEarthCurve(ctx,points,w,h,camera,color,width=1,dash=[]) {
  let segment=[];
  const flush=()=>{if(segment.length>1)line3(ctx,segment,w,h,camera,color,width,dash);segment=[];};
  points.forEach(v=>{if(project(v,w,h,camera).depth>.005)segment.push(v);else flush();}); flush();
}

function drawContinents(ctx,w,h,camera,axis,basis,center,corePx) {
  ctx.save(); ctx.beginPath(); ctx.arc(center.x,center.y,corePx,0,TAU); ctx.clip();
  CONTINENT_PATCHES.forEach((patch,index)=>{
    const points=patch.map(([lat,lon])=>earthSurfacePoint(axis,basis,lat,lon,.765));
    if(points.reduce((sum,v)=>sum+project(v,w,h,camera).depth,0)/points.length<=0) return;
    const projected=points.map(v=>project(v,w,h,camera));
    ctx.beginPath(); projected.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
    ctx.fillStyle=index%2?"rgba(78,139,126,.58)":"rgba(87,157,133,.5)"; ctx.fill();
    ctx.strokeStyle="rgba(147,210,179,.42)"; ctx.lineWidth=0.7; ctx.stroke();
  });
  ctx.restore();
}

function drawEarth(ctx,w,h,camera,axis,spinPhase=0,showAxisLabel=true) {
  const c=project([0,0,0],w,h,camera), r=camera.zoom*Math.min(w,h)*.28;
  const cy=Math.cos(camera.yaw), sy=Math.sin(camera.yaw), cp=Math.cos(camera.pitch), sp=Math.sin(camera.pitch);
  const hx=[cy,-sy,0], vy=[sp*sy,sp*cy,-cp], delta=.76*.76-1.08*1.08;
  const ax=dot(hx,axis), ay=dot(vy,axis), sxx=1.08*1.08+delta*ax*ax, syy=1.08*1.08+delta*ay*ay, sxy=delta*ax*ay;
  const spread=Math.hypot(sxx-syy,2*sxy), major=Math.sqrt((sxx+syy+spread)/2)*r, minor=Math.sqrt((sxx+syy-spread)/2)*r, angle=.5*Math.atan2(2*sxy,sxx-syy);
  const corePx=.76*r, basis=earthBasis(axis,spinPhase);
  ctx.save(); ctx.fillStyle="rgba(255,204,102,.14)"; ctx.strokeStyle="rgba(255,204,102,.56)"; ctx.lineWidth=1.2; ctx.beginPath(); ctx.ellipse(c.x,c.y,major,minor,angle,0,TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  ellipsoidLines(axis).forEach((pts,i)=>line3(ctx,pts,w,h,camera,i<5?hexAlpha(COLORS.cyan,.42):hexAlpha(COLORS.borderStrong,.5),i===0?1.2:.8));
  const grd=ctx.createRadialGradient(c.x-corePx*.35,c.y-corePx*.45,2,c.x,c.y,corePx*1.15); grd.addColorStop(0,"#2b6686"); grd.addColorStop(.72,"#17445e"); grd.addColorStop(1,"#0a2334");
  ctx.save(); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(c.x,c.y,corePx,0,TAU); ctx.fill(); ctx.strokeStyle="rgba(112,205,224,.62)"; ctx.lineWidth=1.1; ctx.stroke(); ctx.restore();
  drawContinents(ctx,w,h,camera,axis,basis,c,corePx);
  const outerEquator=[]; for(let i=0;i<=96;i++){const q=TAU*i/96;outerEquator.push(add(scale(basis.m1,1.08*Math.cos(q)),scale(basis.m2,1.08*Math.sin(q))));}
  drawVisibleEarthCurve(ctx,outerEquator,w,h,camera,"rgba(255,204,102,.75)",1.5);
  [-.16,.16].forEach(offset=>drawVisibleEarthCurve(ctx,parallel3(axis,offset,1.08),w,h,camera,"rgba(255,204,102,.38)",.9,[3,3]));
  const m1=basis.m1;
  const meridian=[]; for(let i=0;i<=72;i++){ const lat=-Math.PI/2+Math.PI*i/72; meridian.push(add(scale(m1,1.09*Math.cos(lat)),scale(axis,.77*Math.sin(lat)))); }
  drawVisibleEarthCurve(ctx,meridian,w,h,camera,hexAlpha(COLORS.magenta,.8),1.3);
  if(showAxisLabel) arrow3(ctx,scale(axis,-1.32),scale(axis,1.32),w,h,camera,COLORS.cyan,2,"spin axis");
  ctx.save(); ctx.font=`10px ${FONT}`; ctx.fillStyle=COLORS.amber; ctx.fillText("bulge exaggerated",c.x-r*.95,c.y+Math.max(major,corePx)+14); ctx.restore();
}

function drawMoon(ctx,w,h,camera,v,ghost=false,color=COLORS.cyan) {
  const p=project(v,w,h,camera); const r=ghost?7:9; ctx.save(); ctx.fillStyle=ghost?hexAlpha(color,.12):color; ctx.strokeStyle=ghost?hexAlpha(color,.6):COLORS.white; ctx.lineWidth=ghost?1:1.5; ctx.setLineDash(ghost?[4,3]:[]); ctx.beginPath(); ctx.arc(p.x,p.y,r,0,TAU); ghost?ctx.stroke():ctx.fill(); ctx.restore();
}

function fill3(ctx,points,w,h,camera,fill,stroke=null,width=1,dash=[]) {
  if(!points.length) return;
  ctx.save(); ctx.fillStyle=fill; if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);}
  ctx.beginPath(); points.forEach((v,i)=>{const p=project(v,w,h,camera);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}); ctx.closePath(); ctx.fill(); if(stroke)ctx.stroke(); ctx.restore();
}

function drawTorqueReferencePlanes(ctx,w,h,camera,state,mobile) {
  const eclipticNormal=[0,0,1], k=state.lunarOrbitNormal, orbitRadius=2.65;
  const ecliptic=circle3(eclipticNormal,orbitRadius), orbit=circle3(k,orbitRadius);
  fill3(ctx,ecliptic,w,h,camera,"rgba(255,204,102,.025)");
  line3(ctx,ecliptic,w,h,camera,hexAlpha(COLORS.amber,.5),1,[6,5]);
  fill3(ctx,orbit,w,h,camera,"rgba(86,199,217,.025)");
  line3(ctx,orbit,w,h,camera,hexAlpha(COLORS.cyan,.65),1.3);
  const equator=circle3(state.axis,1.25);
  line3(ctx,equator,w,h,camera,"rgba(203,208,214,.6)",1,[4,4]);
  if(!mobile){
    label3(ctx,"ecliptic",[0,-orbitRadius,0],w,h,camera,COLORS.amber,8,14);
    label3(ctx,"Moon orbit",[-orbitRadius,0,0],w,h,camera,COLORS.cyan,8,-14);
    label3(ctx,"equator ⟂ L",scale(normalize(cross(eclipticNormal,state.axis)),1.25),w,h,camera,"#cbd0d6",8,-8);
  } else {
    ctx.save();ctx.font=`11px ${FONT}`;ctx.textAlign="left";ctx.textBaseline="top";
    ctx.fillStyle=COLORS.amber;ctx.fillText("Amber: ecliptic plane",18,122);
    ctx.fillStyle=COLORS.cyan;ctx.fillText("Cyan: Moon orbit · inclined 5.1°",18,139);
    ctx.fillStyle="#cbd0d6";ctx.fillText("Gray ring: equator ⟂ L",18,156);ctx.restore();
  }
  const kTip=scale(k,1.45), eTip=scale(eclipticNormal,1.7);
  line3(ctx,[[0,0,0],eTip],w,h,camera,hexAlpha(COLORS.amber,.75),1.2,[4,3]);
  line3(ctx,[[0,0,0],kTip],w,h,camera,hexAlpha(COLORS.cyan,.85),1.3,[4,3]);
  label3(ctx,mobile?"ecliptic normal":"ecliptic normal",eTip,w,h,camera,COLORS.amber,-85,-12);
  label3(ctx,"lunar normal k",kTip,w,h,camera,COLORS.cyan,-92,10);
  const angle=Math.acos(Math.max(-1,Math.min(1,dot(eclipticNormal,state.axis))));
  const toward=normalize([state.axis[0],state.axis[1],0]), arc=[];
  for(let i=0;i<=32;i++){const a=angle*i/32;arc.push(scale(add(scale(eclipticNormal,Math.cos(a)),scale(toward,Math.sin(a))),.95));}
  line3(ctx,arc,w,h,camera,hexAlpha(COLORS.amber,.9),1.5);
  label3(ctx,"23.44°",arc[16],w,h,camera,COLORS.amber,8,-8);
  const inclination=Math.acos(k[2]), lunarArc=[];
  for(let i=0;i<=20;i++){const a=inclination*i/20;lunarArc.push([0,orbitRadius*Math.cos(a),orbitRadius*Math.sin(a)]);}
  line3(ctx,lunarArc,w,h,camera,COLORS.cyan,2);
  label3(ctx,"5.1°",lunarArc[10],w,h,camera,COLORS.cyan,8,10);
}

function drawTorqueAverageInset(ctx,w,h,state) {
  const insetW=w<560?Math.min(280,w-20):340, insetH=w<560?220:260;
  const ix=w-insetW-10, iy=w<560?h-insetH-12:30, samples=24;
  const axis=normalize(state.axis), horizontal=normalize(state.lunarMeanDirection), vertical=normalize(cross(axis,horizontal));
  const vectors=[]; let average=[0,0,0];
  for(let i=0;i<samples;i++){
    const angle=360*i/samples, sampled=stateAt(state.year,angle).moonTorque;
    vectors.push(sampled); average=add(average,sampled);
  }
  average=scale(average,1/samples);
  const xy=v=>({x:dot(v,horizontal),y:dot(v,vertical)}), sampleXY=vectors.map(xy), meanXY=xy(average), nowXY=xy(state.moonTorque);
  let maxX=0,maxY=0; sampleXY.forEach(p=>{maxX=Math.max(maxX,Math.abs(p.x));maxY=Math.max(maxY,Math.abs(p.y));});
  const cy=iy+insetH*.64, rx=insetW-78, ry=insetH*.24;
  const pxPerUnit=Math.min(rx/Math.max(maxX,1e-8),ry/Math.max(maxY,1e-8))*.88;
  const cx=ix+insetW*.5-meanXY.x*pxPerUnit;
  const screen=p=>({x:cx+p.x*pxPerUnit,y:cy-p.y*pxPerUnit});
  const arrow2=(from,to,color,width,label)=>{
    const dx=to.x-from.x,dy=to.y-from.y,m=Math.hypot(dx,dy)||1,ux=dx/m,uy=dy/m,nx=-uy,ny=ux,head=Math.max(5,Math.min(9,m*.18));
    ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(to.x,to.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(to.x,to.y); ctx.lineTo(to.x-ux*head+nx*head*.45,to.y-uy*head+ny*head*.45); ctx.lineTo(to.x-ux*head-nx*head*.45,to.y-uy*head-ny*head*.45); ctx.closePath(); ctx.fill();
    if(label){ctx.font=`600 9px ${FONT}`;ctx.textAlign=to.x>=from.x?"left":"right";ctx.textBaseline="middle";ctx.fillText(label,to.x+(to.x>=from.x?5:-5),to.y+(to.y>=from.y?8:-8));} ctx.restore();
  };
  ctx.save(); ctx.fillStyle="rgba(13,16,21,.9)"; ctx.strokeStyle=hexAlpha(COLORS.borderStrong,.8); ctx.lineWidth=1; ctx.beginPath(); ctx.rect(ix,iy,insetW,insetH); ctx.fill(); ctx.stroke();
  ctx.font=`600 ${w<560?11:12}px ${FONT}`; ctx.fillStyle=COLORS.text; ctx.textAlign="left"; ctx.textBaseline="top"; ctx.fillText(w<560?"Torque plane ⟂ L":"Torque plane (perpendicular to L)",ix+8,iy+6);
  ctx.strokeStyle=hexAlpha(COLORS.borderStrong,.45); ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(cx-10,cy); ctx.lineTo(ix+insetW-12,cy); ctx.moveTo(cx,cy-ry); ctx.lineTo(cx,cy+ry); ctx.stroke(); ctx.setLineDash([]);
  ctx.font=`10px ${FONT}`; ctx.fillStyle=COLORS.muted; ctx.textAlign="left"; ctx.fillText(`${samples} equal-time samples`,ix+8,iy+25); ctx.textAlign="right"; ctx.fillText("view from +L",ix+insetW-7,iy+25);
  ctx.font=`10px ${FONT}`; ctx.textAlign="center"; ctx.fillText("horizontal: lunar mean torque",ix+insetW*.5,iy+insetH-24); ctx.fillText("vertical: perpendicular component",ix+insetW*.5,iy+insetH-14);
  ctx.strokeStyle=hexAlpha(COLORS.magenta,.3); ctx.lineWidth=1; ctx.beginPath(); sampleXY.forEach((p,i)=>{const q=screen(p);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);}); const first=screen(sampleXY[0]); ctx.lineTo(first.x,first.y); ctx.stroke();
  sampleXY.forEach(p=>{const q=screen(p);ctx.strokeStyle=hexAlpha(COLORS.magenta,.22);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.fillStyle=hexAlpha(COLORS.magenta,.42);ctx.beginPath();ctx.arc(q.x,q.y,2,0,TAU);ctx.fill();});
  arrow2({x:cx,y:cy},screen(nowXY),COLORS.magenta,2,"now"); arrow2({x:cx,y:cy},screen(meanXY),COLORS.green,2,"mean of tips");
  ctx.font=`10px ${FONT}`; ctx.textAlign="left"; ctx.fillStyle=COLORS.muted; ctx.fillText("sideways components cancel",ix+8,iy+43); ctx.fillText("forward components add",ix+8,iy+57); ctx.restore();
}

function drawForce(ctx,w,h,camera,state,opts) {
  const mobile=w<560;
  drawTorqueReferencePlanes(ctx,w,h,camera,state,mobile);
  drawEarth(ctx,w,h,camera,state.axis,state.spinPhase);
  const moon=scale(state.moon,2.65), ghost=scale(state.moon,-2.65); drawMoon(ctx,w,h,camera,moon,false); drawMoon(ctx,w,h,camera,ghost,true);
  label3(ctx,"Moon",moon,w,h,camera,COLORS.cyan,10,-8); label3(ctx,mobile?"ghost":"opposite position",ghost,w,h,camera,COLORS.muted,10,mobile?18:-8);
  line3(ctx,[[0,0,0],moon],w,h,camera,hexAlpha(COLORS.cyan,.28),1,[4,3]);
  line3(ctx,[[0,0,0],ghost],w,h,camera,hexAlpha(COLORS.cyan,.2),1,[3,4]);
  const fp=state.moonForcePoints;
  const radiusColor="#cbd0d6";
  arrow3(ctx,[0,0,0],fp.near,w,h,camera,radiusColor,1.3);
  arrow3(ctx,[0,0,0],fp.far,w,h,camera,radiusColor,1.3);
  arrow3(ctx,fp.near,add(fp.near,fp.nearForce),w,h,camera,COLORS.cyan,2,"F₁");
  arrow3(ctx,fp.far,add(fp.far,fp.farForce),w,h,camera,hexAlpha(COLORS.cyan,.7),1.5,"F₂");
  label3(ctx,"r₁",scale(fp.near,.6),w,h,camera,radiusColor,5,-9);
  label3(ctx,"r₂",scale(fp.far,.6),w,h,camera,radiusColor,5,-9);
  if(opts.showSun){
    const sun=scale(state.sun,3.2); drawMoon(ctx,w,h,camera,sun,false,COLORS.amber); label3(ctx,"Sun",sun,w,h,camera,COLORS.amber,10,-8);
    const sfp=state.sunForcePoints, sunForceScale=.7; arrow3(ctx,sfp.near,add(sfp.near,scale(sfp.nearForce,sunForceScale)),w,h,camera,COLORS.amber,1.5); arrow3(ctx,sfp.far,add(sfp.far,scale(sfp.farForce,sunForceScale)),w,h,camera,hexAlpha(COLORS.amber,.6),1);
  }
  if(opts.showTorque){
    const instantaneous=fp.torque, average=state.averageMoonTorqueFromForces, torqueGain=3.4;
    const instantTip=scale(instantaneous,torqueGain), averageTip=scale(average,torqueGain);
    if(length(instantaneous)>1e-8){ arrow3(ctx,[0,0,0],instantTip,w,h,camera,COLORS.magenta,2.5,""); label3(ctx,"dL/dt (now)",instantTip,w,h,camera,COLORS.magenta,10,-12); }
    else label3(ctx,"dL/dt = 0",[0,0,0],w,h,camera,COLORS.magenta,10,-10);
    if(length(average)>1e-8){ arrow3(ctx,[0,0,0],averageTip,w,h,camera,COLORS.green,2,""); label3(ctx,"⟨dL/dt⟩",averageTip,w,h,camera,COLORS.green,10,14); }
    { ctx.save(); ctx.font=`11px ${FONT}`; ctx.fillStyle=COLORS.magenta; ctx.fillText("τ_inst = dL/dt (now)",18,42); ctx.fillStyle=COLORS.green; ctx.fillText("τ_avg = ⟨dL/dt⟩ (orbit average)",18,59); ctx.fillStyle=radiusColor; ctx.fillText("gray r · cyan F",18,76); ctx.restore(); }
  }
  ctx.save(); ctx.font=`10px ${FONT}`; ctx.fillStyle=COLORS.muted; ctx.fillText(mobile?"τ = dL/dt (Moon) · gray r · cyan F":"τ = dL/dt (Moon) · gray r · cyan F · schematic scale",18,22); ctx.restore();
  if(opts.showTorque) drawTorqueAverageInset(ctx,w,h,state);
}

function drawEquinoxTrail(ctx,w,h,camera) {
  const pts=[]; for(let i=0;i<=120;i++){ const a=TAU*i/120; pts.push([Math.cos(a)*1.58,Math.sin(a)*1.58,0]); }
  line3(ctx,pts,w,h,camera,hexAlpha(COLORS.amber,.35),1,[3,4]);
}

function drawMobilePoleLabels(ctx,w,h,camera,state,epRadius=1.58,cpRadius=1.58) {
  const ep=project(scale([0,0,1],epRadius),w,h,camera), cp=project(scale(state.axis,cpRadius),w,h,camera);
  const leftX=64, rightX=w-64, leftY=58, rightY=80;
  ctx.save(); ctx.font=`600 11px ${FONT}`; ctx.lineWidth=1;
  ctx.strokeStyle=hexAlpha(COLORS.amber,.65); ctx.fillStyle=COLORS.amber; ctx.textAlign="left"; ctx.textBaseline="middle";
  ctx.beginPath(); ctx.moveTo(ep.x,ep.y); ctx.lineTo(leftX,leftY); ctx.stroke(); ctx.fillText("ecliptic pole",10,leftY);
  ctx.strokeStyle=hexAlpha(COLORS.cyan,.75); ctx.fillStyle=COLORS.cyan; ctx.textAlign="right";
  ctx.beginPath(); ctx.moveTo(cp.x,cp.y); ctx.lineTo(rightX,rightY); ctx.stroke(); ctx.fillText("celestial pole",w-10,rightY);
  ctx.restore();
}

function drawSky(ctx,w,h,camera,state,opts) {
  drawStars(ctx,w,h,camera);
  if(opts.showGrid){
    line3(ctx,circle3([0,0,1],1.58),w,h,camera,hexAlpha(COLORS.amber,.75),1.5,[5,4]);
    line3(ctx,circle3(state.axis,1.58),w,h,camera,hexAlpha(COLORS.cyan,.8),1.5,[4,3]);
    [-.55,.55].forEach(d=>line3(ctx,parallel3(state.axis,d,1.58),w,h,camera,hexAlpha(COLORS.cyan,.27),1,[3,4]));
    let e1=cross([0,0,1],state.axis); if(length(e1)<1e-6)e1=[1,0,0]; e1=normalize(e1);
    const e2=normalize(cross(state.axis,e1));
    [e1,e2].forEach(m=>line3(ctx,circle3(m,1.58),w,h,camera,hexAlpha(COLORS.cyan,.24),1,[3,4]));
    drawEquinoxTrail(ctx,w,h,camera);
  }
  arrow3(ctx,[0,0,0],scale([0,0,1],1.58),w,h,camera,COLORS.amber,2,w<560?"":"ecliptic pole");
  arrow3(ctx,[0,0,0],scale(state.axis,1.58),w,h,camera,COLORS.cyan,2.5,w<560?"":"celestial pole");
  point3(ctx,scale(state.equinox,1.58),w,h,camera,COLORS.amber,5);
  label3(ctx,"vernal equinox",scale(state.equinox,1.58),w,h,camera,COLORS.amber,10,9);
  ctx.save(); ctx.font=`11px ${FONT}`; ctx.fillStyle=COLORS.muted; ctx.fillText("fixed stars",18,22); if(w>=560){ctx.font=`10px ${FONT}`;ctx.fillText("cyan grid: celestial equator · amber grid: ecliptic",18,39);} ctx.restore();
  if(w<560) drawMobilePoleLabels(ctx,w,h,camera,state);
  else { ctx.save(); ctx.font=`10px ${FONT}`; ctx.fillStyle=COLORS.muted; ctx.textAlign="right"; ctx.textBaseline="bottom"; ctx.fillText("RA/Dec is a moving reference frame; stellar proper motion is omitted",w-16,h-14); ctx.restore(); }
}

function drawTimeline(ctx,w,h,state) {
  if(state.step===1){drawTorqueTimeline(ctx,w,h,state);return;}
  ctx.fillStyle=COLORS.canvas; ctx.fillRect(0,0,w,h);
  const lunar=state.step===1, max=lunar?LUNAR_ORBIT_DAYS:PRECESSION_YEARS, value=lunar?state.lunarDay:state.year;
  const unit=lunar?" d":" y", format=n=>lunar?Number(n.toFixed(3)).toLocaleString():Math.round(n).toLocaleString();
  const left=50,right=w-20,y=h*.52; ctx.strokeStyle=hexAlpha(COLORS.borderStrong,.75); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();
  ctx.font=`9px ${FONT}`; ctx.textAlign="center"; ctx.textBaseline="top";
  for(let i=0;i<=4;i++){
    const x=left+(right-left)*i/4; ctx.strokeStyle=hexAlpha(COLORS.borderStrong,.8); ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(x,y+8); ctx.stroke(); ctx.fillStyle=COLORS.muted; ctx.textAlign=i===0?"left":i===4?"right":"center"; ctx.fillText(format(max*i/4)+unit,x,y+13);
  }
  const x=left+(right-left)*value/max; ctx.strokeStyle=COLORS.cyan; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(x,y-30); ctx.lineTo(x,y+8); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=COLORS.cyan; ctx.beginPath(); ctx.arc(x,y,5,0,TAU); ctx.fill();
  ctx.font=`600 10px ${FONT}`; ctx.textBaseline="bottom"; ctx.textAlign="left"; ctx.fillStyle=COLORS.text; ctx.fillText(lunar?(w<560?"Lunar orbit · days":"lunar orbit · days from reference position"):(w<560?"Years from reference":"precession phase · years from reference phase"),left,y-34); ctx.textAlign="right"; ctx.fillStyle=COLORS.cyan; ctx.fillText(format(value)+unit,right,y-34);
}

export function createPrecessionRenderer(mainCanvas, timelineCanvas) {
  const mainCtx=mainCanvas.getContext("2d"); const timelineCtx=timelineCanvas.getContext("2d");
  const camera={yaw:-.55,pitch:.38,zoom:1};
  function resizeOne(canvas,ctx){ const r=canvas.getBoundingClientRect(); const dpr=window.devicePixelRatio||1; const w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height)); canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); return {w,h}; }
  function resize(){ return {main:resizeOne(mainCanvas,mainCtx),timeline:resizeOne(timelineCanvas,timelineCtx)}; }
  function draw(state,opts){
    const w=mainCanvas.clientWidth||mainCanvas.width/(window.devicePixelRatio||1), h=mainCanvas.clientHeight||mainCanvas.height/(window.devicePixelRatio||1); const tw=timelineCanvas.clientWidth||w, th=timelineCanvas.clientHeight||120; const forceCamera=Object.assign({},camera,{zoom:camera.zoom*.55}); drawBackground(mainCtx,w,h); if(state.step===0) drawCone(mainCtx,w,h,camera,state,opts); else if(state.step===1) drawForce(mainCtx,w,h,forceCamera,state,opts); else drawSky(mainCtx,w,h,camera,state,opts); drawTimeline(timelineCtx,tw,th,state);
  }
  function rotate(dx,dy){ camera.yaw+=dx*.008; camera.pitch=Math.max(-1.15,Math.min(1.15,camera.pitch+dy*.008)); }
  function zoom(delta){ camera.zoom=Math.max(.65,Math.min(1.65,camera.zoom*(delta>0?.92:1.08))); }
  return { resize, draw, rotate, zoom, camera };
}
