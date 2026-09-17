const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={devicePixelRatio:1};
const renderer=import('../html/geometric_optics_view.js');
function canvas(){
  const ctx=new Proxy({},{get:(obj,key)=>key in obj?obj[key]:()=>{},set:(obj,key,value)=>{obj[key]=value;return true}});
  return {getBoundingClientRect:()=>({width:800,height:500}),getContext:()=>ctx};
}
test('focal plane moves continuously with equal physical x/y scales',async()=>{
  const {drawOptics}=await renderer;
  const draw=f=>drawOptics(canvas(),{tab:'plate',plate:{f,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:24}});
  const D=203.2;
  const a=draw(100),b=draw(150),near=draw(159),edge=draw(160),after=draw(161);
  assert.equal(b.scaleX,a.scaleX);
  assert.ok(Math.abs((b.cx-b.objectX)/(a.cx-a.objectX)-1.5)<1e-12);
  assert.ok(Math.abs(after.cx-edge.cx)<6,'focus remains continuous at the transition');
  assert.ok(after.cx>edge.cx&&edge.cx>near.cx,'focus keeps moving right after easing begins');
  let previous=0;
  for(const f of [100,150,159,160,161,200,201,400,2032,10000,100000]){
    const r=draw(f);
    assert.equal(r.scaleX,r.scaleY);
    assert.ok(Math.abs(r.aperturePx/r.scale-D/2)<1e-9);
    assert.ok(Math.abs(r.chiefSlope-Math.tan(.5*Math.PI/180))<1e-12);
    assert.ok(r.cx>previous&&r.cx<800);
    previous=r.cx;
    assert.ok(Math.abs((r.cx-r.objectX)/r.scaleX-f)<1e-9);
  }
});

test('pixel size changes physical grid spacing while grouping stays viewport-based',async()=>{
  const {drawOptics}=await renderer;
  const draw=pixel=>drawOptics(canvas(),{tab:'plate',plate:{f:2032,D:203.2,angle:.5,unit:'deg',pixel,width:24,grid:true}});
  const a=draw(4.8),b=draw(9.6),c=draw(1);
  assert.equal(a.gridGroup,b.gridGroup);
  assert.ok(Math.abs(b.gridCellPx/a.gridCellPx-2)<1e-12);
  assert.ok(c.gridCellPx<a.gridCellPx);
});

test('one arcsecond detail has fixed physical scale and grows linearly with focal length',async()=>{
  const {drawOptics}=await renderer;
  const draw=f=>drawOptics(canvas(),{tab:'plate',plate:{f,D:203.2,angle:1,unit:'arcsec',target:'1 arcsecond',pixel:4.8,width:24}});
  const a=draw(100),b=draw(1000),c=draw(10000);
  for(const r of [a,b,c])assert.equal(r.detectorDisplayedWidth,.06);
  // The detector inset can resize slightly to clear the cone labels; compare
  // the target's fraction of that inset so focal-length scaling is isolated.
  assert.ok(Math.abs((b.targetSpan/b.detectorPixelWidth)/(a.targetSpan/a.detectorPixelWidth)-10)<1e-9);
  assert.ok(Math.abs((c.targetSpan/c.detectorPixelWidth)/(a.targetSpan/a.detectorPixelWidth)-100)<1e-9);
});

test('detector aspect controls the centered lower inset and physical fit',async()=>{
  const {drawOptics}=await renderer;
  const draw=(plate)=>drawOptics(canvas(),{tab:'plate',plate});
  const wide=draw({f:2032,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:24,aspect:'4:3',target:'Moon'});
  const square=draw({f:2032,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:24,aspect:'1:1',target:'Moon'});
  assert.ok(Math.abs(wide.detectorPixelWidth/wide.detectorPixelHeight-4/3)<1e-12);
  assert.ok(Math.abs(square.detectorPixelWidth/square.detectorPixelHeight-1)<1e-12);
  assert.equal(draw({f:2032,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:10,aspect:'1:1',target:'Moon'}).fitsDetector,false);
  assert.equal(draw({f:2032,D:203.2,angle:.01,unit:'deg',pixel:4.8,width:10,aspect:'1:1',target:'Saturn'}).fitsDetector,true);
});

