/*
 * Browser-independent geometric optics calculations.
 *
 * Distances are in the units supplied by the caller.  In particular, f and p
 * must use the same units in thinLens, while plateScale/pixelScale expect
 * focal length in millimetres.
 */

export const ARCSEC_PER_RAD = 206264.80624709636;

const EPSILON = 1e-12;

function finite(value) {
  return Number.isFinite(Number(value));
}

function invalid(reason) {
  return { valid: false, reason, f: null, p: null, q: null, magnification: null };
}

/**
 * Thin-lens equation: 1/f = 1/p + 1/q.
 *
 * Sign convention: f>0 converging, f<0 diverging; p>0 is a real object in
 * front of the lens; q>0 is a real image on the opposite side.  At p=f the
 * outgoing rays are parallel and q is represented by Infinity.
 */
export function thinLens(f, p, epsilon = EPSILON) {
  f = Number(f); p = Number(p); epsilon = Math.max(Number(epsilon) || EPSILON, EPSILON);
  if (!finite(f) || !finite(p) || f === 0) return invalid('f and p must be finite, with f non-zero');
  if (p <= 0) return invalid('p must be positive for a real object');

  const denominator = 1 / f - 1 / p;
  const scale = Math.max(Math.abs(1 / f), Math.abs(1 / p), 1);
  const atInfinity = Math.abs(denominator) <= epsilon * scale;
  const q = atInfinity ? Infinity : 1 / denominator;
  const magnification = atInfinity ? (denominator < 0 ? -Infinity : Infinity) : -q / p;
  const real = q > 0;
  const absMagnification = Math.abs(magnification);
  return {
    valid: true,
    f,
    p,
    q,
    magnification,
    m: magnification,
    atInfinity,
    imageType: atInfinity ? 'at infinity' : real ? 'real' : 'virtual',
    imageOrientation: atInfinity ? 'undefined' : magnification < 0 ? 'inverted' : 'upright',
    sizeClass: atInfinity ? 'unbounded' : absMagnification > 1 + epsilon ? 'enlarged'
      : absMagnification < 1 - epsilon ? 'reduced' : 'same size',
  };
}

function reciprocalRadius(radius) {
  // null and +/-Infinity both denote a plane surface.  A zero radius is not
  // a plane: it is an invalid physical input and must not be silently used.
  if (radius === null || radius === undefined || radius === Infinity || radius === -Infinity) return 0;
  const value = Number(radius);
  return Number.isFinite(value) && value !== 0 ? 1 / value : null;
}

/**
 * Lens-maker equation for light travelling left to right:
 * 1/f = (nLens/nMedium - 1) (1/R1 - 1/R2).
 * R is positive when the centre of curvature lies to the right of its surface.
 */
export function lensMaker(n, R1, R2, nMedium = 1) {
  n = Number(n); nMedium = Number(nMedium);
  const invR1 = reciprocalRadius(R1), invR2 = reciprocalRadius(R2);
  if (!finite(n) || !finite(nMedium) || nMedium <= 0 || n <= 0 || invR1 === null || invR2 === null) {
    return { valid: false, reason: 'indices and radii must be physical values', n, nMedium, R1, R2, power: null, f: null };
  }
  const indexFactor = n / nMedium - 1;
  const power = indexFactor * (invR1 - invR2);
  const f = Math.abs(power) <= EPSILON ? Infinity : 1 / power;
  return { valid: true, n, nMedium, R1, R2, invR1, invR2, indexFactor, power, reciprocalFocalLength: power, f,
    type: !Number.isFinite(f) ? 'afocal' : f > 0 ? 'converging' : 'diverging' };
}

export function focalRatio(f, aperture) {
  f = Number(f); aperture = Number(aperture);
  return finite(f) && finite(aperture) && aperture > 0 ? f / aperture : null;
}

export function plateScale(fMm) {
  fMm = Number(fMm);
  return finite(fMm) && fMm !== 0 ? ARCSEC_PER_RAD / fMm : null;
}

export function pixelScale(fMm, pixelSizeUm) {
  fMm = Number(fMm); pixelSizeUm = Number(pixelSizeUm);
  return finite(fMm) && finite(pixelSizeUm) && fMm !== 0 && pixelSizeUm >= 0
    ? ARCSEC_PER_RAD * (pixelSizeUm / 1000) / fMm : null;
}

export function angleToRadians(angle, unit = 'rad') {
  angle = Number(angle);
  if (!finite(angle)) return null;
  const normalized = String(unit).toLowerCase().replace(/\s+/g, '');
  if (normalized === 'rad' || normalized === 'radian' || normalized === 'radians') return angle;
  if (normalized === 'deg' || normalized === 'degree' || normalized === 'degrees') return angle * Math.PI / 180;
  if (normalized === 'arcmin' || normalized === 'arcminute' || normalized === 'arcminutes') return angle * Math.PI / (180 * 60);
  if (normalized === 'arcsec' || normalized === 'arcsecond' || normalized === 'arcseconds') return angle * Math.PI / (180 * 3600);
  return null;
}

export function radiansToAngle(radians, unit = 'rad') {
  radians = Number(radians);
  if (!finite(radians)) return null;
  const normalized = String(unit).toLowerCase().replace(/\s+/g, '');
  if (normalized === 'rad' || normalized === 'radian' || normalized === 'radians') return radians;
  if (normalized === 'deg' || normalized === 'degree' || normalized === 'degrees') return radians * 180 / Math.PI;
  if (normalized === 'arcmin' || normalized === 'arcminute' || normalized === 'arcminutes') return radians * 180 * 60 / Math.PI;
  if (normalized === 'arcsec' || normalized === 'arcsecond' || normalized === 'arcseconds') return radians * 180 * 3600 / Math.PI;
  return null;
}

// Common aliases keep call sites readable without duplicating implementations.
export const degreesToRadians = angle => angleToRadians(angle, 'deg');
export const radiansToDegrees = angle => radiansToAngle(angle, 'deg');

/** Exact focal-plane separation and its small-angle approximation. */
export function focalImageSize(f, angle, unit = 'rad') {
  f = Number(f);
  const theta = angleToRadians(angle, unit);
  if (!finite(f) || theta === null) return { valid: false, exact: null, smallAngle: null, fractionalDifference: null, angleRad: null };
  const exact = f * Math.tan(theta);
  const smallAngle = f * theta;
  return { valid: true, exact, smallAngle, angleRad: theta,
    fractionalDifference: exact === 0 ? 0 : (exact - smallAngle) / exact };
}
