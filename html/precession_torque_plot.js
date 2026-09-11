import { LUNAR_ORBIT_DAYS, stateAt, lunarStateAt, cross, dot, normalize } from './precession_model.js?v=lunar-51';

const FONT = '"SF Pro Text", "Helvetica Neue", Arial, sans-serif';

// Integrate the same instantaneous lunar torque used by the 3D diagram.
export function torqueOrbitSeries(year, count=256) {
  const base=stateAt(year), axes=[base.lunarMeanDirection,normalize(cross(base.axis,base.lunarMeanDirection))];
  const samples=Array.from({length:count+1},(_,i)=>{
    const day=LUNAR_ORBIT_DAYS*i/count;
    const torque=stateAt(year,lunarStateAt(day).angleDeg).moonTorque;
    return {day, values:axes.map(axis=>dot(torque,axis))};
  });
  const sums=[0,0];
  samples.forEach((sample,i)=>{
    if(i) for(let j=0;j<2;j++) sums[j]+=(samples[i-1].values[j]+sample.values[j])/2;
    sample.running=i?sums.map(v=>v/i):sample.values.slice();
  });
  const mean=sums.map(v=>v/count), unit=Math.hypot(...mean)||1;
  samples.forEach(sample=>{sample.values=sample.values.map(v=>v/unit);sample.running=sample.running.map(v=>v/unit);});
  return {samples,mean:mean.map(v=>Math.abs(v/unit)<1e-12?0:v/unit)};
}

let cachedYear, cachedSeries;
export function drawTorqueTimeline(ctx,w,h,state) {
  if(cachedYear!==state.year){cachedYear=state.year;cachedSeries=torqueOrbitSeries(state.year);}
  const {samples,mean}=cachedSeries;
  const left=50,right=w-20,top=57,bottom=h-28,gap=28,rowH=(bottom-top-gap)/2;
  const x=day=>left+(right-left)*day/LUNAR_ORBIT_DAYS;
  const colors={instant:'#d17bff',running:'#7fa8ff',mean:'#6bd69b',muted:'#8b98a8',grid:'rgba(48,59,71,.35)',cursor:'#56c7d9'};
  ctx.fillStyle='#0d1015';ctx.fillRect(0,0,w,h);ctx.font='10px '+FONT;ctx.textBaseline='middle';
  const legend=[['now',colors.instant],['mean so far',colors.running],['orbit mean',colors.mean]];
  legend.forEach(([label,color],i)=>{const lx=left+i*(right-left)/3;ctx.strokeStyle=color;ctx.setLineDash(i===2?[5,3]:[]);ctx.beginPath();ctx.moveTo(lx,14);ctx.lineTo(lx+12,14);ctx.stroke();ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(label,lx+16,14);});ctx.setLineDash([]);
  ctx.fillStyle=colors.muted;ctx.textAlign='left';ctx.fillText('Components of lunar dL/dt',left,32);ctx.textAlign='right';ctx.fillStyle=colors.cursor;ctx.fillText(Number(state.lunarDay.toFixed(3))+' d',right,32);
  for(let j=0;j<2;j++){
    const rowTop=top+j*(rowH+gap), lo=j===0?-.15:-1.3, hi=j===0?2.2:1.3;
    const y=v=>rowTop+rowH*(hi-v)/(hi-lo);
    ctx.strokeStyle='rgba(48,59,71,.6)';ctx.lineWidth=1;ctx.strokeRect(left,rowTop,right-left,rowH);
    for(let k=1;k<4;k++){ctx.strokeStyle=colors.grid;ctx.beginPath();ctx.moveTo(x(LUNAR_ORBIT_DAYS*k/4),rowTop);ctx.lineTo(x(LUNAR_ORBIT_DAYS*k/4),rowTop+rowH);ctx.stroke();}
    ctx.textAlign='left';ctx.fillStyle='#e7edf3';ctx.fillText(j===0?'Along the green average arrow':'Perpendicular to the green arrow',left,rowTop-9);
    for(const tick of j===0?[0,1,2]:[-1,0,1]){ctx.strokeStyle=colors.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y(tick));ctx.lineTo(right,y(tick));ctx.stroke();ctx.fillStyle=colors.muted;ctx.textAlign='right';ctx.fillText(String(tick),left-8,y(tick));}
    ctx.strokeStyle=colors.mean;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(left,y(mean[j]));ctx.lineTo(right,y(mean[j]));ctx.stroke();ctx.setLineDash([]);
    ctx.save();ctx.beginPath();ctx.rect(left,rowTop,right-left,rowH);ctx.clip();
    ctx.strokeStyle=colors.instant;ctx.lineWidth=1.8;ctx.beginPath();samples.forEach((s,i)=>i?ctx.lineTo(x(s.day),y(s.values[j])):ctx.moveTo(x(s.day),y(s.values[j])));ctx.stroke();
    ctx.strokeStyle=colors.running;ctx.lineWidth=1.8;ctx.beginPath();
    for(let i=0;i<samples.length;i++){
      const s=samples[i];
      if(s.day>state.lunarDay){const prev=samples[i-1],f=(state.lunarDay-prev.day)/(s.day-prev.day);ctx.lineTo(x(state.lunarDay),y(prev.running[j]+f*(s.running[j]-prev.running[j])));break;}
      if(i)ctx.lineTo(x(s.day),y(s.running[j]));else ctx.moveTo(x(s.day),y(s.running[j]));
    }ctx.stroke();ctx.restore();
    const index=state.lunarDay/LUNAR_ORBIT_DAYS*(samples.length-1), i=Math.min(samples.length-2,Math.floor(index)), f=index-i;
    const value=samples[i].values[j]+f*(samples[i+1].values[j]-samples[i].values[j]);
    ctx.strokeStyle=colors.cursor;ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x(state.lunarDay),rowTop);ctx.lineTo(x(state.lunarDay),rowTop+rowH);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=colors.instant;ctx.beginPath();ctx.arc(x(state.lunarDay),y(value),3,0,2*Math.PI);ctx.fill();
  }
  ctx.font='9px '+FONT;ctx.fillStyle=colors.muted;
  for(let i=0;i<=4;i++){const day=LUNAR_ORBIT_DAYS*i/4;ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(Number(day.toFixed(3))+' d',x(day),h-12);}
}