test('optical-axis ruler ticks retain physical positions while the view expands',async()=>{
  const {drawOptics}=await renderer;
  const draw=f=>drawOptics(canvas(),{tab:'plate',plate:{f,D:203.2,angle:.5,unit:'deg',pixel:4.8,width:24,aspect:'4:3'}});
  const short=draw(100), long=draw(1000);
  assert.ok(long.visibleSpan>short.visibleSpan);
  for(const tick of short.rulerTicks) {
    assert.ok(Math.abs((tick.x-short.objectX)/short.scaleX-tick.distance)<1e-9);
    if(tick.major) assert.match(tick.label,/mm|m/);
  }
  assert.ok(short.rulerMajor>0&&long.rulerMajor>=short.rulerMajor);
});

test('1 arcsecond detail can be magnified while physical detector fit remains truthful',async()=>{
  const {drawOptics}=await renderer;
  const r=drawOptics(canvas(),{tab:'plate',plate:{f:100000,D:203.2,angle:1,unit:'arcsec',target:'1 arcsecond',pixel:4.8,width:24,aspect:'4:3'}});
  assert.equal(r.fitsDetector,true);
  assert.equal(r.detailClipped,true);
});

test('real camera keeps a fixed physical scale and exposes reversible transforms',async()=>{
  const {drawOptics}=await renderer;
  const draw=f=>drawOptics(canvas(),{tab:'plate',plate:{f,D:203.2,angle:.5,unit:'deg',scaleMode:'real',camera:{zoom:1,panX:0,panY:0}}});
  const near=draw(100), mid=draw(1000), far=draw(100000);
  assert.equal(near.scale,far.scale);
  assert.equal(near.scaleX,near.scaleY);
  assert.equal(near.cy,100);
  assert.equal(far.cy,100);
  assert.ok(Math.abs(far.realCamera.sensorSegmentPx - (24 / (4 / 3)) * far.scale) < 1e-9);
  const fixedPanel=drawOptics(canvas(),{tab:'plate',plate:{f:100,D:203.2,angle:.5,unit:'deg',scaleMode:'real',camera:{zoom:1}}});
  const zoomedPanel=drawOptics(canvas(),{tab:'plate',plate:{f:100000,D:500,angle:.5,unit:'deg',scaleMode:'real',camera:{zoom:4}}});
  assert.equal(fixedPanel.detectorPixelWidth,zoomedPanel.detectorPixelWidth);
  assert.equal(fixedPanel.detectorPixelHeight,zoomedPanel.detectorPixelHeight);
  assert.ok(zoomedPanel.realCamera.sensorSegmentPx>fixedPanel.realCamera.sensorSegmentPx);
  assert.ok(far.detectorPixelWidth>0&&far.detectorPixelHeight>0,'real mode retains the enlarged detector panel');
  assert.ok(far.gridCellPx>0&&far.detectorPhysicalHeight>0);
  assert.ok(mid.cx>near.cx&&mid.cx<far.cx,'focus moves with physical focal length before the guard');
  assert.equal(far.cx,far.realCamera.targetFocusX);
  assert.ok(far.realCamera.autoPanX<0&&far.realCamera.totalPanX<0,'automatic follow shifts the origin left');
  const c=far.realCamera;
  assert.ok(Math.abs(c.screenToWorld(800, 0).x - c.screenToWorld(0, 0).x - far.visibleSpan) < 1e-9);
  const screen=c.worldToScreen.x(1234.5);
  assert.ok(Math.abs(c.screenToWorld(screen,c.worldToScreen.y(-7.25)).x-1234.5)<1e-9);
  assert.ok(Math.abs(c.screenToWorld(screen,c.worldToScreen.y(-7.25)).y+7.25)<1e-9);
});

test('real camera zoom and pan alter view coordinates without changing world distances',async()=>{
  const {drawOptics}=await renderer;
  const r=drawOptics(canvas(),{tab:'plate',plate:{f:1000,D:203.2,angle:.5,unit:'deg',scaleMode:'real',camera:{zoom:2,panX:30,panY:-12}}});
  assert.equal(r.scale,.7);
  const a=r.realCamera.worldToScreen.x(100), b=r.realCamera.worldToScreen.x(200);
  assert.equal(b-a,70);
  assert.equal(r.realCamera.worldToScreen.y(10)-r.realCamera.worldToScreen.y(0),7);
});
