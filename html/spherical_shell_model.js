// Lengths in R, forces in GMm/R²; positive axial force points along -x.
export function fullForce(r) {
  return r === 1 ? NaN : r < 1 ? 0 : 1 / (r * r);
}

// Exact integral of ringDensity(r, angle) from angle = 0 to theta.
export function accumulatedForce(r, theta) {
  if (r === 1) return NaN;
  if (theta <= 0) return 0;
  if (theta >= Math.PI) return fullForce(r);
  const sin = Math.sin(theta), cos = Math.cos(theta);
  const s = Math.hypot(r - cos, sin);
  const a = 1 - r * cos;
  // Rationalized forms avoid cancellation near the center and near theta = 0.
  if (r < 1) return -(sin * sin) / (2 * s * (a + s));
  if (a < 0) return sin * sin / (2 * s * (s - a));
  return (a + s) / (2 * r * r * s);
}

export function ringDensity(r, theta) {
  if (r === 1) return NaN;
  const sin = Math.sin(theta), cos = Math.cos(theta);
  const s = Math.hypot(r - cos, sin);
  return 0.5 * sin * (r - cos) / (s * s * s);
}

// Keep the original ring labels when moving every mass element to the center.
// dm/M = (sin(theta)/2) dtheta, and each unit of mass now pulls with Gm/r².
export function pointRingDensity(r, theta) {
  return r === 0 ? NaN : 0.5 * Math.sin(theta) / (r * r);
}

export function pointAccumulatedForce(r, theta) {
  if (r === 0) return NaN;
  return (1 - Math.cos(theta)) / (2 * r * r);
}
