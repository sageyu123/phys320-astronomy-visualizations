import { thinLens, lensMaker, focalImageSize, angleToRadians } from './geometric_optics_model.js';

const COLORS = {
  bg: '#0d1015', grid: '#3b4046', text: '#e7e9eb', muted: '#979ea6',
  cyan: '#56c7d9', amber: '#ffcc66', purple: '#a99bff', green: '#56dc72',
  coral: '#ff7f66', magenta: '#ee65be', glass: 'rgba(86,199,217,.13)',
};
const EPS = 1e-9;
const PHOTO_CROPS = {
  moon: { src: '../assets/optics/moon-provided.png', rect: [220, 173, 2145, 2151], shape: 'disk' },
  sun: { src: '../assets/optics/sun-provided.png', rect: [99, 2, 775, 737], physicalWidth: 680, shape: 'disk' },
  jupiter: { src: '../assets/optics/jupiter-provided.png', rect: [91, 61, 1101, 1039], shape: 'disk' },
  saturn: { src: '../assets/optics/saturn-provided.png', rect: [298, 110, 3259, 1318], shape: 'rings' },
  venus: { src: '../assets/optics/venus-provided.png', rect: [90, 80, 895, 937], shape: 'disk' },
};
const photoCache = new Map();
const latestStates = new WeakMap();

const finite = value => Number.isFinite(Number(value));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const val = (v, fallback) => finite(v) ? Number(v) : fallback;
function niceGridGroup(raw) {
  if (raw <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const multiplier of [1, 2, 5, 10]) if (power * multiplier >= raw) return power * multiplier;
  return power * 10;
}
function niceRulerStep(raw) {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const multiplier of [1, 2, 5, 10]) if (power * multiplier >= raw) return power * multiplier;
  return power * 10;
}
function rulerLabel(distanceMm) {
  return distanceMm >= 1000 ? `${(distanceMm / 1000).toFixed(distanceMm < 10000 ? 1 : 0)} m` : `${distanceMm.toFixed(distanceMm < 10 ? 1 : 0)} mm`;
}
function drawAxisRuler(ctx, x0, y0, scaleX, visibleSpan, width) {
  const available = width - 48;
  const major = niceRulerStep(visibleSpan * 70 / available);
  const minor = major / 5;
  const ticks = [];
  for (let distance = major; distance <= visibleSpan + minor * .1; distance += minor) {
    const x = x0 + distance * scaleX;
    if (x > width - 24) break;
    const isMajor = Math.abs(distance / major - Math.round(distance / major)) < 1e-7;
    line(ctx, [x, y0 - (isMajor ? 7 : 4)], [x, y0 + (isMajor ? 7 : 4)], isMajor ? COLORS.amber : COLORS.muted, isMajor ? 1.2 : 1);
    if (isMajor) text(ctx, rulerLabel(distance), x, y0 + 17, COLORS.muted, 9, 'center');
    ticks.push({ distance, x, major: isMajor, label: isMajor ? rulerLabel(distance) : '' });
  }
  return { major, minor, ticks };
}
function parseAspect(value) {
  if (typeof value === 'string' && value.includes(':')) {
    const [w, h] = value.split(':').map(Number);
    if (finite(w) && finite(h) && w > 0 && h > 0) return w / h;
  }
  return finite(value) && Number(value) > 0 ? Number(value) : 4 / 3;
}

function photoKey(target) {
  const key = String(target || '').toLowerCase();
  return key.includes('moon') ? 'moon' : key.includes('sun') ? 'sun' : key.includes('jupiter') ? 'jupiter' : key.includes('saturn') ? 'saturn' : key.includes('venus') ? 'venus' : null;
}
function requestPhoto(key, canvas, state) {
  if (typeof Image === 'undefined' || !PHOTO_CROPS[key]) return null;
  let entry = photoCache.get(key);
  if (!entry) {
    const image = new Image();
    entry = { image, status: 'loading' };
    photoCache.set(key, entry);
    image.onload = () => {
      entry.status = 'loaded';
      const current = latestStates.get(canvas);
      if (current) drawOptics(canvas, current);
    };
    image.onerror = () => { entry.status = 'error'; };
    image.src = PHOTO_CROPS[key].src;
  }
  return entry.status === 'loaded' ? entry.image : null;
}

function setup(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || canvas.clientWidth || 720);
  const height = Math.max(1, rect.height || canvas.clientHeight || 480);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  return { ctx, width, height };
}

