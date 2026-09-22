import {thinLens,lensMaker,plateScale,pixelScale,focalImageSize,angleToRadians,radiansToAngle} from './geometric_optics_model.js';
import {drawOptics} from './geometric_optics_view.js';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const state = {
  tab:'ray',
  ray:{f:.676,p:1.5,h:.24,foci:true,labels:true,equations:true,lock:false},
  maker:{n:1.37,R1:.25,R2:null,D:.12,medium:1,advanced:false},
  plate:{f:2032,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:24,aspect:4/3,grid:true,target:'Moon',scaleMode:'real',camera:{zoom:1,panX:0,panY:0}}
};
const radiusMemory = [.25,-.25];
const canvas = $('opticsCanvas');
let layout = {}, bindings = [];
const fmt = (v,d=3) => !Number.isFinite(v)?'∞':Number(v.toFixed(d)).toString();
const makerResult = () => {const m=state.maker;return lensMaker(m.n,m.R1,m.R2,m.advanced?m.medium:1)};
const card = (title,body) => '<section class="card"><h3>'+title+'</h3>'+body+'</section>';
const button = (label,action) => '<button type="button" data-action="'+action+'">'+label+'</button>';
const check = (id,label) => '<label class="check"><input type="checkbox" id="'+id+'">'+label+'</label>';
function field(id,label,min,max,step,unit=''){
  return '<div class="field"><label for="'+id+'N">'+label+'</label><div class="row"><input id="'+id+'" type="range" aria-label="'+label+' slider" min="'+min+'" max="'+max+'" step="'+step+'"><input id="'+id+'N" type="number" aria-label="'+label+'" min="'+min+'" max="'+max+'" step="'+step+'"><span class="unit">'+unit+'</span></div></div>';
}
function buildControls(){
  bindings=[];
  if(state.tab==='ray'){
    $('controls').innerHTML=card('Lens and object',
      '<div class="field"><label for="lensType">Lens type</label><select id="lensType"><option value="1">Converging · f &gt; 0</option><option value="-1">Diverging · f &lt; 0</option></select></div>'+
      field('rayF','Focal length magnitude |f|',.05,3,.001,'m')+
      field('rayP','Object distance p',.02,10,.001,'m')+
      field('rayH','Object height h',.02,1,.01,'m')+
      check('lockMaker','Link to Lens Maker')+'<p class="note" id="lockHelp"></p>')+
      card('Explore image formation','<div class="buttons">'+
        button('Beyond 2f','ray-beyond')+button('At 2f','ray-2f')+
        button('Between f and 2f','ray-between')+button('At f · parallel rays','ray-focus')+
        button('Inside f · virtual','ray-inside')+button('Diverging lens','ray-diverge')+
        button('Reset','ray-reset')+'</div>')+
      card('Display',check('showFoci','Focal points')+check('showLabels','Diagram labels')+check('showEq','Lens equation'))+
      card('Reading the diagram','<p class="note">Solid rays are light paths. Dashed lines extend rays backward to a <strong title="A location from which rays appear to originate; light does not meet there.">virtual image</strong>.</p><p class="note">p &gt; 0: real object on the left. q &gt; 0: real image on the right. q &lt; 0: virtual image on the left. Lens thickness is schematic; refraction occurs at its central plane.</p>');
    bindPair('rayF',()=>Math.abs(state.ray.f),v=>state.ray.f=Math.sign(state.ray.f)*v);
    bindPair('rayP',()=>state.ray.p,v=>state.ray.p=v);
    bindPair('rayH',()=>state.ray.h,v=>state.ray.h=v);
    $('lensType').onchange=e=>{state.ray.f=Number(e.target.value)*Math.abs(state.ray.f);update()};
    bindCheck('lockMaker',state.ray,'lock');bindCheck('showFoci',state.ray,'foci');
    bindCheck('showLabels',state.ray,'labels');bindCheck('showEq',state.ray,'equations');
  }else if(state.tab==='maker'){
    $('controls').innerHTML=card('Material and aperture',
      field('makerN','Lens refractive index n',1,2.5,.01)+
      field('makerD','Clear aperture D',.01,.4,.001,'m')+
      '<p id="apertureHelp" class="note"></p>'+check('advanced','Change surrounding medium')+
      '<div id="mediumField">'+field('mediumN','Medium refractive index',1,2,.01)+'</div>')+
      card('Signed surface radii',[1,2].map(i=>field('makerR'+i,'Radius magnitude |R'+i+'|',.03,2,.001,'m')+
        '<label class="field">Center of curvature · surface '+i+'<select id="sign'+i+'" aria-label="Radius '+i+' sign"><option value="1">Right of surface · positive</option><option value="-1">Left of surface · negative</option></select></label>'+
        check('plane'+i,'Surface '+i+' is plane (1/R = 0)')).join(''))+
      card('Lens shapes','<div class="buttons">'+[
        ['Biconvex','bi'],['Plano-convex','pc'],['Positive meniscus','pm'],
        ['Biconcave','bc'],['Plano-concave','pn'],['Negative meniscus','nm'],
        ['Lecture A · +0.676 m','a'],['Lecture B · −0.316 m','b']
      ].map(([label,key])=>button(label,'mk-'+key)).join('')+'</div>')+
      card('Use this lens','<button class="wide" data-action="use-ray">Use in Ray Diagram →</button><button class="wide" data-action="use-plate">Use in Plate Scale →</button><p class="note" id="transferHelp"></p>');
    bindPair('makerN',()=>state.maker.n,v=>state.maker.n=v);
    bindPair('makerD',()=>state.maker.D,v=>state.maker.D=v);
    bindPair('mediumN',()=>state.maker.medium,v=>state.maker.medium=v);
    bindCheck('advanced',state.maker,'advanced');
    [1,2].forEach(i=>{
      const key='R'+i;
      bindPair('makerR'+i,()=>Math.abs(state.maker[key]??radiusMemory[i-1]),v=>{
        state.maker[key]=v*Number($('sign'+i).value);radiusMemory[i-1]=state.maker[key];
      });
      $('plane'+i).onchange=e=>{state.maker[key]=e.target.checked?null:radiusMemory[i-1];update()};
      $('sign'+i).onchange=e=>{state.maker[key]=Math.abs(state.maker[key])*Number(e.target.value);radiusMemory[i-1]=state.maker[key];update()};
    });
  }else{
    $('controls').innerHTML=card('Telescope',field('plateF','Focal length f',100,100000,.1,'mm')+'<p class="note">Logarithmic slider · 100–100,000 mm</p>'+field('plateD','Aperture D',20,1000,.1,'mm'))+
      card('Sky target','<div class="field"><label for="plateAngle">Angular diameter θ</label><div class="row"><input id="plateAngle" type="number" min="0" step="any"><select id="angleUnit" aria-label="Angular units"><option value="deg">degrees</option><option value="arcmin">arcmin</option><option value="arcsec">arcsec</option></select></div></div><div class="buttons">'+
        button('Moon · 0.5°','pl-moon')+button('Sun · 0.5°','pl-sun')+button('Jupiter · 45″','pl-jupiter')+button('Saturn rings · 40″','pl-saturn')+button('Venus · 20″','pl-venus')+button('1 arcsecond','pl-one')+'</div><p class="note">Illustrative angular sizes; edit θ to explore others. Saturn’s angle spans the outer rings.</p>')+
      card('Detector',field('pixelSize','Pixel size',1,15,.1,'µm')+field('detectorW','Detector width W · in focal plane',4,60,.1,'mm')+
        '<div class="field"><label for="detectorAspect">Aspect ratio · width : height</label><select id="detectorAspect"><option value="1.3333333333333333">4:3</option><option value="1.5">3:2</option><option value="1.7777777777777777">16:9</option><option value="1">1:1 · square</option></select></div>'+
        check('pixelGrid','Show pixel grid')+'<p class="note">The detector sits in the purple focal plane. W is its horizontal dimension; the axial cross-section shows its height H = W / aspect. Larger pixels spread the grid lines apart. When individual pixels are too small to see, each grid cell groups the number of pixels shown on the plot.</p>')+
      card('Telescope examples','<div class="buttons">'+button('8-inch f/10 + Moon','pl-lecture')+button('200 mm f/4','pl-fast')+'</div><p class="note">The cone uses equal horizontal and vertical scales. Increasing f narrows the yellow cone. As the view zooms out, the displayed aperture shrinks too; its physical diameter D stays fixed. The green ray keeps the same sky angle θ. The detector below is enlarged separately.</p>');
    bindPair('plateF',()=>state.plate.f,v=>state.plate.f=v,true);
    bindPair('plateD',()=>state.plate.D,v=>state.plate.D=v);
    bindPair('pixelSize',()=>state.plate.pixel,v=>state.plate.pixel=v);
    bindPair('detectorW',()=>state.plate.width,v=>state.plate.width=v);
    bindCheck('pixelGrid',state.plate,'grid');
    $('detectorAspect').onchange=e=>{state.plate.aspect=Number(e.target.value);update()};
    $('plateAngle').oninput=e=>{
      const v=Number(e.target.value);
      if(e.target.value!==''&&v>=0&&angleToRadians(v,state.plate.unit)<=Math.PI/18){
        state.plate.angle=v;update();
      }
    };
    $('plateAngle').onblur=()=>{$('plateAngle').value=fmt(state.plate.angle,6)};
    $('angleUnit').onchange=e=>{
      state.plate.angle=radiansToAngle(angleToRadians(state.plate.angle,state.plate.unit),e.target.value);
      state.plate.unit=e.target.value;update();
    };
  }
  $('controls').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
}

