(function(global){
  "use strict";

  // These views are deliberately a synthetic, coplanar teaching construction.  They
  // reuse the same focus-centred ellipse convention as the Harmonic tab: a is the
  // semi-major axis, while r is the instantaneous Sun--planet distance.
  const TAU = Math.PI * 2;
  const DEG = 180 / Math.PI;
  let EARTH, MARS, MARS_PERIOD, shared;
  function configure(helpers){
    shared=helpers;
    EARTH=helpers.planets.find(p=>p.key==='earth');
    MARS=helpers.planets.find(p=>p.key==='mars');
    MARS_PERIOD=helpers.periodDays(MARS.a);
  }
  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
  function norm(v){ return Math.hypot(v.x, v.y) || 1; }
  function cross(a,b){ return a.x*b.y - a.y*b.x; }
  function add(a,b){ return {x:a.x+b.x, y:a.y+b.y}; }
  function sub(a,b){ return {x:a.x-b.x, y:a.y-b.y}; }
  function mul(a,s){ return {x:a.x*s, y:a.y*s}; }
  function unit(a){ const n=norm(a); return {x:a.x/n,y:a.y/n}; }

  function orbitAt(a,e,nu){
    const c = Math.cos(nu), s = Math.sin(nu);
    const p = a*(1-e*e);
    const r = p/(1+e*c);
    return { x:r*c, y:r*s, r:r, nu:nu };
  }
  function earthAtTime(t){ return shared.computeOrbit(EARTH.a,EARTH.e,t); }
  function outerState(p){
    const epoch = Number(p.epochDay)||0;
    const mars = orbitAt(MARS.a,MARS.e,(Number(p.marsNuDeg)||0)/DEG);
    const e1 = earthAtTime(epoch), e2 = earthAtTime(epoch+MARS_PERIOD);
    const d1 = unit(sub(mars,e1)), d2 = unit(sub(mars,e2));
    const ray = intersectRays(e1,d1,e2,d2);
    return { mars:mars, earth1:e1, earth2:e2, epoch:epoch, period:MARS_PERIOD,
      d1:d1,d2:d2, intersection:ray, baseline:Math.hypot(e2.x-e1.x,e2.y-e1.y),
      epsilon1:signedElongation(e1,mars),epsilon2:signedElongation(e2,mars),
      rActual:mars.r, rMeasured:ray&&ray.ok?Math.hypot(ray.point.x,ray.point.y):NaN };
  }
  function intersectRays(p1,d1,p2,d2){
    const den=cross(d1,d2), eps=1e-9;
    if(Math.abs(den)<eps) return {ok:false, reason:"parallel sightlines", point:null};
    const q=sub(p2,p1);
    const u=cross(q,d2)/den, v=cross(q,d1)/den;
    const point=add(p1,mul(d1,u));
    if(u < -1e-7 || v < -1e-7) return {ok:false, reason:"intersection lies behind an observer", point:point, u:u, v:v};
    return {ok:true,point:point,u:u,v:v};
  }

  function text(ctx, x,y,s,color,size,align){
    ctx.font=(size||10)+"px Inter, sans-serif"; ctx.fillStyle=color; ctx.textAlign=align||"left"; ctx.textBaseline="middle"; ctx.fillText(s,x,y);
  }
  function line(ctx,a,b,color,alpha,width,dash){
    ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=alpha==null?1:alpha; ctx.lineWidth=width||1.2;
    if(dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.restore();
  }
  function dotMark(ctx,p,r,color,alpha){ ctx.save(); ctx.fillStyle=color; ctx.globalAlpha=alpha==null?1:alpha; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,TAU); ctx.fill(); ctx.restore(); }
  function mapFactory(w,h,extent,H){
    const scale=(Math.min(w,w<650?h-90:h)/2-34)/extent, cx=w/2, cy=h/2+(w<650?25:0);
    const base=function(pt){ return {x:cx+pt.x*scale,y:cy-pt.y*scale}; };
    return {cx:cx,cy:cy,scale:scale,toScreen:H.viewToScreen(base,cx,cy), worldScale:H.viewScale(scale)};
  }
  function drawOrbit(ctx,to,a,e,color,alpha,width,dash,omega=0){
    ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;
    ctx.setLineDash(dash||[]);
    const rotated=p=>to({x:p.x*Math.cos(omega)-p.y*Math.sin(omega),y:p.x*Math.sin(omega)+p.y*Math.cos(omega)});
    shared.drawEllipsePath(ctx,rotated,a,e);ctx.restore();
  }
  function label(H,ctx,p,s,dir,color,size){ H.drawLabel(ctx,p.x,p.y,s,dir||{dx:0,dy:-1},{color:color,size:size||10,offset:8}); }

  function signedElongation(earth,planet){
    const difference=Math.atan2(planet.y-earth.y,planet.x-earth.x)-Math.atan2(-earth.y,-earth.x);
    return Math.atan2(Math.sin(difference),Math.cos(difference));
  }
  function angleArc(ctx,earth,sun,planet,color,name,radius=24){
    const a=Math.atan2(sun.y-earth.y,sun.x-earth.x),b=Math.atan2(planet.y-earth.y,planet.x-earth.x);
    const delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(earth.x,earth.y,radius,a,a+delta,delta<0);ctx.stroke();ctx.restore();
    if(name)text(ctx,earth.x+(radius+10)*Math.cos(a+delta/2),earth.y+(radius+10)*Math.sin(a+delta/2),name,color,10,'center');
  }
  function angleText(value){return (Math.abs(value)*DEG).toFixed(1)+'° '+(value>=0?'E':'W');}
  function drawOuter(ctx,w,h,state,C,H){
    const p=state.p, s=outerState(p), T=mapFactory(w,h,2.0,H), to=T.toScreen;
    const sun=to({x:0,y:0}), e1=to(s.earth1), e2=to(s.earth2), mars=to(s.mars);
    const st=H.layerStyle||function(){return {show:true,alpha:1,mul:1};};
    const ray=st("rays"), ptsStyle=st("points"), ell=st("ellipse");
    drawOrbit(ctx,to,EARTH.a,EARTH.e,C.green,0.48,1.2,[4,4]);
    if(ell.show) drawOrbit(ctx,to,MARS.a,MARS.e,C.coral,0.7,2);
    line(ctx,e1,e2,C.green,0.75,1,[4,4]);
    if(ray.show){
      line(ctx,e1,mars,C.magenta,0.9,1.8);line(ctx,e2,mars,C.cyan,0.9,1.8);
      line(ctx,e1,sun,C.amber,0.65,1,[4,4]);line(ctx,e2,sun,C.amber,0.65,1,[4,4]);
      angleArc(ctx,e1,sun,mars,C.magenta,'ε₁');angleArc(ctx,e2,sun,mars,C.cyan,'ε₂',34);
    }
    if(s.intersection && s.intersection.ok){ const q=to(s.intersection.point); dotMark(ctx,q,5,C.coral,1); line(ctx,sun,q,C.coral,0.85,2); }
    if(ptsStyle.show) (p.points||[]).forEach(function(o){ dotMark(ctx,to(o.point),4,C.green,0.9); });
    dotMark(ctx,sun,7,C.amber,1); dotMark(ctx,e1,6,C.green,1); dotMark(ctx,e2,6,C.green,1); dotMark(ctx,mars,6,C.coral,1);
    if(H.labelsOn()){
      label(H,ctx,sun,"Sun",{dx:-1,dy:-1},C.amber,10); label(H,ctx,e1,"Earth t₁ = Day "+s.epoch.toFixed(0),{dx:-1,dy:1},C.green,10); label(H,ctx,e2,"Earth t₂ = Day "+(s.epoch+s.period).toFixed(0),{dx:1,dy:1},C.green,10); label(H,ctx,mars,"Mars",{dx:1,dy:-1},C.coral,10);
      text(ctx,8,18,"1 · t₁ = Day "+s.epoch.toFixed(1)+" · ε₁ = "+angleText(s.epsilon1),C.magenta,11,"left");
      text(ctx,8,35,"2 · t₂ = Day "+(s.epoch+s.period).toFixed(1)+" · ε₂ = "+angleText(s.epsilon2),C.cyan,11,"left");
      text(ctx,8,52,"Second observation: one Mars year later",C.muted,10,"left");
      if(s.intersection.ok)text(ctx,w-8,w<650?72:20,"Inferred r = "+s.rMeasured.toFixed(3)+" AU",C.coral,11,"right");
      else text(ctx,w-8,w<650?72:20,"Parallel rays: distance undetermined",C.coral,10,"right");
      text(ctx,8,h-30,w<650?"ε: Sun–Earth–Mars angle; E/W of Sun":"Measured: Sun–Earth–Mars angles ε₁ and ε₂, and their dates (E/W specifies the side of the Sun)",C.muted,10,"left");
      text(ctx,8,h-15,"Known Earth positions + sight lines → Mars distance",C.muted,10,"left");
    }
    if((p.points||[]).length && w>=650) text(ctx,w-8,h-16,(p.points||[]).length+" reconstructed Mars points",C.green,9,"right");
  }

  function drawInnerEvents(ctx,w,h,state,C,H,events,fit){
    const body=shared.planets.find(p=>p.key===state.p.planet),color=C[body.color];
    const earthNow=earthAtTime(state.t),planetNow=shared.computeOrbit(body.a,body.e,state.t);
    const collected=state.p.collected||0,labels=H.labelsOn(),to=mapFactory(w,h,1.35,H).toScreen;
    const sun=to({x:0,y:0}),earth=to(earthNow),planet=to(planetNow);
    const rays=H.layerStyle('rays'),points=H.layerStyle('points'),fitted=fit&&H.layerStyle('fit').show;
    drawOrbit(ctx,to,EARTH.a,EARTH.e,C.green,0.4,1);
    drawOrbit(ctx,to,body.a,body.e,color,0.35,1);
    if(fitted)drawOrbit(ctx,to,fit.a,fit.e,color,0.95,2,null,fit.omega);
    const dateBoxes=[];
    for(let i=0;i<collected;i++){
      const o=events[i],e=to(o.earth),q=to(o.planet),last=i===collected-1;
      const d={x:Math.cos(o.angle),y:Math.sin(o.angle)};
      const far=to({x:o.earth.x+2.1*d.x,y:o.earth.y+2.1*d.y});
      if(rays.show){
        line(ctx,e,far,C.magenta,last?0.8:0.4,last?1.6:1,[4,4]);
        // A short Sun reference and angle remain with every saved observation.
        const towardsSun=unit(sub(sun,e));
        line(ctx,e,add(e,mul(towardsSun,40)),C.amber,0.55,1,[3,3]);
        angleArc(ctx,e,sun,q,C.magenta,'',14);
      }
      if(points.show){dotMark(ctx,e,3,C.green,0.8);dotMark(ctx,q,3,color,0.8);}
      if(labels){
        const name='Day '+o.t.toFixed(0)+' · '+(o.elongation*DEG).toFixed(1)+'°';
        const tx=clamp(e.x+(o.earth.x<0?-104:8),4,w-106),baseY=e.y+(o.earth.y<0?13:-13);
        let ty=baseY;
        for(const offset of [0,-14,14,-28,28,-42,42]){
          ty=clamp(baseY+offset,90,h-44);
          if(!dateBoxes.some(b=>Math.abs(b.y-ty)<12&&Math.abs(b.x-tx)<103))break;
        }
        dateBoxes.push({x:tx,y:ty});
        if(Math.abs(ty-baseY)>5)line(ctx,e,{x:tx+45,y:ty},C.green,0.3,0.7);
        text(ctx,tx,ty,name,C.green,9,'left');
      }
    }
    if(rays.show){line(ctx,earth,planet,C.cyan,0.8,1.6);line(ctx,earth,sun,C.amber,0.45,1,[4,4]);angleArc(ctx,earth,sun,planet,C.cyan,'ε');}
    dotMark(ctx,sun,7,C.amber);dotMark(ctx,earth,6,C.green);dotMark(ctx,planet,6,color);
    if(labels){
      label(H,ctx,sun,'Sun',{dx:-1,dy:1},C.amber);
      label(H,ctx,earth,'Earth now',{dx:earthNow.x<0?-1:1,dy:1},C.green);
      label(H,ctx,planet,body.name+' now',{dx:planetNow.x<0?-1:1,dy:-1},color);
      text(ctx,8,18,'Day '+state.t.toFixed(1)+' · live ε = '+angleText(signedElongation(earthNow,planetNow)),C.cyan,11,'left');
      text(ctx,8,35,collected+' greatest-elongation snapshots saved',C.magenta,10,'left');
      const last=events[collected-1];
      if(last&&state.t-last.t<3)text(ctx,8,52,'Snapshot added at Day '+last.t.toFixed(1),C.green,11,'left');
      if(fitted)text(ctx,w-8,w<650?70:18,'Recovered ellipse: a = '+fit.a.toFixed(3)+' AU, e = '+fit.e.toFixed(3),color,10,'right');
      text(ctx,8,h-30,'Cyan: live sight line · magenta: saved maxima',C.muted,10,'left');
      text(ctx,8,h-15,'Thin orbit: simulation · bold orbit: recovered fit',C.muted,10,'left');
    }
  }

  function axes(w,h){ return {plotL:44,plotR:w-10,plotT:30,plotB:h-30,plotW:Math.max(1,w-54),plotH:Math.max(1,h-60)}; }
  function drawInnerEventStrip(ctx,w,h,state,C,H,events,fit){
    const ax=axes(w,h), n=events.length, collected=clamp(Math.round(state.p.collected||0),0,n), idx=clamp(Math.round(state.p.eventIndex||0),0,Math.max(0,n-1));
    const t0=0, t1=n?events[n-1].t+20:1;
    const x=function(i){return ax.plotL+(n<=1?0.5:(events[i].t-t0)/(t1-t0||1))*ax.plotW;};
    ctx.strokeStyle=H.hexAlpha(C.border,0.4);ctx.strokeRect(ax.plotL+.5,ax.plotT+.5,ax.plotW-1,ax.plotH-1);
    const ratioMode=state.stripMode==="ratio";
    let yMin=0,yMax=90;
    if(ratioMode){
      const vals=fit&&fit.positions?fit.positions.map(function(q){return q.ratio;}):[]; yMin=vals.length?Math.max(0,Math.min.apply(null,vals)-0.05):0.25; yMax=vals.length?Math.max.apply(null,vals)+0.05:1.25;
    }
    function y(v){return ax.plotB-((v-yMin)/(yMax-yMin||1))*ax.plotH;}
    ctx.save();ctx.strokeStyle=H.hexAlpha(C.border,0.28);ctx.lineWidth=1;ctx.font="8px Inter, sans-serif";ctx.fillStyle=C.muted;ctx.textAlign="right";ctx.textBaseline="middle";
    for(let j=0;j<=4;j++){const val=yMin+(yMax-yMin)*j/4, yy=y(val);ctx.beginPath();ctx.moveTo(ax.plotL,yy);ctx.lineTo(ax.plotR,yy);ctx.stroke();ctx.fillText(val.toFixed(ratioMode?2:0),ax.plotL-4,yy);}ctx.restore();
    ctx.strokeStyle=ratioMode?C[shared.planets.find(p=>p.key===state.p.planet).color]:C.cyan;ctx.lineWidth=1.5;ctx.beginPath();
    const plotted=ratioMode?(fit?fit.positions:[]):events.slice(0,collected);
    if(!ratioMode){
      const body=shared.planets.find(p=>p.key===state.p.planet);
      const steps=Math.max(1,Math.ceil(state.t/1.5));
      for(let i=0;i<=steps;i++){
        const t=state.t*i/steps, e=earthAtTime(t),p=shared.computeOrbit(body.a,body.e,t);
        const xx=ax.plotL+t/t1*ax.plotW,yy=y(Math.abs(signedElongation(e,p))*DEG);
        if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      }
    }
    if(ratioMode)plotted.forEach(function(o,i){const val=ratioMode?o.ratio:o.elongation*DEG;const xx=x(i),yy=y(val);if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);});ctx.stroke();
    for(let i=0;i<plotted.length;i++){const o=events[i],val=ratioMode?fit.positions[i].ratio:o.elongation*DEG;dotMark(ctx,{x:x(i),y:y(val)},3,ratioMode?C[shared.planets.find(p=>p.key===state.p.planet).color]:C.magenta,1);}
    line(ctx,{x:ax.plotL+state.t/t1*ax.plotW,y:ax.plotT},{x:ax.plotL+state.t/t1*ax.plotW,y:ax.plotB},C.muted,0.7,1,[3,3]);
    text(ctx,ax.plotL,8,ratioMode?"r / rₑ (Sun–planet / Sun–Earth)":"Live elongation ε (degrees)",ratioMode?C[shared.planets.find(p=>p.key===state.p.planet).color]:C.cyan,9,"left");
    text(ctx,ax.plotR,w<650?20:8,(fit?"fit from "+collected+" sightlines":"collect 5 sightlines before fitting"),fit?C.green:C.muted,9,"right");
    text(ctx,ax.plotL,ax.plotB+16,"Day "+t0.toFixed(0),C.muted,9,"left"); text(ctx,ax.plotR,ax.plotB+16,"Day "+t1.toFixed(0),C.muted,9,"right");
  }
  function drawOuterStrip(ctx,w,h,state,C,H){
    const ax=axes(w,h), p=state.p; function x(v){return ax.plotL+v/360*ax.plotW;} function y(v){return ax.plotB-((v-1.3)/0.45)*ax.plotH;}
    ctx.strokeStyle=H.hexAlpha(C.border,0.4);ctx.strokeRect(ax.plotL+.5,ax.plotT+.5,ax.plotW-1,ax.plotH-1);
    ctx.strokeStyle=H.hexAlpha(C.muted,0.5);ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<=240;i++){const nu=360*i/240,o=orbitAt(MARS.a,MARS.e,nu/DEG),xx=x(nu),yy=y(o.r);if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();
    const cur=outerState(p); if(cur.intersection&&cur.intersection.ok){ctx.fillStyle=C.coral;ctx.beginPath();ctx.arc(x(Number(p.marsNuDeg)||0),y(cur.rMeasured),4,0,TAU);ctx.fill();}
    (p.points||[]).forEach(function(o){ctx.fillStyle=C.coral;ctx.beginPath();ctx.arc(x(o.phaseDeg),y(o.r),3,0,TAU);ctx.fill();});
    ctx.save();ctx.strokeStyle=H.hexAlpha(C.border,0.28);ctx.lineWidth=1;ctx.font="8px Inter, sans-serif";ctx.fillStyle=C.muted;ctx.textAlign="center";ctx.textBaseline="top";
    for(let j=0;j<=4;j++){const nu=90*j,xx=x(nu);ctx.beginPath();ctx.moveTo(xx,ax.plotT);ctx.lineTo(xx,ax.plotB);ctx.stroke();ctx.fillText(String(nu)+"°",xx,ax.plotB+3);}ctx.textAlign="right";ctx.textBaseline="middle";
    for(let j=0;j<=4;j++){const rv=1.3+0.45*j/4,yy=y(rv);ctx.beginPath();ctx.moveTo(ax.plotL,yy);ctx.lineTo(ax.plotR,yy);ctx.stroke();ctx.fillText(rv.toFixed(2),ax.plotL-4,yy);}ctx.restore();
    text(ctx,ax.plotL,8,"Mars heliocentric distance r (AU)",C.coral,9,"left"); text(ctx,ax.plotR,w<650?20:8,"faint: model · coral: inferred r",C.muted,9,"right"); text(ctx,(ax.plotL+ax.plotR)/2,ax.plotB+25,"Mars true anomaly",C.muted,9,"center");
  }

  global.keplerMeasurements={ configure,
    get MARS_PERIOD(){return MARS_PERIOD;}, outerState,intersectRays,
    drawMain(ctx,w,h,state,C,H,events,fit){if(state.tab==='innerMeasure')drawInnerEvents(ctx,w,h,state,C,H,events||[],fit);else drawOuter(ctx,w,h,state,C,H);},
    drawStrip(ctx,w,h,state,C,H,events,fit){if(state.tab==='innerMeasure')drawInnerEventStrip(ctx,w,h,state,C,H,events||[],fit);else drawOuterStrip(ctx,w,h,state,C,H);}
  };
})(window);
