const test = require('node:test');
const assert = require('node:assert/strict');
const model = import('../html/spherical_shell_model.js');

test('running integral agrees with independent ring-force quadrature', async () => {
  const { accumulatedForce, ringDensity } = await model;
  for (const r of [0, 1e-8, .5, .99, 1.01, 1.6, 3]) {
    for (const theta of [.1, .8, 2.2, Math.PI]) {
      const n = 40000, step = theta / n;
      let numerical = 0;
      for (let i = 0; i < n; i++) numerical += ringDensity(r, (i + .5) * step) * step;
      assert.ok(Math.abs(accumulatedForce(r, theta) - numerical) < 2e-6, `r=${r}, theta=${theta}`);
    }
  }
});

test('interior outward partial force cancels when all rings are included', async () => {
  const { accumulatedForce, fullForce } = await model;
  assert.ok(accumulatedForce(.5, 1) < 0);
  for (const r of [0, .5, .99, 1.01, 1.6, 3]) {
    assert.equal(accumulatedForce(r, 0), 0);
    assert.equal(accumulatedForce(r, Math.PI), fullForce(r));
  }
  assert.ok(Number.isNaN(accumulatedForce(1, 1)));
});

test('relocated ring masses have a different curve but the same exterior total', async () => {
  const { ringDensity, accumulatedForce, pointRingDensity, pointAccumulatedForce } = await model;
  for (const r of [1.01, 1.6, 2, 3]) {
    const n = 40000, step = Math.PI / n;
    let pointArea = 0;
    for (let i = 0; i < n; i++) pointArea += pointRingDensity(r, (i + .5) * step) * step;
    assert.ok(Math.abs(pointArea - accumulatedForce(r, Math.PI)) < 1e-8);
    assert.equal(pointAccumulatedForce(r, Math.PI), 1 / (r * r));
    assert.notEqual(ringDensity(r, .5), pointRingDensity(r, .5));
    assert.notEqual(accumulatedForce(r, .5), pointAccumulatedForce(r, .5));
  }
  assert.equal(accumulatedForce(.5, Math.PI), 0);
  assert.equal(pointAccumulatedForce(.5, Math.PI), 4);
  assert.ok(Number.isNaN(pointAccumulatedForce(0, Math.PI)));
});
