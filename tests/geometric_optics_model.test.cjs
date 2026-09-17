const { test } = require('node:test');
const assert = require('node:assert/strict');

const model = import('../html/geometric_optics_model.js');

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('thin lens returns real and virtual images with the stated signs', async () => {
  const { thinLens } = await model;

  const real = thinLens(1, 3);
  close(real.q, 1.5);
  close(real.magnification, -0.5);
  assert.equal(real.imageType, 'real');
  assert.equal(real.imageOrientation, 'inverted');
  assert.equal(real.sizeClass, 'reduced');

  const atTwoF = thinLens(1, 2);
  close(atTwoF.q, 2);
  close(atTwoF.magnification, -1);
  assert.equal(atTwoF.sizeClass, 'same size');

  const inside = thinLens(1, 0.5);
  close(inside.q, -1);
  close(inside.magnification, 2);
  assert.equal(inside.imageType, 'virtual');
  assert.equal(inside.imageOrientation, 'upright');
  assert.equal(inside.sizeClass, 'enlarged');

  const infinity = thinLens(1, 1);
  assert.equal(infinity.atInfinity, true);
  assert.equal(infinity.q, Infinity);
  assert.equal(infinity.imageType, 'at infinity');
});

test('diverging lens gives a virtual upright reduced image', async () => {
  const { thinLens } = await model;
  const result = thinLens(-0.317, 0.5);
  close(result.q, -0.1939, 2e-4);
  close(result.magnification, 0.3878, 4e-4);
  assert.equal(result.imageType, 'virtual');
  assert.equal(result.imageOrientation, 'upright');
  assert.equal(result.sizeClass, 'reduced');
});

test('lens maker handles converging, diverging, and plane surfaces', async () => {
  const { lensMaker } = await model;
  const planoConvex = lensMaker(1.37, 0.25, Infinity);
  close(planoConvex.f, 0.6756756756756757, 1e-12);
  close(planoConvex.power, 1.48, 1e-12);
  assert.equal(planoConvex.type, 'converging');

  const planoConvexNull = lensMaker(1.37, 0.25, null);
  close(planoConvexNull.f, planoConvex.f, 1e-12);

  // A biconcave choice under the signed-radius convention, selected to match
  // the lecture's approximately -0.317 m diverging example.
  const diverging = lensMaker(1.37, -0.22, 0.25);
  close(diverging.f, -0.3162737205290396, 1e-12);
  assert.equal(diverging.type, 'diverging');

  const flat = lensMaker(1.5, Infinity, Infinity);
  assert.equal(flat.f, Infinity);
  assert.equal(flat.type, 'afocal');
});

test('f-ratio, plate scale, pixel scale, and lecture Moon size', async () => {
  const { focalRatio, plateScale, pixelScale, focalImageSize } = await model;
  close(focalRatio(2032, 203.2), 10);
  close(plateScale(2032), 206264.80624709636 / 2032, 1e-12);
  close(pixelScale(2032, 5), 206264.80624709636 * 0.005 / 2032, 1e-12);

  const moon = focalImageSize(2032, 0.5, 'deg');
  close(moon.exact, 17.73299535082186, 1e-10);
  close(moon.smallAngle, 17.73254520026239, 1e-10);
  assert.ok(Math.abs(moon.fractionalDifference) < 3e-5);
});

test('angle conversions support degrees, arcminutes, arcseconds, and radians', async () => {
  const { angleToRadians, radiansToAngle, degreesToRadians, radiansToDegrees } = await model;
  close(angleToRadians(180, 'deg'), Math.PI);
  close(angleToRadians(60, 'arcmin'), Math.PI / 180);
  close(angleToRadians(3600, 'arcsec'), Math.PI / 180);
  close(radiansToAngle(Math.PI, 'degrees'), 180);
  close(radiansToAngle(Math.PI / 180, 'arcmin'), 60);
  close(radiansToAngle(Math.PI / 180, 'arcsec'), 3600);
  close(degreesToRadians(1), Math.PI / 180);
  close(radiansToDegrees(Math.PI), 180);
  assert.equal(angleToRadians(1, 'furlong'), null);
});

test('invalid inputs are explicit and do not create numerical blow-ups', async () => {
  const { thinLens, lensMaker, focalRatio, focalImageSize } = await model;
  assert.equal(thinLens(0, 1).valid, false);
  assert.equal(thinLens(1, 0).valid, false);
  assert.equal(lensMaker(1.5, 0, 0).valid, false);
  assert.equal(focalRatio(1, 0), null);
  assert.equal(focalImageSize(1, 1, 'unknown').valid, false);
});
