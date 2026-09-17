const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = import('../html/spherical_shell_extensions_model.js');
function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

test('uniform shell cancels throughout its interior and matches a point mass outside', async () => {
  const { shellField, starField, addFields } = await model;
  for (const p of [[0,0,0], [.5,.4,.2], [-.8,.1,0]]) assert.deepEqual(shellField(p), [0,0,0]);
  for (const p of [[2,0,0], [-1.2,1.1,.5]]) {
    shellField(p).forEach((v,i) => close(v, starField(p,1)[i]));
  }
  assert.equal(shellField([1,0,0]), null);
  assert.equal(starField([0,0,0]), null);
  assert.deepEqual(addFields(shellField([.5,0,0]), starField([.5,0,0])), [-2,0,0]);
});

test('ring center is in-plane unstable and vertically restoring', async () => {
  const { ringField } = await model;
  close(Math.hypot(...ringField([0,0,0])), 0);
  for (const offset of [.01,.2,.8]) {
    const f = ringField([offset,0,0]); assert.ok(f[0] > 0); close(f[1],0); close(f[2],0);
    close(ringField([-offset,0,0])[0], -f[0]);
    close(ringField([0,offset,0])[1], f[0]);
  }
  close(ringField([.001,0,0])[0] / .001, .5, 1e-6);
  for (const z of [-.5,.5]) close(ringField([0,0,z])[2], -z/(1+z*z)**1.5);
  const f = ringField([.2,.1,.3]), scaled = ringField([.4,.2,.6],2);
  scaled.forEach((v,i) => close(v, f[i]/4));
  assert.equal(ringField([1,0,0]), null);
});

test('equal-solid-angle opposing shell patches cancel through area-distance weighting', async () => {
  const { oppositeShellPatches } = await model;
  for (const p of [[0,0],[.7,.2],[-.3,.8]]) for (const angle of [0,.6,1.4,2.7]) {
    const pair = oppositeShellPatches(p,angle);
    close(Math.hypot(...pair.near),1); close(Math.hypot(...pair.far),1);
    close(pair.areaRatio/(pair.farDistance**2),1/(pair.nearDistance**2));
    const a = pair.near.map((v,i)=>(v-p[i])/pair.nearDistance);
    const b = pair.far.map((v,i)=>(v-p[i])/pair.farDistance);
    close(a[0]+b[0],0); close(a[1]+b[1],0);
    // The surface normals at a chord's ends make equal incidence angles.
    // This is the extra geometric factor needed to convert solid angle to area.
    const nearCos = Math.abs(a.reduce((sum,v,i)=>sum+v*pair.near[i],0));
    const farCos = Math.abs(b.reduce((sum,v,i)=>sum+v*pair.far[i],0));
    close(nearCos,farCos);
    const nearArea = pair.nearDistance**2/nearCos;
    const farArea = pair.farDistance**2/farCos;
    close(farArea/nearArea,pair.areaRatio);
  }
});