// Keep controls mounted during input; typing and slider drags retain focus.
function bindPair(id,get,set,logarithmic=false){
  const range=$(id),number=$(id+'N');
  if(logarithmic){range.min=Math.log10(Number(number.min));range.max=Math.log10(Number(number.max));range.step=.001}
  bindings.push({range,number,get,logarithmic});
  const apply=input=>{
    const v=logarithmic&&input===range?Number((10**Number(input.value)).toFixed(1)):Number(input.value);
    if(input.value!==''&&Number.isFinite(v)&&v>=Number(number.min)&&v<=Number(number.max)){set(v);update()}
  };
  range.oninput=()=>apply(range);number.oninput=()=>apply(number);
  number.onblur=()=>{number.value=fmt(get(),6)};
}
function bindCheck(id,obj,key){$(id).onchange=e=>{obj[key]=e.target.checked;update()}}
function disablePair(id,disabled){$(id).disabled=disabled;$(id+'N').disabled=disabled}
function syncControls(){
  for(const {range,number,get,logarithmic} of bindings){
    const v=get();
    if(v>Number(number.max)){range.max=logarithmic?Math.log10(v):v;number.max=v}
    if(v<Number(number.min)){range.min=logarithmic?Math.log10(v):v;number.min=v}
    if(document.activeElement!==range)range.value=logarithmic?Math.log10(v):v;
    if(logarithmic)range.setAttribute('aria-valuetext',fmt(v,1)+' mm');
    if(document.activeElement!==number)number.value=fmt(v,6);
  }
  const r=state.ray,m=state.maker,p=state.plate,d=makerResult();
  if(state.tab==='ray'){
    $('lensType').value=String(Math.sign(r.f));$('lensType').disabled=r.lock;disablePair('rayF',r.lock);
    for(const [id,key] of [['lockMaker','lock'],['showFoci','foci'],['showLabels','labels'],['showEq','equations']])$(id).checked=r[key];
    $('lockMaker').disabled=!Number.isFinite(d.f);
    $('lockHelp').textContent=!Number.isFinite(d.f)?'The current Lens Maker shape has zero power; choose a powered lens to link it.':r.lock?'Focal length follows Lens Maker. Uncheck to adjust it here.':'';
  }else if(state.tab==='maker'){
    $('advanced').checked=m.advanced;$('mediumField').hidden=!m.advanced;
    [1,2].forEach(i=>{
      const radius=m['R'+i];$('plane'+i).checked=radius===null;
      $('sign'+i).value=String(Math.sign(radius??radiusMemory[i-1]));
      $('sign'+i).disabled=radius===null;disablePair('makerR'+i,radius===null);
    });
    $('apertureHelp').textContent='Aperture stays below the surface diameters so the circular lens surfaces remain possible.';
    document.querySelector('[data-action="use-ray"]').disabled=!Number.isFinite(d.f);
    document.querySelector('[data-action="use-plate"]').disabled=!(Number.isFinite(d.f)&&d.f>0);
    $('transferHelp').textContent=d.f<=0?'A diverging lens alone does not form a real focal plane. Use a converging lens for Plate Scale.':!Number.isFinite(d.f)?'This lens has no finite focus. Give it nonzero optical power to use it in another view.':'Focal length is transferred in the correct units. The Ray Diagram stays linked to this lens.';
  }else{
    if(document.activeElement!==$('plateAngle'))$('plateAngle').value=fmt(p.angle,6);
    $('plateAngle').max=radiansToAngle(Math.PI/18,p.unit);
    $('angleUnit').value=p.unit;$('pixelGrid').checked=p.grid;$('detectorAspect').value=String(p.aspect);
  }
}
function rows(entries){return entries.map(([a,b])=>'<div class="out"><span>'+a+'</span><b>'+b+'</b></div>').join('')}
function update(){
  const m=state.maker,r=state.ray,p=state.plate;
  const finiteR=[m.R1,m.R2].filter(v=>v!==null).map(Math.abs);
  if(finiteR.length)m.D=Math.min(m.D,1.8*Math.min(...finiteR));
  const lens=makerResult();
  if(r.lock){if(Number.isFinite(lens.f))r.f=lens.f;else r.lock=false}
  if(state.tab==='maker'){
    const limit=finiteR.length?Math.min(.4,1.8*Math.min(...finiteR)):.4;
    $('makerD').max=limit;$('makerDN').max=limit;
  }
  syncControls();
  const titles={ray:['Ray Diagram','Drag the magenta object · arrow keys move it'],maker:['Lens Maker','Light travels left → right · circular surfaces'],plate:['Focal Plane & Plate Scale',p.scaleMode==='real'?'Real scale · focus follows at right · scroll to zoom · drag horizontally':'True cone angles · fitted view']};
  $('canvasTitle').textContent=titles[state.tab][0];$('canvasHint').textContent=titles[state.tab][1];
  $('titleTools').hidden=state.tab!=='plate';
  document.querySelectorAll('[data-scale-mode]').forEach(button=>{
    const selected=button.dataset.scaleMode===p.scaleMode;
    button.setAttribute('aria-pressed',selected);
    button.onclick=()=>{
      if(p.scaleMode===button.dataset.scaleMode)return;
      p.scaleMode=button.dataset.scaleMode;
      if(p.scaleMode==='real')p.camera={zoom:1,panX:0,panY:0};
      update();
    };
  });
  $('resetRealView').hidden=state.tab!=='plate'||p.scaleMode!=='real';
  $('resetRealView').onclick=()=>{p.camera={zoom:1,panX:0,panY:0};update()};
  canvas.dataset.interactive=state.tab==='ray'||(state.tab==='plate'&&p.scaleMode==='real');
  canvas.setAttribute('aria-label',state.tab==='ray'?'Ray diagram. Use left and right arrow keys to change object distance; up and down change height.':state.tab==='plate'&&p.scaleMode==='real'?'Real-scale telescope diagram. Scroll to zoom and drag horizontally to pan.':'Focal plane and plate-scale diagram.');
  if(state.tab==='ray'){
    const d=thinLens(r.f,r.p);
    $('notice').innerHTML='<strong>'+ (d.atInfinity?'At the focus: outgoing rays are parallel.':d.imageType==='real'?'Actual rays meet at a real image.':'Backward extensions meet at a virtual image.')+'</strong>'+
      '<p>Amber: parallel then through the focal point. Purple: straight through the center. Green: focal construction then parallel.</p>'+
      (r.equations?'<div class="equation">1/f = 1/p + 1/q &nbsp; · &nbsp; m = −q/p</div>':'')+
      '<p title="The thin-lens model uses paraxial rays close to the optical axis.">Thin-lens, paraxial model. Dashed extensions carry no light.</p>';
    $('readouts').innerHTML=rows([['Focal length f',fmt(r.f)+' m'],['Object distance p',fmt(r.p)+' m'],['Image distance q',fmt(d.q)+' m'],['Magnification m',d.atInfinity?'Undefined':fmt(d.magnification)],['Image',d.atInfinity?'At infinity':d.imageType+' · '+d.imageOrientation],['Size',d.atInfinity?'No finite image':d.sizeClass]]);
  }else if(state.tab==='maker'){
    $('notice').innerHTML='<strong>Curvature and refractive index set the optical power.</strong><div class="equation">1/f = (n/nₘ − 1)(1/R₁ − 1/R₂)</div><p>R is positive when the center of curvature is to the right of the surface, and negative to the left. A plane surface contributes zero.</p><p>The profile uses circular surfaces; thickness is illustrative. Rays follow the thin-lens approximation.</p>';
    $('readouts').innerHTML=rows([['Lens / medium index',fmt(m.n)+' / '+fmt(m.advanced?m.medium:1)],['R₁ / R₂',fmt(m.R1??Infinity)+' / '+fmt(m.R2??Infinity)+' m'],['Optical power',fmt(lens.power)+' diopters'],['Focal length',fmt(lens.f)+' m'],['Behavior',lens.type]]);
  }else{
    const im=focalImageSize(p.f,p.angle,p.unit),fits=im.exact<=Math.min(p.width,p.width/p.aspect);
    const suppliedPhoto=['Moon','Sun','Jupiter','Saturn','Venus'].includes(p.target);
    $('notice').innerHTML='<strong>'+(p.scaleMode==='real'?'Real scale: every length uses one shared scale.':'Double the focal length: double the image size.')+'</strong><div class="equation">y = f tan θ ≈ fθ</div><p>'+
      (p.scaleMode==='real'?'Scroll to zoom the camera and drag horizontally to pan. The optical axis stays anchored; the aperture, focal distance, and image height remain in their correct physical proportion. The detector inset below is enlarged separately.':p.target==='1 arcsecond'?'The inset magnifies a fixed 60 µm-wide region of the detector, so the tiny image visibly grows with f. Grid lines show actual detector pixels.':'θ is measured from the axis to the other edge of the target. The detector inset centers that span for the fit comparison.')+
      '</p><p title="Plate scale is angular separation per physical distance on the detector.">Plate scale = 206265/f arcsec/mm. Smaller arcsec/pixel means finer angular sampling, not necessarily sharper resolution.</p>'+
      (suppliedPhoto?'<p>User-supplied image, scaled to the calculated '+(p.target==='Saturn'?'outer-ring width':'disk diameter')+'. Image detail is illustrative.</p>':'');
    $('readouts').innerHTML=rows([['Focal ratio','f/'+fmt(p.f/p.D,2)],['Plate scale',fmt(plateScale(p.f),2)+' arcsec/mm'],['Pixel scale',fmt(pixelScale(p.f,p.pixel))+' arcsec/pixel'],['Detector dimensions',fmt(p.width,1)+' × '+fmt(p.width/p.aspect,1)+' mm'],['Image size · exact',fmt(im.exact,4)+' mm'],['Small-angle size',fmt(im.smallAngle,4)+' mm'],['Image sampling',fmt(im.exact/(p.pixel/1000),1)+' pixels'],['Fits detector',fits?'Yes':'No · target is clipped']]);
  }
  layout=drawOptics(canvas,state)||{};
  if(state.tab==='plate'&&typeof layout.fitsDetector==='boolean'){
    $('readouts').querySelector('.out:last-child b').textContent=layout.fitsDetector?'Yes':'No · target is clipped';
  }
}
function selectTab(tab){
  state.tab=tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===tab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1});
  $('workspace').setAttribute('aria-labelledby','tab-'+tab);
  buildControls();update();
}
function action(a){
  const r=state.ray,m=state.maker,p=state.plate;
  if(a.startsWith('ray-')){
    const presets={beyond:[.5,1.5],'2f':[.5,1],between:[.5,.75],focus:[.5,.5],inside:[.5,.32],diverge:[-.5,.8],reset:[.676,1.5]};
    [r.f,r.p]=presets[a.slice(4)];r.h=.24;r.lock=false;
  }else if(a.startsWith('mk-')){
    const presets={bi:[1.5,.25,-.25],pc:[1.5,.25,null],pm:[1.5,.2,.5],bc:[1.5,-.25,.25],pn:[1.5,null,.25],nm:[1.5,-.2,-.5],a:[1.37,.25,null],b:[1.37,-.22,.25]};
    [m.n,m.R1,m.R2]=presets[a.slice(3)];m.medium=1;m.advanced=false;
    [m.R1,m.R2].forEach((v,i)=>{if(v!==null)radiusMemory[i]=v});
  }else if(a==='use-ray'){r.f=makerResult().f;r.lock=true;selectTab('ray');return}
  else if(a==='use-plate'){p.f=makerResult().f*1000;selectTab('plate');return}
  else if(a==='pl-lecture'){Object.assign(p,{f:2032,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:24,target:'Moon'})}
  else if(a==='pl-fast'){Object.assign(p,{f:800,D:200})}
  else{const presets={'pl-moon':[.5,'deg','Moon'],'pl-sun':[.5,'deg','Sun'],'pl-jupiter':[45,'arcsec','Jupiter'],'pl-saturn':[40,'arcsec','Saturn'],'pl-venus':[20,'arcsec','Venus'],'pl-one':[1,'arcsec','1 arcsecond']};[p.angle,p.unit,p.target]=presets[a]}
  update();
}
document.querySelectorAll('[data-tab]').forEach(b=>{
  b.onclick=()=>selectTab(b.dataset.tab);
  b.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();const tabs=['ray','maker','plate'],i=tabs.indexOf(state.tab);
    const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;
    selectTab(tabs[next]);$('tab-'+tabs[next]).focus();
  };
});
let drag=false,pan=null;
canvas.onpointerdown=e=>{
  if(state.tab==='plate'&&state.plate.scaleMode==='real'){
    pan={x:e.clientX,panX:state.plate.camera.panX};
    canvas.setPointerCapture(e.pointerId);return;
  }
  if(state.tab!=='ray')return;
  const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;
  if(Math.abs(x-layout.objectX)>25||y<Math.min(layout.cy,layout.objectY)-25||y>Math.max(layout.cy,layout.objectY)+25)return;
  drag=true;canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove=e=>{
  if(pan){
    state.plate.camera.panX=pan.panX+e.clientX-pan.x;
    update();return;
  }
  if(!drag)return;
  const box=canvas.getBoundingClientRect();
  state.ray.p=clamp((layout.cx-(e.clientX-box.left))/layout.scale,.02,10);
  state.ray.h=clamp((layout.cy-(e.clientY-box.top))/layout.scale,.02,1);update();
};
canvas.onpointerup=canvas.onpointercancel=()=>{drag=false;pan=null};
canvas.onwheel=e=>{
  if(state.tab!=='plate'||state.plate.scaleMode!=='real')return;
  e.preventDefault();
  const box=canvas.getBoundingClientRect(),p=state.plate,camera=p.camera;
  const oldScale=layout.scale;
  if(!(oldScale>0))return;
  const nextZoom=clamp(camera.zoom*Math.exp(-e.deltaY*.0015),.05,50);
  const nextScale=oldScale*nextZoom/camera.zoom;
  const x=e.clientX-box.left,y=e.clientY-box.top;
  const world=layout.realCamera?.screenToWorld?.(x,y);
  if(!world)return;
  const autoNext=Math.min(0,(box.width*.78)-layout.realCamera.x0-state.plate.f*nextScale);
  camera.panX=x-layout.realCamera.x0-autoNext-world.x*nextScale;
  camera.zoom=nextZoom;update();
},{passive:false};
canvas.onkeydown=e=>{
  if(state.tab!=='ray'||!e.key.startsWith('Arrow'))return;
  e.preventDefault();const r=state.ray;
  if(e.key==='ArrowLeft')r.p=clamp(r.p+.02,.02,10);
  if(e.key==='ArrowRight')r.p=clamp(r.p-.02,.02,10);
  if(e.key==='ArrowUp')r.h=clamp(r.h+.02,.02,1);
  if(e.key==='ArrowDown')r.h=clamp(r.h-.02,.02,1);
  update();
};
let resizing=false,railWidth=290;
const setWidth=v=>{railWidth=clamp(v,240,420);document.documentElement.style.setProperty('--rail-width',railWidth+'px');$('splitter').setAttribute('aria-valuenow',railWidth)};
$('splitter').onpointerdown=e=>{resizing=true;$('splitter').setPointerCapture(e.pointerId)};
$('splitter').onpointermove=e=>{if(resizing)setWidth(e.clientX-$('workspace').getBoundingClientRect().left)};
$('splitter').onpointerup=$('splitter').onpointercancel=()=>resizing=false;
$('splitter').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(railWidth+(e.key==='ArrowRight'?10:-10))}};
new ResizeObserver(()=>{layout=drawOptics(canvas,state)||{}}).observe(canvas.parentElement);
selectTab('ray');
