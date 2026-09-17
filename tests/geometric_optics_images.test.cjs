const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = { devicePixelRatio: 1 };

function canvasRecorder() {
  const calls = [], arcs = [];
  const ctx = {
    save() {}, restore() {}, setTransform() {}, clearRect() {}, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {}, fill() {},
    closePath() {}, arc(...args) { arcs.push(args); }, rect() {}, clip() {}, strokeRect() {}, setLineDash() {},
    fillText() {}, drawImage(...args) { calls.push(args); },
  };
  return { calls, arcs, canvas: { getBoundingClientRect: () => ({ width: 800, height: 500 }), getContext: () => ctx } };
}

test('provided target photos use cropped sources and preserve their aspect ratio', async () => {
  const images = [];
  const expectedRatio = { Moon: 2151 / 2145, Sun: 737 / 775, Jupiter: 1039 / 1101, Saturn: 1318 / 3259, Venus: 937 / 895 };
  global.Image = class FakeImage {
    set src(value) { this.url = value; images.push(this); queueMicrotask(() => this.onload()); }
  };
  const { drawOptics } = await import('../html/geometric_optics_view.js');
  for (const target of ['Moon · 0.5°', 'Sun · 0.5°', 'Jupiter · 0.5°', 'Saturn · 40″', 'Venus · 20″']) {
    const { canvas, calls } = canvasRecorder();
    drawOptics(canvas, { tab: 'plate', plate: { f: 2032, D: 203.2, angle: .5, unit: 'deg', width: 24, pixel: 4.8, target, grid: true } });
    await new Promise(resolve => setImmediate(resolve));
    const imageCall = calls.find(args => args.length === 9);
    assert.ok(imageCall, `${target} draws a cropped image`);
    assert.ok(imageCall[8] > 0 && imageCall[7] > 0, `${target} has a positive displayed footprint`);
    const name = target.split(' ')[0];
    assert.ok(Math.abs(imageCall[8] / imageCall[7] - expectedRatio[name]) < 1e-12, `${target} preserves crop aspect ratio`);
  }
  assert.deepEqual(images.map(image => image.url).sort(), [
    '../assets/optics/jupiter-provided.png', '../assets/optics/moon-provided.png',
    '../assets/optics/saturn-provided.png', '../assets/optics/sun-provided.png', '../assets/optics/venus-provided.png',
  ].sort());
});
