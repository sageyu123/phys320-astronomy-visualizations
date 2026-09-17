import { shellField, starField, ringField, addFields, oppositeShellPatches } from './spherical_shell_extensions_model.js';
const C={cyan:'#56c7d9',magenta:'#ee65be',amber:'#ffcc66',green:'#56dc72',coral:'#ff7f66',purple:'#a99bff',text:'#e7e9eb',muted:'#979ea6',grid:'#3b4046'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=v=>Number.isFinite(v)?v.toFixed(3):'undefined';
function fit(canvas){const {width:w,height:h}=canvas.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);return[ctx,w,h];}
function line(ctx,x,y,a,b,color,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();ctx.setLineDash([]);}
function label(ctx,text,x,y,color=C.text,size=11,align='left'){ctx.fillStyle=color;ctx.font=`${size}px Inter,Arial,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y);}
function arrow(ctx,x,y,dx,dy,color){const n=Math.hypot(dx,dy);if(n<1e-8)return;const ux=dx/n,uy=dy/n,head=Math.min(9,n*.3);line(ctx,x,y,x+dx,y+dy,color);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-ux*head+uy*head*.5,y+dy-uy*head-ux*head*.5);ctx.lineTo(x+dx-ux*head-uy*head*.5,y+dy-uy*head+ux*head*.5);ctx.closePath();ctx.fill();}
export function createShellExtensions(host){
  host.classList.add('sx-host');
  host.innerHTML=`<section class="sx-view sx-active" data-sx-view="dyson"><aside class="sx-controls"><div class="sx-card"><p class="sx-eyebrow">Dyson sphere</p><p class="sx-note">The shell radius stays fixed at <i>R = R₀</i>. Drag the test mass anywhere. The colored arcs mark surface patches selected by two opposite cones. Their widths change as you move; the shell stays the same size.</p></div><div class="sx-card"><p class="sx-eyebrow">Test mass</p><div class="sx-field"><label class="sx-label">distance <i>r/R</i></label><div class="sx-row"><input id="sx-d-r" type="range" min="0" max="2" step=".01" value=".55"><input id="sx-d-rn" class="sx-num" type="number" min="0" max="2" step=".01" value=".55"><span class="sx-unit">R</span></div></div><div class="sx-preset"><button class="sx-btn" data-d-place="center">Place at center</button><button class="sx-btn" data-d-place="near">Near shell</button><button class="sx-btn" data-d-place="outside">Outside</button></div><button class="sx-btn" data-d-place="reset">Reset</button></div><div class="sx-card"><p class="sx-eyebrow">Sources</p><p class="sx-small">Star mass M★ = 0.5M. Ideal point star.</p><select id="sx-d-mode" class="sx-select"><option value="shell">Shell only</option><option value="star">Central star only</option><option value="both">Shell + star</option></select><label class="sx-check"><input id="sx-d-patches" type="checkbox" checked> opposite patch contributions</label><label class="sx-check"><input id="sx-d-pairs" type="checkbox" checked> cancellation pairs</label><label class="sx-check"><input id="sx-d-point" type="checkbox" checked> equivalent point mass</label></div><div class="sx-card"><p class="sx-eyebrow">Readout</p><div class="sx-readout"><span>position</span><b id="sx-d-pos">—</b></div><div class="sx-readout"><span>shell force</span><b id="sx-d-field">—</b></div><div class="sx-readout"><span>net force</span><b id="sx-d-total">—</b></div><div class="sx-readout"><span>units</span><b>GMm/R₀²</b></div></div></aside><div class="sx-divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize demonstration controls"></div><div class="sx-work"><div class="sx-canvas-card"><canvas id="sx-d-canvas" tabindex="0" role="img" aria-label="Dyson sphere: drag test mass or use arrow keys"></canvas></div><div class="sx-bottom"><div class="sx-message" id="sx-d-message"></div><div class="sx-compare"><strong>How the cancellation works</strong><p>The shell itself always has radius <i>R₀</i>. The two cones have the same opening (solid angle). If the far patch is <i>k</i> times farther away, its surface area and mass are <i>k²</i> times larger; the inverse-square law divides by the same <i>k²</i>. The sphere meets both rays at equal inclinations, so the area factors match. Opposite pulls cancel pair by pair.</p><p>Move <i>m</i>: the selected patches change size because the cone meets a fixed sphere at different distances. The sphere never expands.</p><div class="sx-legend"><span><i class="sx-dot" style="background:var(--sx-green)"></i>net</span><span><i class="sx-dot" style="background:var(--sx-amber)"></i>near patch</span><span><i class="sx-dot" style="background:var(--sx-purple)"></i>far patch</span></div></div></div></div></section><section class="sx-view" data-sx-view="ringworld"><aside class="sx-controls"><div class="sx-card"><p class="sx-eyebrow">Ringworld</p><p class="sx-note">Nudge the mass sideways: the nearer side wins, so the in-plane force pushes it farther from center. Above the plane, gravity restores it toward the ring plane.</p></div><div class="sx-card"><p class="sx-eyebrow">Position and ring</p><div class="sx-field"><label class="sx-label">ring radius <i>a</i></label><div class="sx-row"><input id="sx-r-a" type="range" min=".6" max="1.6" step=".01" value="1"><input id="sx-r-an" class="sx-num" type="number" min=".6" max="1.6" step=".01" value="1"><span class="sx-unit">R₀</span></div></div><div class="sx-field"><label class="sx-label">in-plane offset ρ/a (up to 0.85)</label><div class="sx-row"><input id="sx-r-off" type="range" min="0" max=".85" step=".01" value=".18"><input id="sx-r-offn" class="sx-num" type="number" min="0" max=".85" step=".01" value=".18"><span class="sx-unit">×a</span></div></div><div class="sx-field"><label class="sx-label">height <i>z/a</i> above or below plane</label><div class="sx-row"><input id="sx-r-z" type="range" min="-.99" max=".99" step=".01" value="0"><input id="sx-r-zn" class="sx-num" type="number" min="-.99" max=".99" step=".01" value="0"><span class="sx-unit">×a</span></div></div><div class="sx-preset"><button class="sx-btn" data-r-place="center">Centered</button><button class="sx-btn" data-r-place="offset">Slight offset</button><button class="sx-btn" data-r-place="above">Above plane</button><button class="sx-btn" data-r-place="reset">Reset</button></div></div><div class="sx-card"><p class="sx-eyebrow">Sources and overlays</p><p class="sx-small">Ring mass M; star mass M★ = 0.5M.</p><select id="sx-r-mode" class="sx-select"><option value="ring">Ring only</option><option value="both">Ring + central star</option></select><label class="sx-check"><input id="sx-r-elements" type="checkbox" checked> opposite ring elements</label><label class="sx-check"><input id="sx-r-vectors" type="checkbox" checked> element force vectors</label><label class="sx-check"><input id="sx-r-trace" type="checkbox"> net-force trace</label></div><div class="sx-card"><p class="sx-eyebrow">Readout</p><div class="sx-readout"><span>position</span><b id="sx-r-pos">—</b></div><div class="sx-readout"><span>ring force</span><b id="sx-r-field">—</b></div><div class="sx-readout"><span>net force</span><b id="sx-r-total">—</b></div><div class="sx-readout"><span>units</span><b>GMm/R₀²</b></div></div></aside><div class="sx-divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize demonstration controls"></div><div class="sx-work"><div class="sx-canvas-card"><canvas id="sx-r-canvas" tabindex="0" role="img" aria-label="Ringworld: drag in top or side view; arrow keys move in the ring plane"></canvas></div><div class="sx-bottom"><div class="sx-message" id="sx-r-message"></div><div class="sx-compare"><strong>Compare / try this</strong><p>A shell cancels everywhere inside. A ring cancels only at the center. Nudge sideways to see in-plane instability; use Above plane for vertical restoration.</p><div class="sx-legend"><span><i class="sx-dot" style="background:var(--sx-coral)"></i>outward</span><span><i class="sx-dot" style="background:var(--sx-green)"></i>restoring</span></div></div></div></div></section>`;
  const $ = id => host.querySelector('#' + id);
  const state = {
    tab: 'dyson',
    d: { p: [.55, 0, 0], mode: 'shell', patches: true, pairs: true, point: true, zoom: 1 },
    r: { p: [.18, 0, 0], a: 1, mode: 'ring', elements: true, vectors: true, trace: false, history: [], zoom: 1 },
  };
  const dCanvas = $('sx-d-canvas'), rCanvas = $('sx-r-canvas');
  const canvasLayout = new Map();
  const controls = [
    ['sx-d-r','sx-d-rn','Dyson distance r/R'], ['sx-r-a','sx-r-an','Ring radius a/R₀'],
    ['sx-r-off','sx-r-offn','Ring in-plane offset ρ/a'], ['sx-r-z','sx-r-zn','Ring height z/a'],
  ];
  for (const [slider, number, name] of controls) {
    $(slider).setAttribute('aria-label', name); $(number).setAttribute('aria-label', name + ' value');
    $(slider).closest('.sx-field').querySelector('label').htmlFor = slider;
  }
  $('sx-d-mode').setAttribute('aria-label', 'Dyson gravity source');
  $('sx-r-mode').setAttribute('aria-label', 'Ringworld gravity source');

  function sync() {
    for (const [s, n, value] of [
      ['sx-d-r','sx-d-rn',Math.hypot(...state.d.p)],
      ['sx-r-a','sx-r-an',state.r.a],
      ['sx-r-off','sx-r-offn',Math.hypot(...state.r.p.slice(0,2))/state.r.a],
      ['sx-r-z','sx-r-zn',state.r.p[2]/state.r.a],
    ]) { $(s).value = value; $(n).value = value.toFixed(2); }
  }
  function fields(which) {
    const s = state[which], base = which === 'd' ? shellField(s.p) : ringField(s.p,s.a);
    const star = starField(s.p);
    const total = s.mode === 'star' ? star : s.mode === 'both' ? addFields(base,star) : base;
    return { base, star, total };
  }
  function drawMass(ctx, x, y, color = C.magenta, radius = 7) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,radius,0,2*Math.PI); ctx.fill();
  }
  function drawConePair(ctx, m, map, p, angle, pair, primary, showCones) {
    const eps = primary ? .085 : .055;
    // Keep each cone on the same ray branch even at the center.
    const hit = t => {
      const u = [Math.cos(t), Math.sin(t)], dot = p[0]*u[0]+p[1]*u[1];
      const distance = -dot + Math.sqrt(dot*dot + 1 - p[0]*p[0] - p[1]*p[1]);
      return [p[0]+distance*u[0], p[1]+distance*u[1]];
    };
    const {cx,cy,scale}=canvasLayout.get(dCanvas);
    for (const [point,color,name,distance] of [[pair.near,C.amber,'Near',pair.nearDistance],[pair.far,C.purple,'Far',pair.farDistance]]) {
      const direction=Math.atan2(point[1]-p[1],point[0]-p[0]);
      const a=hit(direction-eps), b=hit(direction+eps), u=map(a), v=map(b);
      const start=Math.atan2(-a[1],a[0]);
      const end=start+Math.atan2(Math.sin(Math.atan2(-b[1],b[0])-start),Math.cos(Math.atan2(-b[1],b[0])-start));
      if(showCones){
        ctx.globalAlpha=primary?.15:.035;ctx.fillStyle=color;
        ctx.beginPath();ctx.moveTo(...m);ctx.lineTo(...u);ctx.arc(cx,cy,scale,start,end,end<start);ctx.closePath();ctx.fill();
        ctx.globalAlpha=primary?.8:.2;
        line(ctx,...m,...u,color,[3,4]);line(ctx,...m,...v,color,[3,4]);
      }
      ctx.globalAlpha=primary?1:.3;ctx.strokeStyle=color;ctx.lineWidth=primary?6:3;
      ctx.beginPath();ctx.arc(cx,cy,scale,start,end,end<start);ctx.stroke();ctx.globalAlpha=1;
      if(primary){
        const q=map(point), right=point[0]>=0;
        label(ctx,`${name} patch`,q[0]+(right?14:-14),q[1]-8,color,11,right?'left':'right');
        label(ctx,`${distance.toFixed(2)} R from m`,q[0]+(right?14:-14),q[1]+9,color,10,right?'left':'right');
      }
    }
  }
  function drawForce(ctx, origin, vector, color, scale, maxLength = 90) {
    if (!vector) return;
    const magnitude = Math.hypot(...vector);
    if (magnitude < 1e-10) return;
    const length = Math.min(maxLength, magnitude*scale);
    const u = vector.map(v=>v/magnitude);
    arrow(ctx, origin[0]+u[0]*8, origin[1]+u[1]*8, u[0]*length, u[1]*length, color);
  }
  function drawDyson() {
    const [ctx,w,h] = fit(dCanvas); if (!w || !h) return;
    const scale = Math.max(15, Math.min((w-70)/4.4,(h-100)/4.4)) * state.d.zoom;
    const cx = w/2, cy = h/2;
    canvasLayout.set(dCanvas,{cx,cy,scale});
    const p = state.d.p, radius = Math.hypot(...p), data = fields('d');
    const map = q => [cx+q[0]*scale,cy-q[1]*scale], m = map(p);
    const gradient = ctx.createRadialGradient(cx-scale*.3,cy-scale*.3,0,cx,cy,scale);
    gradient.addColorStop(0,'rgba(86,199,217,.16)'); gradient.addColorStop(1,'rgba(86,199,217,.025)');
    ctx.fillStyle=gradient; ctx.strokeStyle=C.cyan; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,scale,0,2*Math.PI); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#56c7d955'; ctx.setLineDash([4,5]);
    for (const [rx,ry] of [[scale,.32*scale],[.32*scale,scale]]) { ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,2*Math.PI); ctx.stroke(); }
    ctx.setLineDash([]); line(ctx,cx-2.05*scale,cy,cx+2.05*scale,cy,C.grid,[4,5]);
    label(ctx,'Fixed shell radius R',cx,cy+scale+26,C.cyan,11,'center');
    let explanation = '';
    if (radius < 1 && state.d.mode !== 'star' && (state.d.patches || state.d.pairs)) {
      const baseAngle = radius > 1e-9 ? Math.atan2(p[1],p[0]) : 0;
      const angles = state.d.pairs ? [baseAngle,baseAngle+1.1,baseAngle-1.1] : [baseAngle];
      for (const [i, angle] of angles.entries()) {
        const pair = oppositeShellPatches(p,angle), near=map(pair.near), far=map(pair.far);
        const primary = i === 0;
        drawConePair(ctx,m,map,p,angle,pair,primary,state.d.pairs);
        if (state.d.patches) {
          // Equal-solid-angle patches give equal opposing forces, despite unequal areas.
          for (const [point,color] of [[near,C.amber],[far,C.purple]]) {
            const dx=point[0]-m[0],dy=point[1]-m[1],len=Math.hypot(dx,dy);
            drawForce(ctx,m,[dx/len,dy/len],color,Math.min(48,scale*.35));
          }
        }
        if (!i) {
          const k=pair.farDistance/pair.nearDistance;
          explanation=`<b>Far ÷ near:</b> distance ${k.toFixed(2)}× → area &amp; mass ${(k*k).toFixed(2)}× → force ${(k*k).toFixed(2)}/${(k*k).toFixed(2)} = 1×.<br>Equal pulls in opposite directions cancel. Pair every direction to get zero shell force.`;
          label(ctx,'Opposite narrow cones · equal opening',14,66,C.text,w<500?11:13);
          label(ctx,`Far patch: ${k.toFixed(2)}× farther, ${(k*k).toFixed(2)}× more mass`,14,87,C.purple,w<500?11:13);
          label(ctx,'More mass ÷ distance² = same pull',14,108,C.amber,w<500?11:13);
        }
      }
    }
    if (state.d.mode !== 'shell') {
      drawMass(ctx,cx,cy,C.amber,9); label(ctx,'M★ = 0.5M',cx+12,cy+18,C.amber);
    } else drawMass(ctx,cx,cy,C.cyan,3);
    if (state.d.point && radius > 1 && state.d.mode !== 'star') {
      ctx.strokeStyle=C.amber; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.arc(cx,cy,13,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
      label(ctx,'shell equivalent M',cx,cy+30,C.amber,11,'center');
    }
    drawForce(ctx,m,data.total && [data.total[0],-data.total[1]],C.green,scale*.5);
    drawMass(ctx,...m); label(ctx,'m',m[0]+10,m[1]-11,C.magenta,13);
    label(ctx,'Dyson Sphere · drag m in this cross-section',14,20,C.text,13);
    label(ctx,'Shell force: '+(state.d.mode==='star'?'off':fmt(data.base ? Math.hypot(...data.base) : NaN)),14,42,C.cyan,12);
    label(ctx,`Scroll to zoom · ${Math.round(state.d.zoom * 100)}% · double-click to reset`,14,128,C.muted,w<500?10:11);
    label(ctx,data.total ? 'Net force: '+fmt(Math.hypot(...data.total)) : 'Net force undefined at this idealized location',14,h-42,C.green,12);
    label(ctx,'Fixed R · colored arcs show selected shell surface',14,h-20,C.muted,w<500?10:11);
    $('sx-d-pos').textContent=`(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;
    $('sx-d-field').textContent=state.d.mode === 'star' ? 'off' : fmt(data.base ? Math.hypot(...data.base) : NaN);
    $('sx-d-total').textContent=fmt(data.total ? Math.hypot(...data.total) : NaN);
    const notice = !data.total && radius===0 ? 'At the ideal point star’s center its force is undefined. Move slightly away.' : Math.abs(radius-1)<1e-9 && state.d.mode!=='star' ? 'On the ideal thin shell, its field is discontinuous. Move just inside or outside.' : state.d.mode==='star' ? 'Only the point star contributes; its force is undefined at its exact center.' : radius < 1 ? 'The shell contributes exactly zero everywhere inside.'+(state.d.mode==='both'?' The central star supplies the remaining force.':' Try several off-center positions.') : 'Outside, the shell pulls exactly like mass M at its center.';
    $('sx-d-message').innerHTML=`<strong>What to notice:</strong> ${notice}<p>${explanation || 'Equivalent point-mass replacement applies only outside the shell.'}</p><span class="sx-small">The sphere is fixed at R = R₀. Arcs show a cross-section of tiny 3D surface patches. Width grows with distance; area grows with distance². Cone openings are enlarged for visibility; the proof uses infinitesimal patches.</span>`;
  }

  function ringLayout(w,h) {
    const zoom = state.r.zoom;
    if (w >= 650) return { top: {cx:w*.32,cy:h*.48,scale:Math.min(w*.22,h*.34)*zoom/state.r.a}, side:{cx:w*.80,cy:h*.48,scale:Math.min(w*.13,h*.27)*zoom/state.r.a}, split:w*.61, vertical:false };
    return { top:{cx:w/2,cy:h*.30,scale:Math.min(w*.35,h*.23)*zoom/state.r.a},side:{cx:w/2,cy:h*.79,scale:Math.min(w*.32,h*.14)*zoom/state.r.a},split:h*.57,vertical:true };
  }
  function drawRing() {
    const [ctx,w,h]=fit(rCanvas); if (!w||!h) return;
    const layout=ringLayout(w,h), {top,side}=layout, s=state.r, p=s.p, data=fields('r');
    canvasLayout.set(rCanvas,layout);
    const map=q=>[top.cx+q[0]*top.scale,top.cy-q[1]*top.scale], m=map(p), rad=s.a*top.scale;
    ctx.strokeStyle=C.amber;ctx.lineWidth=3;ctx.beginPath();ctx.arc(top.cx,top.cy,rad,0,2*Math.PI);ctx.stroke();
    line(ctx,top.cx-rad,top.cy,top.cx+rad,top.cy,C.grid,[4,4]);
    drawMass(ctx,top.cx,top.cy,s.mode==='both'?C.amber:C.cyan,s.mode==='both'?8:3);
    if (s.mode==='both') label(ctx,'star',top.cx-12,top.cy+18,C.amber,10,'right');
    if (s.trace) for (const item of s.history) drawForce(ctx,map(item.p),item.f&&[item.f[0],-item.f[1]],'#a99bff70',top.scale*.22,38);
    const angle=Math.atan2(p[1],p[0]), parts=[];
    for (let i=0;i<2;i++) {
      const a=angle+i*Math.PI,q=[s.a*Math.cos(a),s.a*Math.sin(a),0];
      const delta=q.map((v,j)=>v-p[j]), distance=Math.hypot(...delta);
      parts.push({q,force:delta.map(v=>v/(32*distance**3)),color:i?C.purple:C.amber,a});
    }
    const partMax=Math.max(...parts.map(q=>Math.hypot(q.force[0],q.force[1])),1e-12);
    for (const part of parts) {
      if (s.elements) {
        ctx.lineWidth=7;ctx.strokeStyle=part.color;ctx.beginPath();ctx.arc(top.cx,top.cy,rad,-part.a-Math.PI/32,-part.a+Math.PI/32);ctx.stroke();
      }
      if(s.vectors) drawForce(ctx,[m[0],m[1]-24],[part.force[0],-part.force[1]],part.color,Math.min(65,rad*.55)/partMax,65);
    }
    if (s.vectors) { line(ctx,m[0],m[1]-9,m[0],m[1]-24,C.muted,[2,3]); label(ctx,'patch pulls',m[0],m[1]-39,C.muted,10,'center'); }
    const outward=data.total && data.total[0]*p[0]+data.total[1]*p[1]>0;
    drawForce(ctx,m,data.total&&[data.total[0],-data.total[1]],outward?C.coral:C.green,top.scale*3);
    drawMass(ctx,...m);label(ctx,Math.abs(p[2])>1e-9?'m (projection)':'m',m[0]+10,m[1]-12,C.magenta,12);
    label(ctx,'Ringworld · top view',14,20,C.text,13);
    label(ctx,'Drag sideways; the ring has less symmetry than a shell.',14,42,C.muted,w<500?10:11);
    label(ctx,`Scroll to zoom · ${Math.round(s.zoom * 100)}% · double-click to reset`,14,63,C.muted,w<500?10:11);
    if(layout.vertical) line(ctx,16,layout.split,w-16,layout.split,C.grid);else line(ctx,layout.split,55,layout.split,h-50,C.grid);
    const sideRad=s.a*side.scale, sideMass=[side.cx+p[0]*side.scale,side.cy-p[2]*side.scale];
    line(ctx,side.cx-sideRad,side.cy,side.cx+sideRad,side.cy,C.grid,[4,4]);
    drawMass(ctx,side.cx-sideRad,side.cy,C.amber,4);drawMass(ctx,side.cx+sideRad,side.cy,C.amber,4);
    label(ctx,'edge-on: ring plane',side.cx,side.cy+sideRad+20,C.muted,10,'center');
    label(ctx,'Side view · drag up/down',side.cx,layout.vertical?layout.split+22:70,C.text,11,'center');
    if(s.mode==='both')drawMass(ctx,side.cx,side.cy,C.amber,7);
    drawForce(ctx,sideMass,data.total&&[data.total[0],-data.total[2]],C.green,side.scale*.7);
    drawMass(ctx,...sideMass);label(ctx,'m',sideMass[0]+10,sideMass[1]-10,C.magenta,11);
    label(ctx,'Net = '+fmt(data.total?Math.hypot(...data.total):NaN)+' GMm/R₀²',14,h-20,C.green,12);
    $('sx-r-pos').textContent=`(${p.map(v=>v.toFixed(2)).join(', ')})`;
    $('sx-r-field').textContent=fmt(data.base?Math.hypot(...data.base):NaN);
    $('sx-r-total').textContent=fmt(data.total?Math.hypot(...data.total):NaN);
    let notice = s.mode==='both' ? 'The star adds an inward pull. The net arrow combines ring and star; the ring-only instability statement does not describe this combined field.' : Math.abs(p[2])>1e-9 ? 'Above or below the ring, the vertical force points toward the plane. The Above plane preset isolates this restoring direction.' : Math.hypot(p[0],p[1])<1e-9 ? 'At the center the ring gives zero force. Press an arrow key to nudge the mass: it is an unstable equilibrium in the plane.' : 'The nearer side pulls harder. The ring’s net force points away from the center, so an in-plane displacement grows.';
    if (!data.total) notice='The ideal point-star force is undefined at its center. Move the test mass slightly away.';
    $('sx-r-message').innerHTML=`<strong>What to notice:</strong> ${notice}<p>Amber and purple arcs have equal mass. Their arrow lengths use a common scale, so unequal pulls are visible.</p><span class="sx-small">Offsets limited to 0.85a to avoid the ideal thin ring. Arrows are capped; the readout gives the actual force.</span>`;
  }
  function render(){if(host.hidden)return;state.tab==='dyson'?drawDyson():drawRing();}
  function afterPositionChange(trace=false){
    if(trace&&state.r.trace){state.r.history.push({p:[...state.r.p],f:fields('r').total});if(state.r.history.length>45)state.r.history.shift();}
    sync();render();
  }
  function setRadius(p,r){const old=Math.hypot(p[0],p[1]);const a=old?Math.atan2(p[1],p[0]):0;p[0]=r*Math.cos(a);p[1]=r*Math.sin(a);}
  function boundPosition(p,max){const r=Math.hypot(p[0],p[1]);if(r>max){p[0]*=max/r;p[1]*=max/r;}}
  function bind(slider,number,min,max,apply){
    const set = value => {if(!Number.isFinite(value))return;apply(clamp(value,min,max));afterPositionChange();};
    $(slider).addEventListener('input',()=>set(Number($(slider).value)));
    $(number).addEventListener('input',()=>{if($(number).value==='')return;const v=$(number).valueAsNumber;if(Number.isFinite(v)){apply(clamp(v,min,max));$(slider).value=clamp(v,min,max);render();}});
    $(number).addEventListener('change',()=>set($(number).value===''?Number($(slider).value):$(number).valueAsNumber));
  }
  bind('sx-d-r','sx-d-rn',0,2,v=>setRadius(state.d.p,v));
  bind('sx-r-a','sx-r-an',.6,1.6,v=>{const ratio=v/state.r.a;state.r.p=state.r.p.map(q=>q*ratio);state.r.a=v;state.r.history=[];});
  bind('sx-r-off','sx-r-offn',0,.85,v=>{setRadius(state.r.p,v*state.r.a);state.r.history=[];});
  bind('sx-r-z','sx-r-zn',-.99,.99,v=>{state.r.p[2]=v*state.r.a;state.r.history=[];});
  for(const which of ['d','r']) {
    $('sx-'+which+'-mode').addEventListener('change',e=>{state[which].mode=e.target.value;state.r.history=[];render();});
    const keys=which==='d'?['patches','pairs','point']:['elements','vectors','trace'];
    for(const key of keys)$('sx-'+which+'-'+key).addEventListener('change',e=>{state[which][key]=e.target.checked;if(key==='trace')state.r.history=[];render();});
  }
  host.querySelectorAll('[data-d-place]').forEach(button=>button.addEventListener('click',()=>{
    const type=button.dataset.dPlace;state.d.p=[type==='center'?0:type==='near'?.9:type==='outside'?1.4:.55,0,0];
    if(type==='reset'){state.d.mode='shell';$('sx-d-mode').value='shell';for(const k of ['patches','pairs','point']){state.d[k]=true;$('sx-d-'+k).checked=true;}}
    afterPositionChange();
  }));
  host.querySelectorAll('[data-r-place]').forEach(button=>button.addEventListener('click',()=>{
    const type=button.dataset.rPlace;if(type==='reset'){state.r.a=1;state.r.mode='ring';$('sx-r-mode').value='ring';state.r.trace=false;$('sx-r-trace').checked=false;}
    state.r.p=[type==='offset'||type==='reset'?.18*state.r.a:0,0,type==='above'?.4*state.r.a:0];state.r.history=[];afterPositionChange();
  }));
  function bindDrag(canvas,which){
    let drag=null;
    function move(e){
      const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,layout=canvasLayout.get(canvas);
      if(!layout)return;
      if(which==='d'){state.d.p=[(x-layout.cx)/layout.scale,(layout.cy-y)/layout.scale,0];boundPosition(state.d.p,2);}
      else {
        const view=drag.view==='side'?layout.side:layout.top;
        state.r.p[0]=(x-view.cx)/view.scale;
        if(drag.view==='side')state.r.p[2]=clamp((view.cy-y)/view.scale,-.99*state.r.a,.99*state.r.a);
        else state.r.p[1]=(view.cy-y)/view.scale;
        boundPosition(state.r.p,.85*state.r.a);
      }
      afterPositionChange(which==='r');
    }
    canvas.addEventListener('pointerdown',e=>{const b=canvas.getBoundingClientRect(),l=canvasLayout.get(canvas);if(!l)return;drag={id:e.pointerId,view:which==='r'&&(l.vertical?e.clientY-b.top>l.split:e.clientX-b.left>l.split)?'side':'top'};canvas.focus();canvas.setPointerCapture(e.pointerId);move(e);});
    canvas.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId)move(e);});
    for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,()=>{drag=null;});
    canvas.addEventListener('keydown',e=>{
      const vectors={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(!vectors[e.key])return;e.preventDefault();
      const p=state[which].p,step=.02*(which==='r'?state.r.a:1);p[0]+=step*vectors[e.key][0];p[1]+=step*vectors[e.key][1];boundPosition(p,which==='r'?.85*state.r.a:2);afterPositionChange(which==='r');
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const view = state[which];
      view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * .0015), .65, 2.8);
      render();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => { state[which].zoom = 1; render(); });
  }
  bindDrag(dCanvas,'d');bindDrag(rCanvas,'r');
  for(const divider of host.querySelectorAll('.sx-divider')){
    let drag=null;
    divider.addEventListener('pointerdown',e=>{drag=e.clientX-divider.parentElement.getBoundingClientRect().left;divider.setPointerCapture(e.pointerId);});
    divider.addEventListener('pointermove',e=>{if(drag===null)return;host.style.setProperty('--sx-control-width',clamp(e.clientX-divider.parentElement.getBoundingClientRect().left,240,380)+'px');});
    for(const name of ['pointerup','pointercancel'])divider.addEventListener(name,()=>{drag=null;});
    divider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const current=parseFloat(getComputedStyle(host).getPropertyValue('--sx-control-width'))||280;host.style.setProperty('--sx-control-width',clamp(current+(e.key==='ArrowRight'?10:-10),240,380)+'px');});
  }
  new ResizeObserver(render).observe(dCanvas.parentElement);new ResizeObserver(render).observe(rCanvas.parentElement);
  sync();
  return {show(name){state.tab=name==='ringworld'?'ringworld':'dyson';host.classList.add('sx-visible');host.querySelectorAll('.sx-view').forEach(view=>view.classList.toggle('sx-active',view.dataset.sxView===state.tab));render();},resize:render};
}
