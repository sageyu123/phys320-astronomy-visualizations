import { ringDensity, accumulatedForce, pointRingDensity, pointAccumulatedForce } from './spherical_shell_model.js';

const C = { text: '#e7e9eb', muted: '#979ea6', grid: '#252a31', amber: '#ffcc66', green: '#56dc72', coral: '#ff7f66', purple: '#a99bff' };
const samples = Array.from({ length: 601 }, (_, i) => Math.PI * (i / 600) ** 2);

function text(ctx, value, x, y, color = C.muted, align = 'left', size = 10) {
  ctx.fillStyle = color; ctx.font = `${size}px Inter, Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
}
function line(ctx, x, y, a, b, color, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(a, b); ctx.stroke();
}

function panel(ctx, box, r, theta, isPoint, min, max) {
  const { x, y, w, h } = box;
  const L = x + 49, right = x + w - 14, T = y + 56, bottom = y + h - 32;
  const X = t => L + t / Math.PI * (right - L);
  const Y = f => T + (max - f) / (max - min) * (bottom - T);
  const density = isPoint ? pointRingDensity : ringDensity;
  const other = isPoint ? ringDensity : pointRingDensity;
  const area = (isPoint ? pointAccumulatedForce : accumulatedForce)(r, theta);
  const color = isPoint ? C.purple : C.green;
  text(ctx, isPoint ? 'Ring masses at center' : 'Rings on shell', x + 8, y + 14, C.text, 'left', 11);
  text(ctx, Number.isFinite(area) ? `area ${area.toFixed(3)}` : 'area undefined', right, y + 14, color, 'right', 11);
  text(ctx, isPoint ? 'Each dm:  dF = Gm dm / r²' : 'Each dm:  dF = Gm dm cos α / s²', x + 8, y + 34, C.muted, 'left', 10);

  for (const [t, name] of [[0, '0'], [Math.PI / 2, 'π/2'], [Math.PI, 'π']]) {
    line(ctx, X(t), T, X(t), bottom, C.grid);
    text(ctx, name, X(t), bottom + 13, C.muted, 'center');
  }
  const step = (max - min) / 3;
  for (const v of [0, min + step, min + 2 * step, max]) {
    if (Math.abs(v) < 1e-12 && v !== 0) continue;
    line(ctx, L, Y(v), right, Y(v), v === 0 ? '#69717a' : C.grid);
    text(ctx, v.toFixed(Math.abs(v) >= 10 ? 1 : 2), L - 7, Y(v), C.muted, 'right', 9);
  }
  ctx.save(); ctx.translate(x + 9, (T + bottom) / 2); ctx.rotate(-Math.PI / 2);
  text(ctx, 'dF/dθ · GMm/R² units', 0, 0, C.muted, 'center', 9); ctx.restore();
  text(ctx, 'original ring angle θ', (L + right) / 2, bottom + 26, C.muted, 'center', 9);
  if (!Number.isFinite(area)) {
    text(ctx, isPoint ? 'Point force undefined at r = 0' : 'Ideal shell surface excluded', (L + right) / 2, (T + bottom) / 2, C.amber, 'center', 10);
    return;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(L - 4, T - 4, right - L + 8, bottom - T + 8); ctx.clip();
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = Math.min(samples[i], theta);
    if (a >= theta) break;
    const fa = density(r, a), fb = density(r, b);
    ctx.fillStyle = fa + fb < 0 ? 'rgba(255,127,102,.32)' : isPoint ? 'rgba(169,155,255,.32)' : 'rgba(86,220,114,.32)';
    ctx.beginPath(); ctx.moveTo(X(a), Y(0)); ctx.lineTo(X(a), Y(fa));
    ctx.lineTo(X(b), Y(fb)); ctx.lineTo(X(b), Y(0)); ctx.closePath(); ctx.fill();
  }
  // Dashed outline lets students compare the two shapes directly on each axis.
  ctx.setLineDash([4, 4]);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], fa = other(r, a), fb = other(r, b);
    if (Number.isFinite(fa) && Number.isFinite(fb)) line(ctx, X(a), Y(fa), X(b), Y(fb), '#69717a');
  }
  ctx.setLineDash([]);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], fa = density(r, a), fb = density(r, b);
    line(ctx, X(a), Y(fa), X(b), Y(fb), fa + fb < 0 ? C.coral : color, 1.8);
  }
  ctx.setLineDash([3, 4]); line(ctx, X(theta), T, X(theta), bottom, C.amber); ctx.setLineDash([]);
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(X(theta), Y(density(r, theta)), 3, 0, 2 * Math.PI); ctx.fill();
  ctx.restore();
}

export function drawComparison(canvas, r, theta) {
  const { width: w, height: h } = canvas.getBoundingClientRect();
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const values = [...samples, theta].flatMap(t => [ringDensity(r, t), pointRingDensity(r, t)]).filter(Number.isFinite);
  const lo = Math.min(0, ...values), hi = Math.max(.01, ...values), span = hi - lo;
  const min = lo - span * .08, max = hi + span * .1;
  const stacked = w < 600;
  const boxes = stacked
    ? [{ x: 0, y: 0, w, h: h / 2 }, { x: 0, y: h / 2, w, h: h / 2 }]
    : [{ x: 0, y: 0, w: w / 2, h }, { x: w / 2, y: 0, w: w / 2, h }];
  panel(ctx, boxes[0], r, theta, false, min, max);
  panel(ctx, boxes[1], r, theta, true, min, max);
}