function line(ctx, a, b, color = COLORS.grid, width = 1, dash = []) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
}
function text(ctx, message, x, y, color = COLORS.text, size = 12, align = 'left', baseline = 'middle') {
  ctx.save(); ctx.fillStyle = color; ctx.font = `${size}px Inter, ui-sans-serif, Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(String(message), x, y); ctx.restore();
}
function arrow(ctx, a, b, color, width = 2) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length, size = 7;
  line(ctx, a, b, color, width);
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - ux * size - uy * size * .55, b[1] - uy * size + ux * size * .55);
  ctx.lineTo(b[0] - ux * size + uy * size * .55, b[1] - uy * size - ux * size * .55);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function axis(ctx, a, b) { line(ctx, a, b, COLORS.grid, 1, [5, 5]); }
function drawCurvedLens(ctx, x, cy, halfHeight, halfThickness, converging, labels = true) {
  // Make the silhouette read as a lens at a glance: convex glass is narrow at
  // the rim and thick at the center; concave glass reverses those widths.
  const edge = converging ? Math.max(3, halfThickness * .22) : Math.max(halfThickness, 22);
  const center = converging ? Math.max(halfThickness * 1.45, 22) : Math.max(6, halfThickness * .35);
  const leftEdge = x - edge, rightEdge = x + edge;
  const leftCenter = x - center, rightCenter = x + center;
  ctx.save();
  ctx.fillStyle = COLORS.glass; ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftEdge, cy - halfHeight);
  ctx.bezierCurveTo(leftCenter, cy - halfHeight * .66,
    leftCenter, cy + halfHeight * .66, leftEdge, cy + halfHeight);
  ctx.lineTo(rightEdge, cy + halfHeight);
  ctx.bezierCurveTo(rightCenter, cy + halfHeight * .66,
    rightCenter, cy - halfHeight * .66, rightEdge, cy - halfHeight);
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  if (labels) text(ctx, converging ? 'curved converging lens' : 'curved diverging lens', x, cy + halfHeight + 20, COLORS.cyan, 11, 'center');
}

function drawRay(ctx, x0, y0, x1, y1, color, dashed = false, arrowAtEnd = true) {
  if (dashed) line(ctx, [x0, y0], [x1, y1], color, 1.25, [5, 5]);
  else if (arrowAtEnd) arrow(ctx, [x0, y0], [x1, y1], color, 2);
  else line(ctx, [x0, y0], [x1, y1], color, 2);
}

function renderRay(ctx, width, height, state) {
  const r = state.ray || {};
  const f = val(r.f, .676), p = Math.max(EPS, val(r.p, 1.5)), h = val(r.h, .24);
  const result = thinLens(f, p);
  const q = result.valid ? result.q : Infinity;
  const m = result.valid ? result.magnification : NaN;
  const finiteQ = finite(q);
  const absF = Math.abs(f);
  const incidentFocus = -f;
  const yThird = result.atInfinity ? null : -h * f / (p - f);
  const imageWindow = 6;
  const physicalMin = Math.min(-p, -absF, finiteQ && q < -EPS && Math.abs(q) <= imageWindow ? q : -2.0) - .18;
  const physicalMax = Math.max(absF, finiteQ && q > EPS && q <= imageWindow ? q : 2.4, 1.6) + .18;
  const span = Math.max(physicalMax - physicalMin, 3.2);
  const lensHalfHeight = Math.max(.62, Math.min(1.05, Math.max(Math.abs(h)*1.2, yThird===null?0:Math.abs(yThird)*1.15)));
  const imageFits = finiteQ && Math.abs(q)<=imageWindow && Math.abs(m*h)<=2.5;
  const verticalExtent=Math.max(lensHalfHeight,Math.abs(h),imageFits?Math.abs(m*h):0);
  const scale = Math.min((width - 90) / span, (height - 160) / (2*verticalExtent));
  const xLeft = (width-span*scale)/2, cy = (height-100)/2;
  const mapX = x => xLeft + (x - physicalMin) * scale;
  const mapY = y => cy - y * scale;
  const lensX = mapX(0), objectX = mapX(-p), objectTip = [objectX, mapY(h)];
  const xStart = (24-lensX)/scale;
  const xEnd = (width-24-lensX)/scale;
  const thirdVisible = yThird !== null && Math.abs(yThird) <= lensHalfHeight;
  const lensPxHalf = lensHalfHeight * scale;

  let status='';
  ctx.save();ctx.beginPath();ctx.rect(18,12,width-36,height-108);ctx.clip();
  axis(ctx, [mapX(xStart), cy], [mapX(xEnd), cy]);
  const labels = r.labels !== false;
  drawCurvedLens(ctx, lensX, cy, lensPxHalf, Math.max(9, Math.min(18, scale * .10)), f > 0, labels);
  if (r.foci !== false) {
    for (const fx of [-absF, absF]) {
      const px = mapX(fx); ctx.fillStyle = COLORS.amber; ctx.beginPath(); ctx.arc(px, cy, 4, 0, Math.PI * 2); ctx.fill();
      if (labels) text(ctx, fx < 0 ? 'F' : 'F′', px, cy + 16, COLORS.amber, 11, 'center');
    }
  }
  arrow(ctx, [objectX, mapY(0)], objectTip, COLORS.magenta, 2.5);
  if (labels) text(ctx, 'object', objectX, objectTip[1] - 15, COLORS.magenta, 11, 'center');
  const right = mapX(xEnd);
  // Parallel ray: horizontal before lens, then transformed slope m_out = -y/f.
  const yParallel = h;
  const outParallelSlope = -yParallel / f;
  drawRay(ctx, objectX, mapY(h), lensX, mapY(h), COLORS.amber, false, false);
  drawRay(ctx, lensX, mapY(h), right, mapY(h + outParallelSlope * xEnd), COLORS.amber);
  // Center ray keeps its incident slope through the thin-lens center.
  const centerSlope = -h / p;
  drawRay(ctx, objectX, mapY(h), lensX, cy, COLORS.purple, false, false);
  drawRay(ctx, lensX, cy, right, mapY(centerSlope * xEnd), COLORS.purple);
  // Focal ray is aimed at the front focal point; at p=f it is replaced by a
  // clean representative ray because the focal construction is undefined.
  if (yThird === null || !thirdVisible) {
    status=yThird===null?'p = f: outgoing rays are parallel.':'Third ray falls outside the drawn lens aperture.';
  } else {
    const focalSlope = -h / (p - f);
    const lensY = h + focalSlope * p;
    drawRay(ctx, objectX, mapY(h), lensX, mapY(lensY), COLORS.green, false, false);
    drawRay(ctx, lensX, mapY(lensY), right, mapY(lensY), COLORS.green);
    // show the construction point only on the incident side if it is there;
    // for a diverging lens it lies to the right but remains a virtual target.
    const targetX = mapX(incidentFocus), targetY = cy;
    line(ctx, [lensX, mapY(lensY)], [targetX, targetY], COLORS.green, 1, [4, 5]);
  }
  // Virtual images are backwards extensions of actual outgoing rays.
  if (imageFits && q >= xStart && q < 0) {
    const imageX = mapX(q), imageY = mapY(m * h);
    for (const rayY of [h, 0]) {
      line(ctx, [imageX, imageY], [lensX, mapY(rayY)], rayY === h ? COLORS.amber : COLORS.purple, 1, [5, 5]);
    }
    arrow(ctx, [imageX, mapY(0)], [imageX, imageY], COLORS.purple, 2);
    if (labels) text(ctx, 'virtual image', imageX, imageY - 16, COLORS.purple, 11, 'center');
  } else if (imageFits && q > 0 && q < xEnd) {
    const imageX = mapX(q), imageY = mapY(m * h);
    arrow(ctx, [imageX, mapY(0)], [imageX, imageY], COLORS.green, 2);
    if (labels) text(ctx, 'real image', imageX, imageY + (m < 0 ? 16 : -16), COLORS.green, 11, 'center');
  }
  ctx.restore();
  if(finiteQ&&!imageFits)status='Finite image is outside this view; see q below.';
  if(!finiteQ)status='p = f: parallel outgoing rays; image at infinity.';
  if(status)text(ctx,status,width/2,height-74,COLORS.amber,width<500?10:12,'center');
  text(ctx, `f = ${f.toFixed(3)} m`, 18, height - 46, COLORS.cyan, 12);
  text(ctx, finiteQ ? `q = ${q.toFixed(3)} m   m = ${m.toFixed(3)}` : 'q = ∞', width - 18, height - 46, finiteQ ? COLORS.green : COLORS.amber, 12, 'right');
  return { cx: lensX, cy, scale, objectX, objectY: objectTip[1], kind: 'ray', xToPhysical: x => (x - lensX) / scale };
}

function surfaceSag(radius, y) {
  if (radius === null || !finite(radius) || Math.abs(radius) < EPS) return 0;
  const R = Number(radius), a = Math.abs(y);
  return R - Math.sign(R) * Math.sqrt(Math.max(0, R * R - a * a));
}
function drawMakerSurface(ctx, xVertex, radius, cy, yTop, yBottom, scale, label, color) {
  const samples = 32; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const y = yTop + (yBottom - yTop) * i / samples;
    const x = xVertex + surfaceSag(radius, (cy - y) / scale) * scale;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.restore();
  text(ctx, label, xVertex, yTop - 15, color, 11, 'center');
}
function renderMaker(ctx, width, height, state) {
  const m = state.maker || {};
  const n = val(m.n, 1.5), R1 = m.R1 === null ? null : val(m.R1, .25), R2 = m.R2 === null ? null : val(m.R2, -.25);
  const D = Math.max(.01, val(m.D, .12)), halfAperture = Math.min(D / 2, ...[R1, R2].filter(v => v !== null && finite(v) && Math.abs(v) > EPS).map(v => .9 * Math.abs(v)));
  const maker = lensMaker(n, R1, R2, m.advanced ? val(m.medium, 1) : 1);
  const f = maker.f;
  const cx = width * .46, cy = height * .56, scale = Math.min((width - 170) / Math.max(D * 2.3, .28), (height - 160) / Math.max(D * 2.5, .4));
  const a = halfAperture * scale, sag1 = surfaceSag(R1, halfAperture), sag2 = surfaceSag(R2, halfAperture);
  const thickness = Math.max(.06 * D, sag1 - sag2 + .12 * D), v1 = cx - thickness * scale / 2, v2 = cx + thickness * scale / 2;
  axis(ctx, [32, cy], [width - 32, cy]); text(ctx, 'light →', 42, cy - a - 24, COLORS.amber, 12);
  ctx.save(); ctx.fillStyle = COLORS.glass; ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const y = -halfAperture + 2 * halfAperture * i / 40; const x = v1 + surfaceSag(R1, y) * scale; if (i === 0) ctx.moveTo(x, cy - y * scale); else ctx.lineTo(x, cy - y * scale); }
  for (let i = 40; i >= 0; i--) { const y = -halfAperture + 2 * halfAperture * i / 40; const x = v2 + surfaceSag(R2, y) * scale; ctx.lineTo(x, cy - y * scale); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  drawMakerSurface(ctx, v1, R1, cy, cy - a, cy + a, scale, 'R₁', COLORS.cyan);
  drawMakerSurface(ctx, v2, R2, cy, cy - a, cy + a, scale, 'R₂', COLORS.cyan);
  // Centers of curvature are drawn as small, inset markers with signed labels.
  for (const [R, vertex, label] of [[R1, v1, 'C₁'], [R2, v2, 'C₂']]) {
    if (R === null || !finite(R)) { text(ctx, `${label}: plane`, vertex, cy + a + 18, COLORS.muted, 10, 'center'); continue; }
    const cp = vertex + R * scale; line(ctx, [vertex, cy], [cp, cy], COLORS.muted, 1, [3, 4]);
    ctx.fillStyle = COLORS.amber; ctx.beginPath(); ctx.arc(cp, cy, 4, 0, Math.PI * 2); ctx.fill();
    text(ctx, `${label} = ${R > 0 ? '+' : ''}${R.toFixed(2)} m`, cp, cy + 17, COLORS.amber, 10, 'center');
  }
  const rays = [-.65, 0, .65].map(frac => cy + frac * a);
  if (finite(f) && Math.abs(f) < 1e5) {
    const fx = v2 + f * scale;
    for (const y of rays) {
      const localY = (cy - y) / scale;
      const entranceX = v1 + surfaceSag(R1, localY) * scale;
      const exitX = v2 + surfaceSag(R2, localY) * scale;
      line(ctx, [32, y], [entranceX, y], COLORS.amber, 1.5);
      line(ctx, [entranceX, y], [exitX, y], COLORS.amber, 1.5);
      const slopePx = -(y - cy) / (fx - exitX);
      arrow(ctx, [exitX, y], [width - 34, y + slopePx * (width - 34 - exitX)], COLORS.amber, 1.5);
    }
    if (fx > 34 && fx < width - 34) { ctx.fillStyle = f > 0 ? COLORS.green : COLORS.coral; ctx.beginPath(); ctx.arc(fx, cy, 5, 0, Math.PI * 2); ctx.fill(); text(ctx, `f = ${f.toFixed(3)} m`, fx, cy - 19, f > 0 ? COLORS.green : COLORS.coral, 12, 'center'); }
    else text(ctx, `f = ${f.toFixed(3)} m (off screen)`, width - 18, height - 46, f > 0 ? COLORS.green : COLORS.coral, 12, 'right');
  } else {
    for (const y of rays) arrow(ctx, [32, y], [width - 34, y], COLORS.amber, 1.5);
    text(ctx, 'afocal: parallel rays remain parallel', width / 2, height - 46, COLORS.amber, 12, 'center');
  }
  text(ctx, `aperture D = ${(2 * halfAperture).toFixed(3)} m`, 18, height - 46, COLORS.cyan, 12);
  return { cx, cy, scale, objectX: v1, objectY: cy, kind: 'maker' };
}

function drawDetectorInset(ctx, width, height, state, image, lowerTop, title) {
  const p = state.plate || {};
  const detectorW = Math.max(EPS, val(p.width, 24)), pixel = Math.max(EPS, val(p.pixel, 4.8));
  const aspect = parseAspect(p.aspect), lowerBottom = height - 12;
  const regionWidth = Math.max(40, width - 64), regionHeight = Math.max(40, lowerBottom - lowerTop);
  const iw = Math.min(regionWidth, regionHeight * aspect), ih = iw / aspect;
  const ix = (width - iw) / 2, iy = lowerTop + (regionHeight - ih) / 2;
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(ix, iy, iw, ih); ctx.strokeStyle = COLORS.purple; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, iw, ih); ctx.restore();
  const detail = p.target === '1 arcsecond', displayedWidth = detail ? .06 : detectorW;
  text(ctx, title, ix, iy - 17, COLORS.purple, 12);
  const markY = iy + ih / 2, imageFrac = image.valid && finite(image.exact) ? image.exact / displayedWidth : 0;
  const actualSpan = Math.abs(imageFrac) * iw, halfSpan = actualSpan / 2;
  const key = photoKey(p.target), spec = key ? PHOTO_CROPS[key] : null;
  const photo = key ? requestPhoto(key, state.__canvas || null, state) : null;
  const photoSpan = spec ? actualSpan * (spec.rect[2] / (spec.physicalWidth || spec.rect[2])) : actualSpan;
  const photoHeight = spec ? photoSpan * spec.rect[3] / spec.rect[2] : actualSpan;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  if (photo && actualSpan >= 4) {
    const [sx, sy, sw, sh] = spec.rect;
    ctx.drawImage(photo, sx, sy, sw, sh, ix + iw / 2 - photoSpan / 2, markY - photoHeight / 2, photoSpan, photoHeight);
  } else {
    ctx.fillStyle = 'rgba(86,220,114,.22)'; ctx.strokeStyle = COLORS.green; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ix + iw / 2, markY, halfSpan, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  const nominalPitchPx = iw * .0048 / displayedWidth;
  const gridGroup = detail ? 1 : niceGridGroup(12 / Math.max(nominalPitchPx, EPS));
  const gridCellPx = iw * (pixel / 1000) / displayedWidth * gridGroup;
  if (p.grid !== false) {
    for (let x = gridCellPx; x < iw; x += gridCellPx) line(ctx, [ix + x, iy], [ix + x, iy + ih], '#a99bff44', 1);
    for (let y = gridCellPx; y < ih; y += gridCellPx) line(ctx, [ix, iy + y], [ix + iw, iy + y], '#a99bff44', 1);
    text(ctx, detail ? '1 pixel / grid cell' : `${gridGroup.toLocaleString()} pixels / grid cell`, ix + iw - 5, iy + 12, COLORS.muted, 10, 'right');
  }
  const detectorHeight = detectorW / aspect;
  const physicalPhotoWidth = image.exact * (spec ? spec.rect[2] / (spec.physicalWidth || spec.rect[2]) : 1);
  const physicalPhotoHeight = physicalPhotoWidth * (spec ? spec.rect[3] / spec.rect[2] : 1);
  const fitsDetector = physicalPhotoWidth <= detectorW && physicalPhotoHeight <= detectorHeight;
  const detailClipped = photoSpan > iw || photoHeight > ih;
  const infoX = ix + iw / 2, infoY = Math.min(height - 35, iy + ih + 14);
  const sizeLabel = image.exact < .1 ? `${(image.exact * 1000).toFixed(3)} µm` : `${image.exact.toFixed(3)} mm`;
  text(ctx, `${p.target || 'Target'} · ${sizeLabel}`, infoX, infoY, COLORS.green, 11, 'center');
  const fitText = detail ? (detailClipped ? 'detail clipped to view' : 'detail fits view') : (fitsDetector ? 'Fits detector' : 'Wider/taller than detector');
  text(ctx, `${fitText} · ${detectorW.toFixed(1)}×${detectorHeight.toFixed(1)} mm · ${pixel.toFixed(1)} µm px`, infoX, infoY + 17, fitsDetector && (!detail || !detailClipped) ? COLORS.muted : COLORS.coral, 10, 'center');
  return { detectorDisplayedWidth: displayedWidth, detectorPixelWidth: iw, detectorPixelHeight: ih, detectorPhysicalHeight: detectorHeight, targetSpan: actualSpan, targetHeight: photoHeight, fitsDetector, detailClipped, gridCellPx, gridGroup };
}

function renderRealPlate(ctx, width, height, state) {
  const p = state.plate || {};
  const f = Math.max(EPS, val(p.f, 2032)), D = Math.max(EPS, val(p.D, 203.2));
  const theta = angleToRadians(val(p.angle, .5), p.unit || 'deg') || 0;
  const image = focalImageSize(f, theta);
  const camera = p.camera || {};
  const zoom = clamp(val(camera.zoom, 1), .05, 20);
  const scale = .35 * zoom;
  const x0 = 42, y0 = height * .20;
  const detectorW = Math.max(EPS, val(p.width, 24)), aspect = parseAspect(p.aspect);
  const detectorHeight = detectorW / aspect;
  const panX = val(camera.panX, 0);
  // Keep the optical axis at the same vertical anchor as fit mode. Real-mode
  // navigation is horizontal; vertical panning would move the teaching axis.
  const panY = 0;
  const targetFocusX = width * .78;
  const autoPanX = Math.min(0, targetFocusX - x0 - f * scale);
  const totalPanX = autoPanX + panX;
  const sx = worldX => x0 + totalPanX + worldX * scale;
  const sy = worldY => y0 + panY + worldY * scale;
  const screenToWorld = (x, y) => ({ x: (x - x0 - totalPanX) / scale, y: (y - y0 - panY) / scale });
  const xFocus = sx(f), aperturePx = D * scale / 2, imagePx = image.exact * scale;
  const visibleMin = (-x0 - totalPanX) / scale, visibleMax = (width - x0 - totalPanX) / scale;
  const rulerStep = niceRulerStep((visibleMax - visibleMin) * 70 / Math.max(width - 48, 1));
  const rulerTicks = [];
  axis(ctx, [0, sy(0)], [width, sy(0)]);
  line(ctx, [sx(0), sy(-D / 2)], [sx(0), sy(D / 2)], COLORS.cyan, 3);
  line(ctx, [sx(0), sy(-D / 2)], [xFocus, sy(0)], COLORS.amber, 2);
  line(ctx, [sx(0), sy(D / 2)], [xFocus, sy(0)], COLORS.amber, 2);
  line(ctx, [sx(0), sy(0)], [xFocus, sy(image.exact)], COLORS.green, 2);
  text(ctx, `real scale · ${scale.toFixed(2)} px/mm`, 18, 18, COLORS.muted, width < 500 ? 10 : 12);
  text(ctx, `D = ${D.toFixed(1)} mm`, sx(0) + 8, sy(-D / 2) - 15, COLORS.cyan, 11);
  text(ctx, `f = ${f.toFixed(0)} mm`, sx(0) + 10, sy(D / 2) + 18, COLORS.amber, 11);
  text(ctx, `θ = ${val(p.angle, .5)} ${p.unit || 'deg'}`, sx(0) + 10, sy(-D / 2) + 17, COLORS.green, 11);
  const first = Math.floor(visibleMin / rulerStep) * rulerStep;
  for (let distance = first; distance <= visibleMax + rulerStep * .1; distance += rulerStep / 5) {
    const x = sx(distance);
    if (x < 18 || x > width - 18) continue;
    const major = Math.abs(distance / rulerStep - Math.round(distance / rulerStep)) < 1e-7;
    line(ctx, [x, sy(0) - (major ? 7 : 4)], [x, sy(0) + (major ? 7 : 4)], major ? COLORS.amber : COLORS.muted, major ? 1.2 : 1);
    const label = major ? rulerLabel(distance) : '';
    if (major) text(ctx, label, x, sy(0) + 17, COLORS.muted, 9, 'center');
    rulerTicks.push({ distance, x, major, label });
  }
  if (xFocus > 18 && xFocus < width - 18) {
    line(ctx, [xFocus, 20], [xFocus, height - 20], COLORS.purple, 1, [5, 5]);
    line(ctx, [xFocus, sy(-detectorHeight / 2)], [xFocus, sy(detectorHeight / 2)], COLORS.purple, 3);
    const sensorTop = sy(-detectorHeight / 2), sensorBottom = sy(detectorHeight / 2);
    line(ctx, [xFocus - 5, sensorTop], [xFocus + 5, sensorTop], COLORS.purple, 3);
    line(ctx, [xFocus - 5, sensorBottom], [xFocus + 5, sensorBottom], COLORS.purple, 3);
    const calloutRight = xFocus < width - 180, calloutX = calloutRight ? xFocus + 14 : xFocus - 14;
    const calloutAlign = calloutRight ? 'left' : 'right';
    line(ctx, [xFocus, (sensorTop + sensorBottom) / 2], [calloutRight ? calloutX - 5 : calloutX + 5, y0 - 24], COLORS.purple, 1);
    text(ctx, `sensor: ${detectorW.toFixed(1)} × ${detectorHeight.toFixed(1)} mm`, calloutX, y0 - 30, COLORS.purple, 10, calloutAlign);
    text(ctx, 'enlarged below', calloutX, y0 - 16, COLORS.muted, 10, calloutAlign);
  } else {
    text(ctx, `focus at ${f.toFixed(0)} mm (off screen)`, width - 18, height - 24, COLORS.purple, 11, 'right');
  }
  const detectorTop = height * .55;
  text(ctx, 'Enlarged detector view; upper diagram stays at real scale.', width / 2, detectorTop - 28, COLORS.muted, 10, 'center');
  const detector = drawDetectorInset(ctx, width, height, state, image, detectorTop, 'Detector inset · enlarged separately');
  return {
    cx: xFocus, cy: sy(0), scale, scaleX: scale, scaleY: scale,
    aperturePx, imagePx, chiefSlope: image.exact / f, visibleSpan: visibleMax - visibleMin, ...detector,
    rulerTicks, rulerMajor: rulerStep, objectX: sx(0), objectY: sy(0), kind: 'plate', scaleMode: 'real',
    realCamera: { baseScale: .35, scale, zoom, panX, panY, autoPanX, totalPanX, targetFocusX, focusScreenX: xFocus, sensorSegmentPx: detectorHeight * scale, x0, y0,
      worldToScreen: { x: sx, y: sy }, screenToWorld },
  };
}

function renderPlate(ctx, width, height, state) {
  const p = state.plate || {}, f = Math.max(EPS, val(p.f, 2032)), D = Math.max(EPS, val(p.D, 203.2));
  if (p.scaleMode === 'real') return renderRealPlate(ctx, width, height, state);
  const theta = angleToRadians(val(p.angle, .5), p.unit || 'deg') || 0;
  const image = focalImageSize(f, theta);
  const detectorW = Math.max(EPS, val(p.width, 24)), pixel = Math.max(EPS, val(p.pixel, 4.8));
  const fitAspect = parseAspect(p.aspect), fitDetectorHeight = detectorW / fitAspect;
  const x0 = 42;
  const coneRight = width - 48;
  const y0 = height * .20;
  const physicalLength = f, physicalHalfD = D / 2;
  // Keep the focus proportional through the normal range, then ease it toward
  // the right edge continuously. This avoids a visible snap when f crosses a
  // power-of-two threshold while keeping very long focal lengths on screen.
  const focusFraction = f <= 160 ? f / 200 : .8 + .15 * (f - 160) / (f - 130);
  const horizontalBound = f / Math.max(focusFraction, EPS);
  const scale = Math.min((coneRight - x0) / horizontalBound, (height * .14) / Math.max(physicalHalfD, Math.abs(image.exact), EPS));
  const visibleSpan = (coneRight - x0) / scale;
  const horizontalZoom = visibleSpan / 200;
  const scaleX = scale, scaleY = scale;
  const xFocus = x0 + physicalLength * scale;
  const aperturePx = physicalHalfD * scale, imagePx = image.exact * scale;
  text(ctx,`Horizontal span: ${visibleSpan.toFixed(0)} mm · equal x/y scales`,18,18,COLORS.muted,width<500?10:12);
  axis(ctx, [x0, y0], [coneRight, y0]);
  const ruler = drawAxisRuler(ctx, x0, y0, scaleX, visibleSpan, width);
  line(ctx, [x0, y0 - aperturePx], [x0, y0 + aperturePx], COLORS.cyan, 3);
  text(ctx, `objective D = ${D.toFixed(1)} mm`, x0, y0 + Math.max(aperturePx + 18, 35), COLORS.cyan, 11);
  const top = [x0, y0 - aperturePx], bottom = [x0, y0 + aperturePx], focus = [xFocus, y0];
  line(ctx, top, focus, COLORS.amber, 2); line(ctx, bottom, focus, COLORS.amber, 2);
  arrow(ctx, [x0 - 25, y0 - aperturePx - 30], [x0 + 18, y0 - aperturePx - 30], COLORS.amber, 1.5);
  text(ctx, `f = ${f.toFixed(0)} mm`, (x0+xFocus)/2, y0 + Math.max(aperturePx + 36, 53), COLORS.amber, 11, 'center');
  // Keep the chief-ray endpoint visible on the focal-plane marker even when
  // the angle is large; the aperture-sized cap keeps the marker readable.
  line(ctx, [xFocus, 20], [xFocus, height - 80], COLORS.purple, 1, [5, 5]);
  const planeHalf = Math.max(12, Math.abs(imagePx) + 8, Math.min(aperturePx * .88, 34));
  line(ctx, [xFocus, y0 - planeHalf], [xFocus, y0 + planeHalf], COLORS.purple, 3);
  text(ctx, `sensor at focal plane · ${detectorW.toFixed(1)}×${fitDetectorHeight.toFixed(1)} mm (enlarged below)`, xFocus, y0 + Math.max(aperturePx + 54, 71), COLORS.purple, 10, 'right');
  line(ctx, [x0, y0], [xFocus, y0 + imagePx], COLORS.green, 2);
  text(ctx, `θ = ${val(p.angle, .5)} ${p.unit || 'deg'}`, x0 + 10, y0 - aperturePx - 18, COLORS.green, 11);
  // The detector is below the telescope cone. Its horizontal scale is detectorW,
  // so the target is visibly clipped when it exceeds the sensor.
  const aspect = fitAspect;
  const lowerTop = Math.max(height * .40, y0 + aperturePx + 90), lowerBottom = height - 68;
  const regionWidth = Math.max(40, width - 64), regionHeight = Math.max(40, lowerBottom - lowerTop);
  const iw = Math.min(regionWidth, regionHeight * aspect), ih = iw / aspect;
  const ix = (width - iw) / 2, iy = lowerTop + (regionHeight - ih) / 2;
  ctx.save(); ctx.fillStyle='#000';ctx.fillRect(ix,iy,iw,ih);ctx.strokeStyle = COLORS.purple; ctx.lineWidth = 2; ctx.strokeRect(ix, iy, iw, ih); ctx.restore();
  const detail=p.target==='1 arcsecond';
  const displayedWidth=detail?.06:detectorW;
  text(ctx, detail?'Detector detail · 60 µm wide':'detector inset', ix, iy - 17, COLORS.purple, 12);
  const markY = iy + ih / 2, imageFrac = image.valid && finite(image.exact) ? image.exact / displayedWidth : 0;
  const actualSpan = Math.abs(imageFrac) * iw, halfSpan = actualSpan / 2;
  const key = photoKey(p.target), spec = key ? PHOTO_CROPS[key] : null;
  const photo = key ? requestPhoto(key, state.__canvas || null, state) : null;
  const photoSpan = spec ? actualSpan * (spec.rect[2] / (spec.physicalWidth || spec.rect[2])) : actualSpan;
  const photoHeight = spec ? photoSpan * spec.rect[3] / spec.rect[2] : actualSpan;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  if (photo && actualSpan >= 4) {
    const [sx, sy, sw, sh] = PHOTO_CROPS[key].rect;
    ctx.drawImage(photo, sx, sy, sw, sh, ix + iw / 2 - photoSpan / 2, markY - photoHeight / 2, photoSpan, photoHeight);
  } else {
    ctx.fillStyle = 'rgba(86,220,114,.22)'; ctx.strokeStyle = COLORS.green; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ix + iw / 2, markY, halfSpan, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  const pixelsAcross = displayedWidth / (pixel / 1000);
  const nominalPitchPx = iw * .0048 / displayedWidth;
  const gridGroup = detail ? 1 : niceGridGroup(12 / Math.max(nominalPitchPx, EPS));
  const gridCellPx = iw * (pixel / 1000) / displayedWidth * gridGroup;
  if (p.grid !== false) {
    for (let x = gridCellPx; x < iw; x += gridCellPx) line(ctx, [ix + x, iy], [ix + x, iy + ih], '#a99bff44', 1);
    const rowStep = gridCellPx;
    for (let y = rowStep; y < ih; y += rowStep) line(ctx, [ix, iy + y], [ix + iw, iy + y], '#a99bff44', 1);
    text(ctx, detail ? '1 pixel / grid cell' : `${gridGroup.toLocaleString()} pixels / grid cell`, ix + iw - 5, iy + 12, COLORS.muted, 10, 'right');
  }
  const detectorHeight = fitDetectorHeight;
  const physicalPhotoWidth = image.exact * (spec ? spec.rect[2] / (spec.physicalWidth || spec.rect[2]) : 1);
  const physicalPhotoHeight = physicalPhotoWidth * (spec ? spec.rect[3] / spec.rect[2] : 1);
  const fitsDetector = physicalPhotoWidth <= detectorW && physicalPhotoHeight <= detectorHeight;
  const detailClipped = photoSpan > iw || photoHeight > ih;
  const infoX = ix + iw / 2, infoY = Math.min(height - 42, iy + ih + 14);
  const sizeLabel=image.exact<.1?`${(image.exact*1000).toFixed(3)} µm`:`${image.exact.toFixed(3)} mm`;
  text(ctx, `${p.target || 'Target'} · ${sizeLabel}`, infoX, infoY, COLORS.green, 11, 'center');
  const fitText = detail ? (detailClipped ? 'detail clipped to view' : 'detail fits view') : (fitsDetector ? 'Fits detector' : 'Wider/taller than detector');
  text(ctx, `${fitText} · ${detectorW.toFixed(1)}×${detectorHeight.toFixed(1)} mm · ${pixel.toFixed(1)} µm px`, infoX, infoY+17, fitsDetector && (!detail || !detailClipped) ? COLORS.muted : COLORS.coral, 10, 'center');
  return { cx: xFocus, cy: y0, scale, scaleX, scaleY, horizontalZoom, visibleSpan, aperturePx, imagePx, chiefSlope: image.exact / f, rulerTicks:ruler.ticks, rulerMajor:ruler.major, detectorDisplayedWidth:displayedWidth, detectorPixelWidth:iw, detectorPixelHeight:ih, detectorPhysicalHeight:detectorHeight, targetSpan:actualSpan, targetHeight:photoHeight, fitsDetector, detailClipped, gridCellPx, gridGroup, objectX: x0, objectY: y0, kind: 'plate' };
}

/** Draw one optics tab and return CSS-pixel anchors used by the parent for drag. */
export function drawOptics(canvas, state) {
  const { ctx, width, height } = setup(canvas);
  latestStates.set(canvas, state || {});
  const tab = state && state.tab || 'ray';
  if (tab === 'maker') return renderMaker(ctx, width, height, state || {});
  if (tab === 'plate') return renderPlate(ctx, width, height, { ...(state || {}), __canvas: canvas });
  return renderRay(ctx, width, height, state || {});
}
