const {test}=require('node:test');
const assert=require('node:assert/strict');
const view=import('../html/geometric_optics_view.js');
global.window={devicePixelRatio:1};

function recordingCanvas(){
  const strokes=[],texts=[],stack=[];let path=[];
  const ctx={strokeStyle:'',fillStyle:'',lineWidth:1,
    save(){stack.push([this.strokeStyle,this.fillStyle,this.lineWidth])},
    restore(){[this.strokeStyle,this.fillStyle,this.lineWidth]=stack.pop()},
    beginPath(){path=[]},moveTo(x,y){path.push([x,y])},lineTo(x,y){path.push([x,y])},
    stroke(){strokes.push({color:this.strokeStyle,path:[...path]})},
    setTransform(){},clearRect(){},fillRect(){},setLineDash(){},fill(){},closePath(){},
    bezierCurveTo(x1,y1,x2,y2,x3,y3){path.push([x1,y1],[x2,y2],[x3,y3])},fillText(value){texts.push(String(value))},arc(){},rect(){},clip(){},strokeRect(){}
  };
  return {strokes,texts,canvas:{getBoundingClientRect:()=>({width:800,height:500}),getContext:()=>ctx}};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);

test('drawn principal rays meet at the real or virtual image predicted by the lens equation',async()=>{
  const {drawOptics}=await view;
  for(const [f,p] of [[.5,1],[.5,.3],[-.5,.8]]){
    const {canvas,strokes}=recordingCanvas(),h=.24;
    const L=drawOptics(canvas,{tab:'ray',ray:{f,p,h}});
    const q=f*p/(p-f),imageX=L.cx+q*L.scale,imageY=L.cy+q*h/p*L.scale;
    for(const color of ['#ffcc66','#a99bff']){
      const segment=strokes.find(s=>s.color===color&&s.path.length===2&&Math.abs(s.path[0][0]-L.cx)<1e-7&&s.path[1][0]>L.cx);
      assert.ok(segment,'outgoing ray exists');
      const [[x,y],[xx,yy]]=segment.path;
      close(y+(yy-y)/(xx-x)*(imageX-x),imageY);
    }
  }
});

test('ray diagram framing stays stable as the object crosses the focal plane',async()=>{
  const {drawOptics}=await view;
  const frame=[];
  let focalApertureHeights=[];
  const focalDistance=.5;
  const positiveCutoff=focalDistance*6/(6-focalDistance);
  const negativeCutoff=focalDistance*-6/(-6-focalDistance);
  for(const samples of [
    [focalDistance-1e-8,focalDistance,focalDistance+1e-8],
    [positiveCutoff-1e-6,positiveCutoff+1e-6],
    [negativeCutoff-1e-6,negativeCutoff+1e-6],
  ]){
    const apertureHeights=[];
    const frames=samples.map(p=>{
      const {canvas,strokes}=recordingCanvas();
      const layout=drawOptics(canvas,{tab:'ray',ray:{f:focalDistance,p,h:.24}});
      const lens=strokes.find(s=>s.color==='#56c7d9');
      apertureHeights.push(Math.max(...lens.path.map(point=>point[1]))-Math.min(...lens.path.map(point=>point[1])));
      return layout;
    });
    if(samples.length===3)focalApertureHeights=apertureHeights;
    frame.push(frames);
  }
  assert.ok(Math.max(...focalApertureHeights)-Math.min(...focalApertureHeights)<1e-6);
  for(const frames of frame){
    assert.ok(Math.max(...frames.map(layout=>layout.scale))-Math.min(...frames.map(layout=>layout.scale))<.01);
    assert.ok(Math.max(...frames.map(layout=>layout.cx))-Math.min(...frames.map(layout=>layout.cx))<.01);
  }
});

test('finite image beyond the fixed view is reported without changing framing',async()=>{
  const {drawOptics}=await view;
  const {canvas,texts}=recordingCanvas();
  const layout=drawOptics(canvas,{tab:'ray',ray:{f:.5,p:.6,h:.24}});
  assert.ok(texts.includes('Finite image is outside this view; see q below.'));
  assert.ok(Number.isFinite(layout.scale));
});

test('finite image beyond the fixed vertical view is reported',async()=>{
  const {drawOptics}=await view;
  const {canvas,texts}=recordingCanvas();
  drawOptics(canvas,{tab:'ray',ray:{f:.5,p:.75,h:.4}});
  assert.ok(texts.includes('Finite image is outside this view; see q below.'));
});

test('lens silhouette is convex or concave in the intended direction',async()=>{
  const {drawOptics}=await view;
  for(const [f,shouldBulgeOut] of [[.5,true],[-.5,false]]){
    const {canvas,strokes}=recordingCanvas();
    drawOptics(canvas,{tab:'ray',ray:{f,p:.8,h:.24}});
    const lens=strokes.find(s=>s.color==='#56c7d9'&&s.path.length>=4);
    assert.ok(lens,'lens outline is drawn');
    const center=(lens.path[0][0]+lens.path[4][0])/2;
    const rim=Math.abs(lens.path[0][0]-center), control=Math.abs(lens.path[1][0]-center);
    assert.equal(control>rim,shouldBulgeOut);
  }
});

test('drawn lens-maker bundle focuses one physical focal length beyond its exit plane',async()=>{
  const {drawOptics}=await view;
  const {canvas,strokes}=recordingCanvas();
  const L=drawOptics(canvas,{tab:'maker',maker:{n:1.5,R1:.25,R2:-.25,D:.12,medium:1,advanced:false}});
  const rays=strokes.filter(s=>s.color==='#ffcc66'&&s.path.length===2&&s.path[0][0]>L.cx&&Math.abs(s.path[0][1]-L.cy)>1);
  assert.equal(rays.length,2);
  for(const {path:[[x,y],[xx,yy]]} of rays){
    const focus=x+(L.cy-y)*(xx-x)/(yy-y);
    const sag=.25-Math.sqrt(.25*.25-.06*.06);
    const thickness=2*sag+.12*.12;
    const vertex2=L.cx+thickness*L.scale/2;
    close((focus-vertex2)/L.scale,.25);
  }
  const incoming=strokes.find(s=>s.color==='#ffcc66'&&s.path[0][0]===32);
  assert.ok(incoming,'incident ray reaches a curved surface');
  const exit=strokes.find(s=>s.color==='#ffcc66'&&s.path[0][0]===incoming.path[1][0]&&s.path[0][1]===incoming.path[1][1]);
  assert.ok(exit,'in-glass segment starts exactly where the incident ray ends');
});
